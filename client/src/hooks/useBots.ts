import { useEffect, useState } from "react";
import type { Room } from "../../../functions/src/shared/model";
import { advanceBots, errorMessage } from "../firebase/api";
export function useBots(room: Room | null, connected: boolean) {
  const [error, setError] = useState("");
  const code = room?.code;
  const enabled =
    connected &&
    room?.status === "playing" &&
    Object.values(room.players).some((p) => p.isBot);
  const token = room?.game
    ? `${room.game.id}:${room.game.revision}`
    : room?.timebomb
      ? `${room.timebomb.id}:${room.timebomb.revision}`
      : room?.splendor ? `${room.splendor.id}:${room.splendor.revision}` : "";
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
    }, 1100);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [code, enabled, token]);
  return error;
}
