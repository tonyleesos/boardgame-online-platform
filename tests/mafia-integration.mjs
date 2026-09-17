import assert from "node:assert/strict";
const project = "demo-boardgame",
  base = `http://127.0.0.1:5001/${project}/asia-east1`,
  db = `http://127.0.0.1:9000`;
async function player() {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `test-${crypto.randomUUID()}@example.test`,
        password: "Boardgame-test-72!",
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
    assert.ok(body.error, `${name} must reject`);
    return body;
  }
  assert.ok(!body.error, JSON.stringify(body));
  return body.result;
}
async function read(p, path, denied = false) {
  const r = await fetch(
    `${db}/${path}.json?ns=${project}-default-rtdb${p ? `&auth=${p.idToken}` : ""}`,
  );
  assert.equal(r.status, denied ? 401 : 200, path);
  return r.json();
}
async function denyWrite(p, path, value) {
  const r = await fetch(
    `${db}/${path}.json?ns=${project}-default-rtdb&auth=${p.idToken}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    },
  );
  assert.equal(r.status, 401, path);
}
async function admin(path, value) {
  const r = await fetch(`${db}/${path}.json?ns=${project}-default-rtdb`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify(value),
  });
  assert.equal(r.status, 200);
}
const people = await Promise.all(Array.from({ length: 13 }, player));
const host = people[0],
  outsiders = people[12];
await call(
  null,
  "createRoom",
  { gameId: "mafia-de-cuba", nickname: "anonymous" },
  true,
);

for (const count of [6, 12]) {
  const players = people.slice(0, count),
    { code } = await call(host, "createRoom", {
      gameId: "mafia-de-cuba",
      nickname: "Godfather",
    }),
    path = `sessions/${code}`;
  for (const [i, p] of players.slice(1).entries())
    await call(p, "joinRoom", { code, nickname: `Player ${i + 1}` });

  await call(
    players[1],
    "roomAction",
    {
      code,
      action: {
        type: "mafiaConfig",
        config: {
          cleanerEnabled: false,
          godfatherSelection: "RANDOM",
          expansion: "NONE",
        },
      },
    },
    true,
  );
  if (count === 12)
    await call(outsiders, "joinRoom", { code, nickname: "overflow" }, true);
  for (const p of players)
    await call(p, "roomAction", {
      code,
      action: { type: "ready", ready: true },
    });
  await call(host, "roomAction", { code, action: { type: "start" } });
  let g = (await read(host, `${path}/public`)).mafia;
  const current = async () => (g = (await read(host, `${path}/public`)).mafia);
  const action = async (p, a, denied = false) =>
    call(
      p,
      "gameAction",
      { code, phaseToken: `${g.id}:${g.revision}`, action: a },
      denied,
    );
  const own = async (p) => read(p, `${path}/mafiaPrivate/${p.localId}`);
  const byId = (id) => players.find((p) => p.localId === id);
  await read(outsiders, `${path}/public`, true);
  await read(null, `${path}/public`, true);
  await read(host, path, true);
  await read(host, `${path}/secret`, true);
  await read(host, `${path}/secret/mafia/box`, true);
  await read(players[1], `${path}/secret/mafia/discarded`, true);
  await read(host, `${path}/mafiaPrivate`, true);
  await read(host, `${path}/mafiaPrivate/${players[1].localId}`, true);
  await read(
    players[1],
    `${path}/mafiaPrivate/${host.localId}/hiddenDiamonds`,
    true,
  );
  await denyWrite(host, `${path}/public/mafia/revision`, 999);
  await denyWrite(
    host,
    `${path}/mafiaPrivate/${host.localId}/role`,
    "AGENT_FBI",
  );
  await denyWrite(host, `${path}/secret/mafia/box/diamonds`, 999);
  await action(outsiders, { type: "mafiaPrepare", hidden: 2 }, true);
  await action(players[1], { type: "mafiaPrepare", hidden: 2 }, true);
  await action(host, { type: "mafiaPrepare", hidden: 3 });
  await current();
  assert.equal((await own(host)).currentBoxView, undefined);
  const first = byId(g.holderId),
    firstView = await own(first);
  assert.equal(firstView.currentBoxView.diamonds, 12);
  // Re-read models a restored private subscription after reconnect.
  assert.deepEqual((await own(first)).currentBoxView, firstView.currentBoxView);
  await read(
    host,
    `${path}/mafiaPrivate/${first.localId}/currentBoxView`,
    true,
  );
  await action(host, { type: "mafiaTake", diamonds: 1 }, true);
  const stale = `${g.id}:${g.revision}`;
  const attempts = await Promise.allSettled([
    action(first, {
      type: "mafiaTake",
      diamonds: 3,
      discardTokenId: firstView.currentBoxView.tokens[0].id,
    }),
    action(first, {
      type: "mafiaTake",
      diamonds: 3,
      discardTokenId: firstView.currentBoxView.tokens[0].id,
    }),
  ]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  await current();
  assert.equal((await own(first)).diamonds, 3);
  assert.equal((await own(first)).currentBoxView, undefined);
  assert.equal((await own(first)).receivedBox.diamonds, 12);
  assert.equal((await own(first)).passedBox.diamonds, 9);
  assert.equal((await own(first)).hiddenBag.token.role, "LOYAL_HENCHMAN");
  await read(host, `${path}/mafiaPrivate/${first.localId}/receivedBox`, true);
  await read(host, `${path}/mafiaPrivate/${first.localId}/hiddenBag`, true);
  assert.equal(
    await read(first, `${path}/mafiaPrivate/${first.localId}/currentBoxView`),
    null,
  );
  const second = byId(g.holderId);
  assert.equal((await own(second)).currentBoxView.diamonds, 9);
  await read(
    first,
    `${path}/mafiaPrivate/${second.localId}/currentBoxView`,
    true,
  );
  await call(
    first,
    "gameAction",
    { code, phaseToken: stale, action: { type: "mafiaTake", diamonds: 1 } },
    true,
  );
  assert.ok(
    !JSON.stringify(g).match(
      /currentBoxView|receivedBox|passedBox|hiddenBag|hiddenDiamonds|initialDiamonds|discarded|token-0/,
    ),
  );
  // Identical public progression regardless of diamond/token/empty choice.
  let agentId;
  while (g.phase === "BOX_PASS") {
    const p = byId(g.holderId),
      view = (await own(p)).currentBoxView;
    const a =
      p.localId === g.passOrder.at(-1)
        ? { type: "mafiaTake", nothing: true }
        : view.tokens?.length
          ? { type: "mafiaTake", tokenId: view.tokens[0].id }
          : view.diamonds
            ? { type: "mafiaTake", diamonds: 1 }
            : { type: "mafiaTake", nothing: true };
    if (
      a.tokenId &&
      view.tokens.find((t) => t.id === a.tokenId)?.role.startsWith("AGENT")
    )
      agentId = p.localId;
    await action(p, a);
    await current();
  }
  assert.equal(g.phase, "INVESTIGATION");
  await action(first, { type: "mafiaSay", text: "我沒有拿鑽石。" });
  await current();
  assert.equal(g.messages.at(-1).text, "我沒有拿鑽石。");
  assert.equal(g.seats[first.localId].revealed, false);
  if (count === 12) {
    for (const [index, ordinary] of [players[2], players[3]].entries()) {
      await action(host, { type: "mafiaAccuse", target: ordinary.localId });
      await current();
      await new Promise((resolve) => setTimeout(resolve, 1700));
      await action(host, { type: "mafiaResolve" });
      await current();
      assert.equal(g.jokers, 1 - index);
      assert.equal(g.phase, "INVESTIGATION");
      assert.equal(g.seats[ordinary.localId].alive, true);
      await action(ordinary, {
        type: "mafiaSay",
        text: "我是心腹，繼續調查。",
      });
      await current();
    }
  }
  assert.ok((await own(host)).currentBoxView);
  for (const p of players.slice(1))
    assert.equal((await own(p)).currentBoxView, undefined);
  await read(
    players[1],
    `${path}/mafiaPrivate/${host.localId}/currentBoxView`,
    true,
  );
  await action(
    players[1],
    { type: "mafiaAccuse", target: players[2].localId },
    true,
  );
  await call(host, "roomAction", { code, action: { type: "recover" } }, true);
  await action(host, { type: "mafiaAccuse", target: first.localId });
  await current();
  assert.equal(g.phase, "ACCUSATION_PENDING");
  assert.equal(g.seats[first.localId].role, undefined);
  await action(host, { type: "mafiaResolve" }, true);
  await new Promise((r) => setTimeout(r, 1700));
  await action(players[1], { type: "mafiaResolve" });
  await current();
  assert.equal(g.recovered, 3);
  assert.equal(g.seats[first.localId].role, "THIEF");
  assert.equal((await own(first)).diamonds, 0);
  assert.equal((await own(first)).receivedBox.diamonds, 12);
  await action(first, { type: "mafiaSay", text: "出局後提示" }, true);
  // Finish through an agent accusation (without consulting any other user's data).
  if (g.phase === "INVESTIGATION") {
    const agent = byId(agentId);
    await action(host, { type: "mafiaAccuse", target: agent.localId });
    await current();
    await new Promise((r) => setTimeout(r, 1700));
    await action(host, { type: "mafiaResolve" });
    await current();
    assert.equal(g.winReason, "AGENT_ACCUSED");
    assert.deepEqual(g.winners, [
      agent.localId,
      ...(count === 6
        ? [players[3].localId]
        : [players[8].localId, players[9].localId]),
    ]);
  }
  assert.ok(g.final);
  assert.equal(g.final.hiddenDiamonds, 3);
  assert.ok(g.final.discarded);
  assert.equal((await own(host)).currentBoxView, undefined);
  await call(host, "roomAction", { code, action: { type: "rematch" } });
  assert.equal((await read(host, `${path}/public`)).mafia, undefined);
  assert.equal(await own(host), null);
  // Start again, confirm game ID replay protection and explicit leave abort.
  for (const p of players)
    await call(p, "roomAction", {
      code,
      action: { type: "ready", ready: true },
    });
  await call(host, "roomAction", { code, action: { type: "start" } });
  await current();
  await call(
    host,
    "gameAction",
    { code, phaseToken: stale, action: { type: "mafiaPrepare", hidden: 0 } },
    true,
  );
  await action(host, { type: "mafiaPrepare", hidden: 0 });
  await current();
  await call(byId(g.holderId), "roomAction", {
    code,
    action: { type: "leave" },
  });
  assert.equal((await read(host, `${path}/public`)).mafia.winReason, "ABORTED");
  console.log(
    `Mafia ${count} players: lifecycle, choices, concurrent retry, secrecy, reconnect, accusation, winners, rematch and leave PASS`,
  );
}
// Use the emulator admin only to construct otherwise expensive advanced setups.
// Real clients still execute all protected cleaner actions through callables.
{
  const { code } = await call(host, "createRoom", {
      gameId: "mafia-de-cuba",
      nickname: "Cleaner test",
    }),
    path = `sessions/${code}`;
  for (const [i, p] of people.slice(1, 6).entries())
    await call(p, "joinRoom", { code, nickname: `Cleaner ${i}` });
  await call(host, "roomAction", {
    code,
    action: {
      type: "mafiaConfig",
      config: {
        cleanerEnabled: true,
        godfatherSelection: "HOST_SELECTS",
        expansion: "NONE",
      },
    },
  });
  for (const p of people.slice(0, 6))
    await call(p, "roomAction", {
      code,
      action: { type: "ready", ready: true },
    });
  await call(host, "roomAction", { code, action: { type: "start" } });
  let g = (await read(host, `${path}/public`)).mafia;
  const roleMap = {};
  const roles = [
    "GODFATHER",
    "CLEANER",
    "AGENT_FBI",
    "THIEF",
    "STREET_URCHIN",
    "DRIVER",
  ];
  for (const [i, p] of people.slice(0, 6).entries()) {
    roleMap[p.localId] = { role: roles[i], diamonds: i === 3 ? 4 : 0 };
    await admin(`${path}/mafiaPrivate/${p.localId}`, {
      gameId: g.id,
      ...roleMap[p.localId],
    });
  }
  await admin(`${path}/secret/mafia/roles`, roleMap);
  await admin(`${path}/secret/mafia/box/diamonds`, 11);
  await admin(`${path}/public/mafia/phase`, "INVESTIGATION");
  const action = async (p, a, denied = false) =>
    call(
      p,
      "gameAction",
      { code, phaseToken: `${g.id}:${g.revision}`, action: a },
      denied,
    );
  await action(host, { type: "mafiaAccuse", target: people[2].localId });
  g = (await read(host, `${path}/public`)).mafia;
  const before = structuredClone(g);
  await action(people[3], { type: "mafiaCleaner", choice: "SHOOT" }, true);
  await action(people[1], { type: "mafiaCleaner", choice: "SHOOT" });
  assert.deepEqual((await read(host, `${path}/public`)).mafia, before);
  await read(
    host,
    `${path}/mafiaPrivate/${people[1].localId}/cleanerChoice`,
    true,
  );
  await read(host, `${path}/secret/mafia/cleanerChoice`, true);
  await action(people[1], { type: "mafiaCleaner", choice: "PASS" }, true);
  await action(host, { type: "mafiaResolve" }, true);
  await new Promise((r) =>
    setTimeout(r, Math.max(0, g.pending.deadline - Date.now() + 100)),
  );
  await action(host, { type: "mafiaResolve" });
  g = (await read(host, `${path}/public`)).mafia;
  assert.equal(g.winReason, "CLEANER_SHOT_AGENT");
  assert.deepEqual(g.winners, [people[1].localId]);
  console.log(
    "Mafia Cleaner: private action, constant public snapshot, deadline, duplicate denial and solo win PASS",
  );
}
// Practice uses the same public/private boundaries as a friends room.
for (const [count, aiFather] of [
  [6, false],
  [12, true],
]) {
  const { code } = await call(host, "createRoom", {
      gameId: "mafia-de-cuba",
      nickname: "Solo",
      mode: "practice",
      playerCount: count,
    }),
    path = `sessions/${code}`;
  let room = await read(host, `${path}/public`);
  assert.equal(
    Object.values(room.players).filter((p) => p.isBot && p.ready).length,
    count - 1,
  );
  await call(outsiders, "joinRoom", { code, nickname: "intruder" }, true);
  await call(host, "roomAction", {
    code,
    action: {
      type: "mafiaConfig",
      config: {
        cleanerEnabled: false,
        godfatherSelection: "HOST_SELECTS",
        godfatherId: aiFather ? "bot_1" : host.localId,
        expansion: "NONE",
      },
    },
  });
  room = await read(host, `${path}/public`);
  assert.ok(
    Object.values(room.players)
      .filter((p) => p.isBot)
      .every((p) => p.ready),
  );
  await call(host, "roomAction", {
    code,
    action: { type: "ready", ready: true },
  });
  await call(host, "roomAction", { code, action: { type: "start" } });
  let g = (await read(host, `${path}/public`)).mafia;
  const action = async (a) =>
    call(host, "gameAction", {
      code,
      phaseToken: `${g.id}:${g.revision}`,
      action: a,
    });
  await read(host, `${path}/mafiaPrivate/bot_1`, true);
  await call(
    outsiders,
    "advanceBots",
    { code, token: `${g.id}:${g.revision}` },
    true,
  );
  if (aiFather) {
    await action({ type: "mafiaPrepare", hidden: 0 }).then(
      () => assert.fail("Human cannot act as AI godfather"),
      () => {},
    );
  } else {
    await action({ type: "mafiaPrepare", hidden: 2 });
    g = (await read(host, `${path}/public`)).mafia;
  }
  const response = await Promise.all([
    call(host, "advanceBots", { code, token: `${g.id}:${g.revision}` }),
    call(host, "advanceBots", { code, token: `${g.id}:${g.revision}` }),
  ]);
  assert.equal(response.filter((r) => r.moved).length, 1);
  for (let step = 0; step < 80; step++) {
    room = await read(host, `${path}/public`);
    g = room.mafia;
    if (room.status === "finished") break;
    if (g.phase === "ACCUSATION_PENDING") {
      await new Promise((r) =>
        setTimeout(r, Math.max(0, g.pending.deadline - Date.now() + 70)),
      );
      await action({ type: "mafiaResolve" });
    } else if (g.phase === "INVESTIGATION" && g.godfatherId === host.localId)
      await action({
        type: "mafiaAccuse",
        target: g.passOrder.find(
          (id) => g.seats[id].alive && !g.seats[id].revealed,
        ),
      });
    else if (g.phase === "BOX_PASS" && g.holderId === host.localId) {
      const own = await read(host, `${path}/mafiaPrivate/${host.localId}`),
        box = own.currentBoxView;
      await action(
        g.passOrder.at(-1) === host.localId
          ? { type: "mafiaTake", nothing: true }
          : box.diamonds
            ? { type: "mafiaTake", diamonds: 1 }
            : box.tokens?.length
              ? { type: "mafiaTake", tokenId: box.tokens[0].id }
              : { type: "mafiaTake", nothing: true },
      );
    } else {
      await new Promise((r) => setTimeout(r, 700));
      await call(host, "advanceBots", { code, token: `${g.id}:${g.revision}` });
    }
  }
  room = await read(host, `${path}/public`);
  assert.equal(room.status, "finished");
  assert.ok(room.mafia.final);
  assert.ok(room.mafia.winners.length);
  await call(host, "roomAction", { code, action: { type: "rematch" } });
  room = await read(host, `${path}/public`);
  assert.equal(room.status, "waiting");
  assert.ok(
    Object.values(room.players)
      .filter((p) => p.isBot)
      .every((p) => p.ready),
  );
  await call(host, "roomAction", { code, action: { type: "leave" } });
  await read(host, `${path}/public`, true);
  console.log(
    `Mafia solo ${count} players / ${aiFather ? "AI" : "human"} godfather: complete game, bot isolation, concurrent single-step and rematch PASS`,
  );
}
{
  const { code } = await call(host, "createRoom", {
      gameId: "mafia-de-cuba",
      nickname: "Private AI Cleaner",
      mode: "practice",
      playerCount: 6,
    }),
    path = `sessions/${code}`;
  await call(host, "roomAction", {
    code,
    action: {
      type: "mafiaConfig",
      config: {
        cleanerEnabled: true,
        godfatherSelection: "HOST_SELECTS",
        expansion: "NONE",
      },
    },
  });
  await call(host, "roomAction", {
    code,
    action: { type: "ready", ready: true },
  });
  await call(host, "roomAction", { code, action: { type: "start" } });
  const g = (await read(host, `${path}/public`)).mafia;
  await admin(`${path}/public/mafia/phase`, "ACCUSATION_PENDING");
  await admin(`${path}/public/mafia/pending`, {
    target: "bot_2",
    deadline: Date.now() + 8000,
  });
  await admin(`${path}/mafiaPrivate/bot_1`, {
    gameId: g.id,
    role: "CLEANER",
    diamonds: 0,
  });
  await admin(`${path}/secret/mafia/roles/bot_1`, {
    role: "CLEANER",
    diamonds: 0,
  });
  const before = await read(host, `${path}/public`);
  const response = await call(host, "advanceBots", {
    code,
    token: `${g.id}:${g.revision}`,
  });
  assert.deepEqual(response, { moved: false, idle: true });
  assert.deepEqual(await read(host, `${path}/public`), before);
  await read(host, `${path}/mafiaPrivate/bot_1/cleanerChoice`, true);
  await read(host, `${path}/secret/mafia/cleanerChoice`, true);
  assert.deepEqual(
    await call(host, "advanceBots", { code, token: `${g.id}:${g.revision}` }),
    response,
  );
  await call(host, "roomAction", { code, action: { type: "leave" } });
  console.log(
    "Mafia AI Cleaner: callable result, activity, deadline and public timestamp do not leak ownership/choice PASS",
  );
}
