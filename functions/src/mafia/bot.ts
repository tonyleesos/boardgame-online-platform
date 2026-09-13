import type {
  MafiaAction,
  MafiaPrivate,
  MafiaPublicState,
} from "../shared/mafia";

/** This policy cannot access Session, another seat's role, discarded token or
 * historical box snapshots. Unrevealed accusations remain uncertain guesses. */
export function chooseMafiaAction(
  uid: string,
  g: MafiaPublicState,
  own: MafiaPrivate,
  shuffle: <T>(values: T[]) => T[],
  casual = false,
  now = Date.now(),
): MafiaAction | null {
  if (own.gameId !== g.id || !g.seats[uid]?.alive) return null;
  if (g.phase === "GODFATHER_PREPARE_BOX" && uid === g.godfatherId)
    return { type: "mafiaPrepare", hidden: shuffle([0, 1, 2, 3, 4, 5])[0] };
  if (g.phase === "BOX_PASS" && uid === g.holderId && own.currentBoxView) {
    const box = own.currentBoxView,
      tokens = [...(box.tokens ?? [])];
    const first = uid === g.passOrder[0],
      last = uid === g.passOrder.at(-1);
    const discard =
      first && tokens.length && shuffle([true, false, false])[0]
        ? shuffle(tokens)[0]
        : undefined;
    const available = tokens.filter((t) => t.id !== discard?.id);
    const base = {
      type: "mafiaTake" as const,
      ...(discard ? { discardTokenId: discard.id } : {}),
    };
    if (
      (!box.diamonds && !available.length) ||
      (last && shuffle([true, false, false])[0])
    )
      return { ...base, nothing: true };
    const takeDiamonds =
      box.diamonds > 0 &&
      (!available.length ||
        shuffle(casual ? [true, false] : [true, true, false, false, false])[0]);
    if (takeDiamonds) {
      const max = Math.min(box.diamonds, casual ? box.diamonds : 6);
      const amounts = Array.from({ length: max }, (_, i) => i + 1);
      // Higher theft is valuable, but taking the whole box makes later players
      // more likely to become allies/agents; never infer their real roles.
      return { ...base, diamonds: shuffle(amounts)[0] };
    }
    return { ...base, tokenId: shuffle(available)[0].id };
  }
  if (g.phase === "INVESTIGATION" && uid === g.godfatherId) {
    const candidates = shuffle(
      g.passOrder.filter((id) => g.seats[id].alive && !g.seats[id].revealed),
    );
    if (!candidates.length) return null;
    // Only an uncertain positional prior: earlier players had more diamonds
    // available. Random selection remains possible for every eligible seat.
    const pool = casual
      ? candidates
      : [
          ...candidates,
          ...candidates.filter(
            (id) => g.passOrder.indexOf(id) < g.passOrder.length / 2,
          ),
        ];
    return { type: "mafiaAccuse", target: shuffle(pool)[0] };
  }
  if (
    g.phase === "ACCUSATION_PENDING" &&
    g.config.cleanerEnabled &&
    own.role === "CLEANER" &&
    !own.cleanerChoice &&
    g.pending &&
    now < g.pending.deadline
  ) {
    return {
      type: "mafiaCleaner",
      choice:
        g.pending.target === uid
          ? "PASS"
          : shuffle(["PASS", "PASS", "PASS", "SHOOT"] as Array<
              "PASS" | "SHOOT"
            >)[0],
    };
  }
  return null;
}
