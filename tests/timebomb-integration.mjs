import assert from "node:assert/strict";
const authUrl =
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key";
const base = "http://127.0.0.1:5001/demo-boardgame/asia-east1";
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
    assert.ok(v.error, JSON.stringify(v));
    return v;
  }
  assert.equal(r.status, 200, JSON.stringify(v));
  assert.ok(!v.error, JSON.stringify(v));
  return v.result;
}
async function read(p, path, fail = false) {
  const r = await fetch(
    `http://127.0.0.1:9000/${path}.json?ns=demo-boardgame-default-rtdb&auth=${p.idToken}`,
  );
  assert.equal(r.status, fail ? 401 : 200);
  return r.json();
}
const people = await Promise.all(Array.from({ length: 9 }, player));
for (const [n, variant] of [
  [4, "classic"],
  [8, "classic"],
  [6, "evolution"],
]) {
  const active = people.slice(0, n),
    host = active[0];
  const { code } = await call(host, "createRoom", {
    nickname: "Host",
    gameId: variant === "classic" ? "timebomb-classic" : "timebomb",
    bombVariant: variant,
  });
  const pub = `sessions/${code}/public`;
  await Promise.all(
    active
      .slice(1)
      .map((p, i) => call(p, "joinRoom", { code, nickname: `Partner ${i}` })),
  );
  if (n === 6 || n === 8)
    await call(people[n], "joinRoom", { code, nickname: "Full" }, true);
  await Promise.all(
    active.map((p) =>
      call(p, "roomAction", { code, action: { type: "ready", ready: true } }),
    ),
  );
  await call(
    active[1],
    "roomAction",
    { code, action: { type: "start" } },
    true,
  );
  await call(host, "roomAction", { code, action: { type: "start" } });
  const own = await read(
    host,
    `sessions/${code}/timebombPrivate/${host.localId}`,
  );
  assert.equal(
    Object.values(own.inventory).reduce((a, b) => a + b, 0),
    5,
  );
  assert.deepEqual(Object.keys(own).sort(), ["inventory", "role", "round"]);
  await read(
    host,
    `sessions/${code}/timebombPrivate/${active[1].localId}`,
    true,
  );
  await read(host, `sessions/${code}/timebombPrivate`, true);
  await read(host, `sessions/${code}/secret/bombHands/${host.localId}`, true);
  const token = (g) => `${g.id}:${g.round}:${g.phase}:${g.cuts}`;
  const act = async (p, action, fail = false) => {
    const g = (await read(host, pub)).timebomb;
    return call(p, "gameAction", { code, action, phaseToken: token(g) }, fail);
  };
  const initial = (await read(host, pub)).timebomb;
  await Promise.all(active.map((p) => act(p, { type: "bombReveal" })));
  await call(
    host,
    "gameAction",
    { code, action: { type: "bombReveal" }, phaseToken: token(initial) },
    true,
  );
  for (let step = 0; step < 110; step++) {
    const room = await read(host, pub),
      g = room.timebomb;
    if (room.status === "finished") break;
    assert.equal(g.roles, undefined);
    assert.equal(g.bombHands, undefined);
    const byId = (id) => active.find((p) => p.localId === id);
    if (g.phase === "CLAIMS")
      await Promise.all(
        active
          .filter((p) => g.claims?.[p.localId] === undefined)
          .map((p) => act(p, { type: "claim", successes: 1 })),
      );
    else if (g.phase === "CUT") {
      const cutter = byId(g.scissorsId);
      const foreign = active.find((p) => p !== cutter);
      const target =
        g.forcedTarget ??
        g.order.find((id) => id !== g.scissorsId && g.hands?.[id]?.length);
      const slot = g.hands[target][0];
      await act(foreign, { type: "cut", target, slot }, true);
      if (!g.forcedTarget && g.hands[g.scissorsId]?.length)
        await act(
          cutter,
          { type: "cut", target: g.scissorsId, slot: g.hands[g.scissorsId][0] },
          true,
        );
      await act(cutter, { type: "cut", target, slot });
    } else if (g.phase === "DEFUSE") {
      const color = g.colors.find(
        (c) => c !== "yellow" && g.bombs?.[c] && !g.defused?.[c],
      );
      await act(byId(g.effectActor), { type: "defuse", color });
    } else if (g.phase === "REARM") {
      const color = g.colors.find((c) => g.defused?.[c]);
      await act(byId(g.effectActor), { type: "rearm", color });
    } else if (g.phase === "CUT_RESULT")
      await act(host, { type: "bombContinue" });
    else throw Error(`Unexpected phase ${g.phase}`);
  }
  const end = await read(host, pub);
  assert.equal(end.status, "finished");
  assert.equal(Object.keys(end.timebomb.roles).length, n);
  await call(host, "roomAction", { code, action: { type: "rematch" } });
  assert.equal(
    await read(host, `sessions/${code}/timebombPrivate/${host.localId}`),
    null,
  );
  assert.equal((await read(host, pub)).timebomb, undefined);
}
for (const gameId of ["avalon", "timebomb", "timebomb-classic"]) {
  const host = people[0];
  const { code } = await call(host, "createRoom", {
    nickname: "Solo",
    gameId,
    mode: "practice",
  });
  const pub = `sessions/${code}/public`;
  let room = await read(host, pub);
  assert.equal(Object.values(room.players).filter((p) => !p.isBot).length, 1);
  const bot = Object.values(room.players).find((p) => p.isBot);
  await call(people[1], "joinRoom", { code, nickname: "Uninvited" }, true);
  await call(
    people[1],
    "roomAction",
    { code, action: { type: "removeBot", botId: bot.uid } },
    true,
  );
  await call(
    host,
    "roomAction",
    { code, action: { type: "removeBot", botId: host.localId } },
    true,
  );
  await call(host, "roomAction", {
    code,
    action: { type: "removeBot", botId: bot.uid },
  });
  await call(host, "roomAction", { code, action: { type: "addBot" } });
  await call(host, "roomAction", {
    code,
    action: { type: "ready", ready: true },
  });
  await call(host, "roomAction", { code, action: { type: "start" } });
  room = await read(host, pub);
  const g = room.game ?? room.timebomb;
  const before = g.revision;
  await read(
    host,
    `sessions/${code}/${gameId === "avalon" ? "private" : "timebombPrivate"}/${Object.values(room.players).find((p) => p.isBot).uid}`,
    true,
  );
  await call(
    people[1],
    "advanceBots",
    { code, token: `${g.id}:${g.revision}` },
    true,
  );
  const results = await Promise.all(
    [1, 2].map(() =>
      call(host, "advanceBots", { code, token: `${g.id}:${g.revision}` }),
    ),
  );
  assert.equal(results.filter((r) => r.moved).length, 1);
  room = await read(host, pub);
  assert.equal((room.game ?? room.timebomb).revision, before + 1);
  await call(host, "roomAction", { code, action: { type: "leave" } });
  await call(host, "joinRoom", { code, nickname: "deleted" }, true);
}
await call(
  people[0],
  "createRoom",
  { nickname: "bad", gameId: "timebomb", mode: "practice", playerCount: 7 },
  true,
);
await call(
  people[0],
  "createRoom",
  { nickname: "bad", gameId: "timebomb", bombVariant: "invented" },
  true,
);
console.log(
  "PASS: 4/8-player classic and 6-player Evolution games, hidden hands/roles, capacity, rematch, practice isolation, bot management, one atomic bot move, human-only ownership.",
);
for (const data of [
  { gameId: "timebomb-classic", mode: "practice", playerCount: 9 },
  { gameId: "timebomb-classic", bombVariant: "evolution" },
  { gameId: "timebomb", bombVariant: "classic" },
])
  await call(people[0], "createRoom", { nickname: "bad", ...data }, true);
