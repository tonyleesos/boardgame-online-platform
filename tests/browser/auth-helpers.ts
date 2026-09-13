import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
export async function registerPlayer(page: Page, nickname: string) {
  const email = `browser-${randomUUID()}@example.test`,
    password = "Boardgame-test-72!";
  await page.goto("/register");
  await page.getByLabel("電子郵件", { exact: true }).fill(email);
  await page.getByLabel("密碼", { exact: true }).fill(password);
  await page.getByLabel("確認密碼", { exact: true }).fill(password);
  const signup = page.waitForResponse((r) =>
    r.url().includes("accounts:signUp"),
  );
  await page.getByRole("button", { name: "建立帳號", exact: true }).click();
  const result = await (await signup).json();
  expect(result.error).toBeUndefined();
  await page.getByLabel("讓大家認識你").fill(nickname);
  await page.getByRole("button", { name: "入座，開始冒險" }).click();
  await expect(page).toHaveURL(/\/games$/);
  return { ...result, email, password } as {
    localId: string;
    idToken: string;
    email: string;
    password: string;
  };
}
