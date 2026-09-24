import type { Session } from "../shared/model";
import { ensure } from "../shared/rules";
import type { Shuffle } from "../timebomb-engine";
import {
  cellKey,
  GOAL_KEYS,
  MINE_CARDS,
  MINE_CARD_BY_ID,
  ROLE_DECK,
  normalizeMine,
  normalizeMinePrivate,
  mineActor,
  EFFECT_NAMES,
} from "../shared/saboteur";
import type {
  MineGame,
  MineAction,
  MineActivity,
  MinePrivate,
  MineSecret,
  Effect,
  Tool,
} from "../shared/saboteur";
import { legalActionTargets } from "../shared/mineActions";
import {
  EDGES,
  STEP,
  opposite,
  tileChannels,
  reachableGoal,
  reachableChannels,
  validatePathPlacement,
} from "../shared/mineTopology";
import {
  calculateRoundGoldAwards,
  determineMineWinners,
  theftOrder,
} from "./scoring";

function parts(s: Session) {
  const g = s.public.saboteur;
  ensure(g && s.secret.saboteur && s.saboteurPrivate, "礦坑尚未開始");
  normalizeMine(g);
  const secret = s.secret.saboteur;
  secret.deck ??= [];
  secret.removed ??= [];
  secret.discard ??= [];
  secret.roles ??= [];
  for (const p of Object.values(s.saboteurPrivate)) normalizeMinePrivate(p);
  return { g, secret, privatePlayers: s.saboteurPrivate };
}
function sync(s: Session) {
  const { g, secret, privatePlayers } = parts(s);
  g.drawCount = secret.deck.length;
  g.discardCount = secret.discard.length;
  for (const id of g.order) {
    g.players[id].handCount = privatePlayers[id].hand.length;
    g.players[id].hasGold = privatePlayers[id].gold > 0;
    privatePlayers[id].revision = g.revision;
  }
}
export function setupMineRound(s: Session, shuffle: Shuffle) {
  const g = s.public.saboteur!,
    old = s.saboteurPrivate ?? {};
  const deck = shuffle(MINE_CARDS.map((c) => c.id)),
    roles = shuffle(ROLE_DECK);
  const goals = shuffle(["GOLD", "ROCK", "ROCK"] as const);
  const secret: MineSecret = {
    deck,
    removed: deck.splice(0, 10),
    discard: [],
    roles,
    goals: Object.fromEntries(GOAL_KEYS.map((k, i) => [k, goals[i]])),
  };
  s.secret ??= { teamVotes: {}, missionVotes: {} };
  s.secret.saboteur = secret;
  g.board = {
    "0_0": { x: 0, y: 0, type: "start", cardId: "start", rotation: 0 },
  };
  GOAL_KEYS.forEach((k, i) => {
    const [x, y] = k.split("_").map(Number);
    g.board[k] = { x, y, type: "goal", cardId: `goal-${i}`, rotation: 0 };
  });
  s.saboteurPrivate = {};
  for (const id of g.order) {
    g.players[id] = {
      uid: id,
      nickname: s.public.players[id].nickname,
      effects: {},
      handCount: 6,
      hasGold: (old[id]?.gold ?? 0) > 0,
    };
    s.saboteurPrivate[id] = {
      gameId: g.id,
      revision: g.revision,
      round: g.round,
      role: roles.shift()!,
      hand: deck.splice(0, 6),
      gold: old[id]?.gold ?? 0,
      goals: {},
      inspections: [],
      roleVersion: g.revision,
    };
  }
  g.phase = "PLAYER_ACTION";
  g.theftQueue = [];
  delete g.connector;
  delete g.result;
  delete g.finalPlayer;
  sync(s);
}
export function startMine(s: Session, id: string, shuffle: Shuffle) {
  const room = s.public,
    players = Object.values(room.players).sort(
      (a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid),
    );
  ensure(
    room.gameId === "saboteur-2" && room.status === "waiting",
    "無法開始這款遊戲",
  );
  ensure(
    players.length >= 2 &&
      players.length <= 12 &&
      players.every((p) => p.ready),
    "需要 2–12 位玩家全部準備",
  );
  room.saboteur = {
    id,
    revision: 0,
    round: 1,
    phase: "PLAYER_ACTION",
    order: players.map((p) => p.uid),
    current: shuffle(players.map((_, i) => i))[0],
    board: {},
    players: {},
    drawCount: 0,
    discardCount: 0,
    turn: 0,
    theftQueue: [],
    activities: [],
  };
  s.saboteurPrivate = {};
  room.status = "playing";
  setupMineRound(s, shuffle);
}
function draw(s: Session, uid: string, count: number) {
  const { secret, privatePlayers } = parts(s);
  privatePlayers[uid].hand.push(...secret.deck.splice(0, count));
}
function removeHand(p: MinePrivate, ids: string[]) {
  ensure(
    Array.isArray(ids) &&
      ids.every((id) => typeof id === "string") &&
      new Set(ids).size === ids.length &&
      ids.every((id) => p.hand.includes(id)),
    "手牌中沒有這些卡牌，或重複選牌",
  );
  p.hand = p.hand.filter((id) => !ids.includes(id));
}
function removeEffect(
  g: MineGame,
  secret: MineSecret,
  uid: string,
  effect: Effect,
) {
  ensure(
    ["PICKAXE", "LANTERN", "CART", "TRAPPED", "THEFT"].includes(effect),
    "無效狀態",
  );
  ensure(g.players[uid]?.effects[effect], "沒有可以移除的狀態");
  secret.discard.push(g.players[uid].effects[effect]!.cardId);
  delete g.players[uid].effects[effect];
}
function settleTheft(s: Session) {
  const { g, privatePlayers } = parts(s);
  while (
    g.theftQueue.length &&
    !g.order.some((id) => id !== g.theftQueue[0] && privatePlayers[id].gold > 0)
  )
    g.theftQueue.shift();
  if (g.theftQueue.length) {
    g.phase = "THEFT_RESOLUTION";
    return;
  }
  if (g.round === 3) {
    g.phase = "GAME_OVER";
    s.public.status = "finished";
    g.totals = Object.fromEntries(
      g.order.map((id) => [id, privatePlayers[id].gold]),
    );
    g.winners = determineMineWinners(g.totals);
  } else g.phase = "ROUND_RESULT";
}
function endRound(s: Session) {
  const { g, privatePlayers } = parts(s);
  g.result = calculateRoundGoldAwards(g, privatePlayers);
  for (const id of g.order) privatePlayers[id].gold += g.result.awards[id];
  g.theftQueue = theftOrder(g);
  settleTheft(s);
}
function advanceTurn(s: Session, uid: string) {
  const { g, privatePlayers } = parts(s);
  g.finalPlayer = uid;
  if (g.connector || g.order.every((id) => !privatePlayers[id].hand.length)) {
    endRound(s);
    return;
  }
  do {
    g.current = (g.current + 1) % g.order.length;
  } while (!privatePlayers[g.order[g.current]].hand.length);
  g.phase = "PLAYER_ACTION";
  g.turn++;
}
function revealGoals(s: Session, uid: string) {
  const { g, secret } = parts(s),
    revealed: string[] = [];
  let changed = true;
  while (changed && !g.connector) {
    changed = false;
    for (const key of GOAL_KEYS) {
      const t = g.board[key];
      if (t.revealed || !reachableGoal(g.board, key)) continue;
      const reached = reachableChannels(g.board);
      t.revealed = secret.goals[key];
      // Preserve the entering connection first, then maximize matching neighbors.
      const score = (rotation: 0 | 180) => {
        const ports = tileChannels({ ...t, rotation }).flat();
        return EDGES.reduce((n, e) => {
          const [dx, dy] = STEP[e],
            nk = cellKey(t.x + dx, t.y + dy),
            neighbor = g.board[nk];
          if (!neighbor) return n;
          const incoming = tileChannels(neighbor).some(
            (ch, i) => ch.includes(opposite(e)) && reached.has(`${nk}:${i}`),
          );
          return (
            n +
            (incoming && ports.includes(e) ? 100 : 0) +
            (ports.includes(e) ===
            tileChannels(neighbor).flat().includes(opposite(e))
              ? 1
              : 0)
          );
        }, 0);
      };
      t.rotation = score(180) > score(0) ? 180 : 0;
      revealed.push(key);
      changed = true;
      if (t.revealed === "GOLD") {
        g.connector = uid;
        break;
      }
    }
  }
  return revealed;
}
/** Clone before validation: a rejected action can never partially mutate a session. */
export function applyMineAction(
  original: Session,
  uid: string,
  a: MineAction,
  shuffle: Shuffle,
): Session {
  const s = structuredClone(original),
    { g, secret, privatePlayers } = parts(s);
  ensure(
    s.public.gameId === "saboteur-2" &&
      s.public.status === "playing" &&
      g.players[uid],
    "你不在進行中的礦坑",
  );
  ensure(a && typeof a.type === "string", "缺少操作");
  const p = privatePlayers[uid];
  const event: MineActivity = {
    revision: g.revision + 1,
    uid,
    kind: a.type,
    text: "",
  };
  if (a.type === "mineNext") {
    ensure(
      g.phase === "ROUND_RESULT" && s.public.hostId === uid,
      "只有房主可以開始下一輪",
    );
    g.current = (g.order.indexOf(g.finalPlayer!) + 1) % g.order.length;
    g.round++;
    g.revision++;
    setupMineRound(s, shuffle);
    event.text = `開始第 ${g.round} 輪，重新分配身份與手牌`;
  } else {
    ensure(mineActor(g) === uid, "目前不是你的回合");
    if (a.type === "mineSteal") {
      ensure(
        g.phase === "THEFT_RESOLUTION" &&
          a.target !== uid &&
          privatePlayers[a.target]?.gold > 0,
        "請選擇另一位持有金塊的玩家",
      );
      privatePlayers[a.target].gold--;
      p.gold++;
      g.theftQueue.shift();
      event.target = a.target;
      event.kind = "THEFT";
      event.text = `從 ${g.players[a.target].nickname} 偷走 1 金塊`;
      settleTheft(s);
    } else if (a.type === "mineAcknowledge") {
      ensure(
        g.phase === "PRIVATE_RESULT" && secret.pendingCard && p.notice,
        "沒有等待確認的私人情報",
      );
      secret.discard.push(secret.pendingCard);
      delete secret.pendingCard;
      delete p.notice;
      draw(s, uid, 1);
      event.text = "已記住私人情報";
      advanceTurn(s, uid);
    } else {
      ensure(g.phase === "PLAYER_ACTION", "請先完成目前階段");
      if (a.type === "minePass" || a.type === "mineClean") {
        ensure(
          Array.isArray(a.cards) &&
            (a.type === "mineClean"
              ? a.cards.length === 2
              : a.cards.length >= 1 && a.cards.length <= 3),
          "跳過需棄 1–3 張；解除狀態需棄 2 張",
        );
        removeHand(p, a.cards);
        secret.discard.push(...a.cards);
        if (a.type === "mineClean") {
          removeEffect(g, secret, uid, a.effect);
          event.text = `棄兩張牌解除${EFFECT_NAMES[a.effect]}`;
        } else event.text = `跳過並交換 ${a.cards.length} 張手牌`;
        draw(s, uid, a.type === "mineClean" ? 1 : a.cards.length);
        advanceTurn(s, uid);
      } else if (a.type === "minePath" || a.type === "mineAction") {
        ensure(
          typeof a.cardId === "string" && p.hand.includes(a.cardId),
          "你的手牌中沒有這張牌",
        );
        const card = MINE_CARD_BY_ID[a.cardId];
        if (a.type === "minePath") {
          ensure(card?.kind === "path", "請選道路牌");
          const error = validatePathPlacement(
            g.board,
            card,
            a.x,
            a.y,
            a.rotation,
            g.players[uid],
          );
          ensure(!error, error ?? "無法蓋路");
          removeHand(p, [card.id]);
          const key = cellKey(a.x, a.y);
          g.board[key] = {
            x: a.x,
            y: a.y,
            cardId: card.id,
            rotation: a.rotation,
            type: "path",
          };
          event.cardId = card.id;
          event.cell = key;
          event.rotation = a.rotation;
          event.text = `放置${card.name}`;
          event.goals = revealGoals(s, uid);
          if (g.connector) event.text += "，找到黃金！";
          else if (event.goals.length) event.text += "，發現岩石目標";
          if (!g.connector) draw(s, uid, 1);
          advanceTurn(s, uid);
        } else {
          ensure(card?.kind === "action", "請選行動牌");
          const target =
            card.action === "THEFT"
              ? uid
              : card.action === "MAP" || card.action === "ROCKFALL"
                ? a.cell
                : a.target;
          ensure(
            typeof target === "string" &&
              legalActionTargets(g, uid, card).includes(target),
            "無效目標，或玩家已有相同效果",
          );
          removeHand(p, [card.id]);
          event.kind = card.action;
          event.cardId = card.id;
          if (g.players[target]) event.target = target;
          else event.cell = target;
          event.text = `${card.name}${g.players[target] ? ` → ${g.players[target].nickname}` : ""}`;
          let persistent: Effect | undefined;
          switch (card.action) {
            case "BREAK":
              persistent = card.tools![0];
              event.text += `（${EFFECT_NAMES[persistent]}）`;
              break;
            case "TRAPPED":
              persistent = "TRAPPED";
              break;
            case "THEFT":
              persistent = "THEFT";
              break;
            case "REPAIR":
              ensure(
                a.tool && card.tools!.includes(a.tool),
                "請選擇其中一種可修復工具",
              );
              removeEffect(g, secret, target, a.tool as Tool);
              break;
            case "FREEDOM":
              removeEffect(g, secret, target, "TRAPPED");
              break;
            case "HANDS_OFF":
              removeEffect(g, secret, target, "THEFT");
              break;
            case "ROCKFALL":
              secret.discard.push(g.board[target].cardId);
              delete g.board[target];
              break;
            case "SWAP_HANDS": {
              const hand = p.hand;
              p.hand = privatePlayers[target].hand;
              privatePlayers[target].hand = hand;
              draw(s, target, 1);
              break;
            }
            case "CHANGE_HATS": {
              ensure(secret.roles.length > 0, "身份牌堆不足");
              secret.roles.push(privatePlayers[target].role);
              privatePlayers[target].role = secret.roles.shift()!;
              privatePlayers[target].roleVersion = g.revision + 1;
              break;
            }
            case "MAP":
              p.goals[target] = secret.goals[target];
              p.notice = {
                title: "藏寶圖情報",
                text: `${GOAL_KEYS.indexOf(target) + 1} 號目標是${secret.goals[target] === "GOLD" ? "黃金" : "岩石"}`,
              };
              break;
            case "INSPECTION":
              p.inspections.push({
                uid: target,
                role: privatePlayers[target].role,
                revision: g.revision + 1,
              });
              p.notice = { title: "偵查情報", text: target };
              break;
          }
          if (persistent)
            g.players[target].effects[persistent] = {
              cardId: card.id,
              sequence: g.turn,
            };
          else if (card.action === "MAP" || card.action === "INSPECTION") {
            secret.pendingCard = card.id;
            g.phase = "PRIVATE_RESULT";
          } else secret.discard.push(card.id);
          if (g.phase !== "PRIVATE_RESULT") {
            if (card.action !== "SWAP_HANDS") draw(s, uid, 1);
            advanceTurn(s, uid);
          }
        }
      } else throw new Error("未知礦坑操作");
    }
    g.revision++;
  }
  g.activities = [...g.activities, event].slice(-40);
  sync(s);
  return s;
}
