import { test, expect } from "@playwright/test";
import { chooseSplendorAction } from "../../functions/src/splendor/bot";
import {
  CARD_BY_ID,
  GEM_NAMES,
  normalizeSplendor,
  TOKEN_COLORS,
} from "../../functions/src/shared/splendor";
import type {
  SplendorPublicState,
  SplendorPrivate,
} from "../../functions/src/shared/splendor";

for (const count of [2, 3, 4])
  test(`Splendor practice with ${count - 1} AI: automatic legal turns and responsive controls`, async ({
    page,
  }) => {
    test.setTimeout(300000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const auth = page.waitForResponse((r) =>
      r.url().includes("accounts:signUp"),
    );
    await page.goto("/");
    const { localId: uid, idToken } = await (await auth).json();
    await page.getByLabel("讓大家認識你").fill("練習商人");
    await page.getByRole("button", { name: "入座，開始冒險" }).click();
    await page
      .locator(".game-card.splendor")
      .getByRole("link", { name: "單人練習 · 與 AI 對局" })
      .click();
    await page.getByLabel("對局人數（包含你）").selectOption(String(count));
    await page
      .getByLabel("AI 難度")
      .selectOption(count === 3 ? "casual" : "standard");
    await page.getByRole("button", { name: "建立練習桌", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "等待朋友入座" }),
    ).toBeVisible();
    const code = (await page
      .getByRole("button", { name: "複製房間代碼" })
      .textContent())!.trim();
    const module =
      count === 2 ? "base" : count === 3 ? "cities" : "tradingPosts";
    if (module !== "base")
      await page.getByLabel("選擇玩法").selectOption(module);
    if (count === 4) {
      // This control is authoritative-server controlled; wait for the committed state.
      await page.getByRole("checkbox", { name: /競技模式/ }).click();
      await expect(
        page.getByRole("checkbox", { name: /競技模式/ }),
      ).toBeChecked();
    }
    await expect(page.locator(".player-list .ready")).toHaveCount(count - 1);
    await page.getByRole("button", { name: "我準備好了", exact: true }).click();
    await page.getByRole("button", { name: "開始遊戲", exact: true }).click();
    await expect(page.locator(".sp-game")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    if (count === 3) {
      await expect(page.locator(".sp-patrons")).toContainText("城市目標");
      await expect(page.locator(".sp-patron")).toHaveCount(3);
    }
    if (count === 4) {
      await expect(page.locator(".sp-card.affordable")).toHaveCount(0);
      await page.locator(".sp-posts summary").click();
      await expect(page.locator(".sp-posts article")).toHaveCount(5);
    }
    const read = async <T>(path: string): Promise<T> => {
      const res = await fetch(
        `http://127.0.0.1:9000/sessions/${code}/${path}.json?ns=demo-boardgame-default-rtdb&auth=${idToken}`,
      );
      expect(res.status).toBe(200);
      return res.json();
    };
    const state = async () =>
      normalizeSplendor(await read<SplendorPublicState>("public/splendor"));
    let humanMoves = 0,
      aiMoves = 0,
      lastRevision = 0;
    while (humanMoves < (count === 2 ? 200 : 7)) {
      await expect
        .poll(
          async () => {
            const g = await state();
            return (
              g.phase === "GAME_OVER" ||
              g.playerOrder[g.currentPlayerIndex] === uid
            );
          },
          { timeout: 30000 },
        )
        .toBe(true);
      const g = await state();
      aiMoves += Math.max(0, g.revision - lastRevision);
      if (g.phase === "GAME_OVER") break;
      const own = await read<SplendorPrivate>(`splendorPrivate/${uid}`);
      const selected = chooseSplendorAction(uid, g, own, (a) => a);
      expect(selected).not.toBeNull();
      const action = selected!;
      if (action.type === "splendorTake") {
        await page.getByRole("button", { name: /異色 ×/ }).click();
        for (const c of action.colors)
          await page
            .getByRole("button", {
              name: `${GEM_NAMES[c]}，庫存 ${g.bank[c]}`,
              exact: true,
            })
            .click();
        await page
          .getByRole("button", {
            name: `拿取 ${action.colors.length}`,
            exact: true,
          })
          .click();
      } else if (action.type === "splendorDouble") {
        await page
          .getByRole("button", { name: "同色 ×2", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: `${GEM_NAMES[action.color]}，庫存 ${g.bank[action.color]}`,
            exact: true,
          })
          .click();
        await page.getByRole("button", { name: "拿取 2", exact: true }).click();
      } else if (
        action.type === "splendorBuy" ||
        action.type === "splendorReserve"
      ) {
        const id =
          action.type === "splendorBuy" && action.slot
            ? own.reserved[action.slot]
            : action.cardId!;
        const card = CARD_BY_ID[id];
        await page
          .locator(
            action.type === "splendorBuy" && action.slot
              ? ".sp-reserve-row"
              : ".sp-market",
          )
          .getByRole("button", {
            name: `${card.name}，${card.tier} 階，${GEM_NAMES[card.bonusColor]}加成，${card.prestige} 聲望`,
            exact: true,
          })
          .click();
        if (count === 4)
          await expect(page.locator(".sp-payment")).toHaveCount(0);
        await page
          .getByRole("dialog")
          .getByRole("button", {
            name: action.type === "splendorBuy" ? "購買" : /^保留/,
            exact: action.type === "splendorBuy",
          })
          .click();
      } else if (action.type === "splendorReturn") {
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "關閉視窗" }),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeVisible();
        for (const c of TOKEN_COLORS)
          for (let n = 0; n < (action.tokens[c] ?? 0); n++)
            await page
              .getByRole("button", {
                name: `增加退回${GEM_NAMES[c]}`,
                exact: true,
              })
              .click();
        await page.getByRole("button", { name: /退回 \d+ \// }).click();
      } else if (action.type === "splendorNoble") {
        await page
          .locator(".sp-noble-choice")
          .filter({
            hasText: g.nobles.find((n) => n.id === action.nobleId)!.name,
          })
          .click();
      } else throw new Error(`unexpected ${action.type}`);
      humanMoves++;
      lastRevision = g.revision + 1;
      await expect
        .poll(async () => (await state()).revision)
        .toBeGreaterThan(g.revision);
      if (humanMoves === 2) {
        await page.reload();
        await expect(page.locator(".sp-game")).toBeVisible();
      }
    }
    expect(aiMoves).toBeGreaterThan(0);
    if (count === 2) {
      await expect(page.locator(".sp-result")).toContainText("勝出");
      await page.getByRole("button", { name: "再開一局", exact: true }).click();
      await expect(page.locator(".player-list .ready")).toHaveCount(1);
    } else {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.tools/screenshots/splendor-practice-${count}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    expect(errors).toEqual([]);
  });
