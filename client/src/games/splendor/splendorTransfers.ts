import {
  CARD_BY_ID,
  GEM_NAMES,
} from "../../../../functions/src/shared/splendor";
import type {
  DevelopmentTier,
  SplendorAction,
  SplendorPlayerState,
  SplendorPublicState,
  TokenColor,
} from "../../../../functions/src/shared/splendor";

export interface TransferItem {
  source: string;
  destination: string;
  color?: TokenColor;
  cardId?: string;
  tier?: DevelopmentTier;
}
export interface TransferPlan {
  title: string;
  detail: string;
  items: TransferItem[];
}

/** Describe the submitted action, but display it only after server acceptance. */
export function describeTransfer(
  action: SplendorAction,
  game: SplendorPublicState,
  player: SplendorPlayerState,
  selectedCardId?: string,
): TransferPlan | null {
  const gem = (color: TokenColor): TransferItem => ({
    source: `token:${color}`,
    destination: `token:${color}`,
    color,
  });
  if (action.type === "splendorTake" || action.type === "splendorDouble") {
    const colors =
      action.type === "splendorTake"
        ? action.colors
        : [action.color, action.color];
    return {
      title: "寶石已入袋",
      detail:
        action.type === "splendorDouble"
          ? `${GEM_NAMES[action.color]} ×2`
          : colors.map((c) => `${GEM_NAMES[c]} ×1`).join("、"),
      items: colors.map(gem),
    };
  }
  if (action.type === "splendorReserve" || action.type === "splendorBlind") {
    const card =
      action.type === "splendorReserve" ? CARD_BY_ID[action.cardId] : undefined;
    const items: TransferItem[] = [
      {
        source:
          action.type === "splendorBlind"
            ? `deck:${action.source}${action.tier}`
            : `card:${action.cardId}`,
        destination: "reserves",
        cardId: card?.id,
        tier: action.type === "splendorBlind" ? action.tier : card?.tier,
      },
    ];
    if (game.bank.gold > 0) items.push(gem("gold"));
    return {
      title: "卡牌已保留",
      detail: `${card?.name ?? "暗牌已加入保留卡"}${game.bank.gold > 0 ? " · 黃金 +1" : ""}`,
      items,
    };
  }
  if (action.type === "splendorBuy") {
    const id =
      action.cardId ??
      player.reservedCards.find((r) => r.slot === action.slot)?.cardId ??
      selectedCardId;
    const card = id ? CARD_BY_ID[id] : undefined;
    if (!card) return null;
    const items: TransferItem[] = [
      { source: `card:${card.id}`, destination: "cards", cardId: card.id },
    ];
    // An Orient purchase may also reserve another public card, without gold.
    const extra =
      card.orientEffect?.type === "reserve" && action.choice?.reserveCardId;
    if (extra)
      items.push({
        source: `card:${extra}`,
        destination: "reserves",
        cardId: extra,
      });
    return {
      title: "卡牌已購入",
      detail: `${card.name} · 已加入發展卡收藏${extra ? "，並保留 1 張卡" : ""}`,
      items,
    };
  }
  return null;
}
