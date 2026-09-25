import { test, expect } from "@playwright/test";
import { registerPlayer } from "./auth-helpers";
import { startDance } from "../../functions/src/criminalDance/engine";
import type { Session } from "../../functions/src/shared/model";
test("Criminal Dance: responsive physical cards, private witness, atomic trade, paced animations and round reveal", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext({
      viewport: { width: 390, height: 740 },
      hasTouch: true,
    }),
    browser.newContext({ viewport: { width: 1280, height: 800 } }),
  ]);
  const [host, guest] = await Promise.all(contexts.map((c) => c.newPage())),
    errors: string[] = [];
  for (const p of [host, guest])
    p.on("pageerror", (e) => errors.push(e.message));
  const a = await registerPlayer(host, "舞會房主"),
    b = await registerPlayer(guest, "手機夥伴");
  const api = "http://127.0.0.1:5001/demo-boardgame/asia-east1";
  async function call(p: { idToken: string }, name: string, data: unknown) {
    const r = await fetch(`${api}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.idToken}`,
      },
      body: JSON.stringify({ data }),
    });
    const j = await r.json();
    expect(j.error).toBeUndefined();
    return j.result;
  }
  await host
    .locator(".game-card.criminal-dance")
    .getByRole("link", { name: "建立房間" })
    .click();
  await host.getByRole("button", { name: "建立房間", exact: true }).click();
  await expect(host).toHaveURL(/\/room\//);
  const code = host.url().split("/").at(-1)!;
  await call(b, "joinRoom", { code, nickname: "手機夥伴" });
  await guest.goto(`/room/${code}`);
  await expect(host.getByLabel("犯人在跳舞勝利目標")).toBeEnabled();
  await expect(guest.getByLabel("犯人在跳舞勝利目標")).toBeDisabled();
  const url = `http://127.0.0.1:9000/sessions/${code}.json?ns=demo-boardgame-default-rtdb`,
    admin = {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    };
  async function fixture(
    name: string,
    own: string[],
    other = ["CRIMINAL-0", "ALIBI-0"],
    count = 8,
  ) {
    const s = (await (await fetch(url, { headers: admin })).json()) as Session;
    s.public.status = "waiting";
    for (const p of Object.values(s.public.players)) p.ready = true;
    for (let i = 2; i < count; i++)
      s.public.players[`fixture${i}`] = {
        uid: `fixture${i}`,
        nickname: `舞客 ${i}`,
        ready: true,
        joinedAt: Date.now() + i,
      };
    startDance(s, `browser-${name}`, (v) => [...v]);
    const g = s.public.dance!;
    g.firstPlay = false;
    g.current = a.localId;
    for (const id of g.order) s.dancePrivate![id].hand = [];
    s.dancePrivate![a.localId].hand = own;
    s.dancePrivate![b.localId].hand = other;
    s.dancePrivate!.fixture2.hand = ["ORDINARY_PERSON-0"];
    for (const id of g.order)
      g.players[id].handCount = s.dancePrivate![id].hand.length;
    const r = await fetch(url, {
      method: "PUT",
      headers: admin,
      body: JSON.stringify(s),
    });
    expect(r.ok).toBe(true);
    await expect(host.locator(".cd-hand-card")).toHaveCount(own.length);
    await expect(host.locator(".cd-turn")).toContainText("輪到你");
  }
  async function play(name: string) {
    await host
      .getByRole("button", { name: `查看手牌：${name}`, exact: true })
      .click();
    await host.getByRole("button", { name: "打出此牌", exact: true }).click();
  }
  try {
    await fixture("layout", ["WITNESS-0", "DETECTIVE-0", "TRADE-0", "RUMOR-0"]);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 740 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
      { width: 740, height: 390 },
    ]) {
      await host.setViewportSize(viewport);
      await expect(host.locator(".cd-player")).toHaveCount(8);
      const seats = await host.locator(".cd-player").evaluateAll((nodes) =>
        nodes.map((node) => {
          const b = node.getBoundingClientRect();
          return {
            offset: Number((node as HTMLElement).dataset.seatOffset),
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
          };
        }),
      );
      const me = seats.find((s) => s.offset === 0)!;
      expect(seats.find((s) => s.offset === 1)!.x).toBeLessThan(me.x);
      expect(seats.find((s) => s.offset === 7)!.x).toBeGreaterThan(me.x);
      expect(seats.filter((s) => s.y < me.y - 10).length).toBe(7);
      for (let i = 0; i < seats.length; i++) {
        expect(seats[i].x).toBeGreaterThanOrEqual(0);
        expect(seats[i].x + seats[i].width).toBeLessThanOrEqual(
          viewport.width + 1,
        );
        for (let j = i + 1; j < seats.length; j++) {
          const a = seats[i],
            b = seats[j];
          const overlapX =
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY =
            Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          expect(
            overlapX <= 1 || overlapY <= 1,
            `Seats ${a.offset} and ${b.offset} overlap at ${viewport.width}x${viewport.height}`,
          ).toBe(true);
        }
      }
      await expect(
        host.getByRole("button", { name: "出牌紀錄", exact: true }),
      ).toBeInViewport();
      const d = await host.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
        vw: innerWidth,
        vh: innerHeight,
      }));
      expect(d.w).toBeLessThanOrEqual(d.vw + 1);
      expect(d.h).toBeLessThanOrEqual(d.vh + 2);
      await host.screenshot({
        path: `.tools/screenshots/criminal-dance-${viewport.width}x${viewport.height}.png`,
      });
    }
    await host.setViewportSize({ width: 390, height: 740 });
    await play("目擊者");
    await expect(
      host.getByRole("dialog", { name: "目擊者 · 選擇目標" }),
    ).toBeVisible();
    await host.getByRole("button", { name: /手機夥伴.*張牌/ }).click();
    await host.getByRole("button", { name: "確認目標", exact: true }).click();
    await expect(
      host.getByRole("button", { name: "查看對方手牌", exact: true }),
    ).toBeVisible();
    expect(await host.locator(".cd-witness-hand .cd-card").count()).toBe(0);
    await host
      .getByRole("button", { name: "查看對方手牌", exact: true })
      .click();
    await expect(host.locator(".cd-witness-hand .cd-card")).toHaveCount(2);
    await expect(
      guest.getByRole("dialog", { name: "目擊者 · 私人情報" }),
    ).toHaveCount(0);
    await host.getByRole("button", { name: "我記住了", exact: true }).click();
    await expect(host.getByRole("dialog")).toHaveCount(0);
    await host.reload();
    await expect(host.locator(".cd-game")).toBeVisible();
    await expect(host.locator(".cd-witness-hand")).toHaveCount(0);
    await fixture("trade", ["TRADE-0", "CRIMINAL-0"], ["ALIBI-0"]);
    await play("交易");
    await host.getByRole("button", { name: /手機夥伴.*張牌/ }).click();
    await host.getByRole("button", { name: "確認目標", exact: true }).click();
    await expect(guest.locator(".cd-turn")).toContainText("秘密選一張");
    await guest
      .getByRole("button", { name: "查看手牌：不在場證明", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "鎖定這張牌", exact: true })
      .click();
    await expect(guest.locator(".cd-turn")).toContainText("已鎖定");
    await guest.reload();
    await expect(guest.locator(".cd-turn")).toContainText("已鎖定");
    await expect(
      host.getByRole("button", { name: "查看手牌：犯人", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "查看手牌：犯人", exact: true })
      .click();
    await host.getByRole("button", { name: "鎖定這張牌", exact: true }).click();
    await expect(
      guest.getByRole("button", { name: "查看手牌：犯人", exact: true }),
    ).toBeVisible();
    await expect(host.locator(".cd-playback .cd-flying-card")).toHaveCount(2);
    await expect(host.locator(".cd-playback .cd-card-back")).toHaveCount(2);
    await host.screenshot({
      path: ".tools/screenshots/criminal-dance-trade.png",
    });
    await expect(
      host.getByRole("button", { name: "確認，繼續", exact: true }),
    ).toBeEnabled();
    await host.getByRole("button", { name: "確認，繼續", exact: true }).click();
    await fixture("rumor", ["RUMOR-0", "ALIBI-1"], ["CRIMINAL-0"]);
    await play("謠言");
    await expect(host.locator(".cd-playback .cd-flying-card")).toHaveCount(3);
    await expect(host.locator(".cd-playback .cd-card-back")).toHaveCount(3);
    await expect(
      host.getByRole("button", { name: "確認，繼續", exact: true }),
    ).toBeEnabled();
    await host.getByRole("button", { name: "確認，繼續", exact: true }).click();
    await fixture("dog", ["DOG-0", "ALIBI-1"], ["ALIBI-0"]);
    await play("神犬");
    await host.getByRole("button", { name: /手機夥伴.*張牌/ }).click();
    await host.getByRole("button", { name: "確認目標", exact: true }).click();
    await expect(host.locator(".cd-playback .cd-flying-card")).toHaveCount(2);
    await expect(
      guest.getByRole("button", { name: "查看手牌：神犬", exact: true }),
    ).toBeVisible();
    await host.getByRole("button", { name: "確認，繼續", exact: true }).click();
    await fixture("victory", ["DETECTIVE-0", "ALIBI-0"], ["CRIMINAL-0"]);
    await play("偵探");
    await host.getByRole("button", { name: /手機夥伴.*張牌/ }).click();
    await host.getByRole("button", { name: "確認目標", exact: true }).click();
    await expect(
      host.getByRole("heading", { name: "成功破案！", exact: true }),
    ).toBeVisible();
    await expect(
      host.getByRole("button", { name: "正在揭曉結果…" }),
    ).toBeDisabled();
    await expect(host.locator(".cd-score-table")).toHaveCount(0);
    await expect(
      guest.getByRole("heading", { name: "成功破案！", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "查看本輪得分", exact: true })
      .click();
    await expect(host.locator(".cd-score-table")).toBeVisible();
    await host.screenshot({
      path: ".tools/screenshots/criminal-dance-result.png",
    });
    await host.getByRole("button", { name: "開始下一輪", exact: true }).click();
    await expect(host.locator(".cd-heading")).toContainText("第 2 輪");
    await expect(host.locator(".cd-hand-card")).toHaveCount(4);
    await call(b, "roomAction", { code, action: { type: "leave" } });
    await expect(
      host.getByRole("heading", { name: "玩家離席，本局中止", exact: true }),
    ).toBeVisible();
    await host.getByRole("button", { name: "再開一局", exact: true }).click();
    await expect(host.getByLabel("犯人在跳舞勝利目標")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

for (const count of [3, 8])
  test(`Police Chief ${count} seats: settings, public holder, private hands and terminal interception`, async ({
    browser,
  }) => {
    const contexts = await Promise.all([
      browser.newContext({ viewport: { width: 320, height: 568 } }),
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
    ]);
    const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
    const errors: string[] = [];
    for (const page of [host, guest])
      page.on("pageerror", (e) => errors.push(e.message));
    const a = await registerPlayer(host, "警部玩家"),
      b = await registerPlayer(guest, "案件目標");
    async function call(p: { idToken: string }, name: string, data: unknown) {
      const r = await fetch(
        `http://127.0.0.1:5001/demo-boardgame/asia-east1/${name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${p.idToken}`,
          },
          body: JSON.stringify({ data }),
        },
      );
      const j = await r.json();
      expect(j.error).toBeUndefined();
      return j.result;
    }
    const { code } = await call(a, "createRoom", {
      gameId: "criminal-dance",
      nickname: "警部玩家",
    });
    await call(b, "joinRoom", { code, nickname: "案件目標" });
    await host.goto(`/room/${code}`);
    await guest.goto(`/room/${code}`);
    try {
      await host.getByLabel("加入警部（替換神犬）").click();
      await expect(guest.getByLabel("加入警部（替換神犬）")).toBeChecked();
      await expect(guest.getByLabel("加入警部（替換神犬）")).toBeDisabled();
      await host.getByLabel("加入少年（替換一張目擊者）").click();
      await expect(
        guest.getByLabel("加入少年（替換一張目擊者）"),
      ).toBeChecked();
      const url = `http://127.0.0.1:9000/sessions/${code}.json?ns=demo-boardgame-default-rtdb`,
        headers = {
          Authorization: "Bearer owner",
          "Content-Type": "application/json",
        };
      async function fixture(hand: string[]) {
        const s = (await (await fetch(url, { headers })).json()) as Session;
        s.public.status = "waiting";
        for (const p of Object.values(s.public.players)) p.ready = true;
        for (let i = 2; i < count; i++)
          s.public.players[`fixture${i}`] = {
            uid: `fixture${i}`,
            nickname: `舞客 ${i}`,
            ready: true,
            joinedAt: Date.now() + i,
          };
        startDance(s, `police-${count}-${hand.length}`, (v) => [...v]);
        const g = s.public.dance!;
        g.firstPlay = false;
        g.current = a.localId;
        for (const id of g.order) s.dancePrivate![id].hand = [];
        s.dancePrivate![a.localId].hand = hand;
        s.dancePrivate![b.localId].hand = ["CRIMINAL-0"];
        s.dancePrivate!.fixture2.hand = ["ORDINARY_PERSON-0"];
        for (const id of g.order)
          g.players[id].handCount = s.dancePrivate![id].hand.length;
        g.policeChiefHolderUid = a.localId;
        expect(
          (
            await fetch(url, {
              method: "PUT",
              headers,
              body: JSON.stringify(s),
            })
          ).ok,
        ).toBe(true);
        await expect(host.locator(".cd-hand-card")).toHaveCount(hand.length);
      }
      await fixture(["POLICE_CHIEF-0", "ALIBI-0", "TRADE-0", "RUMOR-0"]);
      await expect(
        guest.locator(".cd-player").filter({ hasText: "警部持有中" }),
      ).toContainText("警部玩家");
      await expect(
        host.getByRole("button", { name: "出牌紀錄", exact: true }),
      ).toBeInViewport();
      const size = await host.evaluate(() => ({
        h: document.documentElement.scrollHeight,
        vh: innerHeight,
      }));
      expect(size.h).toBeLessThanOrEqual(size.vh + 2);
      await host
        .getByRole("button", { name: "查看手牌：警部", exact: true })
        .click();
      await expect(
        host.getByRole("button", { name: "打出此牌", exact: true }),
      ).toBeDisabled();
      await host.getByRole("button", { name: "關閉視窗", exact: true }).click();
      await fixture(["POLICE_CHIEF-0", "ALIBI-0"]);
      await host
        .getByRole("button", { name: "查看手牌：警部", exact: true })
        .click();
      await host.getByRole("button", { name: "打出此牌", exact: true }).click();
      await expect(
        host.getByRole("dialog", { name: "警部 · 選擇目標" }),
      ).toBeVisible();
      await expect(
        host.getByRole("dialog").getByRole("button", { name: /警部玩家/ }),
      ).toHaveCount(0);
      await host.getByRole("button", { name: /案件目標.*張牌/ }).click();
      await host.getByRole("button", { name: "確認目標", exact: true }).click();
      await expect(
        guest.locator(".cd-player").filter({ hasText: "警部鎖定" }),
      ).toContainText("案件目標");
      await expect(guest.locator(".cd-result")).toHaveCount(0);
      await host
        .getByRole("button", { name: "確認，繼續", exact: true })
        .click();
      await expect(guest.locator(".cd-turn")).toContainText("輪到你");
      await guest
        .getByRole("button", { name: "查看手牌：犯人", exact: true })
        .click();
      await guest
        .getByRole("button", { name: "打出此牌", exact: true })
        .click();
      for (const page of [host, guest])
        await expect(
          page.getByRole("heading", {
            name: "警部成功攔截犯人！",
            exact: true,
          }),
        ).toBeVisible();
      await expect(host.locator(".cd-score-table")).toHaveCount(0);
      await host
        .getByRole("button", { name: "查看本輪得分", exact: true })
        .click();
      await expect(
        host.locator(".cd-score-table tr").filter({ hasText: "警部玩家" }),
      ).toContainText("+3");
      await expect(
        host.locator(".cd-score-table tr").filter({ hasText: "案件目標" }),
      ).toContainText("+0");
      await host.screenshot({
        path: `.tools/screenshots/police-chief-${count}.png`,
      });
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

for (const count of [3, 8])
  test(`Criminal Dance: real AI practice with Police Chief (${count} seats)`, async ({
    page,
  }) => {
    await registerPlayer(page, "推理練習");
    await page
      .locator(".game-card.criminal-dance")
      .getByRole("link", { name: /AI/ })
      .click();
    await page.getByLabel("對局人數（包含你）").selectOption(String(count));
    await page.getByRole("button", { name: /建立/ }).click();
    await expect(page).toHaveURL(/\/room\//);
    await page.getByLabel("加入警部（替換神犬）").click();
    await page.getByLabel("加入少年（替換一張目擊者）").click();
    await page.getByRole("button", { name: "我準備好了", exact: true }).click();
    await page.getByRole("button", { name: /開始遊戲/ }).click();
    await expect(page.locator(".cd-game")).toBeVisible();
    await expect(page.locator(".cd-hand-card")).toHaveCount(4);
    if (
      await page
        .getByRole("button", { name: "查看手牌：第一發現者", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "查看手牌：第一發現者", exact: true })
        .click();
      await page.getByRole("button", { name: "打出此牌", exact: true }).click();
    }
    await expect(page.locator(".cd-receipt b")).toContainText("AI");
    await expect(page.locator(".cd-player")).toHaveCount(count);
  });
