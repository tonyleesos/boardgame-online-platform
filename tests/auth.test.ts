import { expect, it } from "vitest";
import { isRegisteredPasswordUser } from "../functions/src/shared/auth";
it.each([
  undefined,
  {},
  { email: "a@b.test" },
  { email: "a@b.test", firebase: { sign_in_provider: "anonymous" } },
  { email: "a@b.test", firebase: { sign_in_provider: "google.com" } },
  { email: "", firebase: { sign_in_provider: "password" } },
])("denies non-password identity %j", (token) =>
  expect(isRegisteredPasswordUser(token)).toBe(false),
);
it("accepts registered password credentials", () =>
  expect(
    isRegisteredPasswordUser({
      email: "a@b.test",
      firebase: { sign_in_provider: "password" },
    }),
  ).toBe(true));
