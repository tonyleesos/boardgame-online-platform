import { test, expect, type Page } from "@playwright/test";
import { applyGameAction, startGame } from "../../functions/src/engine";
import { applyBombAction, startBomb } from "../../functions/src/timebomb-engine";
import type { Session } from "../../functions/src/shared/model";
import { getMissionTeamSize } from "../../functions/src/shared/rules";

// Deterministic UI scenarios use real Auth/Database emulators and the game engines.
// Intercept callable actions so other players and AI cannot race the screenshots.
async function fixture(page: Page, gameId: string, count: number) {
  const auth = page.waitForResponse((r) => r.url().includes("accounts:signUp"));
  await page.goto("/");
  const { localId: uid } = await (await auth).json();
  await page.getByLabel("讓大家認識你").fill("測試玩家");
  await page.getByRole("button", { name: "入座，開始冒險" }).click();
  const code = gameId === "avalon" ? "AVA234" : gameId === "timebomb" ? "BMB234" : "BMC234";
  const ids = [uid, ...Array.from({ length: count - 1 }, (_, i) => `guest-${i}`)];
  const names = ["測試玩家", "露西", "艾達", "華生", "小明", "小華", "亞瑟", "梅莉"];
  const session: Session = {
    public: { code, gameId, hostId: uid, status: "waiting", createdAt: Date.now(),
      players: Object.fromEntries(ids.map((id, i) => [id, { uid: id, nickname: names[i], joinedAt: i, ready: true }])) },
    private: {}, secret: { teamVotes: {}, missionVotes: {} },
  };
  if (gameId === "avalon") startGame(session, "ui-avalon", (a) => a);
  else startBomb(session, "ui-bomb", (a) => a, gameId === "timebomb" ? "evolution" : "classic");
  const save = async () => {
    const response = await fetch(`http://127.0.0.1:9000/sessions/${code}.json?ns=demo-boardgame-default-rtdb`, {
      method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });
    expect(response.ok).toBe(true);
  };
  await page.route("**/asia-east1/gameAction", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
      return;
    }
    const { action } = route.request().postDataJSON().data;
    if (gameId === "avalon") applyGameAction(session, uid, action);
    else applyBombAction(session, uid, action, (a) => a);
    await save();
    await route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ result: {} }) });
  });
  await save();
  await page.goto(`/room/${code}`);
  await expect(page.locator(".game-core")).toBeVisible();
  return { session, uid, ids, save };
}

async function fits(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("Avalon avatars, rejection track, mission reveal and modal priority", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { session: s, uid, ids, save } = await fixture(page, "avalon", 6);
  ids.forEach((id) => applyGameAction(s, id, { type: "reveal" }));
  const g = s.public.game!;
  const propose = (players = ids.slice(0, getMissionTeamSize(ids.length, g.round))) => {
    applyGameAction(s, g.leaderId, { type: "select", players });
    applyGameAction(s, g.leaderId, { type: "propose" });
  };
  // Ties count as rejection; the fifth rejected proposal ends the game.
  for (let n = 0; n < 4; n++) {
    propose();
    ids.forEach((id, i) => applyGameAction(s, id, { type: "teamVote", vote: i < 3 ? "approve" : "reject" }));
  }
  await save();
  await expect(page.getByLabel("連續否決 4 / 5 次")).toBeVisible();
  await expect(page.locator(".rejection-marks .rejected")).toHaveCount(4);
  propose();
  await save();
  const vote = page.getByRole("dialog", { name: "隊伍表決", exact: true });
  await expect(vote.locator(".team-ballot-art .lucide-thumbs-up")).toHaveCount(1);
  await expect(vote.locator(".quest-card-art")).toHaveCount(0);
  await expect(vote.locator(".player-identity .avatar")).toHaveCount(2);
  expect(await vote.locator(".avatar").first().getAttribute("class")).toContain("color-0");
  for (const width of [360, 390, 768, 1280]) await fits(page, width);
  await page.screenshot({ animations: "disabled", path: ".tools/screenshots/avalon-vote-updated.png" });
  await page.keyboard.press("Escape");
  await expect(vote).not.toBeVisible();
  await page.getByRole("button", { name: "開啟投票", exact: true }).click();
  await expect(vote).toBeVisible();
  // Save the final rejection branch for later, then proceed with an approved mission.
  const fifthRejection = structuredClone(s);
  await page.getByRole("button", { name: "贊成", exact: true }).click();
  await expect(vote).not.toBeVisible();
  ids.filter((id) => id !== uid).forEach((id) => applyGameAction(s, id, { type: "teamVote", vote: "approve" }));
  await save();
  await expect(page.getByLabel("連續否決 0 / 5 次")).toBeAttached();
  await expect(page.locator(".seat-ballot")).toHaveCount(ids.length);
  await expect(page.locator(".expedition-ballot")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "選擇任務牌", exact: true })).toHaveCount(0);
  await expect(page.locator(".quest-card-art .lucide-trophy")).toHaveCount(1);
  await page.getByRole("button", { name: "任務成功", exact: true }).click();
  applyGameAction(s, ids[1], { type: "missionVote", vote: "success" });
  await save();
  const result = page.getByRole("dialog", { name: "任務結果", exact: true });
  await expect(page.locator(".expedition-battle")).toBeVisible();
  await expect(result).toHaveCount(0);
  await expect(page.locator(".quest-stop.success, .quest-stop.fail")).toHaveCount(0);
  await expect(result.getByRole("heading", { name: "任務成功", exact: true })).toBeVisible();
  await expect(page.locator(".quest-stop.success")).toHaveCount(0);
  await fits(page, 390);
  await page.screenshot({ animations: "disabled", path: ".tools/screenshots/avalon-result-updated-mobile.png" });
  applyGameAction(s, g.leaderId, { type: "continue" });
  propose([ids[0], ids[4], ids[5]]);
  await save();
  await expect(result).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.getByRole("button", { name: "返回圓桌", exact: true }).click();
  await expect(vote).toBeVisible();
  await expect(page.locator(".quest-stop.success")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(vote).not.toBeVisible();
  await page.getByRole("button", { name: "查看任務結果", exact: true }).click();
  await expect(result).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(result).not.toBeVisible();
  ids.forEach((id) => applyGameAction(s, id, { type: "teamVote", vote: "approve" }));
  g.selectedPlayerIds.forEach((id) => applyGameAction(s, id, { type: "missionVote", vote: s.private[id].side === "evil" ? "fail" : "success" }));
  await save();
  await expect(result.getByRole("heading", { name: "任務失敗", exact: true })).toBeVisible();
  await expect(result).toContainText("2 張失敗票");
  await fits(page, 1280);
  await page.screenshot({ animations: "disabled", path: ".tools/screenshots/avalon-result-fail-updated.png" });
  await page.keyboard.press("Escape");
  await expect(result).not.toBeVisible();
  ids.forEach((id) => applyGameAction(fifthRejection, id, { type: "teamVote", vote: "reject" }));
  Object.assign(s, fifthRejection);
  await save();
  const victory = page.getByRole("dialog", { name: "阿瓦隆終局揭曉", exact: true });
  await expect(victory.getByRole("heading", { name: "壞人陣營勝利" })).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await fits(page, 360);
  await page.screenshot({ animations: "disabled", path: ".tools/screenshots/avalon-victory-evil-mobile.png" });
  await victory.getByRole("button", { name: "查看全員身份與圓桌" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByLabel("連續否決 5 / 5 次")).toBeVisible();
  await expect(page.getByRole("heading", { name: "邪惡陣營獲勝" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const ending of ["good", "assassinated", "three-fails"] as const) test(`Avalon victory priority: ${ending}`, async ({ page }) => {
  const { session: s, uid, ids, save } = await fixture(page, "avalon", 6);
  ids.forEach((id) => applyGameAction(s, id, { type: "reveal" }));
  await save();
  const g = s.public.game!;
  const evil = ids.find((id) => s.private[id].role === "assassin")!;
  const merlin = ids.find((id) => s.private[id].role === "merlin")!;
  if (ending === "three-fails") {
    g.phase = "MISSION_VOTE";
    g.selectedPlayerIds = [uid, evil];
    g.missionResults = [1, 2].map(() => ({ result: "fail", team: [uid, evil], fails: 1 }));
    g.round = 3;
    applyGameAction(s, uid, { type: "missionVote", vote: "success" });
    applyGameAction(s, evil, { type: "missionVote", vote: "fail" });
    // An AI leader can continue while another player is still reading the reveal.
    await save();
    await expect(page.getByRole("dialog", { name: "任務結果", exact: true })).toBeVisible();
    applyGameAction(s, g.leaderId, { type: "continue" });
  } else {
    await page.getByRole("button", { name: "我的身份", exact: true }).click();
    g.phase = "ASSASSINATION";
    g.missionResults = [1, 2, 3].map(() => ({ result: "success", team: ids.slice(0, 2), fails: 0 }));
    g.round = 3;
    applyGameAction(s, evil, { type: "assassinate", target: ending === "good" ? ids.find((id) => s.private[id].side === "good" && id !== merlin)! : merlin });
  }
  await save();
  const victory = page.getByRole("dialog", { name: "阿瓦隆終局揭曉" });
  if (ending === "three-fails") {
    const report = page.getByRole("dialog", { name: "任務結果", exact: true });
    await expect(report).toBeVisible();
    await expect(victory).toHaveCount(0);
    await report.getByRole("button", { name: "返回圓桌", exact: true }).click();
  }
  await expect(victory.getByRole("heading", { name: ending === "good" ? "好人陣營勝利" : "壞人陣營勝利" })).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(victory.locator(".victory-emblem")).toHaveCSS("animation-name", "none");
  await page.screenshot({ animations: "disabled", path: `.tools/screenshots/avalon-victory-${ending}.png` });
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  g.revision++; await save();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.getByRole("button", { name: "查看勝負" }).click();
  await expect(victory).toBeVisible();
  await page.reload();
  await expect(victory).toBeVisible();
});

for (const gameId of ["timebomb-classic", "timebomb"]) test(`${gameId}: opening cards, private dialog, direct cut and mobile layout`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const count = gameId === "timebomb-classic" ? 8 : 6;
  const { session: s, uid, ids, save } = await fixture(page, gameId, count);
  await expect(page.locator(".wire-player .wire-card")).toHaveCount(count * 5);
  await expect(page.locator(".wire-player .avatar")).toHaveCount(count);
  await expect(page.locator(".cut-card:enabled")).toHaveCount(0);
  for (const width of [360, 390, 768, 1280]) {
    await fits(page, width);
    const card = await page.locator(".wire-player .wire-card").first().boundingBox();
    expect(card!.width).toBeGreaterThan(44);
    expect(card!.height).toBeGreaterThan(card!.width);
  }
  await page.getByRole("button", { name: "查看身份與引線" }).click();
  const privateDialog = page.getByRole("dialog", { name: "你的身份與引線" });
  await expect(privateDialog.locator(".wire-card")).toHaveCount(5);
  await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
  await expect(privateDialog).not.toBeVisible();
  await page.getByRole("button", { name: "查看身份與引線" }).click();
  await page.getByRole("button", { name: "收起情報，確認準備" }).click();
  await expect(privateDialog).not.toBeVisible();
  ids.filter((id) => id !== uid).forEach((id) => applyBombAction(s, id, { type: "bombReveal" }, (a) => a));
  await save();
  await page.getByLabel("我宣稱有").selectOption("1");
  await page.getByRole("button", { name: "送出宣言" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  ids.filter((id) => id !== uid).forEach((id) => applyBombAction(s, id, { type: "claim", successes: 1 }, (a) => a));
  await save();
  await expect(page.locator(".cut-card:enabled")).toHaveCount((count - 1) * 5);
  await page.screenshot({ animations: "disabled", path: `.tools/screenshots/${gameId}-cards-updated.png`, fullPage: true });
  await fits(page, 390);
  await page.screenshot({ animations: "disabled", path: `.tools/screenshots/${gameId}-cards-updated-mobile.png`, fullPage: true });
  const target = page.getByRole("button", { name: "剪開 露西 的第 1 張引線", exact: true });
  await target.click();
  await expect(page.getByRole("dialog", { name: "剪線結果" })).toBeVisible();
  await expect(page.locator(".revealed-card .wire-card")).toHaveCount(1);
  await expect(page.locator(".wire-player .wire-card")).toHaveCount(count * 5 - 1);
  await page.getByRole("button", { name: "繼續剪線", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".cut-card:enabled")).toHaveCount(0);
  await page.getByRole("button", { name: "我的身份與引線" }).click();
  await expect(privateDialog).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(privateDialog).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(privateDialog).not.toBeVisible();
  if (gameId === "timebomb") {
    const g = s.public.timebomb!;
    g.scissorsId = uid;
    g.forcedTarget = uid;
    await save();
    await expect(page.locator(".cut-card:enabled")).toHaveCount(5);
    await expect(page.getByRole("button", { name: "剪開 測試玩家 的第 1 張引線", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "剪開 艾達 的第 1 張引線", exact: true })).toBeDisabled();
  }
  expect(errors).toEqual([]);
});
