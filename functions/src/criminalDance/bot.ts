import type { Shuffle } from "../timebomb-engine";
import {
  canPlayDanceCard,
  danceNeedsSelection,
  danceTargets,
  DANCE_CARD_BY_ID,
} from "../shared/criminalDance";
import type {
  DanceAction,
  DanceGame,
  DancePrivate,
} from "../shared/criminalDance";
/** Only public information and this bot's own observation enter the strategy. */
export function chooseDanceAction(
  uid: string,
  g: DanceGame,
  own: DancePrivate,
  shuffle: Shuffle,
  casual = false,
): DanceAction | null {
  if (danceNeedsSelection(g, uid)) {
    const choices = shuffle(own.hand);
    choices.sort((a, b) => {
      const rate = (id: string) =>
        id === "CRIMINAL-0"
          ? own.hand.length <= 2
            ? -10
            : 20
          : DANCE_CARD_BY_ID[id].type === "ALIBI" &&
              own.hand.includes("CRIMINAL-0")
            ? -8
            : 0;
      return casual ? 0 : rate(b) - rate(a);
    });
    return { type: "danceSelect", cardId: choices[0] };
  }
  if (g.current !== uid) return null;
  if (g.phase === "EFFECT_RESULT" || g.phase === "WITNESS_REVEAL")
    return { type: "danceAcknowledge" };
  if (g.phase === "SELECT_TARGET" && g.pending) {
    const targets = shuffle(danceTargets(g, uid, g.pending.type));
    if (!casual)
      targets.sort((a, b) => {
        const score = (id: string) =>
          (id === own.botClue ? 15 : 0) +
          (id === own.boyInitial && g.events.every((e) => e.kind !== "TRANSFER")
            ? 8
            : 0) +
          (g.players[id].handCount === 1 ? 3 : 0) -
          (id === uid ? 20 : 0);
        return score(b) - score(a);
      });
    return { type: "danceTarget", target: targets[0] };
  }
  if (g.phase !== "PLAYER_TURN") return null;
  const legal = shuffle(
      own.hand.filter((id) => !canPlayDanceCard(g, own, uid, id)),
    ),
    criminal = own.hand.includes("CRIMINAL-0");
  if (!casual)
    legal.sort((a, b) => {
      const score = (id: string) => {
        const t = DANCE_CARD_BY_ID[id].type;
        switch (t) {
          case "CRIMINAL":
            return 100;
          case "FIRST_DISCOVERER":
            return 90;
          case "DETECTIVE":
            return own.hand.length <= 3 && !criminal
              ? own.botClue
                ? 45
                : 18
              : -8;
          case "DOG":
            return criminal ? -5 : 25;
          case "POLICE_CHIEF":
            return criminal || g.players[uid].accomplice
              ? 5
              : own.botClue
                ? 40
                : 22;
          case "ALIBI":
            return criminal ? -15 : 10;
          case "ACCOMPLICE":
            return criminal ? 30 : g.players[uid].accomplice ? 0 : 8;
          case "WITNESS":
            return criminal ? 7 : 13;
          case "RUMOR":
          case "INFORMATION_EXCHANGE":
          case "TRADE":
            return criminal && own.hand.length <= 2 ? -10 : 8;
          default:
            return 12;
        }
      };
      return score(b) - score(a);
    });
  return legal.length ? { type: "dancePlay", cardId: legal[0] } : null;
}
