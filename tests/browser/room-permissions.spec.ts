import { registerPlayer } from "./auth-helpers";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const game of [
  { id: "mafia-de-cuba", privateBranch: "mafiaPrivate" },
  { id: "saboteur-2", privateBranch: "saboteurPrivate" },
  { id: "criminal-dance", privateBranch: "dancePrivate" },
  { id: "blades-and-rose", privateBranch: "rosePrivate" },
])
  test(`${game.id}: missing game-private permissions preserve membership; retry recovers; unrelated games still work`, async ({
    page,
  }) => {
    const rules = JSON.parse(await readFile("database.rules.json", "utf8"));
    const oldRules = structuredClone(rules);
    delete oldRules.rules.sessions.$code[game.privateBranch];
    const updateRules = async (value: unknown) => {
      const r = await fetch(
        "http://127.0.0.1:9000/.settings/rules.json?ns=demo-boardgame-default-rtdb",
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer owner",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(value),
        },
      );
      expect(r.status).toBe(200);
    };
    await updateRules(oldRules);
    try {
      await registerPlayer(page, "Permission test");
      await page.goto(`/create/${game.id}?mode=practice`);
      await page.getByRole("button", { name: "建立練習桌" }).click();
      await expect(
        page.getByRole("button", { name: "我準備好了", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "我準備好了", exact: true })
        .click();
      await page.getByRole("button", { name: "開始遊戲", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText("你的座位已保留");
      await expect(page.getByRole("alert")).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: /重新載入私人資料|重新讀取私人手牌/ }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("heading", { name: "無法進入房間" }),
      ).toHaveCount(0);
      // A public update/reconnect must not erase the still-failed private status.
      await page.reload();
      await expect(page.getByRole("alert")).toContainText("你的座位已保留");
      await updateRules(rules);
      await page.getByRole("button", { name: "重新載入私人資料" }).click();
      if (game.id === "mafia-de-cuba") {
        await expect(
          page.getByRole("button", { name: "傳出雪茄盒" }),
        ).toBeVisible();
        await expect(page.getByRole("alert")).toHaveCount(0);
        await page.getByRole("button", { name: "傳出雪茄盒" }).click();
        await expect(
          page.getByRole("button", { name: "檢查雪茄盒" }),
        ).toBeVisible({
          timeout: 20000,
        });
      } else if (game.id === "blades-and-rose") {
        await expect(page.locator(".br-table")).toBeVisible();
        await expect(page.locator(".br-hand .br-card")).toHaveCount(3);
        await expect(page.getByRole("alert")).toHaveCount(0);
        await page.getByRole("button", { name: "查看我的身分" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page
          .getByRole("button", { name: "確認身分，完成夜晚儀式" })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      } else if (game.id === "criminal-dance") {
        await expect(page.locator(".cd-game")).toBeVisible();
        await expect(page.locator(".cd-hand-card")).toHaveCount(4);
        await expect(page.getByRole("alert")).toHaveCount(0);
      } else {
        await expect(page.locator(".mine-game")).toBeVisible();
        await expect(page.locator(".mine-mini-card")).toHaveCount(6);
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "換牌 / 解除狀態", exact: true }),
        ).toBeEnabled({ timeout: 30000 });
        await page
          .getByRole("button", { name: "換牌 / 解除狀態", exact: true })
          .click();
        await page
          .locator(".mine-dialog .mine-hand-grid button")
          .first()
          .click();
        await page.getByRole("button", { name: "確認換 1 張牌" }).click();
        await expect(page.locator(".mine-receipt")).toBeVisible();
      }

      await page
        .getByRole("button", { name: "離開房間", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "確認離開", exact: true }).click();
      await expect(page).toHaveURL(/\/games$/);
      await updateRules(oldRules);
      await page.goto("/create/splendor?mode=practice");
      await page.getByRole("button", { name: "建立練習桌" }).click();
      await page
        .getByRole("button", { name: "我準備好了", exact: true })
        .click();
      await page.getByRole("button", { name: "開始遊戲", exact: true }).click();
      await expect(page.locator(".sp-game")).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "無法進入房間" }),
      ).toHaveCount(0);
    } finally {
      await updateRules(rules);
    }
  });
