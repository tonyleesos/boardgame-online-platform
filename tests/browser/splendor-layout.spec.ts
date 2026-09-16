import { test, expect } from "@playwright/test";
import { registerPlayer } from "./auth-helpers";
import { startSplendorGame } from "../../functions/src/splendor/engine";
import { CARD_BY_ID, GEM_COLORS, TOKEN_COLORS, GEM_NAMES, calculateBonuses } from "../../functions/src/shared/splendor";
import type { Expansion } from "../../functions/src/shared/splendor";
import type { Session } from "../../functions/src/shared/model";

for (const module of ["base", "orient", "cities", "tradingPosts", "strongholds"] as Expansion[]) {
  test(`Splendor compact ${module}: public resources stay readable on phones and desktop`, async ({ page }) => {
    const { localId: uid } = await registerPlayer(page, "星河");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const session: Session = {
      public: {
        code, gameId: "splendor", hostId: uid, status: "waiting", createdAt: Date.now(),
        players: Object.fromEntries([uid, "p1", "p2", "p3"].map((id, i) => [
          id, { uid: id, nickname: ["星河", "長名字的玩家", "海月", "晨光"][i], joinedAt: i, ready: true },
        ])),
        splendorConfig: { module, competitorMode: false },
      },
      private: {}, secret: { teamVotes: {}, missionVotes: {} },
    };
    startSplendorGame(session, "layout-game", (cards) => [...cards].reverse());
    const game = session.public.splendor!;
    // Populate public collections and private reserves, including a four-color
    // price, to exercise the crowded layout beyond the empty opening position.
    for (const [i, player] of Object.values(game.players).entries()) {
      player.purchasedCardIds = GEM_COLORS.flatMap((color) =>
        Object.values(CARD_BY_ID).filter((card) => card.bonusColor === color).slice(i * 2, i * 2 + 2).map((card) => card.id));
      player.tokens = { white: 2, blue: 1, green: 2, red: 1, black: 2, gold: 1 };
      if (module === "orient") {
        const double = Object.values(CARD_BY_ID).find((card) => card.orientEffect?.type === "double")!;
        const copy = Object.values(CARD_BY_ID).find((card) => card.orientEffect?.type === "copy")!;
        player.purchasedCardIds.push(double.id, copy.id);
        player.copiedBonuses = { [copy.id]: "red" };
      }
    }
    const reserves = Object.values(CARD_BY_ID).filter((card) => Object.keys(card.cost).length >= 4).slice(0, 3);
    game.players[uid].reservedCards = reserves.map((card, i) => ({ slot: `r${i}`, tier: card.tier, source: card.source, cardId: card.id }));
    const endpoint = `http://127.0.0.1:9000/sessions/${code}.json?ns=demo-boardgame-default-rtdb`;
    const save = async () => {
      const response = await fetch(endpoint, { method: "PUT", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify(session) });
      expect(response.ok).toBe(true);
    };
    try {
      await save();
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(`/room/${code}`);
      await expect(page.locator(".sp-reserve-row .sp-card")).toHaveCount(3);
      for (const size of [{ width: 320, height: 568 }, { width: 390, height: 740 }, { width: 1280, height: 900 }]) {
        await page.setViewportSize(size);
        for (const player of Object.values(game.players)) {
          const panel = page.getByRole("article", { name: `${player.nickname} 的玩家資訊`, exact: true });
          for (const color of TOKEN_COLORS) await expect(panel.getByLabel(`${GEM_NAMES[color]}持有 ${player.tokens[color]} 枚`, { exact: true })).toBeVisible();
          for (const color of GEM_COLORS) await expect(panel.getByLabel(`${GEM_NAMES[color]}永久折扣 ${calculateBonuses(player)[color]}`, { exact: true })).toBeVisible();
          await expect(panel.getByLabel(`已保留 ${player.reservedCards.length} 張`, { exact: true })).toContainText(`保留卡 ${player.reservedCards.length} / 3`);
        }
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.screenshot({ path: `.tools/screenshots/splendor-compact-${module}-${size.width}.png`, fullPage: true });
        const layout = await page.evaluate(() => ({
          height: innerHeight, scroll: document.documentElement.scrollHeight, width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          sections: [...document.querySelectorAll('.sp-game > *, .sp-market, .sp-bank, .sp-player > *')].map((el) => ({ class: el.className, height: el.getBoundingClientRect().height, minHeight: getComputedStyle(el).minHeight, gap: getComputedStyle(el).gap })),
          clipped: [...document.querySelectorAll(".sp-player, .sp-patron, .sp-market .sp-card, .sp-deck, .sp-token, .sp-bank-action button, .sp-reserve-row > *")].flatMap((el) => {
            const box = el.getBoundingClientRect();
            return box.top < 0 || box.bottom > document.documentElement.scrollHeight + 1 || box.left < 0 || box.right > innerWidth + 1 || !box.height
              ? [{ class: el.className, top: box.top, bottom: box.bottom, left: box.left, right: box.right }] : [];
          }),
          overlappingPrices: [...document.querySelectorAll(".sp-market .sp-card")].some((card) =>
            card.querySelector(".sp-card-head")!.getBoundingClientRect().bottom > card.querySelector(".sp-card-cost")!.getBoundingClientRect().top),
          clippedCardDetails: [...document.querySelectorAll(".sp-market .sp-card")].some((card) => {
            const bounds = card.getBoundingClientRect();
            return [...card.querySelectorAll(".sp-prestige, .sp-card-bonus, .sp-card-bonus b, .sp-card-cost .sp-amount")].some((detail) => {
              const box = detail.getBoundingClientRect();
              return box.width > 0 && (box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom);
            });
          }),
        }));
        expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
        if (size.width <= 600) {
          // Short phones may scroll the page; the full player summary remains
          // visible together, with no inner scroll areas or hidden resources.
          await expect(page.locator(".sp-player").last()).toBeInViewport();
        }
        expect(layout.clipped, JSON.stringify(layout)).toEqual([]);
        expect(layout.overlappingPrices, JSON.stringify(layout)).toBe(false);
        expect(layout.clippedCardDetails, JSON.stringify(layout)).toBe(false);
      }
      await page.getByRole("button", { name: "查看 星河 的收藏", exact: true }).click();
      await expect(page.locator(".sp-owned-list > span")).toHaveCount(module === "orient" ? 12 : 10);
      await page.getByRole("button", { name: "關閉視窗" }).click();
      await page.locator(".sp-reserve-row .sp-card").first().click();
      await expect(page.getByRole("dialog")).toContainText(reserves[0].name);
      await expect(page.getByRole("button", { name: "購買", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "關閉視窗" }).click();
      await page.getByRole("button", { name: "查看交易紀錄" }).click();
      await expect(page.getByRole("dialog", { name: "交易紀錄" })).toBeVisible();
      await page.getByRole("button", { name: "關閉視窗" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.setViewportSize({ width: 390, height: 740 });
      if (module === "base") {
        session.public.status = "finished";
        game.phase = "GAME_OVER";
        game.winners = [uid];
        game.revision++;
        await save();
        await expect(page.getByRole("dialog", { name: "對局結果" })).toContainText("星河 勝出");
        await page.getByRole("button", { name: "關閉視窗" }).click();
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(740);
        await page.getByRole("button", { name: "查看對局結果" }).click();
        await expect(page.getByRole("button", { name: /再開一局/ })).toBeVisible();
        await page.getByRole("button", { name: "關閉視窗" }).click();
      }
      if (module === "strongholds") {
        game.phase = "RESOLVE_EXPANSION";
        game.revision++;
        await save();
        await expect(page.getByRole("button", { name: "略過", exact: true })).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(740);
      }
    } finally {
      await fetch(endpoint, { method: "DELETE", headers: { Authorization: "Bearer owner" } });
    }
  });
}
