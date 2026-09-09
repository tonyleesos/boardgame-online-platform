import type { MissionVote, Role, Side, TeamVote } from "./model";
export const PLAYER_CONFIG: Record<
  number,
  { good: number; evil: number; missions: number[] }
> = {
  5: { good: 3, evil: 2, missions: [2, 3, 2, 3, 3] },
  6: { good: 4, evil: 2, missions: [2, 3, 4, 3, 4] },
  7: { good: 4, evil: 3, missions: [2, 3, 3, 4, 4] },
  8: { good: 5, evil: 3, missions: [3, 4, 4, 5, 5] },
  9: { good: 6, evil: 3, missions: [3, 4, 4, 5, 5] },
  10: { good: 6, evil: 4, missions: [3, 4, 4, 5, 5] },
};
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function getTeamCounts(count: number) {
  ensure(PLAYER_CONFIG[count], "需要 5–10 位玩家");
  return PLAYER_CONFIG[count];
}
export function getMissionTeamSize(count: number, round: number) {
  ensure(Number.isInteger(round) && round >= 1 && round <= 5, "無效的任務回合");
  return getTeamCounts(count).missions[round - 1];
}
export const requiresTwoFails = (count: number, round: number) =>
  count >= 7 && round === 4;
export const sideOf = (role: Role): Side =>
  ["assassin", "morgana", "minion"].includes(role) ? "evil" : "good";
export const calculateTeamVote = (votes: TeamVote[]) =>
  votes.filter((v) => v === "approve").length > votes.length / 2;
export const calculateMissionResult = (
  votes: MissionVote[],
  count: number,
  round: number,
): MissionVote =>
  votes.filter((v) => v === "fail").length >=
  (requiresTwoFails(count, round) ? 2 : 1)
    ? "fail"
    : "success";
export function rolesFor(count: number): Role[] {
  const c = getTeamCounts(count);
  return [
    "merlin",
    "percival",
    ...Array<Role>(c.good - 2).fill("servant"),
    "assassin",
    "morgana",
    ...Array<Role>(c.evil - 2).fill("minion"),
  ];
}
