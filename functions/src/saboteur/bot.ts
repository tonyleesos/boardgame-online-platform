import type { Shuffle } from "../timebomb-engine";
import {
  MINE_CARD_BY_ID,
  mineActor,
  pathBlocked,
  cellKey,
  type MineAction,
  type MineGame,
  type MinePrivate,
  type Effect,
  type MineBoard,
} from "../shared/saboteur";
import { frontier, validatePathPlacement } from "../shared/mineTopology";
import { legalActionTargets } from "../shared/mineActions";
import { mineAllegiances, mineRoutes } from "./strategy";

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

  const bad = own.role === "SABOTEUR",
    geo = own.role === "GEOLOGIST";
  const team =
    own.role === "BLUE_DIGGER"
      ? "BLUE"
      : own.role === "GREEN_DIGGER"
        ? "GREEN"
        : undefined;
  const { roles, beliefs } = mineAllegiances(g, own);
  const before = mineRoutes(g.board, own, team);
  const globalBefore = team ? mineRoutes(g.board, own) : before;
  const cache = new Map<
    string,
    {
      route: ReturnType<typeof mineRoutes>;
      global: ReturnType<typeof mineRoutes>;
    }
  >();
  const evaluate = (key: string, board: MineBoard) => {
    if (!cache.has(key)) {
      const route = mineRoutes(board, own, team);
      cache.set(key, { route, global: team ? mineRoutes(board, own) : route });
    }
    return cache.get(key)!;
  };
  const candidates: Array<{ action: MineAction; score: number }> = [];
  const cardScores = new Map(own.hand.map((id) => [id, 0]));
  const add = (action: MineAction, score: number) => {
    if ("cardId" in action)
      cardScores.set(
        action.cardId,
        Math.max(cardScores.get(action.cardId) ?? 0, score),
      );
    // Difficulty changes precision, never whether the bot follows its objective.
    if (score > 0) candidates.push({ action, score });
  };
  const positions = frontier(g.board);
  for (const id of own.hand) {
    const c = MINE_CARD_BY_ID[id];
    if (c.kind === "path" && !pathBlocked(g.players[uid])) {
      for (const pos of positions)
        for (const rotation of [0, 180] as const) {
          if (validatePathPlacement(g.board, c, pos.x, pos.y, rotation))
            continue;
          const board = {
            ...g.board,
            [cellKey(pos.x, pos.y)]: {
              ...pos,
              cardId: id,
              rotation,
              type: "path" as const,
            },
          };
          const signature = `${JSON.stringify(c.channels)}:${c.door}:${c.ladder}:${pos.x}:${pos.y}:${rotation}`;
          const after = evaluate(signature, board);
          const gain = after.route.value - before.value;
          const reveals = after.global.distances.some(
            (d, i) => d === 0 && globalBefore.distances[i] !== 0,
          );
          let score: number;
          if (bad) {
            // Do not improve ANY plausible route, even if a different route is still shorter.
            if (
              reveals ||
              after.global.distances.some(
                (d, i) => d < globalBefore.distances[i],
              ) ||
              gain >= -0.1
            )
              continue;
            score = 6 - gain * 3;
          } else if (geo) {
            score = (c.crystalCount ?? 0) * 14 + Math.max(0, gain) * 0.1;
            const hasCrystals = own.hand.some((id) => {
              const card = MINE_CARD_BY_ID[id];
              return card.kind === "path" && card.crystalCount;
            });
            if (reveals && hasCrystals) score -= 8;
          } else {
            if (team && c.door && c.door !== team) continue;
            // Never finish a route that only the other color can use.
            if (reveals && !after.route.distances.some((d) => d === 0))
              continue;
            if (gain <= 0 || c.channels.every((ch) => ch.length === 1))
              continue;
            score = 2 + gain * 3 + (reveals ? 100 : 0);
          }
          add({ type: "minePath", cardId: id, ...pos, rotation }, score);
        }
    } else if (c.kind === "action") {
      for (const target of legalActionTargets(g, uid, c)) {
        const belief = beliefs.get(target) ?? 0;
        // Gold teams cooperate against saboteurs; geologists and profiteers are neutral.
        const affinity =
          (bad ? -1 : geo || own.role === "PROFITEER" ? 0 : 1) * belief;
        const ally = affinity > 0.25,
          foe = affinity < -0.25;
        let score = 0;
        if (c.action === "REPAIR" || c.action === "FREEDOM")
          score = target === uid ? 22 : ally ? 10 * affinity : 0;
        if (c.action === "TRAPPED" || c.action === "BREAK")
          score = foe
            ? (pathBlocked(g.players[target]) && c.action === "BREAK"
                ? 3
                : 16) * -affinity
            : 0;
        if (c.action === "THEFT") score = 8;
        if (c.action === "MAP")
          score =
            own.goals[target] || Object.values(own.goals).includes("GOLD")
              ? 0
              : 6;
        if (c.action === "INSPECTION") score = roles.has(target) ? 0 : 8;
        if (c.action === "SWAP_HANDS")
          score = g.players[target].handCount - own.hand.length;
        if (c.action === "CHANGE_HATS")
          score = target !== uid && foe ? 7 * -affinity : 0;
        if (c.action === "HANDS_OFF") score = target !== uid && !ally ? 4 : 0;
        if (c.action === "ROCKFALL") {
          const board = { ...g.board };
          delete board[target];
          const after = evaluate(`remove:${target}`, board);
          const gain = after.route.value - before.value;
          const card = MINE_CARD_BY_ID[g.board[target].cardId];
          if (bad)
            score = after.global.distances.some(
              (d, i) => d < globalBefore.distances[i],
            )
              ? 0
              : -gain * 3;
          else if (geo) score = 0;
          else
            score =
              gain * 3 - (card.kind === "path" ? (card.crystalCount ?? 0) : 0);
        }
        const tool = c.tools?.find((t) => !!g.players[target]?.effects[t]);
        add(
          {
            type: "mineAction",
            cardId: id,
            ...(c.action === "MAP" || c.action === "ROCKFALL"
              ? { cell: target }
              : { target }),
            ...(tool ? { tool } : {}),
          },
          score,
        );
      }
    }
  }
  // Preserve useful actions when exchanging cards or paying to clear an effect.
  const discards = [...own.hand].sort(
    (a, b) => cardScores.get(a)! - cardScores.get(b)!,
  );
  if (pathBlocked(g.players[uid]) && own.hand.length >= 2) {
    const effect = (Object.keys(g.players[uid].effects) as Effect[]).find(
      (e) => e !== "THEFT",
    )!;
    add({ type: "mineClean", cards: discards.slice(0, 2), effect }, 12);
  }
  const playable = shuffle(candidates).sort((a, b) => b.score - a.score);
  if (playable.length) {
    const options = casual
      ? playable.filter((c) => c.score >= playable[0].score * 0.5)
      : playable.slice(0, 1);
    return casual ? shuffle(options)[0].action : options[0].action;
  }
  return { type: "minePass", cards: discards.slice(0, 3) };
}
