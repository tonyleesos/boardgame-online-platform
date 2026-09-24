import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DANCE_MOTION_MS,
  type DanceEvent,
  type DanceGame,
} from "../../../../functions/src/shared/criminalDance";
import { DanceCard } from "./DanceCard";
function Play({
  event,
  game,
  done,
}: {
  event: DanceEvent;
  game: DanceGame;
  done: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const flights = useMemo<
    Array<{ from: string; to?: string; cardId?: string }>
  >(() => {
    if (event.transfers?.length) return event.transfers;
    if (event.kind === "ACK" || event.kind === "LOCK") return [];
    if (event.kind === "DOG" && event.target)
      return [
        { from: event.target, cardId: event.cardId },
        ...(event.cardId === "CRIMINAL-0"
          ? []
          : [{ from: event.actor, to: event.target, cardId: "DOG-0" }]),
      ];
    if (event.kind === "WITNESS" && event.target)
      return [{ from: event.target, to: event.actor }];
    return [{ from: event.actor, to: event.target, cardId: event.cardId }];
  }, [event]);
  useEffect(() => {
    const el = ref.current!;
    el.showPopover?.();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const position = (uid?: string) => {
      const box = uid
        ? document
            .querySelector(`[data-dance-player="${CSS.escape(uid)}"]`)
            ?.getBoundingClientRect()
        : document.querySelector(".cd-center")?.getBoundingClientRect();
      return {
        x: Math.max(
          45,
          Math.min(
            innerWidth - 45,
            box ? box.left + box.width / 2 : innerWidth / 2,
          ),
        ),
        y: Math.max(
          80,
          Math.min(
            innerHeight - 100,
            box ? box.top + box.height / 2 : innerHeight / 2,
          ),
        ),
      };
    };
    const animations = [
      ...el.querySelectorAll<HTMLElement>(".cd-flying-card"),
    ].map((chip, i) => {
      const move = flights[i],
        s = position(move.from),
        t = position(move.to);
      chip.style.left = `${s.x}px`;
      chip.style.top = `${s.y}px`;
      if (reduced) {
        chip.hidden = true;
        return null;
      }
      return chip.animate(
        [
          { transform: "translate(-50%,-50%) scale(.65)", opacity: 0 },
          {
            transform: "translate(-50%,-20%) scale(1)",
            opacity: 1,
            offset: 0.2,
          },
          {
            transform: `translate(calc(-50% + ${t.x - s.x}px),calc(-50% + ${t.y - s.y}px)) scale(1) rotate(${event.kind === "DOG" ? 10 : 0}deg)`,
            opacity: 1,
            offset: 0.8,
          },
          {
            transform: `translate(calc(-50% + ${t.x - s.x}px),calc(-50% + ${t.y - s.y}px)) scale(.8)`,
            opacity: 0,
          },
        ],
        { duration: 2800, easing: "ease-in-out", fill: "both" },
      );
    });
    const timer = setTimeout(done, DANCE_MOTION_MS);
    return () => {
      clearTimeout(timer);
      animations.forEach((a) => a?.cancel());
      if (el.matches(":popover-open")) el.hidePopover?.();
    };
  }, [event, flights, done]);
  return createPortal(
    <div ref={ref} popover="manual" className="cd-playback">
      <div aria-hidden="true">
        {flights.map((flight, i) => (
          <div className="cd-flying-card" key={i}>
            <DanceCard id={flight.cardId} back={!flight.cardId} compact />
          </div>
        ))}
      </div>
      <div className="cd-receipt" role="status">
        <b>{game.players[event.actor]?.nickname}</b>
        <span>{event.text}</span>
      </div>
    </div>,
    document.body,
  );
}
export function DancePlayback({
  game,
  onBusy,
}: {
  game: DanceGame;
  onBusy: (busy: boolean) => void;
}) {
  const [state, setState] = useState<{ revision: number; queue: DanceEvent[] }>(
    { revision: game.revision, queue: [] },
  );
  if (game.revision > state.revision)
    setState({
      revision: game.revision,
      queue: [
        ...state.queue,
        ...game.events.filter((e) => e.revision > state.revision),
      ],
    });
  const done = useCallback(
    () => setState((s) => ({ ...s, queue: s.queue.slice(1) })),
    [],
  );
  const busy = state.queue.length > 0;
  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);
  return state.queue.length ? (
    <Play
      key={state.queue[0].revision}
      event={state.queue[0]}
      game={game}
      done={done}
    />
  ) : null;
}
