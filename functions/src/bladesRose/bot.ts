import {
  canSubmitRose,
  isFlower,
  roseFaction,
  PLAYER_COUNT_RULES,
  type RoseAction,
  type RoseCard,
  type RoseGame,
  type RosePrivate,
} from "../shared/bladesRose";
import type { Shuffle } from "../timebomb-engine";
/** The policy receives only one seat's legal observation. No Session or secret
 * contribution map enters this boundary, even when another bot owns the seat. */
export function chooseRoseAction(
  uid: string,
  g: RoseGame,
  own: RosePrivate,
  shuffle: Shuffle,
  casual = false,
): RoseAction | null {
  if (g.phase === "GAME_OVER") return null;
  if (g.phase === "NIGHT")
    return own.acknowledged ? null : { type: "roseNight" };
  if (g.current !== uid) return null;
  const pick = <T>(items: T[]) => shuffle([...items])[0];
  const white = own.faction === "WHITE_ROSE";
  const suspicion = (id: string) => {
    if (id === uid) return white ? -10 : 10;
    if (own.knownRoles[id])
      return roseFaction(own.knownRoles[id]) === "BLOOD_BLADE" ? 10 : -10;
    const exposed = g.history
      .flatMap((r) => r.cards)
      .filter((c) => c.sourceUid === id);
    if (exposed.some((c) => roseFaction(c.type) === "BLOOD_BLADE")) return 10;
    // Only attributed identity cards convey this information. A played
    // FOLLOWER is available to both factions and is not proof of allegiance.
    if (exposed.some((c) => c.type === "WHITE_ROSE" || c.type === "BISHOP"))
      return -10;
    return own.night.includes(id) ? 2 : 0;
  };
  switch (g.phase) {
    case "COIN": {
      const targets = shuffle(
        g.order.filter((id) => id !== uid && !g.players[id].crystalUsed),
      );
      if (!casual)
        targets.sort(
          (a, b) => (white ? 1 : -1) * (suspicion(a) - suspicion(b)),
        );
      return { type: "roseCoin", target: targets[0] };
    }
    case "CRYSTAL":
      return { type: "roseCrystal" };
    case "TARGET": {
      const targets = shuffle(
        g.order.filter((id) =>
          g.crystal === 7 ? id !== uid : g.players[id].handCount > 0,
        ),
      );
      if (!casual)
        targets.sort((a, b) => {
          const rate = (id: string) =>
            g.crystal === 11
              ? (own.knownRoles[id] ? -20 : 0) + (id === uid ? -50 : 0)
              : g.crystal === 7
                ? white
                  ? -suspicion(id)
                  : suspicion(id)
                : white
                  ? -suspicion(id)
                  : -suspicion(id) + (id === uid ? -20 : 0);
          return rate(b) - rate(a);
        });
      return {
        type: "roseTarget",
        targets: targets.slice(0, g.crystal === 5 ? 2 : 1),
      };
    }
    case "PEEK":
      return { type: "rosePeek" };
    case "REPLACE_TARGET": {
      const target = pick(own.replacementTargets);
      return target && pick([true, false])
        ? { type: "roseReplaceTarget", target }
        : { type: "roseReplaceTarget" };
    }
    case "ROUND_RESULT":
      return { type: "roseContinue" };
    case "DECISIONS":
    case "REPLACE_CARD": {
      const replacing = g.phase === "REPLACE_CARD";
      const legal = shuffle(
        own.hand.filter((c) => replacing || canSubmitRose(own, c.id)),
      );
      if (!legal.length) return { type: "roseDecide" };
      let card: RoseCard | undefined;
      if (casual)
        card = pick([
          ...legal,
          ...(!replacing && canSubmitRose(own) ? [undefined] : []),
        ]);
      else {
        const ids = PLAYER_COUNT_RULES[g.order.length].identities!;
        const totalBlades =
          ids.DOUBLE_BLADE * 2 + ids.GREAT_BLADE + ids.DARK_BLADE;
        const spentBlades = g.history
          .flatMap((r) => r.cards)
          .filter((c) => roseFaction(c.type) === "BLOOD_BLADE").length;
        const lastRounds = g.round >= g.order.length - 2;
        const safe = spentBlades >= totalBlades;
        const rate = (c: RoseCard) => {
          if (white) {
            if (c.type === "WHITE_ROSE")
              return safe ? 100 : lastRounds ? 45 : -12;
            if (isFlower(c.type)) return safe ? 90 : lastRounds ? 70 : 30;
            return safe ? -10 : 12;
          }
          if (roseFaction(c.type) === "BLOOD_BLADE")
            return g.crystal === 2 && !lastRounds
              ? 0
              : lastRounds
                ? 80
                : pick([15, 45]);
          if (c.type === "GHOST") return 25;
          return lastRounds ? 0 : 20;
        };
        // Compute random scores once, never inside the sorting comparator.
        card = legal
          .map((c) => ({ c, score: rate(c) }))
          .sort((a, b) => b.score - a.score)[0].c;
        if (
          !replacing &&
          canSubmitRose(own) &&
          !lastRounds &&
          !safe &&
          pick([false, false, true])
        )
          card = undefined;
      }
      return replacing
        ? { type: "roseReplaceCard", cardId: (card ?? legal[0]).id }
        : { type: "roseDecide", ...(card ? { cardId: card.id } : {}) };
    }
    default:
      return null;
  }
}
