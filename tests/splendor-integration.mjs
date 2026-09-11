import assert from "node:assert/strict";
const project = "demo-boardgame";
const base = `http://127.0.0.1:5001/${project}/asia-east1`;
const database = `http://127.0.0.1:9000`;
const authUrl =
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key";
async function player() {
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function call(p, name, data, denied = false) {
  const response = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(p ? { Authorization: `Bearer ${p.idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  if (denied) {
    assert.ok(body.error, `${name} must reject`);
    return;
  }
  assert.ok(!body.error, JSON.stringify(body));
  return body.result;
}
async function read(p, path, denied = false) {
  const response = await fetch(
    `${database}/${path}.json?ns=${project}-default-rtdb${p ? `&auth=${p.idToken}` : ""}`,
  );
  assert.equal(response.status, denied ? 401 : 200, path);
  if (!denied) return response.json();
}
async function write(p, path, value, method = "PUT") {
  const response = await fetch(
    `${database}/${path}.json?ns=${project}-default-rtdb&auth=${p.idToken}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    },
  );
  assert.equal(response.status, 401, `Forbidden write: ${path}`);
}

import splendor from "../functions/lib/shared/splendor.js";
const {
  normalizeSplendor,
  calculatePurchasePayment,
  CARD_BY_ID,
  GEM_COLORS,
  TOKEN_COLORS,
  emptyTokens,
  mustReturnTokens,
  getEligibleNobles,
  applyTradingPostModifiers,
} = splendor;
const token = (g) => `${g.id}:${g.revision}`;
const people = await Promise.all(Array.from({ length: 5 }, player));
for (const count of [2,3,4]) {
  const host=people[0];
  const {code}=await call(host,'createRoom',{gameId:'splendor',nickname:'練習商人',mode:'practice',playerCount:count});
  const path=`sessions/${code}`;
  let room=await read(host,`${path}/public`);
  assert.equal(Object.values(room.players).filter(p=>p.isBot&&p.ready).length,count-1);
  await call(people[1],'joinRoom',{code,nickname:'不可加入'},true);
  await call(host,'roomAction',{code,action:{type:'splendorConfig',config:{module:'base',competitorMode:false}}});
  room=await read(host,`${path}/public`);
  assert.ok(Object.values(room.players).filter(p=>p.isBot).every(p=>p.ready));
  await call(host,'roomAction',{code,action:{type:'ready',ready:true}});
  await call(host,'roomAction',{code,action:{type:'start'}});
  let g=(await read(host,`${path}/public`)).splendor;
  await call(host,'advanceBots',{code,token:token(g)});
  assert.equal((await read(host,`${path}/public`)).splendor.revision,0);
  await call(host,'gameAction',{code,phaseToken:token(g),action:{type:'splendorTake',colors:['white','blue','green']}});
  g=(await read(host,`${path}/public`)).splendor;
  await read(host,`${path}/splendorPrivate/bot_1`,true);
  await call(host,'gameAction',{code,uid:'bot_1',phaseToken:token(g),action:{type:'splendorDouble',color:'red'}},true);
  const results=await Promise.all(Array.from({length:2},()=>call(host,'advanceBots',{code,token:token(g)})));
  assert.equal(results.filter(r=>r.moved).length,1);
  assert.equal((await read(host,`${path}/public`)).splendor.revision,g.revision+1);
  await call(people[1],'advanceBots',{code,token:token(g)},true);
  await call(host,'roomAction',{code,action:{type:'leave'}});
  console.log(`Splendor practice ${count-1} AI: ready, isolation, private protection, human-only actor, concurrent one-step PASS`);
}
for (const [count, module] of [
  [2, "base"],
  [3, "cities"],
  [4, "tradingPosts"],
  [2, "orient"],
  [2, "strongholds"],
]) {
  const players = people.slice(0, count);
  const { code } = await call(players[0], "createRoom", {
    gameId: "splendor",
    nickname: "商人 1",
  });
  const path = `sessions/${code}`;
  for (const [i, p] of players.slice(1).entries())
    await call(p, "joinRoom", { code, nickname: `商人 ${i + 2}` });
  if (count < 4) {
    await call(players[0], "roomAction", { code, action: { type: "addBot" } });
    const added = Object.values((await read(players[0], `${path}/public`)).players).find(p => p.isBot);
    assert.ok(added.ready && added.nickname.endsWith('AI'));
    await call(players[0], "roomAction", { code, action: { type: "removeBot", botId: added.uid } });
  } else await call(players[0], "roomAction", { code, action: { type: "addBot" } }, true);
  await call(
    players[1],
    "roomAction",
    {
      code,
      action: {
        type: "splendorConfig",
        config: { module, competitorMode: false },
      },
    },
    true,
  );
  await call(
    players[0],
    "roomAction",
    {
      code,
      action: {
        type: "splendorConfig",
        config: { module, competitorMode: false, orient: true },
      },
    },
    true,
  );
  await call(players[0], "roomAction", {
    code,
    action: {
      type: "splendorConfig",
      config: { module, competitorMode: false },
    },
  });
  await Promise.all(
    players.map((p) =>
      call(p, "roomAction", { code, action: { type: "ready", ready: true } }),
    ),
  );
  await call(players[0], "roomAction", { code, action: { type: "start" } });
  const state = async () =>
    normalizeSplendor((await read(players[0], `${path}/public`)).splendor);
  let g = await state();
  const act = (p, action, state = g, denied = false) =>
    call(p, "gameAction", { code, phaseToken: token(state), action }, denied);
  await read(null, `${path}/public`, true);
  await read(people[4], `${path}/public`, true);
  await read(players[0], path, true);
  await read(players[0], `${path}/secret`, true);
  await read(players[0], `${path}/splendorPrivate`, true);
  await read(players[0], `${path}/splendorPrivate/${players[1].localId}`, true);
  await write(
    players[0],
    `${path}/public/splendor/players/${players[0].localId}/prestige`,
    99,
  );
  await write(players[0], `${path}/public/splendor/bank/gold`, 99);
  await write(
    players[0],
    `${path}/splendorPrivate/${players[0].localId}/reserved`,
    { forged: "b1-0-0" },
  );
  await act(players[1], { type: "splendorTake", colors: ["blue"] }, g, true);
  await act(players[0], { type: "splendorTake", colors: ["gold"] }, g, true);
  await act(
    players[0],
    { type: "splendorTake", colors: ["red", "red"] },
    g,
    true,
  );
  const initial = g;
  // Concurrent submissions must apply only once, even through transaction retries.
  const results = await Promise.all(
    Array.from({ length: 2 }, async () => {
      const response = await fetch(`${base}/gameAction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${players[0].idToken}`,
        },
        body: JSON.stringify({
          data: {
            code,
            phaseToken: token(initial),
            action: { type: "splendorBlind", tier: 1, source: "base" },
          },
        }),
      });
      return response.json();
    }),
  );
  assert.equal(results.filter((r) => !r.error).length, 1);
  g = await state();
  const own = await read(
    players[0],
    `${path}/splendorPrivate/${players[0].localId}`,
  );
  const hiddenId = Object.values(own.reserved)[0];
  assert.ok(hiddenId);
  assert.ok(!JSON.stringify(g).includes(hiddenId));
  assert.equal(g.players[players[0].localId].reservedCards.length, 1);
  await act(
    players[0],
    { type: "splendorTake", colors: ["blue"] },
    initial,
    true,
  );
  await call(
    players[0],
    "roomAction",
    { code, action: { type: "recover" } },
    true,
  );
  await call(players[0], "joinRoom", { code, nickname: "重新連線" });
  assert.equal(
    (await read(players[0], `${path}/splendorPrivate/${players[0].localId}`))
      .gameId,
    g.id,
  );
  let steps = 0;
  while (g.phase !== "GAME_OVER" && steps++ < 1200) {
    const uid = g.playerOrder[g.currentPlayerIndex],
      p = g.players[uid],
      actor = players.find((p) => p.localId === uid);
    let action;
    if (g.phase === "RETURN_EXCESS_TOKENS") {
      const tokens = emptyTokens();
      let excess = mustReturnTokens(p);
      for (const c of [...TOKEN_COLORS].sort(
        (a, b) => p.tokens[b] - p.tokens[a],
      )) {
        tokens[c] = Math.min(excess, p.tokens[c]);
        excess -= tokens[c];
      }
      action = { type: "splendorReturn", tokens };
    } else if (g.phase === "CHOOSE_NOBLE")
      action = {
        type: "splendorNoble",
        nobleId: getEligibleNobles(p, g)[0].id,
      };
    else if (g.phase === "RESOLVE_EXPANSION")
      action = { type: "splendorStronghold" };
    else if (g.phase === "STRONGHOLD_BONUS_PURCHASE")
      action = { type: "splendorSkip" };
    else {
      const privateData = await read(actor, `${path}/splendorPrivate/${uid}`);
      const choices = Object.values(g.market)
        .flat()
        .filter(Boolean)
        .map((id) => ({ card: CARD_BY_ID[id], cardId: id }));
      for (const r of p.reservedCards)
        choices.push({
          card: CARD_BY_ID[privateData.reserved[r.slot]],
          slot: r.slot,
        });
      const cards = choices.filter(
        (c) => !c.card.orientEffect || c.card.orientEffect.type === "double",
      );
      const affordable = cards
        .filter((c) => calculatePurchasePayment(c.card, p).affordable)
        .sort(
          (a, b) =>
            b.card.prestige * 2 +
            (6 - p.bonuses[b.card.bonusColor]) -
            (a.card.prestige * 2 + (6 - p.bonuses[a.card.bonusColor])),
        );
      if (affordable.length) {
        const c = affordable[0];
        action = {
          type: "splendorBuy",
          ...(c.slot ? { slot: c.slot } : { cardId: c.cardId }),
        };
      } else {
        const rank = (c) => {
          const pay = calculatePurchasePayment(c.card, p);
          return (
            GEM_COLORS.reduce(
              (n, k) =>
                n + Math.max(0, pay.requiredAfterBonuses[k] - p.tokens[k]),
              0,
            ) -
            c.card.prestige * 0.4
          );
        };
        const target = cards.sort((a, b) => rank(a) - rank(b))[0],
          pay = calculatePurchasePayment(target.card, p);
        const colors = [...GEM_COLORS]
          .filter((c) => g.bank[c] > 0)
          .sort(
            (a, b) =>
              pay.requiredAfterBonuses[b] -
              p.tokens[b] -
              (pay.requiredAfterBonuses[a] - p.tokens[a]),
          );
        assert.ok(colors.length, "no available move");
        action = {
          type: "splendorTake",
          colors: colors.slice(0, applyTradingPostModifiers(p).maxDifferent),
        };
      }
    }
    await act(actor, action);
    g = await state();
    for (const c of TOKEN_COLORS)
      assert.equal(
        g.bank[c] +
          Object.values(g.players).reduce((n, p) => n + p.tokens[c], 0),
        c === "gold" ? 5 : count === 2 ? 4 : count === 3 ? 5 : 7,
      );
  }
  assert.equal(g.phase, "GAME_OVER", `${module} must finish`);
  assert.ok(g.winners?.length);
  const finished = await read(players[0], `${path}/public`);
  assert.equal(finished.status, "finished");
  await call(players[0], "roomAction", { code, action: { type: "rematch" } });
  assert.equal((await read(players[0], `${path}/public`)).status, "waiting");
  assert.equal(
    await read(players[0], `${path}/splendorPrivate/${players[0].localId}`),
    null,
  );
  console.log(
    `Splendor ${count} players / ${module}: permissions, race, reconnect, full game (${steps} actions), rematch PASS`,
  );
}
