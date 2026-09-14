import { CARD_BY_ID, TOKEN_COLORS } from "../shared/splendor";
import type { SplendorActivity, SplendorAction, SplendorPublicState } from "../shared/splendor";

export function recordSplendorActivity(before: SplendorPublicState, after: SplendorPublicState, uid: string, type: SplendorAction["type"]): SplendorActivity {
  const previous = before.players[uid], player = after.players[uid];
  const cards: SplendorActivity["cards"] = [];
  for (const id of player.purchasedCardIds.filter((id) => !previous.purchasedCardIds.includes(id))) {
    const card = CARD_BY_ID[id];
    cards.push({ cardId: id, tier: card.tier, source: card.source,
      from: Object.values(before.market).some((row) => row.includes(id)) ? "market" : "reserved", to: "purchased" });
  }
  for (const id of previous.purchasedCardIds.filter((id) => !player.purchasedCardIds.includes(id))) {
    const card = CARD_BY_ID[id];
    cards.push({ cardId: id, tier: card.tier, source: card.source, from: "purchased", to: "returned" });
  }
  for (const card of player.reservedCards.filter((card) => !previous.reservedCards.some((old) => old.slot === card.slot))) {
    cards.push({ ...(card.visibility === "public" && card.cardId ? { cardId: card.cardId } : {}),
      tier: card.tier, source: card.source, from: card.visibility === "public" ? "market" : "deck", to: "reserved" });
  }
  const strongholdCardId = [...new Set([...Object.keys(before.strongholds), ...Object.keys(after.strongholds)])]
    .find((id) => before.strongholds[id]?.count !== after.strongholds[id]?.count || before.strongholds[id]?.ownerUid !== after.strongholds[id]?.ownerUid);
  const event: SplendorActivity = {
    revision: after.revision, uid, type,
    text: after.log.filter((entry) => entry.revision === after.revision).map((entry) => entry.text).join(" · ") ||
      (type === "splendorSkip" ? "略過額外購買" : "略過要塞放置"),
    tokens: Object.fromEntries(TOKEN_COLORS.map((color) => [color, player.tokens[color] - previous.tokens[color]]).filter(([, amount]) => amount !== 0)),
    cards,
    nobleNames: player.nobles.filter((noble) => !previous.nobles.some((old) => old.id === noble.id)).map((noble) => noble.name),
    ...(strongholdCardId ? { strongholdChange: {
      cardId: strongholdCardId,
      ownerUid: after.strongholds[strongholdCardId]?.ownerUid ?? before.strongholds[strongholdCardId].ownerUid,
      count: Math.abs((after.strongholds[strongholdCardId]?.count ?? 0) - (before.strongholds[strongholdCardId]?.count ?? 0)),
      removed: (after.strongholds[strongholdCardId]?.count ?? 0) < (before.strongholds[strongholdCardId]?.count ?? 0),
    } } : {}),
  };
  after.activities = [...(after.activities ?? []), event].slice(-40);
  return event;
}
