import { createHash } from "node:crypto";
import type { Player } from "./shared/model";

const names = ["艾達", "華生", "露西", "艾琳", "奧斯卡", "亨利", "亞瑟", "梅莉", "米洛", "諾拉", "里昂", "芙蕾", "洛伊", "星野", "小葵", "沐沐", "柚子", "琥珀", "青禾", "小栗", "冬青", "夏洛", "小麥", "海棠"];

/** Stable across transaction retries; avoid every occupied nickname, including humans. */
export function botNickname(players: Record<string, Player>, seed: string): string {
  const taken = new Set(Object.values(players).map((p) => p.nickname));
  const offset = createHash("sha256").update(seed).digest().readUInt32BE(0) % names.length;
  for (let i = 0; ; i++) {
    const suffix = i < names.length ? "" : String(Math.floor(i / names.length) + 1);
    const candidate = `${names[(offset + i) % names.length]}${suffix}AI`;
    if (!taken.has(candidate)) return candidate;
  }
}
