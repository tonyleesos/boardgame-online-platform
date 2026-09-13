import assert from "node:assert/strict";
const project = "demo-boardgame";
const base = `http://127.0.0.1:5001/${project}/asia-east1`;
const database = `http://127.0.0.1:9000`;
const authUrl = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key";
async function player() {
  const response = await fetch(authUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `test-${crypto.randomUUID()}@example.test`, password: "Boardgame-test-72!", returnSecureToken: true }) });
  assert.equal(response.status, 200); return response.json();
}
async function call(p, name, data, denied = false) {
  const response = await fetch(`${base}/${name}`, { method: "POST", headers: { "Content-Type": "application/json", ...(p ? { Authorization: `Bearer ${p.idToken}` } : {}) }, body: JSON.stringify({ data }) });
  const body = await response.json();
  if (denied) { assert.ok(body.error, `${name} must reject`); return; }
  assert.ok(!body.error, JSON.stringify(body)); return body.result;
}
async function read(p, path, denied = false) {
  const response = await fetch(`${database}/${path}.json?ns=${project}-default-rtdb${p ? `&auth=${p.idToken}` : ""}`);
  assert.equal(response.status, denied ? 401 : 200, path);
  if (!denied) return response.json();
}
async function write(p, path, value, method = "PUT") {
  const response = await fetch(`${database}/${path}.json?ns=${project}-default-rtdb&auth=${p.idToken}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  assert.equal(response.status, 401, `Forbidden write: ${path}`);
}
const token = (g) => `${g.id}:${g.round}:${g.phase}:${g.currentPlayerIndex}:${g.turn}`;
const people = await Promise.all(Array.from({ length: 5 }, player));
const outsiders = people[4];
await call(null, "createRoom", { gameId: "decorum", nickname: "unauthenticated" }, true);
await call(people[0], "createRoom", { gameId: "decorum", nickname: "solo", mode: "practice" }, true);
for (const count of [2, 3, 4]) {
  const players = people.slice(0, count);
  const { code } = await call(players[0], "createRoom", { gameId: "decorum", nickname: "室友 1" });
  const path = `sessions/${code}`;
  await Promise.all(players.slice(1).map((p, i) => call(p, "joinRoom", { code, nickname: `室友 ${i + 2}` })));
  await call(players[0], "roomAction", { code, action: { type: "addBot" } }, true);
  await call(players[1], "roomAction", { code, action: { type: "decorScenario", scenarioId: "demo-two-01" } }, true);
  await Promise.all(players.map((p) => call(p, "roomAction", { code, action: { type: "ready", ready: true } })));
  await call(players[0], "roomAction", { code, action: { type: "start" } });
  const publicGame = async () => (await read(players[0], `${path}/public`)).decorum;
  let g = await publicGame();
  const act = (p, action, state = g, denied = false) => call(p, "gameAction", { code, phaseToken: token(state), action }, denied);
  await read(null, `${path}/public`, true);
  await read(outsiders, `${path}/public`, true);
  await read(players[0], path, true);
  await read(players[0], `${path}/secret`, true);
  await read(players[0], `${path}/decorumPrivate`, true);
  await read(players[0], `${path}/decorumPrivate/${players[1].localId}`, true);
  await read(outsiders, `${path}/decorumPrivate/${players[0].localId}`, true);
  const privateData = await Promise.all(players.map((p) => read(p, `${path}/decorumPrivate/${p.localId}`)));
  assert.equal(privateData[0].conditions.length, 3);
  assert.ok(!g.revealedConditions);
  for (const condition of privateData.flatMap((p) => p.conditions)) assert.ok(!JSON.stringify(g).includes(condition.description));
  await write(players[0], `${path}/public/decorum/winner`, "players");
  await write(players[0], `${path}/public/decorum`, { playerFulfilled: { [players[0].localId]: true } }, "PATCH");
  await write(players[0], `${path}/decorumPrivate/${players[0].localId}/conditions`, []);
  await write(players[1], `${path}/decorumPrivate/${players[0].localId}/sharedConditionsReceived`, []);
  await Promise.all(players.map((p) => act(p, { type: "decorReady" })));
  g = await publicGame();
  await act(outsiders, { type: "decorPass" }, g, true);
  await act(players[1], { type: "decorPaint", roomId: "living", color: "green" }, g, true);
  await act(players[0], { type: "decorPass", isFulfilled: true, winner: "players" }, g, true);
  const initialToken = g;
  const finishReactions = async () => {
    const actor = g.playerOrder[g.currentPlayerIndex];
    await Promise.all(players.filter((p) => p.localId !== actor).map((p) => act(p, { type: "decorReact", reaction: "neutral" })));
    g = await publicGame();
  };
  // Reach scheduled meetings through legal turns, never through admin DB edits.
  const firstMeeting = count === 2 ? 15 : 5;
  while (g.phase !== "HEART_TO_HEART" && g.phase !== "HOUSE_MEETING") {
    const actor = players.find((p) => p.localId === g.playerOrder[g.currentPlayerIndex]);
    const color = g.house.rooms.find((r) => r.id === "living").wallColor === "yellow" ? "red" : "yellow";
    await act(actor, { type: "decorPaint", roomId: "living", color });
    g = await publicGame();
    await finishReactions();
  }
  assert.equal(g.round, firstMeeting);
  await act(players[0], { type: "decorPaint", roomId: "living", color: "green" }, initialToken, true);
  const cid = privateData[0].conditions[0].id;
  await act(players[0], { type: "decorShare", conditionId: "forged-condition", recipientId: players[1].localId, status: "neutral" }, g, true);
  await act(players[0], { type: "decorShare", conditionId: cid, recipientId: outsiders.localId, status: "neutral" }, g, true);
  await act(players[0], { type: "decorShare", conditionId: cid, recipientId: players[1].localId, status: "positive" });
  await act(players[0], { type: "decorShare", conditionId: cid, recipientId: players[1].localId, status: "positive" }, g, true);
  const received = await read(players[1], `${path}/decorumPrivate/${players[1].localId}`);
  assert.equal(received.sharedConditionsReceived[0].ownerId, players[0].localId);
  for (const p of players.slice(2)) assert.equal((await read(p, `${path}/decorumPrivate/${p.localId}`)).sharedConditionsReceived, undefined);
  await Promise.all(players.slice(1).map((p, i) => act(p, { type: "decorShare", conditionId: privateData[i + 1].conditions[0].id, recipientId: players[0].localId, status: "neutral" })));
  g = await publicGame();
  assert.equal(g.phase, "PLAYER_ACTION"); assert.equal(g.round, firstMeeting + 1); assert.equal(g.heartsRemaining, count === 2 ? 2 : 4);
  await call(players[0], "roomAction", { code, action: { type: "leave" } });
  const ended = await read(players[1], `${path}/public`);
  assert.equal(ended.decorum.endReason, "player-left");
  assert.equal(Object.keys(ended.decorum.revealedConditions).length, count);
  await read(players[0], `${path}/public`, true);
  await call(players[1], "roomAction", { code, action: { type: "rematch" } });
  const reset = await read(players[1], `${path}/public`);
  assert.equal(reset.status, "waiting"); assert.equal(reset.decorum, undefined);
  assert.equal(await read(players[1], `${path}/decorumPrivate/${players[1].localId}`), null);
  console.log(`PASS: ${count}-player authenticated actions, private reads/writes, selective meeting, leave and rematch`);
}
