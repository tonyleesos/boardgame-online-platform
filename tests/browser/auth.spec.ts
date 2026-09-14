import { test, expect, type Page } from "@playwright/test";
import { registerPlayer } from "./auth-helpers";

async function unnamedAccount() {
  const email = `nickname-${crypto.randomUUID()}@example.test`;
  const password = "Boardgame-test-72!";
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  expect(response.ok).toBe(true);
  return { ...(await response.json()), email, password };
}

async function login(
  page: Page,
  account: { email: string; password: string },
  path = "/games",
) {
  await page.goto(path);
  await page.getByLabel("電子郵件", { exact: true }).fill(account.email);
  await page.getByLabel("密碼", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "登入", exact: true }).click();
}

test("account nickname survives a fresh browser and overrides stale local names", async ({
  page,
  browser,
}) => {
  const account = await registerPlayer(page, "永久暱稱");
  await page.setViewportSize({ width: 320, height: 844 });
  // Active games use a compact header; both account controls must stay visible.
  await page
    .locator("main")
    .evaluate((element) => element.classList.add("room-active"));
  const header = await page.locator(".site-header").boundingBox();
  const edit = await page
    .getByRole("button", { name: "修改暱稱" })
    .boundingBox();
  expect(edit!.y).toBeGreaterThanOrEqual(header!.y);
  expect(edit!.y + edit!.height).toBeLessThanOrEqual(
    header!.y + header!.height,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator("main")
    .evaluate((element) => element.classList.remove("room-active"));
  await page.getByRole("button", { name: "修改暱稱" }).click();
  const dialog = page.getByRole("dialog", { name: "修改暱稱" });
  await expect(dialog.getByLabel("新暱稱")).toHaveValue("永久暱稱");
  await dialog.getByLabel("新暱稱").fill("修改後的暱稱");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".profile")).toContainText("永久暱稱");
  await page.getByRole("button", { name: "修改暱稱" }).click();
  await dialog.getByLabel("新暱稱").fill("   ");
  await expect(dialog.getByRole("button", { name: "儲存暱稱" })).toBeDisabled();
  await dialog.getByLabel("新暱稱").fill("修改後的暱稱");
  await page.route("**/accounts:update?**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "INTERNAL_ERROR" } }),
    }),
  );
  await dialog.getByRole("button", { name: "儲存暱稱" }).click();
  await expect(dialog.getByRole("alert")).toContainText("暱稱儲存失敗");
  await expect(page.locator(".profile")).toContainText("永久暱稱");
  await page.unroute("**/accounts:update?**");
  await dialog.getByRole("button", { name: "儲存暱稱" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".profile")).toContainText("修改後的暱稱");
  await page.reload();
  await expect(page.locator(".profile")).toContainText("修改後的暱稱");
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  try {
    const fresh = await context.newPage();
    await fresh.addInitScript(
      (uid) => localStorage.setItem(`nickname:${uid}`, "過期暱稱"),
      account.localId,
    );
    await login(fresh, account, "/join");
    await expect(fresh).toHaveURL(/\/join$/);
    await expect(fresh.locator(".profile")).toContainText("修改後的暱稱");
    await fresh.goto("/");
    await expect(fresh).toHaveURL(/\/games$/);
    await expect(fresh.getByLabel("讓大家認識你")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("legacy nickname is automatically saved to the account", async ({
  page,
  browser,
}) => {
  const account = await unnamedAccount();
  await page.addInitScript(
    (uid) => localStorage.setItem(`nickname:${uid}`, "原本的暱稱"),
    account.localId,
  );
  await login(page, account);
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.locator(".profile")).toContainText("原本的暱稱");
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  try {
    const fresh = await context.newPage();
    await login(fresh, account);
    await expect(fresh).toHaveURL(/\/games$/);
    await expect(fresh.locator(".profile")).toContainText("原本的暱稱");
  } finally {
    await context.close();
  }
});

test("failed nickname save keeps the form available for retry", async ({
  page,
}) => {
  const account = await unnamedAccount();
  await login(page, account, "/join");
  await page.getByLabel("讓大家認識你").fill("重試暱稱");
  await page.route("**/accounts:update?**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "INTERNAL_ERROR" } }),
    }),
  );
  await page.getByRole("button", { name: "入座，開始冒險" }).click();
  await expect(page.getByRole("alert")).toContainText("暱稱儲存失敗");
  await expect(page.getByLabel("讓大家認識你")).toHaveValue("重試暱稱");
  await page.unroute("**/accounts:update?**");
  await page.getByRole("button", { name: "入座，開始冒險" }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.locator(".profile")).toContainText("重試暱稱");
});

test("registered login, logout, password recovery and account isolation", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/games");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "歡迎回到圓桌" }),
  ).toBeVisible();
  expect(requests.some((url) => url.includes("accounts:signUp"))).toBe(false);
  await page.screenshot({ path: ".tools/login-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".tools/login-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const first = await registerPlayer(page, "Registered player");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "好戲，從這一桌開始。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("電子郵件", { exact: true }).fill(first.email);
  await page.getByLabel("密碼", { exact: true }).fill("Wrong-password-123!");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("電子郵件或密碼不正確");
  await page.getByRole("link", { name: "忘記密碼？" }).click();
  await page.getByLabel("電子郵件", { exact: true }).fill(first.email);
  await page.getByRole("button", { name: "寄送重設郵件" }).click();
  await expect(page.getByRole("status")).toContainText("請查看你的信箱");
  const codes = await (
    await fetch(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-boardgame/oobCodes",
    )
  ).json();
  expect(
    codes.oobCodes.some(
      (c: { email: string; requestType: string }) =>
        c.email === first.email && c.requestType === "PASSWORD_RESET",
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "返回登入" }).click();
  await page.getByLabel("電子郵件", { exact: true }).fill(first.email);
  await page.getByLabel("密碼", { exact: true }).fill(first.password);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.locator(".profile")).toContainText("Registered player");
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await page.goto("/register");
  await page
    .getByLabel("電子郵件", { exact: true })
    .fill(`other-${Date.now()}@example.test`);
  await page.getByLabel("密碼", { exact: true }).fill(first.password);
  await page.getByLabel("確認密碼", { exact: true }).fill("Different-123!");
  await page.getByRole("button", { name: "建立帳號", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("兩次輸入的密碼不一致");
  await page.getByLabel("確認密碼", { exact: true }).fill(first.password);
  await page.getByRole("button", { name: "建立帳號", exact: true }).click();
  await expect(page.getByLabel("讓大家認識你")).toHaveValue("");
});

test("old anonymous session cannot enter a game route", async ({ page }) => {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const guest = await r.json();
  await page.addInitScript((g) => {
    localStorage.setItem(
      "firebase:authUser:demo-key:[DEFAULT]",
      JSON.stringify({
        uid: g.localId,
        email: null,
        emailVerified: false,
        isAnonymous: true,
        providerData: [],
        stsTokenManager: {
          refreshToken: g.refreshToken,
          accessToken: g.idToken,
          expirationTime: Date.now() + 3600000,
        },
        apiKey: "demo-key",
        appName: "[DEFAULT]",
      }),
    );
    localStorage.setItem("nickname", "Old guest");
  }, guest);
  await page.goto("/room/ABC234");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "歡迎回到圓桌" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "複製房間代碼" })).toHaveCount(
    0,
  );
});
