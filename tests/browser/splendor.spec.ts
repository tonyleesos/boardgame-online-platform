import { registerPlayer } from "./auth-helpers";
import { test, expect } from "@playwright/test";
import {
  CARD_BY_ID,
  GEM_COLORS,
  GEM_NAMES,
  TOKEN_COLORS,
  calculatePurchasePayment,
  emptyTokens,
  getEligibleNobles,
  mustReturnTokens,
  normalizeSplendor,
} from "../../functions/src/shared/splendor";
import type { SplendorPublicState } from "../../functions/src/shared/splendor";

for (const count of [2, 3, 4])
  test(`Splendor ${count} browsers: responsive market, real actions, private reserve and reconnect`, async ({
    browser,
  }) => {
    test.setTimeout(360000);
    const contexts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        browser.newContext({
          viewport:
            i === 0
              ? { width: 390, height: 844 }
              : { width: 1024, height: 900 },
        }),
      ),
    );
    const actors = await Promise.all(
      contexts.map(async (context, i) => {
        const page = await context.newPage();
        const credentials = await registerPlayer(
          page,
          ["星河", "小嵐", "海月", "晨光"][i],
        );
        return {
          page,
          uid: credentials.localId as string,
          idToken: credentials.idToken as string,
        };
      }),
    );
    const errors: string[] = [];
    for (const a of actors)
      a.page.on("pageerror", (e) => errors.push(e.message));
    const host = actors[0];
    try {
      await expect(host.page.locator(".game-card.splendor")).toContainText(
        "璀璨寶石",
      );
      await expect(
        host.page.locator(".game-card.splendor .practice-link"),
      ).toHaveCount(1);
      await host.page
        .locator(".game-card.splendor")
        .getByRole("link", { name: "建立房間" })
        .click();
      await host.page
        .getByRole("button", { name: "建立房間", exact: true })
        .click();
      await expect(
        host.page.getByRole("heading", { name: "等待朋友入座" }),
      ).toBeVisible();
      const code = (await host.page
        .getByRole("button", { name: "複製房間代碼" })
        .textContent())!.trim();
      for (const a of actors.slice(1)) {
        await a.page.goto("/join");
        await a.page.getByLabel("房間代碼").fill(code);
        await a.page
          .getByRole("button", { name: "加入房間", exact: true })
          .click();
        await expect(
          a.page.getByRole("heading", { name: "等待朋友入座" }),
        ).toBeVisible();
      }
      const module =
        count === 2 ? "base" : count === 3 ? "orient" : "strongholds";
      if (module !== "base")
        await host.page.getByLabel("選擇玩法").selectOption(module);
      await expect(
        host.page.getByRole("button", { name: /新增 AI/ }),
      ).toHaveCount(1);
      for (const a of actors)
        await a.page
          .getByRole("button", { name: "我準備好了", exact: true })
          .click();
      await host.page
        .getByRole("button", { name: "開始遊戲", exact: true })
        .click();
      for (const a of actors)
        await expect(a.page.locator(".sp-market .sp-card")).toHaveCount(
          module === "orient" ? 18 : 12,
        );
      const read = async () => {
        const res = await fetch(
          `http://127.0.0.1:9000/sessions/${code}/public/splendor.json?ns=demo-boardgame-default-rtdb&auth=${host.idToken}`,
        );
        expect(res.status).toBe(200);
        return normalizeSplendor((await res.json()) as SplendorPublicState);
      };
      let g = await read();
      for (const width of [360, 390, 768, 1280]) {
        await host.page.setViewportSize({
          width,
          height: width === 768 ? 1024 : 900,
        });
        await host.page.locator(".sp-game").scrollIntoViewIfNeeded();
        await host.page.screenshot({
          path: `.tools/screenshots/splendor-${count}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
        const overflow = await host.page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          wide: [...document.querySelectorAll("body *")]
            .filter(
              (el) =>
                el.getBoundingClientRect().right > innerWidth &&
                getComputedStyle(el).position !== "absolute",
            )
            .slice(0, 12)
            .map((el) => ({
              tag: el.tagName,
              class: el.className,
              right: el.getBoundingClientRect().right,
              width: el.getBoundingClientRect().width,
            })),
        }));
        expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
          width,
        );
      }
      await host.page.setViewportSize({ width: 390, height: 844 });
      await host.page.getByRole("button", { name: "遊戲圖示說明" }).click();
      await expect(
        host.page.getByRole("dialog", { name: "一眼學會交易" }),
      ).toBeVisible();
      await host.page.getByRole("button", { name: "開始打造收藏" }).click();
      await host.page
        .getByRole("button", { name: "保留 基礎 1 階暗牌", exact: true })
        .click();
      await host.page
        .getByRole("button", { name: "確認保留", exact: true })
        .click();
      await expect(host.page.locator(".sp-reserve-row .sp-card")).toHaveCount(
        1,
      );
      await expect(actors[1].page.locator(".sp-turn")).toContainText("輪到你");
      await actors[1].page
        .getByRole("button", { name: "查看 星河 的收藏", exact: true })
        .click();
      await expect(actors[1].page.locator(".sp-public-reserves")).toContainText(
        "暗牌",
      );
      await actors[1].page.getByRole("button", { name: "關閉視窗" }).click();
      await host.page.reload();
      await expect(host.page.locator(".sp-reserve-row .sp-card")).toHaveCount(
        1,
      );
      let buys = 0,
        steps = 0;
      // Two players finish through browser controls. Other sizes exercise a purchase and the expansion board.
      while (
        (g = await read()).phase !== "GAME_OVER" &&
        steps++ < (count === 2 ? 600 : 60)
      ) {
        const uid = g.playerOrder[g.currentPlayerIndex],
          p = g.players[uid],
          actor = actors.find((a) => a.uid === uid)!,
          page = actor.page;
        await expect(page.locator(".sp-turn")).toContainText(
          g.phase === "PLAYER_ACTION"
            ? "輪到你"
            : g.phase === "RETURN_EXCESS_TOKENS"
              ? "退回"
              : g.phase === "CHOOSE_NOBLE"
                ? "貴族"
                : g.phase === "RESOLVE_EXPANSION"
                  ? "要塞"
                  : "額外",
        );
        const revision = g.revision;
        if (g.phase === "RETURN_EXCESS_TOKENS") {
          const tokens = emptyTokens();
          let excess = mustReturnTokens(p);
          for (const c of [...TOKEN_COLORS].sort(
            (a, b) => p.tokens[b] - p.tokens[a],
          )) {
            tokens[c] = Math.min(excess, p.tokens[c]);
            excess -= tokens[c];
            for (let n = 0; n < tokens[c]; n++)
              await page
                .getByRole("button", {
                  name: `增加退回${GEM_NAMES[c]}`,
                  exact: true,
                })
                .click();
          }
          await page
            .getByRole("button", {
              name: new RegExp(`退回 ${mustReturnTokens(p)} /`),
            })
            .click();
        } else if (g.phase === "CHOOSE_NOBLE")
          await page
            .locator(".sp-noble-choice")
            .filter({ hasText: getEligibleNobles(p, g)[0].name })
            .click();
        else if (
          g.phase === "RESOLVE_EXPANSION" ||
          g.phase === "STRONGHOLD_BONUS_PURCHASE"
        )
          await page.getByRole("button", { name: "略過", exact: true }).click();
        else {
          const privateRes = await fetch(
            `http://127.0.0.1:9000/sessions/${code}/splendorPrivate/${uid}.json?ns=demo-boardgame-default-rtdb&auth=${actor.idToken}`,
          );
          const own = await privateRes.json();
          const cards = Object.values(g.market)
            .flat()
            .filter((id): id is string => !!id)
            .map((id) => ({ card: CARD_BY_ID[id], reserve: false }));
          for (const r of p.reservedCards)
            cards.push({
              card: CARD_BY_ID[own.reserved[r.slot]],
              reserve: true,
            });
          const usable = cards.filter(
            (c) =>
              !c.card.orientEffect || c.card.orientEffect.type === "double",
          );
          const affordable = usable
            .filter((c) => calculatePurchasePayment(c.card, p).affordable)
            .sort(
              (a, b) =>
                b.card.prestige * 2 +
                6 -
                p.bonuses[b.card.bonusColor] -
                (a.card.prestige * 2 + 6 - p.bonuses[a.card.bonusColor]),
            );
          if (affordable.length) {
            const { card: c, reserve } = affordable[0];
            const label = `${c.name}，${c.tier} 階，${GEM_NAMES[c.bonusColor]}加成，${c.prestige} 聲望`;
            await page
              .locator(reserve ? ".sp-reserve-row" : ".sp-market")
              .getByRole("button", { name: label, exact: true })
              .click();
            await expect(page.locator(".sp-payment")).toBeVisible();
            if (!buys && actor === host)
              await page.screenshot({
                path: ".tools/screenshots/splendor-purchase-mobile.png",
                animations: "disabled",
              });
            await page
              .getByRole("button", { name: "購買", exact: true })
              .click();
            buys++;
          } else {
            const rank = (c: (typeof usable)[number]) => {
              const pay = calculatePurchasePayment(c.card, p);
              return (
                GEM_COLORS.reduce(
                  (n, k) =>
                    n + Math.max(0, pay.requiredAfterBonuses[k] - p.tokens[k]),
                  0,
                ) -
                c.card.prestige * 0.4
              );
            };
            const target = usable.sort((a, b) => rank(a) - rank(b))[0],
              pay = calculatePurchasePayment(target.card, p);
            const colors = [...GEM_COLORS]
              .filter((c) => g.bank[c] > 0)
              .sort(
                (a, b) =>
                  pay.requiredAfterBonuses[b] -
                  p.tokens[b] -
                  (pay.requiredAfterBonuses[a] - p.tokens[a]),
              )
              .slice(0, 3);
            expect(colors.length).toBeGreaterThan(0);
            for (const c of colors)
              await page
                .getByRole("button", {
                  name: `${GEM_NAMES[c]}，庫存 ${g.bank[c]}`,
                  exact: true,
                })
                .click();
            await page
              .getByRole("button", {
                name: `拿取 ${colors.length}`,
                exact: true,
              })
              .click();
          }
        }
        await expect
          .poll(async () => (await read()).revision)
          .toBeGreaterThan(revision);
        if (count !== 2 && buys >= 3 && g.phase === "PLAYER_ACTION") break;
      }
      expect(buys).toBeGreaterThan(0);
      if (count === 2) {
        expect((await read()).phase).toBe("GAME_OVER");
        for (const a of actors)
          await expect(a.page.locator(".sp-result")).toContainText("勝出");
        await host.page
          .getByRole("button", { name: "再開一局", exact: true })
          .click();
        await expect(
          host.page.getByRole("heading", { name: "等待朋友入座" }),
        ).toBeVisible();
      }
      expect(errors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
