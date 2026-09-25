import {
  cellKey,
  GOAL_KEYS,
  MINE_CARD_BY_ID,
  type MineBoard,
  type MineGame,
  type MinePrivate,
  type Team,
} from "../shared/saboteur";
import {
  STEP,
  reachableChannels,
  reachableGoal,
  tileChannels,
} from "../shared/mineTopology";

/** Evaluate reachable exits, not merely tiles placed near a goal. Bridges,
 * ladders and team doors use the engine's connectivity rules. */
export function mineRoutes(board: MineBoard, own: MinePrivate, team?: Team) {
  const knownGold = GOAL_KEYS.filter((k) => own.goals[k] === "GOLD");
  const targets = knownGold.length
    ? knownGold
    : GOAL_KEYS.filter(
        (k) => own.goals[k] !== "ROCK" && board[k]?.revealed !== "ROCK",
      );
  const reached = reachableChannels(board, team);
  const exits = new Map<string, { x: number; y: number }>();
  for (const [key, tile] of Object.entries(board)) {
    tileChannels(tile).forEach((ports, channel) => {
      if (!reached.has(`${key}:${channel}`)) return;
      for (const edge of ports) {
        const [dx, dy] = STEP[edge];
        const x = tile.x + dx,
          y = tile.y + dy,
          next = cellKey(x, y);
        if (!board[next]) exits.set(next, { x, y });
      }
    });
  }
  const distances = targets.map((key) =>
    reachableGoal(board, key, reached)
      ? 0
      : Math.min(
          64,
          ...[...exits.values()].map(
            (pos) =>
              Math.abs(pos.x - board[key].x) + Math.abs(pos.y - board[key].y),
          ),
        ),
  );
  const value =
    (64 - Math.min(64, ...distances)) * 4 +
    distances.reduce((sum, d) => sum + Math.max(0, 16 - d) * 0.25, 0) +
    Math.min(exits.size, 20) * 0.02;
  return { value, distances };
}

/** -1 suggests saboteur, +1 suggests digger, 0 is unknown/neutral.
 * No other player's private role or cards are accepted. */
export function mineAllegiances(g: MineGame, own: MinePrivate) {
  const roundStart =
    g.activities.filter((e) => e.kind === "mineNext").at(-1)?.revision ?? -1;
  const history = g.activities.filter((e) => e.revision > roundStart);
  const roles = new Map<string, MinePrivate["role"]>();
  for (const id of g.order) {
    const changed =
      history.filter((e) => e.kind === "CHANGE_HATS" && e.target === id).at(-1)
        ?.revision ?? -1;
    const inspection = own.inspections
      .filter((i) => i.uid === id && i.revision > changed)
      .at(-1);
    // A role change might have fallen outside the retained public history.
    if (
      inspection &&
      (g.activities[0]?.revision ?? g.revision) <= inspection.revision + 1
    )
      roles.set(id, inspection.role);
  }
  const faction = (role: MinePrivate["role"]) =>
    role === "SABOTEUR"
      ? -1
      : ["BLUE_DIGGER", "GREEN_DIGGER", "BOSS"].includes(role)
        ? 1
        : 0;
  const beliefs = new Map(
    g.order.map((id) => [id, roles.has(id) ? faction(roles.get(id)!) : 0]),
  );
  const baseline = mineRoutes(g.board, own).value;
  for (const id of g.order) {
    if (roles.has(id)) continue;
    const changed =
      history.filter((e) => e.kind === "CHANGE_HATS" && e.target === id).at(-1)
        ?.revision ?? -1;
    let evidence = 0;
    for (const event of history) {
      if (event.uid !== id || event.revision <= changed) continue;
      if (event.kind === "minePath" && event.cell && event.cardId) {
        const card = MINE_CARD_BY_ID[event.cardId];
        if (
          card?.kind !== "path" ||
          g.board[event.cell]?.cardId !== event.cardId
        )
          continue;
        const without = { ...g.board };
        delete without[event.cell];
        const contribution = baseline - mineRoutes(without, own).value;
        if (contribution < -0.1) evidence -= 2;
        else if (contribution > 0.1 && !card.crystalCount) evidence += 1;
      }
      const targetRole = event.target && roles.get(event.target);
      if (targetRole) {
        if (event.kind === "REPAIR" || event.kind === "FREEDOM")
          evidence += faction(targetRole);
        if (event.kind === "BREAK" || event.kind === "TRAPPED")
          evidence -= faction(targetRole);
      }
    }
    beliefs.set(id, Math.max(-0.75, Math.min(0.75, evidence * 0.3)));
  }
  return { roles, beliefs };
}
