import { test, expect, type Page } from "@playwright/test";
import type { Room } from "../../functions/src/shared/model";
import type { DecorumPrivate, HouseAction } from "../../functions/src/shared/decorum";
import { COLOR_LABELS, OBJECT_LABELS, ROOM_LABELS, DECOR_OBJECTS, objectLabel } from "../../functions/src/shared/decorum";
import { solutionMoves } from "../decorum-solutions";

interface Actor { page: Page; uid: string; idToken: string }
async function read<T>(actor: Actor, code: string, path: string): Promise<T> {
  const response = await fetch(`http://127.0.0.1:9000/sessions/${code}/${path}.json?ns=demo-boardgame-default-rtdb&auth=${actor.idToken}`);
  expect(response.status).toBe(200); return response.json();
}
async function move(page: Page, room: Room, action: HouseAction) {
  if (action.type === "decorPass") { await page.getByRole("button", { name: "滿意，略過", exact: true }).click(); return; }
  const target = room.decorum!.house.rooms.find((r) => r.id === action.roomId)!;
  const label = ROOM_LABELS[target.type];
  if (action.type === "decorPaint") {
    await page.getByRole("button", { name: `粉刷${label}`, exact: true }).click();
    await page.getByRole("button", { name: `選擇${COLOR_LABELS[action.color]}`, exact: true }).click();
  } else if (action.type === "decorRoommate") {
    await page.getByRole("button", { name: `搬到${label}`, exact: true }).click();
    await page.getByRole("button", { name: action.swapWith ? `和 ${room.players[action.swapWith].nickname} 交換` : `搬進${label}`, exact: true }).click();
  } else {
    const object = "objectId" in action ? DECOR_OBJECTS.find((o) => o.id === action.objectId)! : null;
    const type = action.type === "decorRemove" ? action.objectType : object!.type;
    await page.getByRole("button", { name: `佈置${label}的${OBJECT_LABELS[type]}`, exact: true }).click();
    await page.getByRole("button", { name: action.type === "decorRemove" ? `移除${OBJECT_LABELS[type]}` : `選擇${objectLabel(object!)}`, exact: true }).click();
  }
  await expect(page.locator(".decor-preview")).toBeVisible();
  await page.getByRole("button", { name: "確認這次佈置", exact: true }).click();
  await expect(page.locator(".decorum-action-sheet")).not.toBeVisible();
}
for (const [count, scenarioId] of [[2, "demo-two-01"], [2, "demo-two-02"], [3, "demo-three-01"], [4, "demo-four-01"]] as const) test(`${scenarioId}: ${count} browsers complete Decorum with meetings, private conditions and reconnect`, async ({ browser }) => {
  test.setTimeout(180000);
  const contexts = await Promise.all(Array.from({ length: count }, () => browser.newContext({ viewport: { width: 1280, height: 950 } })));
  const actors: Actor[] = [];
  const errors: string[] = [];
  try {
    for (const [i, context] of contexts.entries()) {
      const page = await context.newPage(); page.on("pageerror", (e) => errors.push(e.message));
      const auth = page.waitForResponse((r) => r.url().includes("accounts:signUp"));
      await page.goto("/");
      const { localId: uid, idToken } = await (await auth).json();
      actors.push({ page, uid, idToken });
      await page.getByLabel("讓大家認識你").fill(["Tony", "Kevin", "Amy", "小華"][i]);
      await page.getByRole("button", { name: "入座，開始冒險" }).click();
    }
    const host = actors[0];
    await expect(host.page.locator(".game-card.decorum")).toContainText("同房異夢");
    await expect(host.page.locator(".game-card.decorum .practice-link")).toHaveCount(0);
    await host.page.locator(".game-card.decorum").getByRole("link", { name: "建立房間" }).click();
    await host.page.getByRole("button", { name: "建立房間", exact: true }).click();
    await expect(host.page.getByRole("heading", { name: "等待朋友入座" })).toBeVisible();
    const code = (await host.page.getByRole("button", { name: "複製房間代碼" }).textContent())!.trim();
    for (const actor of actors.slice(1)) {
      await actor.page.locator(".game-card.decorum").getByRole("link", { name: "加入房間" }).click();
      await actor.page.getByLabel("房間代碼").fill(code);
      await actor.page.getByRole("button", { name: "加入房間", exact: true }).click();
      await expect(actor.page.getByRole("heading", { name: "等待朋友入座" })).toBeVisible();
    }
    await host.page.getByLabel("合租劇本（由房主選擇）").selectOption(scenarioId);
    await expect(host.page.getByLabel("合租劇本（由房主選擇）")).toHaveValue(scenarioId);
    await expect(host.page.getByRole("button", { name: /新增 AI/ })).toHaveCount(0);
    for (const actor of actors) await actor.page.getByRole("button", { name: "我準備好了", exact: true }).click();
    await host.page.getByRole("button", { name: "開始遊戲", exact: true }).click();
    for (const actor of actors) {
      await actor.page.getByRole("button", { name: /我的秘密心願/ }).click();
      const dialog = actor.page.getByRole("dialog", { name: "我的秘密心願", exact: true });
      await expect(dialog.locator(".condition-list:not(.shared) li")).toHaveCount(3);
      await expect(dialog.locator(".condition-list:not(.shared) .condition-visual")).toHaveCount(3);
      if (actor === host) {
        await actor.page.setViewportSize({ width: 390, height: 844 });
        await actor.page.screenshot({ path: `.tools/screenshots/decorum-${count}-private-mobile.png`, animations: "disabled" });
      }
      await actor.page.getByRole("button", { name: "讀完了，準備入住", exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
    let room = await read<Room>(host, code, "public");
    // Reach the meeting with authenticated, legal moves; no database edits.
    const call = async (actor: Actor, action: object) => {
      const g = room.decorum!;
      const response = await fetch("http://127.0.0.1:5001/demo-boardgame/asia-east1/gameAction", { method: "POST", headers: { Authorization: `Bearer ${actor.idToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: { code, phaseToken: `${g.id}:${g.round}:${g.phase}:${g.currentPlayerIndex}:${g.turn}`, action } }) });
      expect((await response.json()).error).toBeUndefined();
    };
    while (!["HEART_TO_HEART", "HOUSE_MEETING"].includes(room.decorum!.phase)) {
      const g = room.decorum!;
      const active = actors.find((a) => a.uid === g.playerOrder[g.currentPlayerIndex])!;
      await call(active, { type: "decorPaint", roomId: "living", color: g.house.rooms.find((r) => r.id === "living")!.wallColor === "red" ? "yellow" : "red" });
      room = await read<Room>(host, code, "public");
      await Promise.all(actors.filter((a) => a !== active).map((a) => call(a, { type: "decorReact", reaction: "neutral" })));
      room = await read<Room>(host, code, "public");
    }
    const meetingRound = room.decorum!.round;
    const wishesAtMeeting = await Promise.all(actors.map((a) => read<DecorumPrivate>(a, code, `decorumPrivate/${a.uid}`)));
    for (const [i, actor] of actors.entries()) {
      const dialog = actor.page.getByRole("dialog", { name: count === 2 ? "室友談心" : "房屋會議", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".meeting-wishes button")).toHaveCount(3);
      await dialog.getByRole("button", { name: "喜歡", exact: true }).click();
      await dialog.getByRole("button", { name: `分享心願 2：${wishesAtMeeting[i].conditions[1].description}`, exact: true }).click();
      const recipient = actors[(i + 1) % count];
      const recipientName = room.players[recipient.uid].nickname;
      await dialog.getByRole("button", { name: `分享給 ${recipientName}`, exact: true }).click();
      if (i === 0) {
        await actor.page.setViewportSize({ width: 360, height: 844 });
        expect(await actor.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await actor.page.screenshot({ path: `.tools/screenshots/decorum-${scenarioId}-meeting-mobile.png`, animations: "disabled" });
      }
      await dialog.getByRole("button", { name: `交給 ${recipientName}`, exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
    room = await read<Room>(host, code, "public");
    expect(room.decorum!.round).toBe(meetingRound + 1);
    expect(room.decorum!.phase).toBe("PLAYER_ACTION");
    for (const [i, actor] of actors.entries()) {
      const shared = await read<DecorumPrivate>(actor, code, `decorumPrivate/${actor.uid}`);
      expect(shared.sharedConditionsReceived).toHaveLength(1);
      expect(shared.sharedConditionsReceived[0].ownerId).toBe(actors[(i + count - 1) % count].uid);
    }
    const afterMove = async () => {
      room = await read<Room>(host, code, "public");
      if (room.decorum!.phase === "GAME_OVER") return;
      const actorId = room.decorum!.playerOrder[room.decorum!.currentPlayerIndex];
      for (const actor of actors.filter((a) => a.uid !== actorId)) {
        await expect(actor.page.getByRole("heading", { name: "這次改變，你覺得如何？" })).toBeVisible();
        await actor.page.getByRole("button", { name: "沒意見", exact: true }).click();
      }
      room = await read<Room>(host, code, "public");
    };
    // Four players first settle into bedrooms according to their private assignment.
    // Read-only per-player credentials; every mutation still uses the real UI/callable.
    if (count === 4) {
      const wishes = await Promise.all(actors.map((a) => read<DecorumPrivate>(a, code, `decorumPrivate/${a.uid}`)));
      const desired = Object.fromEntries(actors.map((a, i) => [a.uid, wishes[i].conditions.some((c) => c.id === "my-yellow-bedroom") ? "bath" : "bed"]));
      for (let guard = 0; guard < 8 && actors.some((a) => room.decorum!.house.roommates[a.uid] !== desired[a.uid]); guard++) {
        const g = room.decorum!; const active = actors.find((a) => a.uid === g.playerOrder[g.currentPlayerIndex])!;
        if (g.house.roommates[active.uid] !== desired[active.uid]) {
          const other = actors.find((a) => g.house.roommates[a.uid] === desired[active.uid] && desired[a.uid] !== desired[active.uid])!;
          await move(active.page, room, { type: "decorRoommate", roomId: desired[active.uid], swapWith: other.uid });
        } else await move(active.page, room, { type: "decorPaint", roomId: "living", color: g.house.rooms[2].wallColor === "red" ? "yellow" : "red" });
        await afterMove();
      }
      expect(actors.every((a) => room.decorum!.house.roommates[a.uid] === desired[a.uid])).toBe(true);
    }
    for (const width of [360, 390, 768, 1280]) {
      await host.page.setViewportSize({ width, height: 950 });
      expect(await host.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(host.page.locator(".decor-room")).toHaveCount(4);
      await host.page.screenshot({ path: `.tools/screenshots/decorum-${count}-board-${width}.png`, animations: "disabled", fullPage: true });
    }
    await actors[1].page.reload();
    await expect(actors[1].page.locator(".decor-room")).toHaveCount(4);
    for (const action of solutionMoves[scenarioId].filter((a) => a.type !== "decorRoommate")) {
      room = await read<Room>(host, code, "public");
      const active = actors.find((a) => a.uid === room.decorum!.playerOrder[room.decorum!.currentPlayerIndex])!;
      await move(active.page, room, action);
      if (action.type === "decorPaint") for (const actor of actors) await expect(actor.page.getByRole("region", { name: `${ROOM_LABELS[room.decorum!.house.rooms.find((r) => r.id === action.roomId)!.type]}・${COLOR_LABELS[action.color]}牆面`, exact: true })).toBeVisible();
      await afterMove();
    }
    for (const actor of actors) {
      const result = actor.page.getByRole("dialog", { name: "合租成果", exact: true });
      await expect(result.getByRole("heading", { name: "我們，都喜歡這個家。" })).toBeVisible();
      await expect(result.locator(".condition-list li")).toHaveCount(count * 3);
      await expect(result.getByLabel("最終房屋").locator(".room-scene")).toHaveCount(4);
    }
    await host.page.screenshot({ path: `.tools/screenshots/decorum-${count}-victory.png`, animations: "disabled" });
    await host.page.getByRole("dialog", { name: "合租成果" }).getByRole("button", { name: "再合租一次", exact: true }).click();
    await expect(host.page.getByRole("button", { name: "我準備好了", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map((c) => c.close())); }
});
