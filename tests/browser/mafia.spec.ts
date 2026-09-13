import { test, expect, type Page } from "@playwright/test";

test("Mafia: twelve seats, private taking, passing, reconnect, accusations and final reveal", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1180, height: 1000 } }),
    browser.newContext({ viewport: { width: 390, height: 844 } }),
  ]);
  const [father, guest] = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [];
  for (const p of [father, guest])
    p.on("pageerror", (e) => errors.push(e.message));
  async function login(page: Page, name: string) {
    await page.goto("/");
    await page.getByLabel("讓大家認識你").fill(name);
    await page.getByRole("button", { name: "入座，開始冒險" }).click();
  }
  await login(father, "Havana Father");
  await father
    .locator(".game-card.mafia-de-cuba")
    .getByRole("link", { name: "建立房間" })
    .click();
  await father.getByRole("button", { name: "建立房間", exact: true }).click();
  await expect(father).toHaveURL(/\/room\//);
  const code = father.url().split("/").at(-1)!;
  await login(guest, "Havana Guest");
  await guest.goto("/join");
  await guest.locator("#code").fill(code);
  await guest.getByRole("button", { name: "加入房間", exact: true }).click();
  await expect(guest).toHaveURL(new RegExp(`/room/${code}$`));
  const signup =
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key";
  const api = "http://127.0.0.1:5001/demo-boardgame/asia-east1";
  const rest = "http://127.0.0.1:9000";
  const players: Array<{ localId: string; idToken: string }> = [];
  async function call(p: { idToken: string }, name: string, data: unknown) {
    const r = await fetch(`${api}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.idToken}`,
      },
      body: JSON.stringify({ data }),
    });
    const body = await r.json();
    expect(body.error).toBeUndefined();
    return body.result;
  }
  for (let i = 0; i < 10; i++) {
    const r = await fetch(signup, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    const p = await r.json();
    players.push(p);
    await call(p, "joinRoom", { code, nickname: `Havana ${i + 3}` });
    await call(p, "roomAction", {
      code,
      action: { type: "ready", ready: true },
    });
  }
  await father.getByRole("button", { name: "我準備好了", exact: true }).click();
  await guest.getByRole("button", { name: "我準備好了", exact: true }).click();
  await father.getByRole("button", { name: "開始遊戲", exact: true }).click();
  await expect(father.locator(".mafia-seat")).toHaveCount(12);
  await expect(guest.locator(".mafia-seat")).toHaveCount(12);
  await father.screenshot({ path: ".tools/mafia-desktop.png", fullPage: true });
  await guest.screenshot({ path: ".tools/mafia-mobile.png", fullPage: true });
  expect(
    await guest.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await father.getByRole("button", { name: "增加鑽石" }).click();
  await father.getByRole("button", { name: "傳出雪茄盒" }).click();
  await expect(guest.getByRole("button", { name: "顯示雪茄盒" })).toBeEnabled();
  await expect(guest.getByRole("dialog")).toHaveCount(0);
  await guest.getByRole("button", { name: "顯示雪茄盒" }).click();
  await expect(guest.getByRole("dialog", { name: "私人雪茄盒" })).toBeVisible();
  await expect(guest.getByRole("dialog")).toHaveCSS("opacity", "1");
  const privateBounds = await guest.getByRole("dialog").boundingBox();
  expect(privateBounds!.height).toBeLessThanOrEqual(844);
  expect(privateBounds!.y).toBeGreaterThanOrEqual(0);
  await guest.screenshot({
    path: ".tools/mafia-private-box.png",
    fullPage: false,
  });
  await guest.getByRole("button", { name: /秘密移除 0/ }).click();
  await guest
    .getByRole("button", { name: "秘密移除忠誠手下", exact: true })
    .first()
    .click();
  await guest.getByRole("button", { name: "拿鑽石", exact: true }).click();
  await guest.getByRole("button", { name: "增加鑽石" }).click();
  await guest.getByRole("button", { name: "確認拿取並傳盒" }).click();
  await expect(
    guest.getByRole("dialog", { name: "已放入口袋 · 僅你可見" }),
  ).toBeVisible();
  await expect(guest.getByText("2 顆鑽石已入袋")).toBeVisible();
  await expect(father.getByText("2 顆鑽石已入袋")).toHaveCount(0);
  await guest.screenshot({ path: ".tools/mafia-pocket.png", fullPage: true });
  await guest.getByRole("button", { name: "收好口袋" }).click();
  await expect(father.locator(".mafia-travelling-box")).toHaveAttribute(
    "aria-label",
    "雪茄盒在 Havana 3 手中",
  );
  await guest.reload();
  await expect(guest.getByRole("button", { name: "我的口袋" })).toBeVisible();
  await expect(guest.getByRole("button", { name: "顯示雪茄盒" })).toHaveCount(
    0,
  );
  await guest.getByRole("button", { name: "我的口袋" }).click();
  await expect(guest.getByRole("dialog")).toContainText("竊賊");
  await guest.getByRole("button", { name: "關閉視窗" }).click();
  async function room() {
    const r = await fetch(
      `${rest}/sessions/${code}/public.json?ns=demo-boardgame-default-rtdb&auth=${players[0].idToken}`,
    );
    return r.json();
  }
  let g = (await room()).mafia,
    agentName = "";
  while (g.phase === "BOX_PASS") {
    const p = players.find((p) => p.localId === g.holderId)!;
    const r = await fetch(
      `${rest}/sessions/${code}/mafiaPrivate/${p.localId}.json?ns=demo-boardgame-default-rtdb&auth=${p.idToken}`,
    );
    const own = await r.json(),
      box = own.currentBoxView;
    const last = g.holderId === g.passOrder.at(-1);
    const action = last
      ? { type: "mafiaTake", nothing: true }
      : box.tokens?.length
        ? { type: "mafiaTake", tokenId: box.tokens[0].id }
        : box.diamonds
          ? { type: "mafiaTake", diamonds: 1 }
          : { type: "mafiaTake", nothing: true };
    if (!last && box.tokens?.[0]?.role.startsWith("AGENT"))
      agentName = g.seats[p.localId].nickname;
    await call(p, "gameAction", {
      code,
      phaseToken: `${g.id}:${g.revision}`,
      action,
    });
    g = (await room()).mafia;
  }
  await expect(
    father.getByRole("button", { name: "檢查雪茄盒" }),
  ).toBeVisible();
  await father.getByRole("button", { name: "檢查雪茄盒" }).click();
  await expect(father.getByRole("dialog")).toContainText("尚待找回");
  await father.getByRole("button", { name: "關閉視窗" }).click();
  await father
    .getByRole("button", { name: /Havana Guest，身分未揭曉.*指控玩家/ })
    .click();
  await expect(father.getByRole("dialog", { name: "正式指控" })).toBeVisible();
  await father.getByRole("button", { name: "確認指控", exact: true }).click();
  await expect(guest.locator(".mafia-accusation")).toBeVisible();
  await expect(father.locator(".mafia-reveal")).toContainText("找回 2 顆鑽石", {
    timeout: 10000,
  });
  await father
    .getByRole("button", {
      name: new RegExp(`${agentName}，身分未揭曉.*指控玩家`),
    })
    .click();
  await father.getByRole("button", { name: "確認指控", exact: true }).click();
  await expect(father.locator(".mafia-results")).toBeVisible({
    timeout: 10000,
  });
  await father.getByRole("button", { name: "略過演出" }).click();
  await expect(father.locator(".mafia-results")).toContainText("探員獨勝");
  await expect(father.locator(".mafia-final-grid>div")).toHaveCount(12);
  await expect(father.locator(".mafia-final-grid>.winner")).toHaveCount(1);
  await father.screenshot({ path: ".tools/mafia-result.png", fullPage: true });
  await guest.emulateMedia({ reducedMotion: "reduce" });
  await guest.reload();
  await expect(guest.locator(".mafia-final-grid>div")).toHaveCount(12);
  await father.getByRole("button", { name: "再開一局" }).click();
  await expect(
    father.getByRole("button", { name: "我準備好了", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await Promise.all(contexts.map((c) => c.close()));
});

for (const aiFather of [false, true]) {
  test(`Mafia solo practice with ${aiFather ? "AI" : "human"} godfather completes through the UI`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByLabel("讓大家認識你").fill("Solo Havana");
    await page.getByRole("button", { name: "入座，開始冒險" }).click();
    await page
      .locator(".game-card.mafia-de-cuba")
      .getByRole("link", { name: "單人練習 · 與 AI 對局" })
      .click();
    await page.getByRole("button", { name: "建立練習桌" }).click();
    await expect(page.locator(".player-list>li")).toHaveCount(6);
    if (aiFather)
      await page
        .getByRole("combobox", { name: "選擇教父" })
        .selectOption("bot_1");
    await page.getByRole("button", { name: "我準備好了", exact: true }).click();
    await page.getByRole("button", { name: "開始遊戲", exact: true }).click();
    await expect(page.locator(".mafia-seat")).toHaveCount(6);
    if (!aiFather)
      await page.getByRole("button", { name: "傳出雪茄盒" }).click();
    else {
      await page
        .getByRole("button", { name: "顯示雪茄盒" })
        .click({ timeout: 20000 });
      const nothing = page.getByRole("button", { name: /空手離開|空盒 ·/ });
      if (await nothing.count()) await nothing.click();
      else if (
        await page.getByRole("button", { name: "拿鑽石", exact: true }).count()
      )
        await page.getByRole("button", { name: "拿鑽石", exact: true }).click();
      else await page.locator(".mafia-token-grid>button").first().click();
      await page.getByRole("button", { name: "確認拿取並傳盒" }).click();
      await page.getByRole("button", { name: "收好口袋" }).click();
    }
    if (!aiFather) {
      await expect(
        page.getByRole("button", { name: "檢查雪茄盒" }),
      ).toBeVisible({ timeout: 20000 });
      for (let i = 0; i < 5; i++) {
        if (await page.locator(".mafia-results").count()) break;
        await page.locator(".mafia-seat:not(:disabled)").first().click();
        await page
          .getByRole("button", { name: "確認指控", exact: true })
          .click();
        await expect(page.locator(".mafia-accusation")).toBeVisible();
        await expect(page.locator(".mafia-accusation")).toHaveCount(0, {
          timeout: 10000,
        });
      }
    }
    await expect(page.locator(".mafia-results")).toBeVisible({
      timeout: 45000,
    });
    if (await page.getByRole("button", { name: "略過演出" }).count())
      await page.getByRole("button", { name: "略過演出" }).click();
    await expect(page.locator(".mafia-final-grid>div")).toHaveCount(6);
    await page.screenshot({
      path: `.tools/mafia-practice-${aiFather ? "ai" : "human"}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "再開一局" }).click();
    await expect(
      page.getByRole("button", { name: "我準備好了", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".player-list>li")).toHaveCount(6);
  });
}
