import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { startGame } from "../functions/lib/engine.js";
import { createLeaderboardStore } from "../functions/lib/leaderboard-store.js";
import { emptyWins } from "../functions/lib/shared/leaderboard.js";

// Tests are hardwired to the demo project and loopback emulator.
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "demo-boardgame" }, "leaderboard-test");
const firestore = getFirestore(app);
const db = "http://127.0.0.1:9000";
const base = "http://127.0.0.1:5001/demo-boardgame/asia-east1";
const namespace = "demo-boardgame-default-rtdb";
async function admin(path, method = "GET", value) {
  const r = await fetch(`${db}/${path}.json?ns=${namespace}`, {
    method,
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
  assert.equal(r.status, 200);
  return r.json();
}
async function signup(anonymous = false) {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        anonymous
          ? { returnSecureToken: true }
          : {
              email: `leader-${crypto.randomUUID()}@example.test`,
              password: "Boardgame-test-72!",
              returnSecureToken: true,
            },
      ),
    },
  );
  assert.equal(r.status, 200);
  return r.json();
}
async function callable(user, name, data, status = 200) {
  const r = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(user ? { Authorization: `Bearer ${user.idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  assert.equal(r.status, status, await r.clone().text());
  return (await r.json()).result;
}
const board = (user, sort = "total", status = 200) =>
  callable(user, "getLeaderboard", { sort }, status);
async function eventually(check) {
  for (let i = 0; i < 120; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.fail("Firestore settlement did not complete within 30 seconds");
}
const stats = async (uid) =>
  (await firestore.doc(`playerStats/${uid}`).get()).data();
try {
  const a = await signup(),
    b = await signup();
  const prefix = crypto.randomUUID();
  const path = `sessions/test-${prefix}`;
  const result = (suffix, winners = [a.localId, b.localId]) => ({
    matchId: `${prefix}-${suffix}`,
    gameId: "splendor",
    completedAt: Date.now(),
    winners: winners.map((uid) => ({
      uid,
      nickname: uid === a.localId ? "排行玩家甲" : "排行玩家乙",
    })),
  });
  const first = result("first");
  await admin(`${path}/settlements/${first.matchId}`, "PUT", first);
  await eventually(
    async () =>
      (await stats(a.localId))?.totalWins === 1 &&
      (await stats(b.localId))?.totalWins === 1,
  );
  await eventually(
    async () => (await admin(`${path}/settlements/${first.matchId}`)) === null,
  );
  assert((await firestore.doc(`gameResults/${first.matchId}`).get()).exists);
  await Promise.all(
    [0, 1, 2].map((i) =>
      admin(`${path}-${i}/settlements/${first.matchId}`, "PUT", first),
    ),
  );
  await Promise.all(
    [2, 3, 4].map((i) => {
      const r = result(String(i));
      return admin(`${path}/settlements/${r.matchId}`, "PUT", r);
    }),
  );
  await eventually(
    async () =>
      (await stats(a.localId))?.totalWins === 4 &&
      (await stats(b.localId))?.totalWins === 4,
  );
  const deleted = result("deleted", [a.localId]);
  await admin(`${path}-deleted/settlements/${deleted.matchId}`, "PUT", deleted);
  await admin(`${path}-deleted`, "DELETE");
  await eventually(async () => (await stats(a.localId))?.totalWins === 5);
  assert.equal(
    await admin(`playerStats/${a.localId}`),
    null,
    "No RTDB statistics should be written",
  );
  assert(!(await stats(a.localId)).processedMatches);

  // Exercise the real callable final action, including its room transaction and outbox.
  const members = await Promise.all(Array.from({ length: 5 }, () => signup()));
  const { code } = await callable(members[0], "createRoom", {
    gameId: "avalon",
    nickname: "真人測試",
  });
  const session = {
    public: {
      code,
      gameId: "avalon",
      status: "waiting",
      hostId: members[0].localId,
      createdAt: 1,
      players: Object.fromEntries(
        members.map((p, i) => [
          p.localId,
          { uid: p.localId, nickname: `真人${i}`, ready: true, joinedAt: i },
        ]),
      ),
    },
    private: {},
    secret: { teamVotes: {}, missionVotes: {} },
  };
  startGame(session, `${prefix}-avalon`, (items) => items);
  session.public.game.phase = "ASSASSINATION";
  const assassin = members.find(
    (p) => session.private[p.localId].role === "assassin",
  );
  const merlin = members.find(
    (p) => session.private[p.localId].role === "merlin",
  );
  await admin(`sessions/${code}`, "PUT", session);
  await callable(assassin, "gameAction", {
    code,
    action: { type: "assassinate", target: merlin.localId },
    phaseToken: `${session.public.game.id}:${session.public.game.round}:ASSASSINATION:${session.public.game.proposalAttempt}`,
  });
  await callable(members[0], "roomAction", {
    code,
    action: { type: "rematch" },
  });
  await eventually(
    async () => (await stats(assassin.localId))?.wins.avalon === 1,
  );
  assert.equal(
    (await firestore.doc(`gameResults/${prefix}-avalon`).get()).data().winners
      .length,
    2,
  );

  const ranked = await board(a, "splendor");
  assert.equal(ranked.self.totalWins, 5);
  assert(!JSON.stringify(ranked).includes("completedAt"));
  for (let i = 1; i < ranked.entries.length; i++)
    assert(
      ranked.entries[i - 1].wins.splendor >= ranked.entries[i].wins.splendor,
    );
  assert.equal(
    (await board(a, "avalon")).entries.some((p) => p.uid === a.localId),
    false,
  );
  await board(null, "total", 401);
  await board(await signup(true), "total", 403);
  await board(a, "invalid", 400);

  // Global top five include other accounts, exclude the sixth player and keep
  // the caller's own stats separately. Names refresh even when scores are cached.
  const competitors = await Promise.all(
    Array.from({ length: 7 }, () => signup()),
  );
  await Promise.all(
    competitors.map((player, index) =>
      firestore.doc(`playerStats/${player.localId}`).set({
        uid: player.localId,
        nickname: `舊房間暱稱${index}`,
        wins: { ...emptyWins(), "mafia-de-cuba": 1000 + index },
        totalWins: 1000 + index,
        updatedAt: Date.now(),
      }),
    ),
  );
  const top = await board(a, "mafia-de-cuba");
  assert.equal(top.limit, 5);
  assert.deepEqual(
    top.entries.map((entry) => entry.uid),
    competitors
      .slice(2)
      .reverse()
      .map((player) => player.localId),
  );
  assert.equal(top.self.uid, a.localId);
  const champion = competitors[6];
  const renamed = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: champion.idToken,
        displayName: "冠軍新暱稱",
      }),
    },
  );
  assert.equal(renamed.status, 200);
  const renamedBoard = await board(b, "mafia-de-cuba");
  assert.equal(renamedBoard.entries[0].nickname, "冠軍新暱稱");
  assert.equal(renamedBoard.entries[0].totalWins, top.entries[0].totalWins);
  assert(!JSON.stringify(renamedBoard).includes(champion.email));
  await Promise.all(
    competitors.map((player) =>
      firestore.doc(`playerStats/${player.localId}`).delete(),
    ),
  );

  // Cache public rankings across users; fresh self data must never leak between UIDs.
  const store = createLeaderboardStore(firestore);
  const cached = await store.read(a.localId, "splendor");
  await store.settle(result("cache", [a.localId]));
  const refreshed = await store.read(a.localId, "splendor");
  assert.deepEqual(refreshed.entries, cached.entries);
  assert.equal(refreshed.self.totalWins, 6);
  assert.equal((await store.read(b.localId, "splendor")).self.uid, b.localId);
  assert.equal(await store.settle(result("cache", [a.localId])), false);

  const root =
    "http://127.0.0.1:8080/v1/projects/demo-boardgame/databases/(default)/documents";
  for (const token of [null, a.idToken, b.idToken]) {
    for (const resource of [
      `playerStats/${a.localId}`,
      `gameResults/${first.matchId}`,
      "gameResults/missing/children/forged",
    ]) {
      for (const method of ["GET", "PATCH", "DELETE"]) {
        const r = await fetch(`${root}/${resource}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(method === "PATCH"
            ? {
                body: JSON.stringify({
                  fields: {
                    totalWins: { integerValue: "999" },
                    uid: { stringValue: b.localId },
                  },
                }),
              }
            : {}),
        });
        assert.equal(r.status, 403, `${method} ${resource} must be denied`);
      }
    }
    const list = await fetch(`${root}/playerStats`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    assert.equal(list.status, 403);
  }
  const forge = await fetch(
    `${db}/${path}/settlements/forged.json?ns=${namespace}&auth=${a.idToken}`,
    { method: "PUT", body: JSON.stringify(first) },
  );
  assert.equal(forge.status, 401);
  console.log(
    "Leaderboard Firestore integration passed: real final action, atomic multi-winner writes, replay, concurrency, rematch/deletion, caches and security rules.",
  );
} finally {
  await firestore.terminate();
  await deleteApp(app);
}
