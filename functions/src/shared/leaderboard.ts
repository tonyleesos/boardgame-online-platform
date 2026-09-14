export const RANKED_GAMES = [
  "avalon",
  "timebomb-classic",
  "timebomb",
  "decorum",
  "splendor",
  "mafia-de-cuba",
] as const;
export type RankedGame = (typeof RANKED_GAMES)[number];
export const LEADERBOARD_LIMIT = 5;
export type LeaderboardSort = "total" | RankedGame;
export interface GameSettlement {
  matchId: string;
  gameId: RankedGame;
  winners: Array<{ uid: string; nickname: string }>;
  completedAt: number;
}
export interface LeaderboardEntry {
  uid: string;
  nickname: string;
  totalWins: number;
  wins: Record<RankedGame, number>;
}
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  self: LeaderboardEntry | null;
  limit: number;
}
export const emptyWins = (): Record<RankedGame, number> =>
  Object.fromEntries(RANKED_GAMES.map((id) => [id, 0])) as Record<
    RankedGame,
    number
  >;
