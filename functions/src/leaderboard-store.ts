import type { Firestore } from "firebase-admin/firestore";
import { creditWin, publicStats, type PlayerStats } from "./leaderboard";
import { createAsyncCache } from "./shared/async-cache";
import { LEADERBOARD_LIMIT } from "./shared/leaderboard";
import type {
  GameSettlement,
  LeaderboardEntry,
  LeaderboardSort,
} from "./shared/leaderboard";

export function createLeaderboardStore(firestore: Firestore) {
  const rankings = createAsyncCache<LeaderboardEntry[]>();
  return {
    async settle(result: GameSettlement): Promise<boolean> {
      const receipt = firestore.collection("gameResults").doc(result.matchId);
      return firestore.runTransaction(async (transaction) => {
        if ((await transaction.get(receipt)).exists) return false;
        const winners = [
          ...new Map((result.winners ?? []).map((p) => [p.uid, p])).values(),
        ];
        const refs = winners.map((p) =>
          firestore.collection("playerStats").doc(p.uid),
        );
        // All reads precede all writes. Every winner and the receipt commit together.
        const current = refs.length ? await transaction.getAll(...refs) : [];
        winners.forEach((player, i) => {
          transaction.set(
            refs[i],
            creditWin(
              current[i].exists ? (current[i].data() as PlayerStats) : null,
              result,
              player,
              result.completedAt,
            ),
          );
        });
        transaction.create(receipt, { ...result, winners });
        return true;
      });
    },
    async read(uid: string, sort: LeaderboardSort) {
      const field = sort === "total" ? "totalWins" : `wins.${sort}`;
      const [entries, own] = await Promise.all([
        rankings.get(sort, async () => {
          const snapshot = await firestore
            .collection("playerStats")
            .where(field, ">", 0)
            .orderBy(field, "desc")
            .limit(LEADERBOARD_LIMIT)
            .get();
          return snapshot.docs.map((doc) =>
            publicStats(doc.data() as PlayerStats),
          );
        }),
        firestore.collection("playerStats").doc(uid).get(),
      ]);
      return {
        entries,
        self: own.exists ? publicStats(own.data() as PlayerStats) : null,
        limit: LEADERBOARD_LIMIT,
      };
    },
  };
}
