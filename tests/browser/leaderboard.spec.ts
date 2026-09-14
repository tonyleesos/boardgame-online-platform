import { test, expect } from "@playwright/test";
import { registerPlayer } from "./auth-helpers";
test.use({ reducedMotion: "reduce" });

test("leaderboard opens, sorts, retries, closes with Escape and fits mobile", async ({
  page,
}) => {
  await registerPlayer(page, "排行榜測試員");
  // UI fixtures keep ranking assertions independent of other emulator games.
  const wins = {
    avalon: 0,
    splendor: 0,
    decorum: 0,
    timebomb: 0,
    "timebomb-classic": 0,
    "mafia-de-cuba": 0,
  };
  const alice = {
    uid: "alice",
    nickname: "小艾",
    totalWins: 9,
    wins: { ...wins, avalon: 8, splendor: 1 },
  };
  const bob = {
    uid: "bob",
    nickname: "小柏",
    totalWins: 7,
    wins: { ...wins, avalon: 2, splendor: 5 },
  };
  const others = [6, 4, 2].map((score) => ({
    uid: `other-${score}`,
    nickname: `玩家${score}`,
    totalWins: score,
    wins: { ...wins, avalon: score },
  }));
  let fail = false;
  let requests = 0;
  await page.route("**/getLeaderboard", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
        },
      });
    const sort = route.request().postDataJSON().data.sort;
    requests++;
    await route.fulfill({
      status: fail ? 500 : 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(
        fail
          ? { error: { status: "INTERNAL", message: "test failure" } }
          : {
              result: {
                entries:
                  sort === "decorum"
                    ? []
                    : sort === "splendor"
                      ? [bob, alice]
                      : [alice, bob, ...others],
                self: null,
                limit: 5,
              },
            },
      ),
    });
  });
  const launch = page.getByRole("button", { name: "勝場排行榜" });
  await launch.click();
  const dialog = page.getByRole("dialog", { name: "勝場排行榜" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("tbody tr").first()).toContainText("小艾");
  await expect(dialog.locator("tbody tr")).toHaveCount(5);
  await expect(dialog).toContainText("最多顯示前 5 位有勝場的玩家");
  await expect(dialog.locator("tbody tr").last()).toContainText("玩家2");
  await dialog.getByLabel("排行方式").selectOption("splendor");
  await expect(dialog.locator("tbody tr").first()).toContainText("小柏");
  await dialog.getByLabel("排行方式").selectOption("total");
  await expect(dialog.locator("tbody tr").first()).toContainText("小艾");
  await dialog.getByLabel("排行方式").selectOption("splendor");
  await expect(dialog.locator("tbody tr").first()).toContainText("小柏");
  expect(requests).toBe(2);
  await dialog.getByLabel("排行方式").selectOption("total");
  await expect(dialog.locator("tbody tr")).toHaveCount(5);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await dialog.evaluate(
        (el) =>
          el.getBoundingClientRect().right <= innerWidth &&
          el.getBoundingClientRect().left >= 0,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.tools/screenshots/leaderboard-${width}.png`,
    });
  }
  await dialog.getByLabel("排行方式").selectOption("decorum");
  await expect(dialog.getByText("第一場勝利，等你寫下。")).toBeVisible();
  fail = true;
  await dialog.getByRole("button", { name: "重新整理" }).click();
  await expect(dialog.getByRole("alert")).toContainText("排行榜讀取失敗");
  fail = false;
  await dialog.getByRole("button", { name: "重新整理" }).click();
  await expect(dialog.getByText("第一場勝利，等你寫下。")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(launch).toBeFocused();
  const previousRequests = requests;
  await launch.click();
  await expect(dialog.locator("tbody tr").first()).toContainText("小艾");
  expect(requests).toBe(previousRequests);
});

test("leaderboard reads the authenticated Firebase callable", async ({
  page,
}) => {
  await registerPlayer(page, "排行榜連線測試");
  await page.getByRole("button", { name: "勝場排行榜" }).click();
  const dialog = page.getByRole("dialog", { name: "勝場排行榜" });
  await expect(dialog.getByText("我的累積勝場")).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "關閉視窗" }).click();
  await expect(dialog).not.toBeVisible();
});
