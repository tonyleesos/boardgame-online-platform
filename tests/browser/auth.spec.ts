import { test, expect } from "@playwright/test";
import { registerPlayer } from "./auth-helpers";

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
