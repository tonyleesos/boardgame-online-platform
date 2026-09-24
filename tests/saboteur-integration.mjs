import assert from "node:assert/strict";
import shared from "../functions/lib/shared/saboteur.js";
import policy from "../functions/lib/saboteur/bot.js";
const {
  normalizeMine,
  normalizeMinePrivate,
  mineToken,
  mineActor,
  MINE_CARD_BY_ID,
} = shared;
const base = "http://127.0.0.1:5001/demo-boardgame/asia-east1";
const db = "http://127.0.0.1:9000";
async function signup() {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `mine-${crypto.randomUUID()}@example.test`,
        password: "Mine-test-password-72!",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(r.status, 200);
  return r.json();
}
async function call(p, name, data, denied = false) {
  const r = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(p ? { Authorization: `Bearer ${p.idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await r.json();
  if (denied) {
    assert.ok(body.error, `${name} should deny`);
    return body;
  }
  assert.ok(!body.error, JSON.stringify(body));
  return body.result;
}
async function read(p, path, denied = false) {
  const r = await fetch(
    `${db}/${path}.json?ns=demo-boardgame-default-rtdb${p ? `&auth=${p.idToken}` : ""}`,
  );
  assert.equal(r.status, denied ? 401 : 200, path);
  return r.json();
}
const people = await Promise.all(Array.from({ length: 13 }, signup));
for (const count of [2, 5, 12]) {
  const host = people[0],
    { code } = await call(host, "createRoom", {
      gameId: "saboteur-2",
      nickname: "礦坑房主",
    }),
    path = `sessions/${code}`;
  for (let i = 1; i < count; i++)
    await call(people[i], "joinRoom", { code, nickname: `矮人${i}` });
  for (const p of people.slice(0, count))
    await call(p, "roomAction", {
      code,
      action: { type: "ready", ready: true },
    });
  await call(host, "roomAction", { code, action: { type: "start" } });
  let g = normalizeMine((await read(host, `${path}/public`)).saboteur);
  assert.equal(g.order.length, count);
  assert.equal(g.round, 1);
  for (const p of people.slice(0, count))
    assert.equal(
      normalizeMinePrivate(
        await read(p, `${path}/saboteurPrivate/${p.localId}`),
      ).hand.length,
      6,
    );
  for (const tail of ["hand", "role", "gold", "goals", "inspections"])
    await read(
      host,
      `${path}/saboteurPrivate/${people[1].localId}/${tail}`,
      true,
    );
  for (const tail of ["deck", "removed", "roles", "discard", "goals"])
    await read(host, `${path}/secret/saboteur/${tail}`, true);
  await read(host, `${path}/saboteurPrivate`, true);
  await read(people[12], `${path}/public`, true);
  await read(null, `${path}/public`, true);
  for (const tail of [
    "public/saboteur/board",
    "public/saboteur/players",
    "saboteurPrivate/" + host.localId + "/gold",
  ]) {
    const r = await fetch(
      `${db}/${path}/${tail}.json?ns=demo-boardgame-default-rtdb&auth=${host.idToken}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "999",
      },
    );
    assert.equal(r.status, 401);
  }
  const actor = people.find((p) => p.localId === mineActor(g)),
    own = normalizeMinePrivate(
      await read(actor, `${path}/saboteurPrivate/${actor.localId}`),
    );
  const other = people.find((p) => p.localId !== actor.localId);
  await call(
    other,
    "gameAction",
    {
      code,
      phaseToken: mineToken(g),
      action: { type: "minePass", cards: [own.hand[0]] },
    },
    true,
  );
  await call(
    actor,
    "gameAction",
    {
      code,
      phaseToken: mineToken(g),
      action: { type: "minePath", cardId: "forged", x: 1, y: 0, rotation: 0 },
    },
    true,
  );
  const payload = {
    code,
    phaseToken: mineToken(g),
    action: { type: "minePass", cards: own.hand.slice(0, 2) },
  };
  const concurrent = await Promise.all([
    call(actor, "gameAction", payload).then(
      () => true,
      () => false,
    ),
    call(actor, "gameAction", payload).then(
      () => true,
      () => false,
    ),
  ]);
  assert.equal(concurrent.filter(Boolean).length, 1);
  await call(actor, "gameAction", payload, true);
  const seen = new Set();
  let steps = 0;
  while (
    (g = normalizeMine((await read(host, `${path}/public`)).saboteur)).phase !==
      "GAME_OVER" &&
    steps++ < 900
  ) {
    assert.equal(
      g.totals,
      undefined,
      "exact totals stay private until the final reveal",
    );
    if (g.phase === "ROUND_RESULT") {
      await call(host, "gameAction", {
        code,
        phaseToken: mineToken(g),
        action: { type: "mineNext" },
      });
      continue;
    }
    const uid = mineActor(g),
      player = people.find((p) => p.localId === uid),
      priv = normalizeMinePrivate(
        await read(player, `${path}/saboteurPrivate/${uid}`),
      );
    const action = policy.chooseMineAction(uid, g, priv, (a) => [...a]);
    assert.ok(action);
    seen.add(
      action.type === "mineAction"
        ? MINE_CARD_BY_ID[action.cardId].action
        : action.type,
    );
    await call(player, "gameAction", {
      code,
      phaseToken: mineToken(g),
      action,
    });
    const updated = normalizeMine(
      (await read(host, `${path}/public`)).saboteur,
    );
    if (updated.phase === "PRIVATE_RESULT") {
      const info = normalizeMinePrivate(
        await read(player, `${path}/saboteurPrivate/${uid}`),
      );
      assert.ok(info.notice);
      const stranger = people.find((p) => p.localId !== uid);
      await read(stranger, `${path}/saboteurPrivate/${uid}/notice`, true);
      assert.equal(updated.board["8_0"].revealed, g.board["8_0"].revealed);
    }
  }
  assert.equal(g.phase, "GAME_OVER");
  assert.equal(g.round, 3);
  assert.equal(Object.keys(g.totals).length, count);
  assert.ok(g.winners.length);
  assert.ok(seen.has("minePath"));
  await call(host, "roomAction", { code, action: { type: "rematch" } });
  const reset = await read(host, `${path}/public`);
  assert.equal(reset.status, "waiting");
  assert.equal(reset.saboteur, undefined);
  assert.equal(
    await read(host, `${path}/saboteurPrivate/${host.localId}`),
    null,
  );
  for (const p of people.slice(0, count))
    await call(p, "roomAction", { code, action: { type: "leave" } });
  console.log(
    `Saboteur ${count} players: three rounds (${steps} actions), secrecy, version race, reconnect and rematch PASS`,
  );
}
for (const count of [2, 6, 12]) {
  const host = people[0],
    { code } = await call(host, "createRoom", {
      gameId: "saboteur-2",
      nickname: "AI 練習者",
      mode: "practice",
      playerCount: count,
    });
  const path = `sessions/${code}`;
  await call(host, "roomAction", {
    code,
    action: { type: "ready", ready: true },
  });
  await call(host, "roomAction", { code, action: { type: "start" } });
  let g = normalizeMine((await read(host, `${path}/public`)).saboteur);
  if (mineActor(g) === host.localId) {
    const own = normalizeMinePrivate(
      await read(host, `${path}/saboteurPrivate/${host.localId}`),
    );
    await call(host, "gameAction", {
      code,
      phaseToken: mineToken(g),
      action: { type: "minePass", cards: own.hand.slice(0, 1) },
    });
    g = normalizeMine((await read(host, `${path}/public`)).saboteur);
  }
  const moves = await Promise.all([
    call(host, "advanceBots", { code, token: mineToken(g) }),
    call(host, "advanceBots", { code, token: mineToken(g) }),
  ]);
  assert.equal(moves.filter((r) => r.moved).length, 1);
  const next = normalizeMine((await read(host, `${path}/public`)).saboteur);
  assert.equal(next.revision, g.revision + 1);
  assert.equal(
    (await call(host, "advanceBots", { code, token: mineToken(next) })).moved,
    false,
  );
  await read(host, `${path}/saboteurPrivate/bot_1`, true);
  await call(host, "roomAction", { code, action: { type: "leave" } });
  console.log(
    `Saboteur practice ${count - 1} AI: automatic move, hidden hands and paced concurrency PASS`,
  );
}
