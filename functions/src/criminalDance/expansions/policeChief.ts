import type {
  DanceGame,
  DancePrivate,
  DanceTerminalSnapshot,
  DanceEnd,
} from "../../shared/criminalDance";
import { DANCE_CARD_BY_ID } from "../../shared/criminalDance";

/** Capture before the ending action discards cards; never publish the private snapshot. */
export function terminalSnapshot(
  p: Record<string, DancePrivate>,
  endReason: DanceEnd,
  actor: string,
  criminal: string,
): DanceTerminalSnapshot {
  return {
    finalCriminalUid: criminal,
    finalCriminalHadAlibi: !!p[criminal]?.hand.some(
      (id) => DANCE_CARD_BY_ID[id].type === "ALIBI",
    ),
    endReason,
    ...(endReason === "DETECTIVE_CAUGHT" ? { detectiveUid: actor } : {}),
    ...(endReason === "DOG_CAUGHT" ? { dogUid: actor } : {}),
  };
}
export function policeChiefSucceeded(
  g: DanceGame,
  terminal: DanceTerminalSnapshot,
): boolean {
  return (
    !!g.config.policeChiefEnabled &&
    !!g.policeChiefOwnerUid &&
    !!terminal.finalCriminalUid &&
    terminal.endReason !== "NO_PLAYABLE_CARDS" &&
    g.policeChiefTargetUid === terminal.finalCriminalUid &&
    !terminal.finalCriminalHadAlibi
  );
}
