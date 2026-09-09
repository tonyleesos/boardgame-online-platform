import type { Session } from "./shared/model";
import { ensure } from "./shared/rules";
import {
  BOMB_COLORS,
  bombThreshold,
  defusableColors,
  rearmableColors,
  COLOR_NAMES,
} from "./shared/timebomb";
import type {
  BombAction,
  BombRole,
  BombVariant,
  Wire,
} from "./shared/timebomb";
export type Shuffle = <T>(items: T[]) => T[];
export function normalizeBomb(s: Session) {
  const g = s.public.timebomb!;
  g.colors ??= [];
  g.confirmed ??= {};
  g.claims ??= {};
  g.bombs ??= {};
  g.defused ??= {};
  g.history ??= [];
  g.hands ??= {};
  for (const id of g.order) g.hands[id] ??= [];
  if (s.secret.bombHands)
    for (const id of g.order) {
      const stored = s.secret.bombHands[id];
      s.secret.bombHands[id] = Array.from(
        { length: 6 - g.round },
        (_, i) => stored?.[i] ?? null,
      );
    }
  return g;
}
function inventory(s: Session, uid: string) {
  const p = s.timebombPrivate![uid];
  p.inventory = {};
  p.round = s.public.timebomb!.round;
  for (const wire of s.secret.bombHands![uid])
    if (wire) p.inventory[wire] = (p.inventory[wire] ?? 0) + 1;
}
function deal(s: Session, cards: Wire[], shuffle: Shuffle) {
  const g = s.public.timebomb!;
  const shuffled = shuffle(cards);
  const size = 6 - g.round;
  ensure(shuffled.length === g.order.length * size, "引線牌數量不一致");
  s.secret.bombHands = {};
  g.hands = {};
  g.order.forEach((uid, i) => {
    // The browser learns composition only. Even the owner never receives slot contents.
    s.secret.bombHands![uid] = shuffle(
      shuffled.slice(i * size, (i + 1) * size),
    );
    g.hands[uid] = Array.from({ length: size }, (_, j) => j);
    inventory(s, uid);
  });
}
export function startBomb(
  s: Session,
  id: string,
  shuffle: Shuffle,
  variant: BombVariant,
) {
  const room = s.public;
  const order = shuffle(Object.keys(room.players));
  const n = order.length;
  ensure(room.status === "waiting", "遊戲已開始");
  const classic = variant === "classic";
  ensure(
    n >= 4 && n <= (classic ? 8 : 6),
    classic ? "驚爆倫敦需要 4–8 位玩家" : "危機進化需要 4–6 位玩家",
  );
  ensure(
    order.every((uid) => room.players[uid].ready),
    "請等待所有玩家準備",
  );
  const roles = shuffle<BombRole>([
    ...Array<BombRole>(n >= 7 ? 5 : n === 6 ? 4 : 3).fill("sherlock"),
    ...Array<BombRole>(n >= 7 ? 3 : 2).fill("moriarty"),
  ]).slice(0, n);
  const colors = classic ? [] : shuffle([...BOMB_COLORS]).slice(0, n);
  s.timebombPrivate = Object.fromEntries(
    order.map((uid, i) => [uid, { role: roles[i], round: 1, inventory: {} }]),
  );
  s.private = {};
  s.secret = { teamVotes: {}, missionVotes: {} };
  delete room.game;
  room.status = "playing";
  room.timebomb = {
    id,
    revision: 0,
    phase: "ROLE_REVEAL",
    variant,
    round: 1,
    order,
    scissorsId: order[0],
    colors,
    hands: {},
    confirmed: {},
    claims: {},
    cuts: 0,
    cutLimit: n,
    successes: 0,
    bombs: {},
    defused: {},
    history: [],
  };
  const hazards: Wire[] = classic
    ? [...Array<Wire>(4 * n - 1).fill("safe"), "bomb"]
    : shuffle(colors.flatMap((c) => Array<Wire>(5).fill(c))).slice(n);
  deal(s, [...hazards, ...Array<Wire>(n).fill("success")], shuffle);
}
export function finishBomb(
  s: Session,
  winner: "good" | "evil" | undefined,
  reason: string,
) {
  const g = normalizeBomb(s);
  g.phase = "GAME_OVER";
  if (winner) g.winner = winner;
  g.winReason = reason;
  g.roles = Object.fromEntries(
    Object.entries(s.timebombPrivate ?? {}).map(([uid, p]) => [uid, p.role]),
  );
  delete g.effectActor;
  delete g.forcedTarget;
  s.public.status = "finished";
}
function explode(s: Session) {
  const g = s.public.timebomb!;
  const color = g.colors.find(
    (c) => !g.defused[c] && (g.bombs[c] ?? 0) >= bombThreshold(g, c),
  );
  if (color) {
    finishBomb(
      s,
      "evil",
      `${COLOR_NAMES[color]}炸彈達到 ${bombThreshold(g, color)} 張，引爆倫敦`,
    );
    return true;
  }
  return false;
}
function resolveCut(s: Session) {
  const g = s.public.timebomb!;
  delete g.effectActor;
  if (g.round === 4 && g.cuts >= g.cutLimit) {
    finishBomb(s, "evil", "第四輪結束，午夜的鐘聲響起");
    return;
  }
  // A red target without cards receives the scissors instead. At a round boundary
  // the target remains, because everyone receives new cards before the next cut.
  if (
    g.forcedTarget &&
    g.cuts < g.cutLimit &&
    !g.hands[g.forcedTarget]?.length
  ) {
    g.scissorsId = g.forcedTarget;
    delete g.forcedTarget;
  }
  g.phase = "CUT_RESULT";
}
export function applyBombAction(
  s: Session,
  uid: string,
  a: BombAction,
  shuffle: Shuffle,
) {
  ensure(
    s.public.status === "playing" && s.public.timebomb,
    "遊戲尚未開始或已結束",
  );
  const g = normalizeBomb(s);
  ensure(g.order.includes(uid), "你不在這場遊戲中");
  const phase = (p: string) => ensure(g.phase === p, "遊戲階段已變更");
  switch (a.type) {
    case "bombReveal":
      phase("ROLE_REVEAL");
      ensure(!g.confirmed[uid], "已確認身份");
      g.confirmed[uid] = true;
      if (g.order.every((id) => g.confirmed[id])) g.phase = "CLAIMS";
      break;
    case "claim":
      phase("CLAIMS");
      ensure(g.claims[uid] === undefined, "已提交本輪宣言");
      ensure(
        Number.isInteger(a.successes) &&
          a.successes >= 0 &&
          a.successes <= 6 - g.round,
        "宣稱的引線數量不正確",
      );
      g.claims[uid] = a.successes;
      if (g.order.every((id) => g.claims[id] !== undefined)) g.phase = "CUT";
      break;
    case "cut": {
      phase("CUT");
      ensure(g.scissorsId === uid, "只有持有剪刀的玩家可以剪線");
      ensure(g.order.includes(a.target), "無效的目標");
      ensure(
        g.forcedTarget ? a.target === g.forcedTarget : a.target !== uid,
        "請遵守剪線目標限制",
      );
      ensure(
        Number.isInteger(a.slot) && g.hands[a.target]?.includes(a.slot),
        "這張引線已被剪開",
      );
      const wire = s.secret.bombHands?.[a.target]?.[a.slot];
      ensure(wire, "找不到引線");
      s.secret.bombHands![a.target][a.slot] = null;
      g.hands[a.target] = g.hands[a.target].filter((slot) => slot !== a.slot);
      inventory(s, a.target);
      const previous = g.history.at(-1)?.wire;
      g.history.push({
        round: g.round,
        actor: uid,
        target: a.target,
        slot: a.slot,
        wire,
      });
      g.cuts++;
      g.scissorsId = a.target;
      delete g.forcedTarget;
      if (wire === "success") {
        g.successes++;
        if (g.successes === g.order.length) {
          finishBomb(s, "good", "所有解除引線已找到，倫敦得救了");
          break;
        }
        if (g.variant === "evolution" && defusableColors(g).length) {
          g.phase = "DEFUSE";
          g.effectActor = uid;
          break;
        }
      } else if (wire === "bomb") {
        finishBomb(s, "evil", "炸彈被剪開，大笨鐘遭到引爆");
        break;
      } else if (wire !== "safe") {
        g.bombs[wire] = (g.bombs[wire] ?? 0) + 1;
        if (
          g.variant === "evolution" &&
          wire === "pink" &&
          previous === "pink"
        ) {
          finishBomb(s, "evil", "連續兩張粉紅炸彈引爆，拆除保護無法阻止");
          break;
        }
        if (explode(s)) break;
        if (g.variant === "evolution") {
          if (wire === "blue" && rearmableColors(g).length) {
            g.phase = "REARM";
            g.effectActor = uid;
            break;
          }
          if (wire === "red") g.forcedTarget = shuffle([...g.order])[0];
        }
      }
      resolveCut(s);
      break;
    }
    case "defuse":
      phase("DEFUSE");
      ensure(g.effectActor === uid, "只有本次剪線者可以選擇");
      ensure(defusableColors(g).includes(a.color), "此顏色無法拆除");
      g.defused[a.color] = true;
      g.history.at(-1)!.note = `已拆除${COLOR_NAMES[a.color]}炸彈`;
      resolveCut(s);
      break;
    case "rearm":
      phase("REARM");
      ensure(g.effectActor === uid, "只有本次剪線者可以選擇");
      ensure(rearmableColors(g).includes(a.color), "此顏色沒有拆除保護");
      delete g.defused[a.color];
      g.history.at(-1)!.note = `${COLOR_NAMES[a.color]}炸彈的保護被移除`;
      if (!explode(s)) resolveCut(s);
      break;
    case "bombContinue":
      phase("CUT_RESULT");
      ensure(uid === s.public.hostId, "等待房主繼續");
      if (g.cuts >= g.cutLimit) {
        g.round++;
        g.cuts = 0;
        g.claims = {};
        g.cutLimit = g.order.length;
        if (g.round === 4 && g.variant === "evolution")
          g.cutLimit = Math.max(0, g.order.length - (g.bombs.orange ?? 0));
        if (!g.cutLimit) {
          finishBomb(s, "evil", "橘色炸彈耗盡第四輪的時間");
          break;
        }
        const cards = Object.values(s.secret.bombHands!)
          .flat()
          .filter((w): w is Wire => w !== null);
        deal(s, cards, shuffle);
        g.phase = "CLAIMS";
      } else g.phase = "CUT";
      break;
    default:
      throw new Error("未知剪線操作");
  }
  g.revision++;
  return s;
}
