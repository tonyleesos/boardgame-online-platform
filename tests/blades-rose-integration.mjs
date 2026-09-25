import assert from "node:assert/strict";
import shared from "../functions/lib/shared/bladesRose.js";
import policy from "../functions/lib/bladesRose/bot.js";
const { roseToken, normalizeRose, normalizeRosePrivate, canSubmitRose } =
  shared;
const api = "http://127.0.0.1:5001/demo-boardgame/asia-east1",
  db = "http://127.0.0.1:9000";
let assertions = 0;
async function signup() {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `rose-${crypto.randomUUID()}@example.test`,
        password: "Rose-test-72!",
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
  if (denied) assert.ok(b.error, `${name} must reject`);
  else assert.ok(!b.error, JSON.stringify(b));
  assertions++;
  return b.result;
}
async function read(p, path, denied = false) {
  const r = await fetch(
    `${db}/${path}.json?ns=demo-boardgame-default-rtdb${p ? `&auth=${p.idToken}` : ""}`,
  );
  assert.equal(r.status, denied ? 401 : 200, path);
  assertions++;
  return r.json();
}
const people = await Promise.all(Array.from({ length: 9 }, signup));
const host = people[0];
await call(
  host,
  "createRoom",
  {
    gameId: "blades-and-rose",
    nickname: "測試",
    mode: "practice",
    playerCount: 5,
  },
  true,
);
const { code } = await call(host, "createRoom", {
    gameId: "blades-and-rose",
    nickname: "薔薇房主",
  }),
  path = `sessions/${code}`;
for (let i = 1; i < 8; i++)
  await call(people[i], "joinRoom", { code, nickname: `旅人 ${i}` });
for (const p of people.slice(0, 8))
  await call(p, "roomAction", { code, action: { type: "ready", ready: true } });
await call(people[1], "roomAction", { code, action: { type: "start" } }, true);
await call(host, "roomAction", { code, action: { type: "start" } });
const get = async () =>
  normalizeRose((await read(host, `${path}/public`)).rose);
const own = async (p) =>
  normalizeRosePrivate(await read(p, `${path}/rosePrivate/${p.localId}`));
let g = await get();
assert.equal(g.phase, "NIGHT");
for (const p of people.slice(0, 8)) assert.equal((await own(p)).hand.length, 3);
for (const tail of [
  "",
  "/hand",
  "/identity",
  "/crystal",
  "/night",
  "/knownRoles",
  "/peek",
])
  await read(host, `${path}/rosePrivate/${people[1].localId}${tail}`, true);
for (const branch of [
  "rosePrivate",
  "secret",
  "secret/rose",
  "secret/rose/contributions",
  "secret/rose/receipts",
])
  await read(host, `${path}/${branch}`, true);
await read(null, `${path}/public`, true);
await read(people[8], `${path}/public`, true);
for (const target of [
  "public/rose",
  `rosePrivate/${host.localId}/hand`,
  "secret/rose/contributions",
]) {
  const r = await fetch(
    `${db}/${path}/${target}.json?ns=demo-boardgame-default-rtdb&auth=${host.idToken}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  assert.equal(r.status, 401);
  assertions++;
}
const first = {
  code,
  phaseToken: roseToken(g),
  action: { type: "roseNight" },
  actionId: crypto.randomUUID(),
};
await call(host, "gameAction", first);
await call(host, "gameAction", first);
await call(
  host,
  "gameAction",
  { ...first, actionId: crypto.randomUUID() },
  true,
);
for (const p of people.slice(1, 8)) {
  g = await get();
  await call(p, "gameAction", {
    code,
    phaseToken: roseToken(g),
    action: { type: "roseNight" },
    actionId: crypto.randomUUID(),
  });
}
const personals = await Promise.all(people.slice(0, 8).map(own));
const double = personals.find((p) => p.identity === "DOUBLE_BLADE");
assert.deepEqual(double.hand.map((c) => c.type).sort(), [
  "DOUBLE_BLADE",
  "DOUBLE_BLADE",
  "FOLLOWER",
]);
g = await get();
const holder = people.find((p) => p.localId === g.current),
  outsider = people.find((p) => p.localId !== g.current);
await call(
  outsider,
  "gameAction",
  {
    code,
    phaseToken: roseToken(g),
    action: { type: "roseCoin", target: holder.localId },
    actionId: crypto.randomUUID(),
  },
  true,
);
const choices = g.order.filter((id) => id !== g.current);
const token = roseToken(g);
const race = await Promise.all(
  choices
    .slice(0, 2)
    .map((target) =>
      fetch(`${api}/gameAction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${holder.idToken}`,
        },
        body: JSON.stringify({
          data: {
            code,
            phaseToken: token,
            actionId: crypto.randomUUID(),
            action: { type: "roseCoin", target },
          },
        }),
      }).then((r) => r.json()),
    ),
);
assert.equal(race.filter((r) => r.result).length, 1);
assert.equal(race.filter((r) => r.error).length, 1);
assertions += 2;
for (let step = 0; step < 180; step++) {
  g = await get();
  if (g.phase === "GAME_OVER") break;
  const actor = people.find((p) => p.localId === g.current),
    p = await own(actor);
  let action;
  switch (g.phase) {
    case "COIN":
      action = {
        type: "roseCoin",
        target: g.order.find(
          (id) => id !== g.current && !g.players[id].crystalUsed,
        ),
      };
      break;
    case "CRYSTAL":
      action = { type: "roseCrystal" };
      break;
    case "TARGET": {
      const valid = g.order.filter((id) =>
        g.crystal === 7 ? id !== g.current : g.players[id].handCount > 0,
      );
      action = {
        type: "roseTarget",
        targets: valid.slice(0, g.crystal === 5 ? 2 : 1),
      };
      break;
    }
    case "PEEK": {
      assert.ok(p.peek);
      await read(
        host.localId !== actor.localId ? host : people[1],
        `${path}/rosePrivate/${actor.localId}/peek`,
        true,
      );
      action = { type: "rosePeek" };
      break;
    }
    case "DECISIONS": {
      const card = p.constraint.mustPlay
        ? p.hand.find((c) => canSubmitRose(p, c.id))
        : undefined;
      action = { type: "roseDecide", ...(card ? { cardId: card.id } : {}) };
      break;
    }
    case "REPLACE_TARGET":
      action = { type: "roseReplaceTarget" };
      break;
    case "ROUND_RESULT":
      action = { type: "roseContinue" };
      break;
    default:
      throw new Error(`Unexpected phase ${g.phase}`);
  }
  await call(actor, "gameAction", {
    code,
    phaseToken: roseToken(g),
    action,
    actionId: crypto.randomUUID(),
  });
}
g = await get();
assert.equal(g.phase, "GAME_OVER");
assert.ok(g.winner);
assert.ok(g.roles);
for (const r of g.history)
  for (const c of r.cards) {
    assert.equal("sourceUid" in c, r.crystal === 2);
    assert.ok(!("id" in c));
  }
await call(host, "roomAction", { code, action: { type: "rematch" } });
assert.equal((await read(host, `${path}/public`)).status, "waiting");
assert.equal(await read(host, `${path}/rosePrivate/${host.localId}`), null);
console.log(
  `Blades & Rose: ${assertions} emulator assertions passed; 8 authenticated players, private rules, duplicate request, race, complete match, rematch.`,
);
const practice = await call(host, "createRoom", {
  gameId: "blades-and-rose",
  nickname: "練習玩家",
  mode: "practice",
  playerCount: 8,
});
const practicePath = `sessions/${practice.code}`;
let practiceRoom = await read(host, `${practicePath}/public`);
assert.equal(
  Object.values(practiceRoom.players).filter((p) => p.isBot).length,
  7,
);
for (const bot of Object.values(practiceRoom.players).filter((p) => p.isBot))
  await read(host, `${practicePath}/rosePrivate/${bot.uid}`, true);
await call(host, "roomAction", {
  code: practice.code,
  action: { type: "ready", ready: true },
});
await call(host, "roomAction", {
  code: practice.code,
  action: { type: "start" },
});
// Advance through the real callable, retaining its pacing and stale-token guard.
for (let step = 0; step < 190; step++) {
  practiceRoom = await read(host, `${practicePath}/public`);
  if (practiceRoom.status === "finished") break;
  const game = normalizeRose(practiceRoom.rose),
    p = normalizeRosePrivate(
      await read(host, `${practicePath}/rosePrivate/${host.localId}`),
    );
  const action = policy.chooseRoseAction(host.localId, game, p, (v) => [...v]);
  if (action)
    await call(host, "gameAction", {
      code: practice.code,
      phaseToken: roseToken(game),
      actionId: crypto.randomUUID(),
      action,
    });
  else {
    await new Promise((resolve) => setTimeout(resolve, 1550));
    await call(host, "advanceBots", {
      code: practice.code,
      token: roseToken(game),
    });
  }
}
assert.equal(practiceRoom.status, "finished");
console.log(
  `AI practice passed: one authenticated human and seven private AI seats; ${assertions} total emulator assertions.`,
);
