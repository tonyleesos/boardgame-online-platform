import { test, expect } from "@playwright/test";
import { registerPlayer } from "./auth-helpers";
import {
  MINE_CARDS,
  DWARF_ROLE_NAMES,
  type DwarfRole,
} from "../../functions/src/shared/saboteur";
import type { Session } from "../../functions/src/shared/model";
import { startMine } from "../../functions/src/saboteur/engine";

test("Saboteur: phone/tablet/PC, twelve seats, real path/trap/map actions and shared animation", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext({
      viewport: { width: 390, height: 740 },
      hasTouch: true,
    }),
    browser.newContext({ viewport: { width: 1280, height: 800 } }),
  ]);
  const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [];
  for (const p of [host, guest])
    p.on("pageerror", (e) => errors.push(e.message));
  const a = await registerPlayer(host, "礦坑房主"),
    b = await registerPlayer(guest, "手機夥伴");
  await expect(
    host.getByRole("img", { name: "矮人礦坑：礦洞、十字鎬與黃金" }),
  ).toBeVisible();
  expect(
    await host
      .locator(".game-card.saboteur-2 .game-art")
      .evaluate((el) => getComputedStyle(el, "::after").content),
  ).not.toContain("AVALON");
  await host
    .locator(".game-card.saboteur-2")
    .screenshot({ path: ".tools/screenshots/saboteur-new-cover.png" });
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
    .locator(".game-card.saboteur-2")
    .getByRole("link", { name: "建立房間" })
    .click();
  await host.getByRole("button", { name: "建立房間", exact: true }).click();
  await expect(host).toHaveURL(/\/room\//);
  const code = host.url().split("/").at(-1)!;
  await call(b, "joinRoom", { code, nickname: "手機夥伴" });
  await guest.goto(`/room/${code}`);
  const url = `http://127.0.0.1:9000/sessions/${code}.json?ns=demo-boardgame-default-rtdb`;
  const admin = {
    Authorization: "Bearer owner",
    "Content-Type": "application/json",
  };
  async function fixture(name: string) {
    const s = (await (await fetch(url, { headers: admin })).json()) as Session;
    s.public.status = "waiting";
    for (const p of Object.values(s.public.players)) p.ready = true;
    for (let i = 2; i < 12; i++)
      s.public.players[`fixture${i}`] = {
        uid: `fixture${i}`,
        nickname: `礦工 ${i}`,
        ready: true,
        joinedAt: Date.now() + i,
      };
    startMine(s, `browser-${name}`, (v) => [...v]);
    const g = s.public.saboteur!;
    g.current = g.order.indexOf(a.localId);
    const card = MINE_CARDS.find((c) => c.name === name)!;
    s.saboteurPrivate![a.localId].hand = [
      card.id,
      ...MINE_CARDS.filter((c) => c.id !== card.id)
        .slice(-5)
        .map((c) => c.id),
    ];
    const result = await fetch(url, {
      method: "PUT",
      headers: admin,
      body: JSON.stringify(s),
    });
    expect(result.ok).toBe(true);
    await expect(
      host.getByRole("button", { name: `選擇手牌 1：${name}`, exact: true }),
    ).toBeEnabled();
  }
  try {
    await fixture("東西礦道");
    await expect(
      host
        .locator(".mine-player")
        .first()
        .getByRole("img", { name: "6 張手牌" }),
    ).toBeVisible();
    await expect(
      host.locator(".mine-player").first().locator(".mine-hand-count svg > g"),
    ).toHaveCount(6);
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 740 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
      { width: 740, height: 390 },
    ]) {
      await host.setViewportSize(viewport);
      await expect(host.locator(".mine-player")).toHaveCount(12);
      await expect(
        host.getByRole("button", { name: "換牌 / 解除狀態", exact: true }),
      ).toBeInViewport();
      const dimensions = await host.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        w: innerWidth,
        h: innerHeight,
      }));
      expect(dimensions.width).toBeLessThanOrEqual(dimensions.w + 1);
      expect(dimensions.height).toBeLessThanOrEqual(dimensions.h + 1);
      const board = await host.locator(".mine-map").boundingBox();
      expect(board!.height).toBeGreaterThan(120);
      await host.screenshot({
        path: `.tools/screenshots/saboteur-${viewport.width}.png`,
      });
    }
    await host.setViewportSize({ width: 390, height: 740 });
    await host.getByRole("button", { name: /身份已更新|查看身份/ }).click();
    await expect(host.locator(".mine-role-portrait")).toHaveCount(0);
    await expect(
      host.getByRole("button", { name: "揭開我的身份" }),
    ).toBeVisible();
    await host.getByRole("button", { name: "揭開我的身份" }).click();
    await expect(
      host.getByRole("img", { name: "藍隊挖金矮人角色圖案" }),
    ).toBeVisible();
    await host
      .getByRole("dialog")
      .screenshot({ path: ".tools/screenshots/saboteur-role-blue.png" });
    await expect(host.locator(".mine-role h3")).toBeVisible();
    await host.getByRole("button", { name: "藏好身份" }).click();
    for (const role of [
      "GREEN_DIGGER",
      "SABOTEUR",
      "BOSS",
      "PROFITEER",
      "GEOLOGIST",
      "BLUE_DIGGER",
    ] as DwarfRole[]) {
      await fetch(url, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ [`saboteurPrivate/${a.localId}/role`]: role }),
      });
      await host.getByRole("button", { name: /身份已更新|查看身份/ }).click();
      await host.getByRole("button", { name: "揭開我的身份" }).click();
      await expect(
        host.getByRole("img", { name: `${DWARF_ROLE_NAMES[role]}角色圖案` }),
      ).toBeVisible();
      await host
        .getByRole("dialog")
        .screenshot({ path: `.tools/screenshots/saboteur-role-${role}.png` });
      await host.getByRole("button", { name: "藏好身份" }).click();
    }
    await host
      .getByRole("button", { name: "選擇手牌 1：東西礦道", exact: true })
      .click();
    await host
      .getByRole("button", { name: "放置道路 1,0", exact: true })
      .click();
    await host.getByRole("button", { name: "蓋路", exact: true }).click();
    await expect(host.locator('[data-mine-cell="1_0"]')).toBeVisible();
    await expect(guest.locator('[data-mine-cell="1_0"]')).toBeVisible();
    await expect(guest.locator(".mine-receipt")).toContainText("放置東西礦道");
    const receiptStarted = Date.now();
    await expect(guest.locator(".mine-receipt")).toBeHidden({ timeout: 10000 });
    expect(Date.now() - receiptStarted).toBeGreaterThan(1800);
    const svg = host.locator(".mine-map > svg"),
      before = await svg.getAttribute("viewBox");
    await host.getByRole("button", { name: "放大棋盤" }).click();
    expect(await svg.getAttribute("viewBox")).not.toBe(before);
    await host.getByRole("button", { name: "查看完整礦道" }).click();
    const box = (await svg.boundingBox())!;
    const panBefore = await svg.getAttribute("viewBox");
    await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await host.mouse.down();
    await host.mouse.move(
      box.x + box.width / 2 + 45,
      box.y + box.height / 2 + 20,
      { steps: 5 },
    );
    await host.mouse.up();
    expect(await svg.getAttribute("viewBox")).not.toBe(panBefore);
    await expect(host.getByRole("dialog")).toHaveCount(0);
    const touch = await contexts[0].newCDPSession(host);
    const pinchBefore = (await svg.getAttribute("viewBox"))!
      .split(" ")
      .map(Number)[2];
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 30, y, id: 1 },
        { x: x + 30, y, id: 2 },
      ],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 70, y, id: 1 },
        { x: x + 70, y, id: 2 },
      ],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () =>
        Number((await svg.getAttribute("viewBox"))!.split(" ")[2]),
      )
      .toBeLessThan(pinchBefore);
    await touch.detach();
    await fixture("設下陷阱");
    await host
      .getByRole("button", { name: "選擇手牌 1：設下陷阱", exact: true })
      .click();
    await expect(
      host.locator(".mine-action-large .mine-action-illustration"),
    ).toBeVisible();
    await host
      .getByRole("dialog")
      .screenshot({ path: ".tools/screenshots/saboteur-trap-card.png" });
    await host
      .getByRole("dialog")
      .getByRole("button", { name: "手機夥伴", exact: true })
      .click();
    await host.getByRole("button", { name: "確認使用" }).click();
    await expect(
      guest.locator(`[data-mine-player="${b.localId}"]`),
    ).toHaveAccessibleName(/不能蓋路/);
    await expect(
      guest
        .locator(`[data-mine-player="${b.localId}"]`)
        .getByRole("img", { name: "被困住" }),
    ).toBeVisible();
    await expect(guest.locator(".mine-receipt")).toBeHidden({ timeout: 10000 });
    await fixture("藏寶圖");
    await host
      .getByRole("button", { name: "選擇手牌 1：藏寶圖", exact: true })
      .click();
    await host.getByRole("button", { name: "1 號目標", exact: true }).click();
    await host.getByRole("button", { name: "確認使用" }).click();
    await expect(
      host.getByRole("button", { name: "記住並關閉" }),
    ).toBeVisible();
    await expect(guest.getByRole("button", { name: "記住並關閉" })).toHaveCount(
      0,
    );
    await expect(
      guest.getByRole("button", { name: "1 號目標：未揭開", exact: true }),
    ).toBeVisible();
    await host.getByRole("button", { name: "記住並關閉" }).click();
    await host.reload();
    await expect(host.locator(".mine-game")).toBeVisible();
    await host.getByRole("button", { name: "查看私人情報" }).click();
    await expect(host.getByRole("dialog")).toContainText("黃金");
    await host.getByRole("button", { name: "關閉視窗" }).click();

    // A real final placement triggers the server's result; the UI must show the
    // round faction before exposing the cumulative winners or score table.
    await fixture("東西礦道");
    const finale = (await (
      await fetch(url, { headers: admin })
    ).json()) as Session;
    const fg = finale.public.saboteur!;
    fg.id = "browser-finale";
    fg.round = 3;
    for (const own of Object.values(finale.saboteurPrivate!)) {
      own.gameId = fg.id;
      own.round = 3;
    }
    finale.secret.saboteur!.goals = {
      "8_-2": "ROCK",
      "8_0": "GOLD",
      "8_2": "ROCK",
    };
    const road = MINE_CARDS.find((c) => c.name === "東西礦道")!;
    for (let x = 1; x <= 6; x++)
      fg.board[`${x}_0`] = {
        x,
        y: 0,
        type: "path",
        cardId: road.id,
        rotation: 0,
      };
    await fetch(url, {
      method: "PUT",
      headers: admin,
      body: JSON.stringify(finale),
    });
    await expect(
      host.getByRole("button", { name: "選擇手牌 1：東西礦道", exact: true }),
    ).toBeEnabled();
    await host
      .getByRole("button", { name: "選擇手牌 1：東西礦道", exact: true })
      .click();
    await host
      .getByRole("button", { name: "放置道路 7,0", exact: true })
      .click();
    await host.getByRole("button", { name: "蓋路", exact: true }).click();
    const victory = host.getByRole("dialog", { name: "第 3 輪勝負揭曉" });
    await expect(
      victory.getByRole("heading", { name: "藍隊挖金矮人獲勝", exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole("dialog", { name: "第 3 輪勝負揭曉" }),
    ).toBeVisible();
    await expect(host.locator(".mine-scores")).toHaveCount(0);
    await expect(victory.getByRole("button")).toBeDisabled();
    await host.keyboard.press("Escape");
    await expect(victory).toBeVisible();
    await expect(
      victory.getByRole("button", { name: "查看本輪結算" }),
    ).toBeEnabled({ timeout: 10000 });
    await victory.screenshot({
      path: ".tools/screenshots/saboteur-victory.png",
    });
    await victory.getByRole("button", { name: "查看本輪結算" }).click();
    await expect(
      host.getByRole("dialog", { name: "礦坑最終結果" }),
    ).toBeVisible();
    await expect(host.locator(".mine-scores")).toBeVisible();
    await expect(
      host.locator(".mine-crystal-total .mine-crystal-art"),
    ).toBeVisible();
    await expect(
      host.locator(".mine-scores .mine-gold-art").first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test("Saboteur practice lobby starts real AI and automatically advances", async ({
  page,
}) => {
  await registerPlayer(page, "練習礦工");
  await page.locator(".game-card.saboteur-2 .practice-link").click();
  await page.getByRole("button", { name: "建立練習桌", exact: true }).click();
  await expect(page).toHaveURL(/\/room\//);
  await page.getByRole("button", { name: "我準備好了", exact: true }).click();
  await page.getByRole("button", { name: "開始遊戲", exact: true }).click();
  await expect(page.locator(".mine-game")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "換牌 / 解除狀態", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await page
    .getByRole("button", { name: "換牌 / 解除狀態", exact: true })
    .click();
  await page.locator(".mine-dialog .mine-hand-grid button").first().click();
  await page.getByRole("button", { name: "確認換 1 張牌" }).click();
  await expect(page.locator(".mine-receipt")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "換牌 / 解除狀態", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await page.getByRole("button", { name: "礦坑紀錄" }).click();
  await expect(page.getByRole("dialog")).toContainText("AI");
});
