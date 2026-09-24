import { useEffect, useState } from "react";
import type { Room } from "../../../functions/src/shared/model";
import { advanceBots, errorMessage } from "../firebase/api";
import { MINE_BOT_DELAY } from "../../../functions/src/shared/saboteur";
import {
  DANCE_BOT_DELAY,
  danceToken,
} from "../../../functions/src/shared/criminalDance";
export function useBots(room: Room | null, connected: boolean) {
  const [error, setError] = useState("");
  const code = room?.code;
  const delay =
    room?.gameId === "criminal-dance"
      ? DANCE_BOT_DELAY
      : room?.gameId === "saboteur-2"
        ? MINE_BOT_DELAY
        : 1100;
  const enabled =
    connected &&
    room?.status === "playing" &&
    Object.values(room.players).some((p) => p.isBot);
  const token = room?.dance
    ? danceToken(room.dance)
    : room?.saboteur
      ? `${room.saboteur.id}:${room.saboteur.revision}`
      : room?.game
        ? `${room.game.id}:${room.game.revision}`
        : room?.mafia
          ? `${room.mafia.id}:${room.mafia.revision}`
          : room?.timebomb
            ? `${room.timebomb.id}:${room.timebomb.revision}`
            : room?.splendor
              ? `${room.splendor.id}:${room.splendor.revision}`
              : "";
  useEffect(() => {
    if (!enabled || !code) return;
    let active = true,
      busy = false,
      idle = false;
    const timer = setInterval(() => {
      if (busy || idle) return;
      busy = true;
      advanceBots(code, token)
        .then((result) => {
          if (result.idle) idle = true;
          if (active) setError("");
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        })
        .finally(() => {
          busy = false;
        });
    }, delay);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [code, enabled, token, delay]);
  return error;
}
