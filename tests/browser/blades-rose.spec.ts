import { test, expect } from "@playwright/test";
import { registerPlayer } from "./auth-helpers";
import {
  startRose,
  applyRoseAction,
} from "../../functions/src/bladesRose/engine";
import type { Session } from "../../functions/src/shared/model";
test("Blades & Rose: mobile and PC physical cards, privacy, card action, reveal and reconnect", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext({
      viewport: { width: 360, height: 800 },
      hasTouch: true,
    }),
    browser.newContext({ viewport: { width: 1440, height: 1000 } }),
  ]);
  const [mobile, desktop] = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [];
  for (const p of [mobile, desktop])
    p.on("pageerror", (e) => errors.push(e.message));
  const a = await registerPlayer(mobile, "白薔薇旅人"),
    b = await registerPlayer(desktop, "月夜司教");
  await mobile
    .locator(".game-card.blades-and-rose")
    .getByRole("link", { name: "建立房間" })
    .click();
  await mobile.getByRole("button", { name: "建立房間", exact: true }).click();
  await expect(mobile).toHaveURL(/\/room\//);
  const code = mobile.url().split("/").at(-1)!;
  const api = "http://127.0.0.1:5001/demo-boardgame/asia-east1";
  const joined = await fetch(`${api}/joinRoom`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${b.idToken}`,
    },
    body: JSON.stringify({ data: { code, nickname: "月夜司教" } }),
  });
  expect((await joined.json()).error).toBeUndefined();
  await desktop.goto(`/room/${code}`);
  await expect(
    mobile.getByText("目前開放 8 人模式。", { exact: false }),
  ).toBeVisible();
  const url = `http://127.0.0.1:9000/sessions/${code}.json?ns=demo-boardgame-default-rtdb`,
    headers = {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    };
  let s = (await (await fetch(url, { headers })).json()) as Session;
  for (const p of Object.values(s.public.players)) p.ready = true;
  for (let i = 2; i < 8; i++)
    s.public.players[`fixture${i}`] = {
      uid: `fixture${i}`,
      nickname: `夜行者 ${i}`,
      joinedAt: Date.now() + i,
      ready: true,
    };
  const shuffle = <T>(v: T[]) => [...v];
  startRose(s, "browser-rose-night", shuffle);
  async function publish() {
    const r = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(s),
    });
    expect(r.ok).toBe(true);
  }
  await publish();
  await expect(mobile.locator(".br-hand .br-card")).toHaveCount(3);
  await mobile.getByRole("button", { name: "查看我的身分" }).click();
  await expect(mobile.getByRole("dialog")).toContainText("白薔薇陣營");
  await mobile.getByRole("button", { name: "確認身分，完成夜晚儀式" }).click();
  await expect(mobile.getByRole("dialog")).toHaveCount(0);
  await desktop.getByRole("button", { name: "查看我的身分" }).click();
  await desktop.getByRole("button", { name: "確認身分，完成夜晚儀式" }).click();
  await expect(desktop.getByRole("dialog")).toHaveCount(0);
  s = (await (await fetch(url, { headers })).json()) as Session;
  for (const uid of s.public.rose!.order)
    if (!s.rosePrivate![uid].acknowledged)
      applyRoseAction(s, uid, { type: "roseNight" }, shuffle);
  s.rosePrivate![b.localId].crystal = 2;
  applyRoseAction(
    s,
    a.localId,
    { type: "roseCoin", target: b.localId },
    shuffle,
  );
  await publish();
  await desktop.getByRole("button", { name: "啟封我的白水晶" }).click();
  await expect(
    desktop.getByRole("heading", { name: "輪到你做出抉擇" }),
  ).toBeVisible();
  await desktop.getByRole("button", { name: "本輪跳過", exact: true }).click();
  await expect(desktop.locator(".br-locked")).toContainText("本輪跳過");
  s = (await (await fetch(url, { headers })).json()) as Session;
  while (s.public.rose!.current !== a.localId)
    applyRoseAction(s, s.public.rose!.current, { type: "roseDecide" }, shuffle);
  await publish();
  await expect(
    mobile.getByRole("heading", { name: "輪到你做出抉擇" }),
  ).toBeVisible();
  for (const page of [mobile, desktop]) {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const box = await page.locator(".br-hand .br-card").first().boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(0.65, 1);
  }
  await mobile.screenshot({
    path: ".tools/screenshots/blades-rose-mobile.png",
    fullPage: true,
  });
  await desktop.screenshot({
    path: ".tools/screenshots/blades-rose-desktop.png",
    fullPage: true,
  });
  await mobile
    .getByRole("button", { name: "查看手牌：白薔薇", exact: true })
    .click();
  await expect(mobile.getByRole("dialog")).toBeVisible();
  await mobile.getByRole("button", { name: "蓋牌打出", exact: true }).click();
  await expect(mobile.getByRole("dialog")).toHaveCount(0);
  await expect(mobile.locator(".br-result")).toContainText("未見血刃");
  await expect(desktop.locator(".br-result")).toContainText("白薔薇旅人");
  await mobile.reload();
  await expect(mobile.locator(".br-hand .br-card")).toHaveCount(2);
  await mobile.getByRole("button", { name: "私密情報", exact: true }).click();
  await expect(mobile.getByRole("dialog")).toContainText("白薔薇陣營");
  await mobile.getByRole("button", { name: "關閉視窗" }).click();
  await mobile.emulateMedia({ reducedMotion: "reduce" });
  await mobile.getByRole("button", { name: "魔法之書與規則" }).click();
  await expect(mobile.getByRole("dialog")).toContainText("12. 終末之命");
  expect(errors).toEqual([]);
  await Promise.all(contexts.map((c) => c.close()));
});
test("Blades & Rose: practice entry creates seven AI seats and AI autonomously plays a round", async ({
  page,
}) => {
  test.setTimeout(180000);
  const user = await registerPlayer(page, "AI 練習旅人");
  await page
    .locator(".game-card.blades-and-rose")
    .getByRole("link", { name: "單人練習 · 與 AI 對局" })
    .click();
  await expect(page.locator("#table-size option")).toHaveCount(1);
  await expect(page.locator("#table-size")).toHaveValue("8");
  await page.getByRole("button", { name: "建立練習桌", exact: true }).click();
  await expect(page).toHaveURL(/\/room\//);
  const code = page.url().split("/").at(-1)!;
  await page.getByRole("button", { name: "我準備好了", exact: true }).click();
  await page.getByRole("button", { name: "開始遊戲", exact: true }).click();
  await page.getByRole("button", { name: "查看我的身分" }).click();
  await page.getByRole("button", { name: "確認身分，完成夜晚儀式" }).click();
  const { chooseRoseAction } =
    await import("../../functions/src/bladesRose/bot");
  const { normalizeRose, normalizeRosePrivate, roseToken } =
    await import("../../functions/src/shared/bladesRose");
  let resolved = false;
  for (let i = 0; i < 110; i++) {
    const base = `http://127.0.0.1:9000/sessions/${code}`;
    const query = `.json?ns=demo-boardgame-default-rtdb&auth=${user.idToken}`;
    const room = await (await fetch(`${base}/public${query}`)).json();
    const g = normalizeRose(room.rose);
    if (g.history.length) {
      resolved = true;
      break;
    }
    const own = normalizeRosePrivate(
      await (await fetch(`${base}/rosePrivate/${user.localId}${query}`)).json(),
    );
    const action = chooseRoseAction(user.localId, g, own, (v) => [...v]);
    if (action) {
      const response = await fetch(
        "http://127.0.0.1:5001/demo-boardgame/asia-east1/gameAction",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.idToken}`,
          },
          body: JSON.stringify({
            data: {
              code,
              phaseToken: roseToken(g),
              actionId: crypto.randomUUID(),
              action,
            },
          }),
        },
      );
      expect((await response.json()).error).toBeUndefined();
    }
    await page.waitForTimeout(650);
  }
  expect(resolved).toBe(true);
  await expect(page.locator(".br-seats")).toContainText("AI");
  await page.getByText("圓桌發言 · AI", { exact: true }).click();
  await expect(page.locator(".ai-conversation")).toContainText("決定已封存");
});
