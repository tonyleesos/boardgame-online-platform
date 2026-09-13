import { registerPlayer } from "./auth-helpers";
import { test, expect } from "@playwright/test";
test("five independent browsers complete Avalon, reconnect, rematch, and mobile layouts", async ({
  browser,
}) => {
  const contexts = await Promise.all(
    Array.from({ length: 5 }, () => browser.newContext()),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [];
  pages.forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
  const names = ["Tony", "Kevin", "Alice", "小明", "小華"];
  try {
    for (let i = 0; i < 5; i++) {
      await registerPlayer(pages[i], names[i]);
      await expect(
        pages[i].getByRole("heading", { name: "好戲，從這一桌開始。" }),
      ).toBeVisible();
    }
    for (const width of [360, 390, 430, 768, 1280]) {
      await pages[0].setViewportSize({ width, height: 900 });
      expect(
        await pages[0].evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await pages[0].screenshot({
        path: `.tools/screenshots/catalog-${width}.png`,
        fullPage: true,
      });
    }
    await pages[0].locator(".avalon").getByRole("link", { name: "建立房間" }).click();
    await pages[0]
      .getByRole("button", { name: "建立房間", exact: true })
      .click();
    await expect(
      pages[0].getByRole("heading", { name: "等待朋友入座" }),
    ).toBeVisible();
    const code = (await pages[0]
      .getByRole("button", { name: "複製房間代碼" })
      .textContent())!.trim();
    for (let i = 1; i < 5; i++) {
      await pages[i].locator(".avalon").getByRole("link", { name: "加入房間" }).click();
      await pages[i].getByLabel("房間代碼").fill(code);
      await pages[i]
        .getByRole("button", { name: "加入房間", exact: true })
        .click();
      await expect(
        pages[i].getByRole("heading", { name: "等待朋友入座" }),
      ).toBeVisible();
    }
    await expect(pages[0].locator(".player-list li")).toHaveCount(5);
    await expect(
      pages[1].getByRole("button", { name: "開始遊戲", exact: true }),
    ).toHaveCount(0);
    await expect(
      pages[0].getByRole("button", { name: "開始遊戲", exact: true }),
    ).toBeDisabled();
    for (const p of pages) {
      await p.getByRole("button", { name: "我準備好了", exact: true }).click();
      await expect(p.getByRole("button", { name: "取消準備" })).toBeVisible();
    }
    await pages[1].reload();
    await expect(
      pages[1].getByRole("button", { name: "取消準備" }),
    ).toBeVisible();
    await expect(pages[0].locator(".player-list li")).toHaveCount(5);
    await pages[0]
      .getByRole("button", { name: "開始遊戲", exact: true })
      .click();
    const roles: string[] = [];
    for (const p of pages) {
      await p.getByRole("button", { name: "查看你的身份" }).click();
      roles.push(
        await p
          .getByRole("dialog", { name: "你的身份" })
          .locator("h2")
          .innerText(),
      );
      await p.getByRole("button", { name: "收起身份，確認準備" }).click();
    }
    expect(roles).toContain("梅林");
    expect(roles).toContain("刺客");
    for (let round = 0; round < 3; round++) {
      await expect(
        pages[0].getByRole("heading", { name: "選擇任務成員", exact: true }),
      ).toBeVisible();
      let leader = -1;
      await expect
        .poll(async () => {
          for (let i = 0; i < 5; i++)
            if (
              await pages[i]
                .getByRole("heading", { name: "由你組建這次的遠征隊。" })
                .isVisible()
            )
              return i;
          return -1;
        })
        .toBeGreaterThanOrEqual(0);
      for (let i = 0; i < 5; i++)
        if (
          await pages[i]
            .getByRole("heading", { name: "由你組建這次的遠征隊。" })
            .isVisible()
        )
          leader = i;
      expect(leader).toBeGreaterThanOrEqual(0);
      const lp = pages[leader];
      const size = [2, 3, 2][round];
      for (let i = 0; i < size; i++) {
        const member = lp
          .locator(".team-picker button")
          .filter({ hasText: names[i] });
        await member.click();
        await expect(member).toHaveAttribute("aria-pressed", "true");
      }
      if (round === 0) {
        for (const width of [360, 390, 430, 768, 1280]) {
          await lp.setViewportSize({ width, height: 900 });
          expect(
            await lp.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await lp.screenshot({
            path: `.tools/screenshots/room-${width}.png`,
            fullPage: true,
          });
        }
      }
      await lp
        .getByRole("button", { name: `提交隊伍（${size}/${size}）` })
        .click();
      for (const p of pages)
        await p.getByRole("button", { name: "贊成", exact: true }).click();
      for (let i = 0; i < size; i++)
        await pages[i]
          .getByRole("button", { name: "任務成功", exact: true })
          .click();
      for (const p of pages) await expect(p.getByRole("dialog", { name: "任務結果", exact: true }).getByRole("heading", { name: "任務成功", exact: true })).toBeVisible();
      for (const p of pages.filter((p) => p !== lp)) await p.getByRole("dialog", { name: "任務結果", exact: true }).getByRole("button", { name: "返回圓桌", exact: true }).click();
      await lp.getByRole("button", { name: "繼續遊戲", exact: true }).click();
    }
    const assassin = pages[roles.indexOf("刺客")];
    const merlinName = names[roles.indexOf("梅林")];
    await assassin
      .getByRole("button", { name: `刺殺 ${merlinName}`, exact: true })
      .click();
    await assassin.getByRole("button", { name: "確認刺殺", exact: true }).click();
    for (const p of pages)
      await expect(
        p.getByRole("dialog", { name: "阿瓦隆終局揭曉" }).getByRole("heading", { name: "壞人陣營勝利" }),
      ).toBeVisible();
    await pages[0].screenshot({
      path: ".tools/screenshots/result.png",
      fullPage: true,
    });
    await pages[0].getByRole("button", { name: "查看全員身份與圓桌" }).click();
    await pages[0].getByRole("button", { name: "再玩一局" }).click();
    for (const p of pages)
      await expect(
        p.getByRole("button", { name: "我準備好了", exact: true }),
      ).toBeVisible();
    // Exercise the largest table, including a long nickname, on the same UI.
    for (let i = 5; i < 10; i++) {
      const context = await browser.newContext();
      contexts.push(context);
      const p = await context.newPage();
      pages.push(p);
      p.on("pageerror", (e) => errors.push(e.message));
      await registerPlayer(p, i === 9 ? "LongNicknameTestUserX" : `夥伴${i + 1}`);
      await p.locator(".avalon").getByRole("link", { name: "加入房間", exact: true }).click();
      await p.getByLabel("房間代碼").fill(code);
      await p.getByRole("button", { name: "加入房間", exact: true }).click();
      await expect(
        p.getByRole("heading", { name: "等待朋友入座" }),
      ).toBeVisible();
    }
    for (const p of pages) {
      await p.getByRole("button", { name: "我準備好了", exact: true }).click();
      await expect(p.getByRole("button", { name: "取消準備" })).toBeVisible();
    }
    await pages[0]
      .getByRole("button", { name: "開始遊戲", exact: true })
      .click();
    for (const p of pages) {
      await p.getByRole("button", { name: "查看你的身份" }).click();
      await p.getByRole("button", { name: "收起身份，確認準備" }).click();
    }
    await expect(
      pages[0].getByRole("heading", { name: "選擇任務成員", exact: true }),
    ).toBeVisible();
    await expect(pages[0].locator(".team-picker button")).toHaveCount(10);
    await expect(pages[0].locator(".game-stage")).toHaveCSS("opacity", "1");
    for (const width of [360, 390, 430, 768, 1280]) {
      await pages[0].setViewportSize({ width, height: 900 });
      expect(
        await pages[0].evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await pages[0].screenshot({
        path: `.tools/screenshots/ten-players-${width}.png`,
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
