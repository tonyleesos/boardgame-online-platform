import {
  CARD_BY_ID,
  GEM_COLORS,
  TOKEN_COLORS,
  calculatePurchasePayment,
  calculateBonuses,
  canPurchaseCard,
  canReserveCard,
  canInteractWithStrongholdCard,
  canTakeDoubleGem,
  getEligibleNobles,
  mustReturnTokens,
  emptyTokens,
  applyTradingPostModifiers,
  normalizeSplendor,
} from "../shared/splendor";
import type {
  DevelopmentCard,
  OrientChoice,
  SplendorAction,
  SplendorPrivate,
  SplendorPublicState,
} from "../shared/splendor";

/** Policy only receives public information and its own reserve. Never a Session or deck order. */
export function chooseSplendorAction(
  uid: string,
  input: SplendorPublicState,
  own: SplendorPrivate,
  shuffle: <T>(values: T[]) => T[],
  casual = false,
): SplendorAction | null {
  const g = normalizeSplendor(structuredClone(input));
  if (
    g.phase === "GAME_OVER" ||
    g.playerOrder[g.currentPlayerIndex] !== uid ||
    own.gameId !== g.id
  )
    return null;
  const p = g.players[uid],
    bonuses = calculateBonuses(p);
  const market = Object.values(g.market)
    .flat()
    .filter((id): id is string => !!id)
    .map((id) => CARD_BY_ID[id]);
  const cards = [
    ...market
      .filter((c) => canInteractWithStrongholdCard(g, uid, c.id))
      .map((card) => ({ card, slot: undefined as string | undefined })),
    ...p.reservedCards.flatMap((r) => {
      const id = own.reserved?.[r.slot] ?? r.cardId;
      return id ? [{ card: CARD_BY_ID[id], slot: r.slot }] : [];
    }),
  ];
  const deficit = (card: DevelopmentCard) => {
    const pay = calculatePurchasePayment(card, p);
    return Math.max(
      0,
      GEM_COLORS.reduce(
        (n, c) => n + Math.max(0, pay.requiredAfterBonuses[c] - p.tokens[c]),
        0,
      ) -
        p.tokens.gold * applyTradingPostModifiers(p).goldValue,
    );
  };
  const useful = (card: DevelopmentCard) => {
    let value = card.prestige * 2 + Math.max(0, 6 - bonuses[card.bonusColor]);
    if (card.orientEffect?.type === "double") value += 3;
    if (card.orientEffect?.type === "copy") value += 2;
    if (g.config.module === "cities")
      value +=
        g.cities.filter(
          (c) =>
            (c.requirements[card.bonusColor] ?? 0) > bonuses[card.bonusColor],
        ).length * 2;
    else
      value +=
        g.nobles.filter(
          (n) =>
            (n.requirements[card.bonusColor] ?? 0) > bonuses[card.bonusColor],
        ).length * 0.5;
    return value;
  };
  const choices = (card: DevelopmentCard): OrientChoice => {
    const effect = card.orientEffect;
    if (effect?.type === "copy")
      return {
        color: [...GEM_COLORS]
          .filter((c) => bonuses[c] > 0)
          .sort((a, b) => bonuses[a] - bonuses[b])[0],
      };
    if (effect?.type === "return")
      return {
        returnCardId: p.purchasedCardIds
          .filter((id) => CARD_BY_ID[id].tier === effect.tier)
          .sort(
            (a, b) =>
              CARD_BY_ID[a].prestige * 3 +
              useful(CARD_BY_ID[a]) -
              (CARD_BY_ID[b].prestige * 3 + useful(CARD_BY_ID[b])),
          )[0],
      };
    if (effect?.type === "reserve" && canReserveCard(p)) {
      const target = market
        .filter(
          (c) =>
            c.id !== card.id && canInteractWithStrongholdCard(g, uid, c.id),
        )
        .sort((a, b) => deficit(a) - deficit(b) || useful(b) - useful(a))[0];
      return target ? { reserveCardId: target.id } : {};
    }
    if (effect?.type === "noble") {
      const target = g.nobles
        .filter(
          (n) =>
            !Object.values(g.players).some((other) =>
              other.pledgedNobleIds.includes(n.id),
            ),
        )
        .sort((a, b) =>
          GEM_COLORS.reduce(
            (n, c) =>
              n +
              Math.max(0, (a.requirements[c] ?? 0) - bonuses[c]) -
              Math.max(0, (b.requirements[c] ?? 0) - bonuses[c]),
            0,
          ),
        )[0];
      return target ? { nobleId: target.id } : {};
    }
    return {};
  };
  const viable = (card: DevelopmentCard) =>
    (card.orientEffect?.type !== "copy" ||
      GEM_COLORS.some((c) => bonuses[c] > 0)) &&
    (card.orientEffect?.type !== "return" ||
      p.purchasedCardIds.some(
        (id) =>
          card.orientEffect?.type === "return" &&
          CARD_BY_ID[id].tier === card.orientEffect.tier,
      ));
  if (g.phase === "CHOOSE_NOBLE")
    return {
      type: "splendorNoble",
      nobleId: getEligibleNobles(p, g).sort(
        (a, b) => b.prestige - a.prestige,
      )[0].id,
    };
  if (g.phase === "RESOLVE_EXPANSION") {
    if (p.strongholdsRemaining) {
      const target = market
        .filter((c) => canInteractWithStrongholdCard(g, uid, c.id))
        .sort(
          (a, b) =>
            (g.strongholds[b.id]?.count ?? 0) -
              (g.strongholds[a.id]?.count ?? 0) ||
            deficit(a) - deficit(b) ||
            useful(b) - useful(a),
        )[0];
      if (target) return { type: "splendorStronghold", cardId: target.id };
    }
    const enemy = market
      .filter(
        (c) => g.strongholds[c.id] && g.strongholds[c.id].ownerUid !== uid,
      )
      .sort((a, b) => g.strongholds[b.id].count - g.strongholds[a.id].count)[0];
    return enemy
      ? { type: "splendorStronghold", cardId: enemy.id, remove: true }
      : { type: "splendorStronghold" };
  }
  if (g.phase === "STRONGHOLD_BONUS_PURCHASE") {
    const card = market.find(
      (c) =>
        g.strongholds[c.id]?.ownerUid === uid &&
        g.strongholds[c.id].count === 3 &&
        canPurchaseCard(g, p, c) &&
        viable(c),
    );
    return card
      ? { type: "splendorBuy", cardId: card.id, choice: choices(card) }
      : { type: "splendorSkip" };
  }
  const ranked = shuffle(cards.filter((c) => viable(c.card))).sort(
    (a, b) =>
      deficit(a.card) - deficit(b.card) || useful(b.card) - useful(a.card),
  );
  if (g.phase === "RETURN_EXCESS_TOKENS") {
    const target = ranked[0],
      needed = target
        ? calculatePurchasePayment(target.card, p).requiredAfterBonuses
        : emptyTokens();
    const held = { ...p.tokens },
      tokens = emptyTokens();
    for (let n = 0; n < mustReturnTokens(p); n++) {
      const color = [...TOKEN_COLORS]
        .filter((c) => held[c] > 0)
        .sort((a, b) => {
          const surplus = (c: typeof a) =>
            c === "gold" ? -20 : held[c] - (needed[c] ?? 0);
          return surplus(b) - surplus(a) || held[b] - held[a];
        })[0];
      tokens[color]++;
      held[color]--;
    }
    return { type: "splendorReturn", tokens };
  }
  const affordable = ranked.filter((c) => canPurchaseCard(g, p, c.card));
  if (affordable.length) {
    const entry = casual
      ? shuffle(affordable)[0]
      : affordable.sort((a, b) => useful(b.card) - useful(a.card))[0];
    return {
      type: "splendorBuy",
      ...(entry.slot ? { slot: entry.slot } : { cardId: entry.card.id }),
      choice: choices(entry.card),
    };
  }
  const target = ranked[0];
  if (target) {
    const pay = calculatePurchasePayment(target.card, p);
    const lacking = [...GEM_COLORS]
      .filter((c) => g.bank[c] > 0 && pay.requiredAfterBonuses[c] > p.tokens[c])
      .sort(
        (a, b) =>
          pay.requiredAfterBonuses[b] -
          p.tokens[b] -
          (pay.requiredAfterBonuses[a] - p.tokens[a]),
      );
    if (
      !casual &&
      lacking.length === 1 &&
      pay.requiredAfterBonuses[lacking[0]] - p.tokens[lacking[0]] >= 2 &&
      canTakeDoubleGem(g, lacking[0])
    )
      return { type: "splendorDouble", color: lacking[0] };
    if (
      !target.slot &&
      canReserveCard(p) &&
      g.bank.gold > 0 &&
      deficit(target.card) <= 2 &&
      (!lacking.length ||
        TOKEN_COLORS.reduce((n, c) => n + p.tokens[c], 0) >= 9)
    )
      return { type: "splendorReserve", cardId: target.card.id };
    const others = shuffle(
      [...GEM_COLORS].filter((c) => g.bank[c] > 0 && !lacking.includes(c)),
    ).sort((a, b) => p.tokens[a] - p.tokens[b]);
    const colors = [...lacking, ...others].slice(
      0,
      applyTradingPostModifiers(p).maxDifferent,
    );
    if (colors.length) return { type: "splendorTake", colors };
    if (!target.slot && canReserveCard(p))
      return { type: "splendorReserve", cardId: target.card.id };
  }
  const colors = GEM_COLORS.filter((c) => g.bank[c] > 0).slice(0, 3);
  return colors.length ? { type: "splendorTake", colors } : null;
}
