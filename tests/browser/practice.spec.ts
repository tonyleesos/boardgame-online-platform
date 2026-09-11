import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function createPractice(page: Page, gameId: string, count?: number) {
  await page.goto("/");
  await page.getByLabel("讓大家認識你").fill("練習玩家");
  await page.getByRole("button", { name: "入座，開始冒險" }).click();
  await page
    .locator(`.game-card.${gameId}`)
    .getByRole("link", { name: "單人練習 · 與 AI 對局" })
    .click();
  if (count)
    await page.getByLabel("對局人數（包含你）").selectOption(String(count));
  await page.getByRole("button", { name: "建立練習桌" }).click();
  await expect(
    page.getByRole("heading", { name: "等待朋友入座" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "我準備好了", exact: true }).click();
  await page.getByRole("button", { name: "開始遊戲", exact: true }).click();
}
const usable = async (page: Page, name: string) => {
  return page
    .getByRole("button", { name, exact: true })
    .and(page.locator(":enabled:visible"))
    .count()
    .then(Boolean);
};
async function nextHumanMove(page: Page, gameId: string) {
  let next = "";
  await expect
    .poll(
      async () => {
        if (gameId === "avalon" && await page.getByRole("dialog", { name: "阿瓦隆終局揭曉" }).isVisible()) return (next = "done");
        if (await page.getByRole("heading", { name: /陣營獲勝/ }).isVisible())
          return (next = "done");
        for (const name of gameId === "timebomb"
          ? ["送出宣言", "繼續剪線", "收回剩餘引線，進入下一輪"]
          : ["贊成", "任務成功", "繼續遊戲", "返回圓桌", "確認刺殺"]) {
          if (await usable(page, name)) return (next = name);
        }
        if (gameId === "timebomb") {
          if (await page.locator(".cut-card:enabled").count())
            return (next = "cut");
          if (await page.locator(".bomb-choice:enabled").count())
            return (next = "effect");
        } else {
          if (
            await page
              .getByRole("heading", { name: "由你組建這次的遠征隊。" })
              .isVisible()
          )
            return (next = "team");
          if (
            await page
              .locator('.team-picker button[aria-label^="刺殺 "]:enabled')
              .count()
          )
            return (next = "assassinate");
        }
        return (next = "");
      },
      { timeout: 40000, intervals: [300, 500, 700] },
    )
    .not.toBe("");
  return next;
}
for (const variant of ["classic", "evolution"])
  test(`solo Time Bomb ${variant}: AI, complete game, cards and mobile`, async ({
    page,
  }) => {
    test.setTimeout(300000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await createPractice(
      page,
      variant === "classic" ? "timebomb-classic" : "timebomb",
      variant === "classic" ? 8 : 6,
    );
    await page.getByRole("button", { name: "查看身份與引線" }).click();
    await expect(
      page.getByRole("dialog", { name: "你的身份與引線" }),
    ).toBeVisible();
    await expect(page.locator(".private-hand .wire-card")).toHaveCount(5);
    await expect(page.locator("dialog:modal")).toHaveCount(1);
    await page.screenshot({
      path: `.tools/screenshots/timebomb-${variant}-private.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.locator(".private-hand .wire-card").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.tools/screenshots/timebomb-${variant}-private-mobile.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "收起情報，確認準備" }).click();
    await expect(
      page.getByRole("dialog", { name: "交換情報", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".bomb-stage")).toHaveCSS("opacity", "1");
    for (const width of [360, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 950 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.tools/screenshots/timebomb-${variant}-${width}.png`,
        fullPage: true,
      });
    }
    // Firebase identity, hidden inventory and current round survive a refresh.
    const count = await page.locator(".player-list li").count();
    await page.reload();
    await expect(page.locator(".player-list li")).toHaveCount(count);
    for (let turns = 0; turns < 90; turns++) {
      const next = await nextHumanMove(page, "timebomb");
      if (next === "done") break;
      if (next === "cut")
        await page.locator(".cut-card:enabled").first().click();
      else if (next === "effect")
        await page.locator(".bomb-choice:enabled").first().click();
      else {
        if (next === "送出宣言")
          await page.getByLabel("我宣稱有").selectOption("1");
        const button = page.getByRole("button", { name: next, exact: true });
        await button.click();
        await expect
          .poll(
            async () =>
              (await button.isVisible()) && (await button.isEnabled()),
          )
          .toBe(false);
      }
    }
    await expect(page.getByRole("heading", { name: /陣營獲勝/ })).toBeVisible();
    await page.locator(".ai-conversation summary").click();
    await expect(page.locator(".ai-messages p").first()).toBeVisible();
    await page.screenshot({
      path: `.tools/screenshots/timebomb-${variant}-result.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "再玩一局" }).click();
    await expect(
      page.getByRole("button", { name: "我準備好了", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".player-list li")).toHaveCount(count);
    expect(errors).toEqual([]);
  });

test("solo Avalon completes a legal game against four AI players", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await createPractice(page, "avalon");
  await page.getByRole("button", { name: "查看你的身份" }).click();
  await page.getByRole("button", { name: "收起身份，確認準備" }).click();
  for (let turns = 0; turns < 100; turns++) {
    const next = await nextHumanMove(page, "avalon");
    if (next === "done") break;
    if (next === "team") {
      const submit = page.getByRole("button", { name: /提交隊伍/ });
      const text = await submit.innerText();
      const match = text.match(/（(\d+)\/(\d+)）/)!;
      for (let i = Number(match[1]); i < Number(match[2]); i++) {
        const member = page
          .locator('.team-picker button[aria-pressed="false"]:enabled')
          .first();
        await member.click();
        await expect(submit).toContainText(`（${i + 1}/${match[2]}）`);
      }
      await submit.click();
      await expect(submit).not.toBeVisible();
    } else if (next === "assassinate")
      await page
        .locator('.team-picker button[aria-label^="刺殺 "]:enabled')
        .first()
        .click();
    else {
      const button = page.getByRole("button", { name: next, exact: true });
      await button.click();
      await expect
        .poll(
          async () => (await button.isVisible()) && (await button.isEnabled()),
        )
        .toBe(false);
    }
  }
  await expect(page.getByRole("dialog", { name: "阿瓦隆終局揭曉" })).toBeVisible();
  await page.screenshot({
    path: ".tools/screenshots/avalon-ai-result.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
