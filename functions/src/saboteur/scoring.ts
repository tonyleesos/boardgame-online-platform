import { canTeamReachGold, countVisibleCrystals } from "../shared/mineTopology";
import type {
  DwarfRole,
  MineGame,
  MinePrivate,
  MineRoundResult,
} from "../shared/saboteur";
export function resolveColoredTeams(
  role: DwarfRole,
  blue: boolean,
  green: boolean,
) {
  if (role === "BLUE_DIGGER" && blue) return { blue: true, green: false };
  if (role === "GREEN_DIGGER" && green) return { blue: false, green: true };
  return { blue, green };
}
export const winnerShare = (count: number) =>
  count > 0 ? Math.max(1, 6 - count) : 0;
export function calculateRoundGoldAwards(
  g: MineGame,
  privatePlayers: Record<string, MinePrivate>,
): MineRoundResult {
  const roles = Object.fromEntries(
    g.order.map((id) => [id, privatePlayers[id].role]),
  );
  const treasure = !!g.connector;
  const teams = treasure
    ? resolveColoredTeams(
        roles[g.connector!],
        canTeamReachGold(g.board, "BLUE"),
        canTeamReachGold(g.board, "GREEN"),
      )
    : { blue: false, green: false };
  const active = g.order.filter((id) => !g.players[id].effects.TRAPPED);
  const winners = active.filter((id) => {
    const role = roles[id];
    return (
      role === "PROFITEER" ||
      (treasure
        ? role === "BOSS" ||
          (role === "BLUE_DIGGER" && teams.blue) ||
          (role === "GREEN_DIGGER" && teams.green)
        : role === "SABOTEUR")
    );
  });
  const geologists = active.filter((id) => roles[id] === "GEOLOGIST"),
    crystals = countVisibleCrystals(g.board);
  const awards: Record<string, number> = Object.fromEntries(
    g.order.map((id) => [id, 0]),
  );
  for (const id of winners)
    awards[id] = Math.max(
      0,
      winnerShare(winners.length) -
        (roles[id] === "BOSS" ? 1 : roles[id] === "PROFITEER" ? 2 : 0),
    );
  for (const id of geologists)
    awards[id] = Math.floor(crystals / geologists.length);
  return {
    reason: treasure ? "TREASURE_REACHED" : "NO_CARDS_LEFT",
    roles,
    awards,
    ...teams,
    crystals,
    trapped: g.order.filter((id) => !!g.players[id].effects.TRAPPED),
  };
}
export function theftOrder(g: MineGame) {
  const eligible = g.order.filter(
    (id) => g.players[id].effects.THEFT && !g.players[id].effects.TRAPPED,
  );
  if (!eligible.length) return [];
  const latest = eligible.reduce((a, b) =>
    g.players[a].effects.THEFT!.sequence > g.players[b].effects.THEFT!.sequence
      ? a
      : b,
  );
  const i = g.order.indexOf(latest);
  return [...g.order.slice(i), ...g.order.slice(0, i)].filter((id) =>
    eligible.includes(id),
  );
}
export function determineMineWinners(totals: Record<string, number>) {
  const max = Math.max(...Object.values(totals));
  return Object.keys(totals).filter((id) => totals[id] === max);
}
