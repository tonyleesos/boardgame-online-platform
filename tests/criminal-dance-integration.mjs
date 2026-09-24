import assert from "node:assert/strict";
import shared from "../functions/lib/shared/criminalDance.js";
import policy from "../functions/lib/criminalDance/bot.js";
const { normalizeDance, normalizeDancePrivate, danceToken } = shared;
const api = "http://127.0.0.1:5001/demo-boardgame/asia-east1",
  db = "http://127.0.0.1:9000";
async function signup() {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `dance-${crypto.randomUUID()}@example.test`,
        password: "Dance-test-72!",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(r.status, 200);
  return r.json();
}
async function call(p, name, data, denied = false) {
  const r = await fetch(`${api}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(p ? { Authorization: `Bearer ${p.idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const b = await r.json();
  if (denied) {
    assert.ok(b.error, `${name} must reject`);
    return b;
  }
  assert.ok(!b.error, JSON.stringify(b));
  return b.result;
}
async function read(p, path, denied = false) {
  const r = await fetch(
    `${db}/${path}.json?ns=demo-boardgame-default-rtdb${p ? `&auth=${p.idToken}` : ""}`,
  );
  assert.equal(r.status, denied ? 401 : 200, path);
  return r.json();
}
const people = await Promise.all(Array.from({ length: 9 }, signup));
for (const count of [3, 8]) {
  const host = people[0],
    { code } = await call(host, "createRoom", {
      gameId: "criminal-dance",
      nickname: "舞會房主",
    }),
    path = `sessions/${code}`;
  for (let i = 1; i < count; i++)
    await call(people[i], "joinRoom", { code, nickname: `玩家${i}` });
  await call(
    people[1],
    "roomAction",
    {
      code,
      action: { type: "danceConfig", config: { targetScore: 5, boy: true } },
    },
    true,
  );
  await call(
    host,
    "roomAction",
    {
      code,
      action: { type: "danceConfig", config: { targetScore: 7, boy: false } },
    },
    true,
  );
  await call(host, "roomAction", {
    code,
    action: {
      type: "danceConfig",
      config: { targetScore: 5, boy: true, policeChiefEnabled: true },
    },
  });
  for (const p of people.slice(0, count))
    await call(p, "roomAction", {
      code,
      action: { type: "ready", ready: true },
    });
  await call(host, "roomAction", { code, action: { type: "start" } });
  let g = normalizeDance((await read(host, `${path}/public`)).dance);
  assert.equal(g.order.length, count);
  assert.equal(g.config.policeChiefEnabled, true);
  if (g.policeChiefHolderUid) {
    const holder = people.find((p) => p.localId === g.policeChiefHolderUid);
    assert.ok(
      (
        await read(holder, `${path}/dancePrivate/${holder.localId}`)
      ).hand.includes("POLICE_CHIEF-0"),
    );
  }
  for (const p of people.slice(0, count))
    assert.equal(
      normalizeDancePrivate(await read(p, `${path}/dancePrivate/${p.localId}`))
        .hand.length,
      4,
    );
  for (const tail of ["hand", "selection", "witness", "boyInitial"])
    await read(host, `${path}/dancePrivate/${people[1].localId}/${tail}`, true);
  for (const tail of ["excluded", "snapshot", "selections", "terminal"])
    await read(host, `${path}/secret/dance/${tail}`, true);
  await read(host, `${path}/dancePrivate`, true);
  await read(people[8], `${path}/public`, true);
  await read(null, `${path}/public`, true);
  for (const tail of [
    "public/dance",
    "dancePrivate/" + host.localId + "/hand",
  ]) {
    const r = await fetch(
      `${db}/${path}/${tail}.json?ns=demo-boardgame-default-rtdb&auth=${host.idToken}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "[]",
      },
    );
    assert.equal(r.status, 401);
  }
  const actor = people.find((p) => p.localId === g.current),
    other = people.find((p) => p.localId !== g.current);
  await call(
    other,
    "gameAction",
    {
      code,
      phaseToken: danceToken(g),
      action: { type: "dancePlay", cardId: "FIRST_DISCOVERER-0" },
    },
    true,
  );
  await call(
    actor,
    "gameAction",
    {
      code,
      phaseToken: danceToken(g),
      action: { type: "dancePlay", cardId: "forged" },
    },
    true,
  );
  const payload = {
    code,
    phaseToken: danceToken(g),
    action: { type: "dancePlay", cardId: "FIRST_DISCOVERER-0" },
  };
  const races = await Promise.all([
    call(actor, "gameAction", payload).then(
      () => true,
      () => false,
    ),
    call(actor, "gameAction", payload).then(
      () => true,
      () => false,
    ),
  ]);
  assert.equal(races.filter(Boolean).length, 1);
  await call(actor, "gameAction", payload, true);
  let steps = 0;
  const seen = new Set();
  while (
    (g = normalizeDance((await read(host, `${path}/public`)).dance)).phase !==
      "MATCH_END" &&
    steps++ < 800
  ) {
    seen.add(g.phase);
    const uid =
        g.phase === "ROUND_END"
          ? host.localId
          : (g.pending?.eligible.find((id) => !g.pending.locked.includes(id)) ??
            g.current),
      p = people.find((p) => p.localId === uid),
      own = normalizeDancePrivate(await read(p, `${path}/dancePrivate/${uid}`));
    assert.equal(own.hand.length, g.players[uid].handCount);
    assert.equal(own.revision, g.revision);
    if (g.phase === "WITNESS_REVEAL") {
      assert.ok(own.witness?.cards);
      await read(
        people.find((p) => p.localId !== uid),
        `${path}/dancePrivate/${uid}/witness`,
        true,
      );
    }
    const action =
      g.phase === "ROUND_END"
        ? { type: "danceNext" }
        : policy.chooseDanceAction(uid, g, own, (a) => [...a], count === 8);
    assert.ok(action, `${g.phase} stalled`);
    await call(p, "gameAction", { code, phaseToken: danceToken(g), action });
    if (g.phase === "WITNESS_REVEAL")
      assert.equal(
        (await read(p, `${path}/dancePrivate/${uid}`)).witness,
        undefined,
      );
    if (action.type === "danceSelect") {
      const after = normalizeDance((await read(p, `${path}/public`)).dance);
      assert.ok(
        !JSON.stringify(after.events.at(-1)).includes(action.cardId),
        "secret selected card leaked into event",
      );
      await read(
        people.find((q) => q.localId !== uid),
        `${path}/dancePrivate/${uid}/selection`,
        true,
      );
    }
  }
  assert.equal(g.phase, "MATCH_END");
  assert.ok(g.winners.length);
  assert.ok(seen.has("ROUND_END"));
  await call(host, "roomAction", { code, action: { type: "rematch" } });
  assert.equal((await read(host, `${path}/public`)).dance, undefined);
  assert.equal(await read(host, `${path}/dancePrivate/${host.localId}`), null);
  for (const p of people.slice(0, count))
    await call(p, "roomAction", { code, action: { type: "leave" } });
  console.log(
    `Criminal Dance ${count} players: full match (${steps} actions), private data, atomic version race, rematch PASS`,
  );
}
for (const count of [3, 8]) {
  const host = people[0],
    { code } = await call(host, "createRoom", {
      gameId: "criminal-dance",
      nickname: "AI 練習者",
      mode: "practice",
      playerCount: count,
    }),
    path = `sessions/${code}`;
  await call(host, "roomAction", {
    code,
    action: {
      type: "danceConfig",
      config: { targetScore: 5, boy: true, policeChiefEnabled: true },
    },
  });
  await call(host, "roomAction", {
    code,
    action: { type: "ready", ready: true },
  });
  await call(host, "roomAction", { code, action: { type: "start" } });
  let g = normalizeDance((await read(host, `${path}/public`)).dance);
  assert.equal(g.config.policeChiefEnabled, true);
  if (g.current === host.localId) {
    await call(host, "gameAction", {
      code,
      phaseToken: danceToken(g),
      action: { type: "dancePlay", cardId: "FIRST_DISCOVERER-0" },
    });
    g = normalizeDance((await read(host, `${path}/public`)).dance);
  }
  const moves = await Promise.all([
    call(host, "advanceBots", { code, token: danceToken(g) }),
    call(host, "advanceBots", { code, token: danceToken(g) }),
  ]);
  assert.equal(moves.filter((r) => r.moved).length, 1);
  const next = normalizeDance((await read(host, `${path}/public`)).dance);
  assert.equal(next.revision, g.revision + 1);
  assert.equal(
    (await call(host, "advanceBots", { code, token: danceToken(next) })).moved,
    false,
  );
  await read(host, `${path}/dancePrivate/bot_1`, true);
  await call(host, "roomAction", { code, action: { type: "leave" } });
  console.log(
    `Criminal Dance practice with ${count - 1} AI: private hands, paced concurrency and departure PASS`,
  );
}
