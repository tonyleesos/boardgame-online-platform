import { useCallback, useState, type RefObject } from "react";
import type { SplendorPublicState } from "../../../../functions/src/shared/splendor";
import { describePublicTransfer } from "./splendorTransfers";
import { SplendorTransfer } from "./SplendorTransfer";
import type { TransferPlayback } from "./splendorTransferGeometry";

export function SplendorActivityPlayback({ game, boardRef }: { game: SplendorPublicState; boardRef: RefObject<HTMLDivElement | null> }) {
  // Mount/reconnect starts from the current revision: never replay historical moves.
  const [state, setState] = useState<{ revision: number; queue: TransferPlayback[] }>({ revision: game.revision, queue: [] });
  if (game.revision > state.revision) {
    const incoming = (game.activities ?? []).filter((event) => event.revision > state.revision)
      .map((event) => ({ id: event.revision, ...describePublicTransfer(event, game) }));
    setState({ revision: game.revision, queue: [...state.queue, ...incoming] });
  }
  const complete = useCallback(() => setState((previous) => ({ ...previous, queue: previous.queue.slice(1) })), []);
  const event = state.queue[0];
  if (!event) return null;
  return <SplendorTransfer key={event.id} boardRef={boardRef} onComplete={complete} playback={event} />;
}
