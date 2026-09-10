import type { Session } from "../shared/model";
import { ensure } from "../shared/rules";
import { DECOR_COLORS, DECOR_OBJECTS, OBJECT_TYPES, REACTION_LABELS, normalizeDecorum } from "../shared/decorum";
import type { DecorumAction, DecorumPublicState, HouseAction, HouseState } from "../shared/decorum";
import { evaluatePlayerConditions } from "../shared/decorum-conditions";
import { decorumScenarios } from "./scenarios";

export function finishDecorum(s: Session, reason: "all-fulfilled" | "round-limit" | "player-left") {
  const g = normalizeDecorum(s.public.decorum!);
  g.phase = "GAME_OVER";
  g.winner = reason === "all-fulfilled" ? "players" : "none";
  g.endReason = reason;
  g.revealedConditions = Object.fromEntries(g.playerOrder.map((uid) => [uid, s.decorumPrivate![uid].conditions]));
  const results = g.playerOrder.flatMap((uid) => evaluatePlayerConditions(s.decorumPrivate![uid].conditions, g.house, { ownerId: uid }).results);
  g.fulfilledConditionCount = results.filter((r) => r.fulfilled).length;
  g.totalConditionCount = results.length;
  g.score = 3 * g.fulfilledConditionCount + (g.winner === "players" ? 2 * g.heartsRemaining : 0);
  s.public.status = "finished";
}
export function recalculateDecorum(s: Session) {
  const g = s.public.decorum!;
  for (const uid of g.playerOrder) g.playerFulfilled[uid] = evaluatePlayerConditions(s.decorumPrivate![uid].conditions, g.house, { ownerId: uid }).fulfilled;
  if (g.playerOrder.every((uid) => g.playerFulfilled[uid])) finishDecorum(s, "all-fulfilled");
}
export function startDecorum(s: Session, id: string, shuffle: <T>(items: T[]) => T[]) {
  const room = s.public;
  ensure(room.gameId === "decorum" && room.status === "waiting", "無法開始同房異夢");
  const players = Object.values(room.players);
  ensure(players.length >= 2 && players.length <= 4 && players.every((p) => p.ready && !p.isBot), "需要 2–4 位已準備的真人玩家");
  const scenario = decorumScenarios.find((v) => v.id === room.decorumScenarioId) ?? (!room.decorumScenarioId ? decorumScenarios.find((v) => v.playerCount === players.length) : undefined);
  ensure(scenario && scenario.playerCount === players.length, "請選擇符合目前人數的劇本");
  const order = players.sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid)).map((p) => p.uid);
  // Assignment order is private. A public scenario ID/order cannot reveal ownership.
  const assignments = shuffle(Object.values(scenario.playerConditions));
  s.decorumPrivate = Object.fromEntries(order.map((uid, i) => [uid, { gameId: id, conditions: structuredClone(assignments[i]), sharedConditionsReceived: [], sharedConditionIds: [] }]));
  s.private = {}; s.timebombPrivate = {};
  s.secret = { teamVotes: {}, missionVotes: {}, decorumShares: {} };
  delete room.game; delete room.timebomb;
  room.status = "playing";
  room.decorum = {
    id, revision: 0, phase: "SETUP", scenarioId: scenario.id, playerOrder: order, currentPlayerIndex: 0,
    round: 1, turn: 0, maxRounds: scenario.maxRounds, heartsRemaining: order.length === 2 ? 3 : 5,
    house: structuredClone(scenario.initialHouse), enableRoommateTokens: !!scenario.enableRoommateTokens,
    playerFulfilled: {}, confirmed: {}, reactions: {}, lastReactions: {}, meetingSubmitted: {}, meetingStatuses: {},
  };
  if (scenario.enableRoommateTokens) {
    const bedrooms = scenario.rooms.filter((r) => r.type === "bedroom" || r.type === "bedroom2");
    order.forEach((uid, i) => { room.decorum!.house.roommates[uid] = bedrooms[Math.floor(i / 2)].id; });
  }
  for (const uid of order) room.decorum.playerFulfilled[uid] = evaluatePlayerConditions(s.decorumPrivate[uid].conditions, room.decorum.house, { ownerId: uid }).fulfilled;
}

/** Returns a new house only after validating a complete move. */
export function applyHouseAction(house: HouseState, action: HouseAction, uid: string, fulfilled: boolean, roommateEnabled: boolean): HouseState {
  const next = structuredClone(house);
  if (action.type === "decorPass") { ensure(fulfilled, "只有目前滿意的玩家可以略過"); return next; }
  const room = next.rooms.find((r) => r.id === action.roomId);
  ensure(room, "找不到這個房間");
  room.objects ??= { lamp: null, curio: null, wallHanging: null };
  switch (action.type) {
    case "decorAdd": case "decorSwap": {
      const object = DECOR_OBJECTS.find((o) => o.id === action.objectId);
      ensure(object, "此物品不在物品目錄中");
      const current = room.objects[object.type];
      ensure(action.type === "decorAdd" ? !current : !!current, action.type === "decorAdd" ? "這種類型的位置已有物品" : "只能替換已存在的同類型物品");
      ensure(current?.id !== object.id, "請選擇不同的物品");
      room.objects[object.type] = { ...object };
      break;
    }
    case "decorRemove":
      ensure(OBJECT_TYPES.includes(action.objectType) && room.objects[action.objectType], "這個位置沒有可移除的物品");
      room.objects[action.objectType] = null;
      break;
    case "decorPaint":
      ensure(DECOR_COLORS.includes(action.color), "無效的牆面顏色");
      ensure(room.wallColor !== action.color, "牆面已是這個顏色");
      room.wallColor = action.color;
      break;
    case "decorRoommate": {
      ensure(roommateEnabled && (room.type === "bedroom" || room.type === "bedroom2"), "只能搬到此劇本的臥室");
      const source = next.roommates[uid];
      ensure(source && source !== room.id, "請選擇另一間臥室");
      const occupants = Object.keys(next.roommates).filter((id) => next.roommates[id] === room.id);
      if (occupants.length >= (room.capacity ?? 1)) {
        ensure(typeof action.swapWith === "string" && occupants.includes(action.swapWith), "臥室已滿，請選擇交換位置的室友");
        next.roommates[action.swapWith] = source;
      } else ensure(!action.swapWith, "房間尚有空位，不需要交換室友");
      next.roommates[uid] = room.id;
      break;
    }
    default: throw new Error("未知的佈置操作");
  }
  return next;
}
function advanceTurn(s: Session) {
  const g = s.public.decorum!;
  g.lastReactions = { ...g.reactions };
  g.reactions = {};
  if (g.currentPlayerIndex < g.playerOrder.length - 1) {
    g.currentPlayerIndex++; g.phase = "PLAYER_ACTION"; return;
  }
  g.phase = "ROUND_END";
  if (g.round >= g.maxRounds) { finishDecorum(s, "round-limit"); return; }
  const meeting = g.playerOrder.length === 2 ? [15, 20, 25].includes(g.round) : g.round % 5 === 0;
  if (meeting && g.heartsRemaining > 0) {
    g.phase = g.playerOrder.length === 2 ? "HEART_TO_HEART" : "HOUSE_MEETING";
    g.meetingSubmitted = {}; g.meetingStatuses = {}; return;
  }
  g.round++; g.currentPlayerIndex = 0; g.phase = "PLAYER_ACTION";
}
function share(s: Session, uid: string, action: Extract<DecorumAction, { type: "decorShare" }>) {
  const g = s.public.decorum!;
  ensure(g.phase === "HEART_TO_HEART" || g.phase === "HOUSE_MEETING", "目前不是分享時間");
  ensure(!g.meetingSubmitted[uid], "你已完成本次分享");
  ensure(action.recipientId !== uid && g.playerOrder.includes(action.recipientId), "請選擇另一位室友");
  ensure(Object.hasOwn(REACTION_LABELS, action.status), "請選擇有效的整體感受");
  const own = s.decorumPrivate![uid];
  const condition = own.conditions.find((c) => c.id === action.conditionId);
  ensure(condition, "只能分享自己的條件");
  const shares = s.secret.decorumShares ??= {};
  if (g.phase === "HEART_TO_HEART") {
    ensure(!own.sharedConditionIds.includes(condition.id) || own.sharedConditionIds.length === own.conditions.length, "請分享一項尚未公開的條件");
    (shares[uid] ??= {})[condition.id] = action.recipientId;
  } else {
    // A house meeting replaces this owner's previous disclosure, including its recipient.
    shares[uid] = { [condition.id]: action.recipientId };
  }
  own.sharedConditionIds = Object.keys(shares[uid]);
  for (const id of g.playerOrder) s.decorumPrivate![id].sharedConditionsReceived = [];
  for (const [ownerId, disclosures] of Object.entries(shares)) for (const [conditionId, recipientId] of Object.entries(disclosures)) {
    const selected = s.decorumPrivate![ownerId].conditions.find((c) => c.id === conditionId)!;
    s.decorumPrivate![recipientId].sharedConditionsReceived.push({ ownerId, condition: structuredClone(selected) });
  }
  g.meetingSubmitted[uid] = true; g.meetingStatuses[uid] = action.status;
  if (g.playerOrder.every((id) => g.meetingSubmitted[id])) {
    g.heartsRemaining--; g.round++; g.currentPlayerIndex = 0; g.phase = "PLAYER_ACTION";
  }
}
export function applyDecorumAction(s: Session, uid: string, action: DecorumAction): Session {
  ensure(s.public.gameId === "decorum" && s.public.status === "playing" && s.public.decorum, "同房異夢尚未開始或已結束");
  const g: DecorumPublicState = normalizeDecorum(s.public.decorum);
  s.secret ??= { teamVotes: {}, missionVotes: {} };
  ensure(g.playerOrder.includes(uid) && s.public.players[uid] && !s.public.players[uid].isBot, "你不在房間內");
  for (const id of g.playerOrder) {
    const own = s.decorumPrivate![id];
    own.sharedConditionIds ??= []; own.sharedConditionsReceived ??= [];
  }
  switch (action.type) {
    case "decorReady":
      ensure(g.phase === "SETUP" && !g.confirmed[uid], "你已確認或遊戲已開始");
      g.confirmed[uid] = true;
      if (g.playerOrder.every((id) => g.confirmed[id])) { g.phase = "PLAYER_ACTION"; recalculateDecorum(s); }
      break;
    case "decorReact":
      ensure(g.phase === "REACTION" && g.playerOrder[g.currentPlayerIndex] !== uid, "等待其他室友回應");
      ensure(!g.reactions[uid] && Object.hasOwn(REACTION_LABELS, action.reaction), "無效或重複的回應");
      g.reactions[uid] = action.reaction;
      if (g.playerOrder.every((id, i) => i === g.currentPlayerIndex || !!g.reactions[id])) advanceTurn(s);
      break;
    case "decorShare": share(s, uid, action); break;
    default: {
      ensure(g.phase === "PLAYER_ACTION" && g.playerOrder[g.currentPlayerIndex] === uid, "現在不是你的佈置回合");
      const fulfilled = evaluatePlayerConditions(s.decorumPrivate![uid].conditions, g.house, { ownerId: uid }).fulfilled;
      g.house = applyHouseAction(g.house, action, uid, fulfilled, g.enableRoommateTokens);
      // Only retain canonical fields; extra client data cannot become a chat channel.
      const clean: HouseAction = action.type === "decorPass" ? { type: action.type }
        : action.type === "decorPaint" ? { type: action.type, roomId: action.roomId, color: action.color }
        : action.type === "decorRemove" ? { type: action.type, roomId: action.roomId, objectType: action.objectType }
        : action.type === "decorRoommate" ? { type: action.type, roomId: action.roomId, ...(action.swapWith ? { swapWith: action.swapWith } : {}) }
        : { type: action.type, roomId: action.roomId, objectId: action.objectId };
      g.latestAction = { actorId: uid, action: clean }; g.turn++;
      g.phase = "FULFILLMENT_CHECK";
      recalculateDecorum(s);
      if (s.public.status === "playing") { g.phase = "REACTION"; g.reactions = {}; }
    }
  }
  g.revision++;
  return s;
}
