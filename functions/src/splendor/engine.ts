import type { Session } from "../shared/model";
import { ensure } from "../shared/rules";
import {
  GEM_COLORS,
  TOKEN_COLORS,
  DEMO_CARDS,
  DEMO_ORIENT_CARDS,
  DEMO_NOBLES,
  DEMO_CITIES,
  DEMO_TRADING_POSTS,
  CARD_BY_ID,
  EXPANSION_NAMES,
  emptyTokens,
  emptyGems,
  deckKey,
  normalizeSplendor,
  calculateBonuses,
  calculatePrestige,
  calculatePurchasePayment,
  canTakeDifferentGems,
  canTakeDoubleGem,
  canReserveCard,
  canInteractWithStrongholdCard,
  mustReturnTokens,
  getEligibleNobles,
  getEligibleCities,
  meets,
  shouldTriggerFinalRound,
  determineSplendorWinners,
} from "../shared/splendor";
import type {
  SplendorAction,
  SplendorConfig,
  SplendorPublicState,
  SplendorPlayerState,
  DevelopmentCard,
  DevelopmentTier,
  OrientChoice,
  TokenInventory,
} from "../shared/splendor";
import { recordSplendorActivity } from "./activity";

export function validateSplendorConfig(config: SplendorConfig) {
  ensure(
    config &&
      typeof config === "object" &&
      Object.hasOwn(EXPANSION_NAMES, config.module) &&
      typeof config.competitorMode === "boolean" &&
      Object.keys(config).every((k) =>
        ["module", "competitorMode"].includes(k),
      ),
    "請選擇基礎遊戲或一種擴充",
  );
}
export function createInitialTokenBank(count: number): TokenInventory {
  ensure([2, 3, 4].includes(count), "需要 2–4 位玩家");
  const bank = emptyTokens();
  for (const c of GEM_COLORS) bank[c] = count === 2 ? 4 : count === 3 ? 5 : 7;
  bank.gold = 5;
  return bank;
}
export function startSplendorGame(
  s: Session,
  id: string,
  shuffle: <T>(values: T[]) => T[],
) {
  const r = s.public,
    players = Object.values(r.players).sort(
      (a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid),
    );
  ensure(r.gameId === "splendor" && r.status === "waiting", "無法開始璀璨寶石");
  ensure(
    players.length >= 2 &&
      players.length <= 4 &&
      players.every((p) => p.ready),
    "需要 2–4 位已準備的玩家",
  );
  const config = r.splendorConfig ?? { module: "base", competitorMode: false };
  validateSplendorConfig(config);
  const g: SplendorPublicState = {
    id,
    revision: 0,
    phase: "PLAYER_ACTION",
    playerOrder: players.map((p) => p.uid),
    currentPlayerIndex: 0,
    round: 1,
    config,
    bank: createInitialTokenBank(players.length),
    players: {},
    market: {},
    deckCounts: {},
    nobles:
      config.module === "cities"
        ? []
        : shuffle(DEMO_NOBLES).slice(0, players.length + 1),
    cities: config.module === "cities" ? shuffle(DEMO_CITIES).slice(0, 3) : [],
    strongholds: {},
    bonusPurchaseUsed: false,
    nobleClaimed: false,
    log: [],
  };
  s.secret = { teamVotes: {}, missionVotes: {}, splendor: { decks: {} } };
  s.splendorPrivate = {};
  for (const tier of [1, 2, 3] as DevelopmentTier[]) {
    for (const source of config.module === "orient"
      ? (["base", "orient"] as const)
      : (["base"] as const)) {
      const key = deckKey(tier, source),
        cards = shuffle(
          (source === "base" ? DEMO_CARDS : DEMO_ORIENT_CARDS)
            .filter((c) => c.tier === tier)
            .map((c) => c.id),
        );
      g.market[key] = cards.splice(0, source === "base" ? 4 : 2);
      s.secret.splendor!.decks[key] = cards;
      g.deckCounts[key] = cards.length;
    }
  }
  for (const p of players) {
    g.players[p.uid] = {
      uid: p.uid,
      nickname: p.nickname,
      tokens: emptyTokens(),
      purchasedCardIds: [],
      reservedCards: [],
      bonuses: emptyGems(),
      prestige: 0,
      nobles: [],
      tradingPosts: [],
      strongholdsRemaining: config.module === "strongholds" ? 3 : 0,
      copiedBonuses: {},
      pledgedNobleIds: [],
      cityIds: [],
    };
    s.splendorPrivate[p.uid] = { gameId: id, reserved: {} };
  }
  delete r.game;
  delete r.timebomb;
  delete r.decorum;
  s.private = {};
  s.timebombPrivate = {};
  s.decorumPrivate = {};
  r.splendor = g;
  r.status = "playing";
}
const log = (g: SplendorPublicState, uid: string, text: string) => {
  g.log = [...g.log, { revision: g.revision, uid, text }].slice(-40);
};
const syncPlayer = (p: SplendorPlayerState) => {
  p.bonuses = calculateBonuses(p);
  p.prestige = calculatePrestige(p);
};
export function evaluateTradingPosts(p: SplendorPlayerState) {
  for (const post of DEMO_TRADING_POSTS)
    if (
      !p.tradingPosts.includes(post.id) &&
      meets(calculateBonuses(p), post.requirements)
    )
      p.tradingPosts.push(post.id);
  syncPlayer(p);
}
function marketLocation(g: SplendorPublicState, id: string) {
  for (const [key, cards] of Object.entries(g.market)) {
    const slot = cards.indexOf(id);
    if (slot >= 0) return { key, slot };
  }
  return undefined;
}
function leaveMarket(s: Session, id: string) {
  const g = s.public.splendor!,
    pos = marketLocation(g, id);
  ensure(pos, "此卡牌已被其他玩家操作，請重新選擇");
  const deck = s.secret.splendor!.decks[pos.key] ?? [];
  g.market[pos.key][pos.slot] = deck.shift() ?? null;
  g.deckCounts[pos.key] = deck.length;
  const hold = g.strongholds[id];
  if (hold) {
    g.players[hold.ownerUid].strongholdsRemaining += hold.count;
    delete g.strongholds[id];
  }
}
function reserve(
  s: Session,
  uid: string,
  id: string,
  visibility: "public" | "private",
) {
  const g = s.public.splendor!,
    p = g.players[uid],
    card = CARD_BY_ID[id];
  ensure(card && canReserveCard(p), "你的保留卡已達 3 張上限");
  const slot = `r${g.revision}-${p.reservedCards.length}`;
  p.reservedCards.push({
    slot,
    tier: card.tier,
    source: card.source,
    visibility,
    ...(visibility === "public" ? { cardId: id } : {}),
  });
  s.splendorPrivate![uid].reserved[slot] = id;
}
/** Original Orient effects: validate all choices before committing the cloned transaction. */
export function validateOrientEffect(
  g: SplendorPublicState,
  p: SplendorPlayerState,
  card: DevelopmentCard,
  choice: OrientChoice,
) {
  const e = card.orientEffect;
  if (!e) return;
  if (e.type === "copy")
    ensure(
      choice.color &&
        GEM_COLORS.includes(choice.color) &&
        calculateBonuses(p)[choice.color] > 0,
      "請選擇已有的寶石加成",
    );
  if (e.type === "return")
    ensure(
      choice.returnCardId &&
        p.purchasedCardIds.includes(choice.returnCardId) &&
        CARD_BY_ID[choice.returnCardId].tier === e.tier,
      "請選擇一張指定階級的已購卡歸還",
    );
  if (e.type === "reserve" && choice.reserveCardId)
    ensure(
      choice.reserveCardId !== card.id &&
        marketLocation(g, choice.reserveCardId) &&
        canReserveCard(p) &&
        canInteractWithStrongholdCard(g, p.uid, choice.reserveCardId),
      "無法保留這張卡",
    );
  if (e.type === "noble" && choice.nobleId)
    ensure(
      g.nobles.some((n) => n.id === choice.nobleId) &&
        !Object.values(g.players).some((other) =>
          other.pledgedNobleIds.includes(choice.nobleId!),
        ),
      "這位貴族已受邀或已離開",
    );
}
export function resolveOrientEffect(
  s: Session,
  p: SplendorPlayerState,
  card: DevelopmentCard,
  choice: OrientChoice,
) {
  const e = card.orientEffect;
  if (!e) return;
  if (e.type === "copy") p.copiedBonuses[card.id] = choice.color!;
  if (e.type === "return") {
    p.purchasedCardIds = p.purchasedCardIds.filter(
      (id) => id !== choice.returnCardId,
    );
    delete p.copiedBonuses[choice.returnCardId!];
  }
  if (e.type === "reserve" && choice.reserveCardId) {
    leaveMarket(s, choice.reserveCardId);
    reserve(s, p.uid, choice.reserveCardId, "public");
  }
  if (e.type === "noble" && choice.nobleId)
    p.pledgedNobleIds.push(choice.nobleId);
}
export function applyPurchase(
  s: Session,
  uid: string,
  action: Extract<SplendorAction, { type: "splendorBuy" }>,
) {
  const g = s.public.splendor!,
    p = g.players[uid];
  ensure(
    (typeof action.cardId === "string") !== (typeof action.slot === "string"),
    "請選擇一張市場卡或保留卡",
  );
  const reserved = action.slot
    ? p.reservedCards.find((r) => r.slot === action.slot)
    : undefined;
  const id = action.slot
    ? s.splendorPrivate![uid].reserved[action.slot]
    : action.cardId;
  ensure(
    id && CARD_BY_ID[id] && (action.slot ? reserved : marketLocation(g, id)),
    "此卡牌已被其他玩家操作，請重新選擇",
  );
  ensure(
    canInteractWithStrongholdCard(g, uid, id),
    "這張卡受到其他玩家的要塞保護",
  );
  if (g.phase === "STRONGHOLD_BONUS_PURCHASE")
    ensure(
      !action.slot &&
        g.strongholds[id]?.ownerUid === uid &&
        g.strongholds[id].count === 3,
      "額外購買只能選擇有自己 3 座要塞的卡",
    );
  const card = CARD_BY_ID[id],
    choice = action.choice ?? {};
  validateOrientEffect(g, p, card, choice);
  const payment = calculatePurchasePayment(card, p);
  ensure(payment.affordable, "你目前無法支付這張卡牌");
  for (const c of GEM_COLORS) {
    p.tokens[c] -= payment.normalPayment[c];
    g.bank[c] += payment.normalPayment[c];
  }
  p.tokens.gold -= payment.goldPayment;
  g.bank.gold += payment.goldPayment;
  if (reserved) {
    p.reservedCards = p.reservedCards.filter((r) => r.slot !== action.slot);
    delete s.splendorPrivate![uid].reserved[action.slot!];
  } else leaveMarket(s, id);
  p.purchasedCardIds.push(id);
  resolveOrientEffect(s, p, card, choice);
  syncPlayer(p);
  log(g, uid, `購入${card.name} · +${card.prestige}★`);
}
function awardNoble(
  g: SplendorPublicState,
  p: SplendorPlayerState,
  id: string,
) {
  const noble = g.nobles.find((n) => n.id === id)!;
  g.nobles = g.nobles.filter((n) => n.id !== id);
  p.nobles.push(noble);
  p.pledgedNobleIds = p.pledgedNobleIds.filter((n) => n !== id);
  g.nobleClaimed = true;
  syncPlayer(p);
  log(g, p.uid, `${noble.name}來訪 · +${noble.prestige}★`);
}
function finishTurn(g: SplendorPublicState, p: SplendorPlayerState) {
  if (g.config.module === "tradingPosts") evaluateTradingPosts(p);
  if (g.config.module === "cities")
    p.cityIds = Array.from(
      new Set([...p.cityIds, ...getEligibleCities(p, g).map((c) => c.id)]),
    );
  syncPlayer(p);
  if (!g.endTriggeredBy && shouldTriggerFinalRound(p, g)) {
    g.endTriggeredBy = p.uid;
    g.finalRoundNumber = g.round;
    log(g, p.uid, "觸發最後一輪");
  }
  if (g.currentPlayerIndex === g.playerOrder.length - 1) {
    if (g.endTriggeredBy) {
      g.phase = "GAME_OVER";
      g.winners = determineSplendorWinners(g);
      return;
    }
    g.round++;
    g.currentPlayerIndex = 0;
  } else g.currentPlayerIndex++;
  g.phase = "PLAYER_ACTION";
  g.bonusPurchaseUsed = false;
  g.nobleClaimed = false;
}
function afterPrimary(g: SplendorPublicState, p: SplendorPlayerState) {
  if (mustReturnTokens(p) > 0) {
    g.phase = "RETURN_EXCESS_TOKENS";
    return;
  }
  if (!g.nobleClaimed) {
    const eligible = getEligibleNobles(p, g);
    if (eligible.length > 1) {
      g.phase = "CHOOSE_NOBLE";
      return;
    }
    if (eligible.length === 1) awardNoble(g, p, eligible[0].id);
  }
  if (
    g.config.module === "strongholds" &&
    !g.bonusPurchaseUsed &&
    Object.values(g.strongholds).some(
      (h) => h.ownerUid === p.uid && h.count === 3,
    )
  ) {
    g.phase = "STRONGHOLD_BONUS_PURCHASE";
    return;
  }
  finishTurn(g, p);
}
/** Clone first: rejected effects never leave partially paid cards or leaked private state. */
export function applySplendorAction(
  input: Session,
  uid: string,
  action: SplendorAction,
): Session {
  const s = structuredClone(input);
  ensure(
    s.public.gameId === "splendor" &&
      s.public.status === "playing" &&
      s.public.splendor,
    "遊戲尚未開始或已結束",
  );
  const g = normalizeSplendor(s.public.splendor);
  ensure(
    g.players[uid] && s.public.players[uid],
    "你不在房間內",
  );
  ensure(g.playerOrder[g.currentPlayerIndex] === uid, "目前不是你的回合");
  const p = g.players[uid];
  s.splendorPrivate ??= {};
  ensure(
    s.splendorPrivate[uid]?.gameId === g.id && s.secret.splendor,
    "遊戲私人資料尚未同步",
  );
  s.splendorPrivate[uid].reserved ??= {};
  s.secret.splendor.decks ??= {};
  const before = structuredClone(g);
  g.revision++;
  syncPlayer(p);
  if (g.phase === "RETURN_EXCESS_TOKENS") {
    ensure(action.type === "splendorReturn", "請先將代幣退回至持有上限");
    ensure(
      action.tokens &&
        typeof action.tokens === "object" &&
        !Array.isArray(action.tokens),
      "無效的退回數量",
    );
    ensure(
      Object.keys(action.tokens).every((c) =>
        TOKEN_COLORS.includes(c as (typeof TOKEN_COLORS)[number]),
      ),
      "無效的寶石",
    );
    let count = 0;
    for (const c of TOKEN_COLORS) {
      const n = action.tokens[c] ?? 0;
      ensure(
        Number.isInteger(n) && n >= 0 && n <= p.tokens[c],
        "退回數量超過持有數量",
      );
      count += n;
    }
    ensure(count === mustReturnTokens(p), "請退回剛好超出的代幣");
    for (const c of TOKEN_COLORS) {
      const n = action.tokens[c] ?? 0;
      p.tokens[c] -= n;
      g.bank[c] += n;
    }
    log(g, uid, `退回 ${count} 枚代幣`);
    afterPrimary(g, p);
  } else if (g.phase === "CHOOSE_NOBLE") {
    ensure(
      action.type === "splendorNoble" &&
        getEligibleNobles(p, g).some((n) => n.id === action.nobleId),
      "請選擇一位符合條件的貴族",
    );
    awardNoble(g, p, action.nobleId);
    afterPrimary(g, p);
  } else if (g.phase === "RESOLVE_EXPANSION") {
    ensure(action.type === "splendorStronghold", "請先放置、移除或略過要塞");
    if (action.cardId) {
      ensure(marketLocation(g, action.cardId), "請選擇市場中的卡牌");
      const h = g.strongholds[action.cardId];
      if (action.remove) {
        ensure(h && h.ownerUid !== uid, "只能移除其他玩家的要塞");
        g.players[h.ownerUid].strongholdsRemaining++;
        h.count--;
        if (!h.count) delete g.strongholds[action.cardId];
      } else {
        ensure(
          p.strongholdsRemaining > 0 && (!h || h.ownerUid === uid),
          "沒有可放置的要塞，或卡牌已受保護",
        );
        g.strongholds[action.cardId] = {
          ownerUid: uid,
          count: (h?.count ?? 0) + 1,
        };
        p.strongholdsRemaining--;
      }
      log(g, uid, action.remove ? "移除一座對手要塞" : "放置一座要塞");
    }
    afterPrimary(g, p);
  } else if (g.phase === "STRONGHOLD_BONUS_PURCHASE") {
    ensure(
      action.type === "splendorBuy" || action.type === "splendorSkip",
      "請購買要塞卡或略過",
    );
    if (action.type === "splendorBuy") applyPurchase(s, uid, action);
    g.bonusPurchaseUsed = true;
    afterPrimary(g, p);
  } else {
    ensure(g.phase === "PLAYER_ACTION", "請先完成目前階段");
    switch (action.type) {
      case "splendorTake":
        ensure(
          canTakeDifferentGems(g, p, action.colors),
          "請選擇庫存充足且不同色的寶石",
        );
        for (const c of action.colors) {
          g.bank[c]--;
          p.tokens[c]++;
        }
        log(g, uid, `拿取 ${action.colors.length} 種寶石`);
        break;
      case "splendorDouble":
        ensure(
          canTakeDoubleGem(g, action.color),
          "只有寶石庫中至少有 4 枚時才能一次拿取 2 枚",
        );
        g.bank[action.color] -= 2;
        p.tokens[action.color] += 2;
        log(g, uid, "拿取 2 枚同色寶石");
        break;
      case "splendorReserve":
        ensure(
          typeof action.cardId === "string" && marketLocation(g, action.cardId),
          "此卡牌已被其他玩家操作，請重新選擇",
        );
        ensure(
          canInteractWithStrongholdCard(g, uid, action.cardId),
          "這張卡受到其他玩家的要塞保護",
        );
        ensure(canReserveCard(p), "你的保留卡已達 3 張上限");
        leaveMarket(s, action.cardId);
        reserve(s, uid, action.cardId, "public");
        if (g.bank.gold > 0) {
          g.bank.gold--;
          p.tokens.gold++;
        }
        log(g, uid, "保留一張公開卡");
        break;
      case "splendorBlind": {
        ensure(
          [1, 2, 3].includes(action.tier) &&
            ["base", "orient"].includes(action.source),
          "無效的牌堆",
        );
        const key = deckKey(action.tier, action.source),
          deck = s.secret.splendor.decks[key];
        ensure(deck?.length, "此牌堆已抽完");
        ensure(canReserveCard(p), "你的保留卡已達 3 張上限");
        reserve(s, uid, deck.shift()!, "private");
        g.deckCounts[key] = deck.length;
        if (g.bank.gold > 0) {
          g.bank.gold--;
          p.tokens.gold++;
        }
        log(g, uid, `保留一張 ${action.tier} 階暗牌`);
        break;
      }
      case "splendorBuy":
        applyPurchase(s, uid, action);
        if (g.config.module === "strongholds") {
          g.phase = "RESOLVE_EXPANSION";
          recordSplendorActivity(before, g, uid, action.type);
          return s;
        }
        break;
      default:
        throw new Error("請選擇拿取、保留或購買");
    }
    afterPrimary(g, p);
  }
  if ((g.phase as string) === "GAME_OVER") s.public.status = "finished";
  recordSplendorActivity(before, g, uid, action.type);
  return s;
}
