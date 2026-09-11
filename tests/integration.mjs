import assert from "node:assert/strict";
const project = "demo-boardgame";
const authUrl =
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key";
const base = `http://127.0.0.1:5001/${project}/asia-east1`;
const db = "http://127.0.0.1:9000";
async function player() {
  const r = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  assert.equal(r.status, 200);
  return r.json();
}
async function call(p, name, data, fail = false) {
  const r = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(p ? { Authorization: `Bearer ${p.idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const v = await r.json();
  if (fail) {
    assert.ok(v.error, `Expected ${name} to reject: ${JSON.stringify(v)}`);
    return v;
  }
  assert.ok(!v.error, JSON.stringify(v));
  return v.result;
}
async function read(p, path, fail = false) {
  const r = await fetch(
    `${db}/${path}.json?ns=${project}-default-rtdb${p ? `&auth=${p.idToken}` : ""}`,
  );
  if (fail) {
    assert.equal(r.status, 401, `Expected denial at ${path}`);
    return;
  }
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
async function write(p, path, value, fail = true) {
  const r = await fetch(
    `${db}/${path}.json?ns=${project}-default-rtdb&auth=${p.idToken}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    },
  );
  assert.equal(r.status, fail ? 401 : 200);
}
const players = await Promise.all(Array.from({ length: 11 }, player));
const host = players[0];
await call(null, "createRoom", { nickname: "anon", gameId: "avalon" }, true);
const { code } = await call(host, "createRoom", {
  nickname: "Tony",
  gameId: "avalon",
});
const pub = `sessions/${code}/public`;
await read(null, pub, true);
await read(players[1], pub, true);
await call(players[1], "joinRoom", { nickname: "Kevin", code: "ZZZZZZ" }, true);
await Promise.all(
  players
    .slice(1, 5)
    .map((p, i) => call(p, "joinRoom", { nickname: `玩家${i + 2}`, code })),
);
await call(host, "joinRoom", { nickname: "Tony again", code });
let room = await read(host, pub);
assert.equal(Object.keys(room.players).length, 5);
await call(players[1], "roomAction", { code, action: { type: "start" } }, true);
await call(host, "roomAction", { code, action: { type: "start" } }, true);
await write(players[1], `${pub}/hostId`, players[1].localId);
await write(host, `${pub}/players/${host.localId}/ready`, true);
await write(
  host,
  `sessions/${code}/presence/${host.localId}/connections/test`,
  true,
  false,
);
await write(
  players[1],
  `sessions/${code}/presence/${host.localId}/connections/forged`,
  true,
);
await write(
  host,
  `sessions/${code}/presence/${host.localId}/lastSeen`,
  Date.now() + 60000,
);
await write(host, `sessions/${code}/presence/${host.localId}/extra`, "forged");
await Promise.all(
  players
    .slice(0, 5)
    .map((p) =>
      call(p, "roomAction", { code, action: { type: "ready", ready: true } }),
    ),
);
await call(host, "roomAction", { code, action: { type: "start" } });
await call(players[5], "joinRoom", { nickname: "late", code }, true);
await call(host, "joinRoom", { nickname: "reconnected", code });
const roles = await Promise.all(
  players
    .slice(0, 5)
    .map((p) => read(p, `sessions/${code}/private/${p.localId}`)),
);
await read(host, `sessions/${code}`, true);
await read(host, `sessions/${code}/secret`, true);
await read(host, `sessions/${code}/private`, true);
await read(host, `sessions/${code}/private/${players[1].localId}`, true);
await write(host, `sessions/${code}/private/${host.localId}`, {
  role: "merlin",
});
room = await read(host, pub);
assert.equal(room.game.roles, undefined);
const playerById = (id) => players.find((p) => p.localId === id);
async function act(p, action, fail = false, token) {
  const g = (await read(host, pub)).game;
  return call(
    p,
    "gameAction",
    {
      code,
      action,
      phaseToken: token ?? `${g.id}:${g.round}:${g.phase}:${g.proposalAttempt}`,
    },
    fail,
  );
}
const initial = (await read(host, pub)).game;
const oldToken = `${initial.id}:${initial.round}:${initial.phase}:${initial.proposalAttempt}`;
await Promise.all(players.slice(0, 5).map((p) => act(p, { type: "reveal" })));
await act(host, { type: "reveal" }, true, oldToken);
const sizes = [2, 3, 2];
for (let round = 0; round < 3; round++) {
  const g = (await read(host, pub)).game;
  const leader = playerById(g.leaderId);
  const team = g.order.slice(0, sizes[round]);
  await act(leader, { type: "select", players: team });
  await act(leader, { type: "propose" });
  await act(host, { type: "teamVote", vote: "approve" });
  const voting = (await read(host, pub)).game;
  assert.equal(
    voting.lastTeamVote?.votes?.[host.localId] === undefined || round > 0,
    true,
  );
  await act(host, { type: "teamVote", vote: "reject" }, true);
  await Promise.all(
    players
      .slice(1, 5)
      .map((p) => act(p, { type: "teamVote", vote: "approve" })),
  );
  const goodId = team.find(
    (id) => roles[players.findIndex((p) => p.localId === id)].side === "good",
  );
  if (goodId)
    await act(playerById(goodId), { type: "missionVote", vote: "fail" }, true);
  await Promise.all(
    team.map((id) =>
      act(playerById(id), { type: "missionVote", vote: "success" }),
    ),
  );
  assert.equal((await read(host, pub)).game.phase, "MISSION_RESULT");
  await act(leader, { type: "continue" });
}
assert.equal((await read(host, pub)).game.phase, "ASSASSINATION");
const assassin = players[roles.findIndex((r) => r.role === "assassin")];
const merlin = players[roles.findIndex((r) => r.role === "merlin")];
await act(assassin, { type: "assassinate", target: merlin.localId });
room = await read(host, pub);
assert.equal(room.game.winner, "evil");
assert.equal(Object.keys(room.game.roles).length, 5);
const previousId = room.game.id;
await call(host, "roomAction", { code, action: { type: "rematch" } });
room = await read(host, pub);
assert.equal(room.status, "waiting");
assert.equal(room.game, undefined);
assert.equal(
  await read(host, `sessions/${code}/private/${host.localId}`),
  null,
);
assert.ok(Object.values(room.players).every((p) => !p.ready));
await Promise.all(
  players
    .slice(5, 10)
    .map((p, i) => call(p, "joinRoom", { nickname: `more${i}`, code })),
);
await call(players[10], "joinRoom", { nickname: "overflow", code }, true);
await Promise.all(
  players
    .slice(0, 10)
    .map((p) =>
      call(p, "roomAction", { code, action: { type: "ready", ready: true } }),
    ),
);
await call(host, "roomAction", { code, action: { type: "start" } });
assert.notEqual((await read(host, pub)).game.id, previousId);
await call(host, "roomAction", { code, action: { type: "leave" } });
room = await read(players[1], pub);
assert.equal(room.status, "playing");
assert.equal(room.players[host.localId].isProxy, true);
assert.match(room.players[host.localId].nickname, /^[\u4e00-\u9fff]+AI$/);
assert.notEqual(room.hostId, host.localId);
await read(host, pub, true);
await read(host, `sessions/${code}/private/${host.localId}`, true);
await call(host, "roomAction", { code, action: { type: "ready", ready: true } }, true);
const recoveryHost = players[9],
  recoveryGuest = players[10];
const recovery = await call(recoveryHost, "createRoom", {
  nickname: "offline-host",
  gameId: "avalon",
});
await call(recoveryGuest, "joinRoom", {
  nickname: "online-guest",
  code: recovery.code,
});
await call(
  recoveryGuest,
  "roomAction",
  { code: recovery.code, action: { type: "recover" } },
  true,
);
await write(
  recoveryHost,
  `sessions/${recovery.code}/presence/${recoveryHost.localId}/lastSeen`,
  1,
  false,
);
await write(
  recoveryHost,
  `sessions/${recovery.code}/presence/${recoveryHost.localId}/connections/alive`,
  true,
  false,
);
await call(
  recoveryGuest,
  "roomAction",
  { code: recovery.code, action: { type: "recover" } },
  true,
);
await write(
  recoveryHost,
  `sessions/${recovery.code}/presence/${recoveryHost.localId}/connections/alive`,
  null,
  false,
);
await call(recoveryGuest, "roomAction", {
  code: recovery.code,
  action: { type: "recover" },
});
const recovered = await read(recoveryGuest, `sessions/${recovery.code}/public`);
assert.equal(recovered.hostId, recoveryGuest.localId);
assert.equal(Object.keys(recovered.players).length, 1);
await call(recoveryGuest, "roomAction", {
  code: recovery.code,
  action: { type: "leave" },
});
await call(
  recoveryGuest,
  "joinRoom",
  { nickname: "gone", code: recovery.code },
  true,
);
console.log(
  "PASS: anonymous auth, concurrent join/ready/votes, 5-player full game, 10-player start, capacity, reconnect, host transfer, rematch, stale-action rejection, private-role and write protection.",
);
