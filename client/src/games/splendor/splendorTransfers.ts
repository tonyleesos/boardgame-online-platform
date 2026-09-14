import {
  CARD_BY_ID,
  GEM_NAMES,
} from "../../../../functions/src/shared/splendor";
import type {
  DevelopmentTier,
  SplendorActivity,
  SplendorPublicState,
  TokenColor,
} from "../../../../functions/src/shared/splendor";

export interface TransferItem {
  source: string;
  destination: string;
  color?: TokenColor;
  cardId?: string;
  tier?: DevelopmentTier;
  symbol?: "noble" | "stronghold";
}

/** All viewers use the same accepted public outcome, including the actor. */
export function describePublicTransfer(event: SplendorActivity, game: SplendorPublicState): TransferPlan {
  const items: TransferItem[] = [];
  const detail: string[] = [];
  for (const [color, delta] of Object.entries(event.tokens ?? {}) as Array<[TokenColor, number]>) {
    const bank = `bank:${color}`, player = `player:${event.uid}:token:${color}`;
    for (let i = 0; i < Math.abs(delta); i++) items.push({ source: delta > 0 ? bank : player, destination: delta > 0 ? player : bank, color });
    detail.push(`${GEM_NAMES[color]} ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`);
  }
  for (const card of event.cards ?? []) {
    const source = card.from === "deck" ? `deck:${card.source}${card.tier}`
      : card.from === "market" ? `card:${card.cardId}` : `player:${event.uid}:${card.from === "reserved" ? "reserves" : "cards"}`;
    const destination = card.to === "returned" ? "market" : `player:${event.uid}:${card.to === "reserved" ? "reserves" : "cards"}`;
    items.push({ source, destination, cardId: card.cardId, tier: card.tier });
    detail.push(card.cardId ? CARD_BY_ID[card.cardId].name : `${card.tier} 階暗牌`);
  }
  for (const name of event.nobleNames ?? []) {
    items.push({ source: "nobles", destination: `player:${event.uid}:cards`, symbol: "noble" });
    detail.push(`${name}來訪`);
  }
  if (event.strongholdChange) {
    const change = event.strongholdChange;
    const player = `player:${change.ownerUid}:cards`, card = `card:${change.cardId}`;
    for (let i = 0; i < change.count; i++) items.push({ source: change.removed ? card : player, destination: change.removed ? player : card, symbol: "stronghold" });
  }
  return { title: `${game.players[event.uid]?.nickname ?? "玩家"} · ${event.text}`, detail: detail.join(" · ") || "所有玩家已同步這次操作", items };
}
export interface TransferPlan {
  title: string;
  detail: string;
  items: TransferItem[];
}
