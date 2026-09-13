import assert from "node:assert/strict";
const origin =
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts",
  db = "http://127.0.0.1:9000",
  base = "http://127.0.0.1:5001/demo-boardgame/asia-east1";
async function signup(registered = true) {
  const r = await fetch(`${origin}:signUp?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      returnSecureToken: true,
      ...(registered
        ? {
            email: `auth-${crypto.randomUUID()}@example.test`,
            password: "Registered-password-72!",
          }
        : {}),
    }),
  });
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
    assert.ok(body.error, `${name} must deny`);
    assert.ok(
      ["UNAUTHENTICATED", "PERMISSION_DENIED"].includes(body.error.status),
    );
  } else assert.ok(!body.error, JSON.stringify(body.error));
  return body.result;
}
const member = await signup(),
  guest = await signup(false);
for (const p of [null, guest])
  for (const name of [
    "createRoom",
    "joinRoom",
    "roomAction",
    "gameAction",
    "advanceBots",
  ])
    await call(
      p,
      name,
      {
        code: "ABC234",
        gameId: "mafia-de-cuba",
        nickname: "Auth test",
        action: { type: "start" },
      },
      true,
    );
const { code } = await call(member, "createRoom", {
  gameId: "mafia-de-cuba",
  nickname: "Member",
  mode: "practice",
  playerCount: 6,
});
const path = `sessions/${code}`;
// Guest deliberately occupies a real member seat: denial must come from provider
// enforcement, independently of the existing room membership rules.
const seed = await fetch(
  `${db}/${path}/public/players/${guest.localId}.json?ns=demo-boardgame-default-rtdb`,
  {
    method: "PUT",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uid: guest.localId,
      nickname: "Legacy guest",
      joinedAt: 1,
      ready: true,
    }),
  },
);
assert.equal(seed.status, 200);
for (const branch of [
  "public",
  `private/${guest.localId}`,
  `mafiaPrivate/${guest.localId}`,
  `splendorPrivate/${guest.localId}`,
  `decorumPrivate/${guest.localId}`,
  `timebombPrivate/${guest.localId}`,
  "presence",
  "secret",
]) {
  const r = await fetch(
    `${db}/${path}/${branch}.json?ns=demo-boardgame-default-rtdb&auth=${guest.idToken}`,
  );
  assert.equal(r.status, 401, branch);
}
const write = await fetch(
  `${db}/${path}/presence/${guest.localId}/lastSeen.json?ns=demo-boardgame-default-rtdb&auth=${guest.idToken}`,
  {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Date.now()),
  },
);
assert.equal(write.status, 401);
const allowed = await fetch(
  `${db}/${path}/public.json?ns=demo-boardgame-default-rtdb&auth=${member.idToken}`,
);
assert.equal(allowed.status, 200);
await call(member, "roomAction", { code, action: { type: "leave" } });
console.log(
  "PASS registered Auth: guest and unauthenticated clients denied on all five callables, own member reads and presence writes; registered user allowed.",
);
