import type { Shuffle } from "../timebomb-engine";
import {
  MINE_CARD_BY_ID,
  mineActor,
  pathBlocked,
  GOAL_KEYS,
} from "../shared/saboteur";
import type {
  MineAction,
  MineGame,
  MinePrivate,
  Effect,
} from "../shared/saboteur";
import {
  frontier,
  validatePathPlacement,
  tileChannels,
} from "../shared/mineTopology";
import { legalActionTargets } from "../shared/mineActions";
/** Receives public information and ONLY this player's own private observation. */
export function chooseMineAction(
  uid: string,
  g: MineGame,
  own: MinePrivate,
  shuffle: Shuffle,
  casual = false,
): MineAction | null {
  if (
    g.phase === "GAME_OVER" ||
    g.phase === "ROUND_RESULT" ||
    mineActor(g) !== uid
  )
    return null;
  if (g.phase === "PRIVATE_RESULT") return { type: "mineAcknowledge" };
  if (g.phase === "THEFT_RESOLUTION")
    return {
      type: "mineSteal",
      target: shuffle(
        g.order.filter((id) => id !== uid && g.players[id].hasGold),
      )[0],
    };
  const candidates: Array<{ action: MineAction; score: number }> = [];
  const bad = own.role === "SABOTEUR",
    geo = own.role === "GEOLOGIST";
  const goalKeys = GOAL_KEYS.filter(
    (k) => own.goals[k] !== "ROCK" && !g.board[k].revealed,
  );
  const targets = goalKeys.length ? goalKeys : GOAL_KEYS;
  const distance = (x: number, y: number) =>
    Math.min(
      ...targets.map((k) => {
        const t = g.board[k];
        return Math.abs(x - t.x) + Math.abs(y - t.y);
      }),
    );
  const occupiedDistance = Math.min(
    ...Object.values(g.board)
      .filter((t) => t.type !== "goal")
      .map((t) => distance(t.x, t.y)),
  );
  for (const id of own.hand) {
    const c = MINE_CARD_BY_ID[id];
    if (c.kind === "path" && !pathBlocked(g.players[uid])) {
      for (const pos of frontier(g.board))
        for (const rotation of [0, 180] as const) {
          if (validatePathPlacement(g.board, c, pos.x, pos.y, rotation))
            continue;
          const forward = occupiedDistance - distance(pos.x, pos.y),
            connected = c.channels.some((ch) => ch.length > 1);
          const opensEast = tileChannels({
            ...pos,
            cardId: c.id,
            rotation,
            type: "path",
          }).some((ch) => ch.includes("W") && ch.includes("E"));
          const oppositeDoor =
            (own.role === "BLUE_DIGGER" && c.door === "GREEN") ||
            (own.role === "GREEN_DIGGER" && c.door === "BLUE");
          const score = bad
            ? connected
              ? -8 - forward * 3
              : 8 + forward * 3
            : 5 +
              forward * 5 +
              Number(opensEast) * 2 -
              Number(!connected) * 15 -
              Number(oppositeDoor) * 5 +
              (geo ? (c.crystalCount ?? 0) * 8 : 0);
          candidates.push({
            action: { type: "minePath", cardId: id, ...pos, rotation },
            score,
          });
        }
    } else if (c.kind === "action") {
      for (const target of legalActionTargets(g, uid, c)) {
        const known = [...own.inspections]
          .reverse()
          .find((i) => i.uid === target)?.role;
        const foe = known
          ? bad
            ? known !== "SABOTEUR"
            : known === "SABOTEUR" ||
              (own.role === "BLUE_DIGGER" && known === "GREEN_DIGGER") ||
              (own.role === "GREEN_DIGGER" && known === "BLUE_DIGGER")
          : false;
        let score = 1;
        if (c.action === "REPAIR" || c.action === "FREEDOM")
          score = target === uid ? 22 : foe ? -5 : 2;
        if (c.action === "TRAPPED" || c.action === "BREAK")
          score = foe ? 15 : bad ? 9 : 1;
        if (c.action === "THEFT") score = 9;
        if (c.action === "MAP") score = own.goals[target] ? -10 : 6;
        if (c.action === "INSPECTION") score = known ? -5 : 4;
        if (c.action === "SWAP_HANDS")
          score = g.players[target].handCount - own.hand.length + 2;
        if (c.action === "CHANGE_HATS")
          score = target === uid ? -4 : foe ? 7 : 0;
        if (c.action === "HANDS_OFF") score = target === uid ? -10 : 3;
        if (c.action === "ROCKFALL") {
          const tile = g.board[target],
            pc = MINE_CARD_BY_ID[tile.cardId];
          score =
            pc.kind === "path" && pc.channels.every((ch) => ch.length === 1)
              ? bad
                ? -5
                : 10
              : bad
                ? 7
                : -8;
        }
        const tool = c.tools?.find((t) => !!g.players[target]?.effects[t]);
        candidates.push({
          score,
          action: {
            type: "mineAction",
            cardId: id,
            ...(c.action === "MAP" || c.action === "ROCKFALL"
              ? { cell: target }
              : { target }),
            ...(tool ? { tool } : {}),
          },
        });
      }
    }
  }
  if (pathBlocked(g.players[uid]) && own.hand.length >= 2) {
    const effect = (Object.keys(g.players[uid].effects) as Effect[]).find(
      (e) => e !== "THEFT",
    )!;
    candidates.push({
      score: 12,
      action: { type: "mineClean", cards: own.hand.slice(0, 2), effect },
    });
  }
  const playable = shuffle(candidates.filter((c) => casual || c.score > 0));
  if (playable.length)
    return casual
      ? playable[0].action
      : playable.sort((a, b) => b.score - a.score)[0].action;
  return { type: "minePass", cards: own.hand.slice(0, 3) };
}
