import { expect, it, vi } from "vitest";
import { createAsyncCache } from "../functions/src/shared/async-cache";

it("coalesces concurrent requests, expires after 60 seconds and isolates keys", async () => {
  let now = 0;
  const cache = createAsyncCache<number>(60_000, 8, () => now);
  const load = vi.fn(async () => 1);
  expect(
    await Promise.all([cache.get("a", load), cache.get("a", load)]),
  ).toEqual([1, 1]);
  expect(load).toHaveBeenCalledTimes(1);
  now = 59_999;
  await cache.get("a", load);
  expect(load).toHaveBeenCalledTimes(1);
  await cache.get("b", load);
  expect(load).toHaveBeenCalledTimes(2);
  now = 60_000;
  await cache.get("a", load);
  expect(load).toHaveBeenCalledTimes(3);
  cache.delete("a");
  await cache.get("a", load);
  expect(load).toHaveBeenCalledTimes(4);
  cache.clear();
  await cache.get("a", load);
  expect(load).toHaveBeenCalledTimes(5);
});

it("does not cache errors and bounds memory", async () => {
  const cache = createAsyncCache<number>(60_000, 2);
  await expect(
    cache.get("a", async () => {
      throw Error("offline");
    }),
  ).rejects.toThrow("offline");
  expect(await cache.get("a", async () => 1)).toBe(1);
  await cache.get("b", async () => 2);
  await cache.get("c", async () => 3);
  expect(await cache.get("a", async () => 4)).toBe(4);
});
