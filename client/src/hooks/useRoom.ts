import {
  normalizeMafia,
  type MafiaPrivate,
} from "../../../functions/src/shared/mafia";
import { normalizeSplendor } from "../../../functions/src/shared/splendor";
import type { SplendorPrivate } from "../../../functions/src/shared/splendor";
import {
  normalizeMine,
  normalizeMinePrivate,
  type MinePrivate,
} from "../../../functions/src/shared/saboteur";
import {
  normalizeDance,
  normalizeDancePrivate,
  type DancePrivate,
} from "../../../functions/src/shared/criminalDance";
import { useEffect, useState } from "react";
import {
  onValue,
  onDisconnect,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { firebase } from "../firebase/config";
import { errorMessage } from "../firebase/api";
import type { PrivateRole, Room } from "../../../functions/src/shared/model";
import type { BombPrivate } from "../../../functions/src/shared/timebomb";
import { normalizeDecorum } from "../../../functions/src/shared/decorum";
import type { DecorumPrivate } from "../../../functions/src/shared/decorum";
export interface Presence {
  connections?: Record<string, boolean>;
  lastSeen?: number;
}
export function useRoom(code: string, uid: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [role, setRole] = useState<PrivateRole | null>(null);
  const [bombRole, setBombRole] = useState<BombPrivate | null>(null);
  const [decorumPrivate, setDecorumPrivate] = useState<DecorumPrivate | null>(
    null,
  );
  const [mafiaPrivate, setMafiaPrivate] = useState<MafiaPrivate | null>(null);
  const [saboteurPrivate, setSaboteurPrivate] = useState<MinePrivate | null>(
    null,
  );
  const [dancePrivate, setDancePrivate] = useState<DancePrivate | null>(null);
  const [splendorPrivate, setSplendorPrivate] =
    useState<SplendorPrivate | null>(null);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [privateError, setPrivateError] = useState("");
  const [presenceError, setPresenceError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!firebase) return;
    const db = firebase.database;
    let active = true;
    let connection: ReturnType<typeof ref> | undefined;
    let unsubscribePrivate: (() => void) | undefined;
    let privatePath: string | undefined;
    const clearPrivate = () => {
      setRole(null);
      setBombRole(null);
      setDecorumPrivate(null);
      setSplendorPrivate(null);
      setMafiaPrivate(null);
      setSaboteurPrivate(null);
      setDancePrivate(null);
    };
    const fail = (e: unknown) => {
      if (active) {
        setError(errorMessage(e));
        setLoaded(true);
        if (
          e &&
          typeof e === "object" &&
          "code" in e &&
          String(e.code).toUpperCase().includes("PERMISSION")
        ) {
          setRoom(null);
          clearPrivate();
          unsubscribePrivate?.();
          unsubscribePrivate = undefined;
          privatePath = undefined;
        }
      }
    };
    const unsubscribeRoom = onValue(
      ref(db, `sessions/${code}/public`),
      (snap) => {
        if (!active) return;
        const value = snap.val() as Room | null;
        if (value?.decorum) normalizeDecorum(value.decorum);
        if (value?.game) {
          value.game.selectedPlayerIds ??= [];
          value.game.missionResults ??= [];
          value.game.revealed ??= {};
          value.game.submitted ??= {};
        }
        if (value?.timebomb) {
          const g = value.timebomb;
          g.colors ??= [];
          g.hands ??= {};
          g.claims ??= {};
          g.confirmed ??= {};
          g.bombs ??= {};
          g.defused ??= {};
          g.history ??= [];
          for (const id of g.order) g.hands[id] ??= [];
        }
        if (value?.mafia) normalizeMafia(value.mafia);
        if (value?.splendor) normalizeSplendor(value.splendor);
        if (value?.saboteur) normalizeMine(value.saboteur);
        if (value?.dance) normalizeDance(value.dance);
        const member = value?.players?.[uid];
        const branches: Record<string, string> = {
          avalon: "private",
          timebomb: "timebombPrivate",
          "timebomb-classic": "timebombPrivate",
          decorum: "decorumPrivate",
          splendor: "splendorPrivate",
          "saboteur-2": "saboteurPrivate",
          "criminal-dance": "dancePrivate",
          "mafia-de-cuba": "mafiaPrivate",
        };
        const branch =
          value && value.status !== "waiting" && member && !member.isBot
            ? branches[value.gameId]
            : undefined;
        if (branch !== privatePath) {
          unsubscribePrivate?.();
          unsubscribePrivate = undefined;
          privatePath = branch;
          clearPrivate();
          setPrivateError("");
          if (branch)
            unsubscribePrivate = onValue(
              ref(db, `sessions/${code}/${branch}/${uid}`),
              (privateSnap) => {
                if (!active || privatePath !== branch) return;
                setPrivateError("");
                const data = privateSnap.val();
                switch (branch) {
                  case "dancePrivate":
                    setDancePrivate(
                      data ? normalizeDancePrivate(data as DancePrivate) : null,
                    );
                    break;
                  case "saboteurPrivate":
                    setSaboteurPrivate(
                      data ? normalizeMinePrivate(data as MinePrivate) : null,
                    );
                    break;
                  case "private": {
                    const p = data as PrivateRole | null;
                    if (p) p.knowledge ??= [];
                    setRole(p);
                    break;
                  }
                  case "timebombPrivate": {
                    const p = data as BombPrivate | null;
                    if (p) p.inventory ??= {};
                    setBombRole(p);
                    break;
                  }
                  case "decorumPrivate": {
                    const p = data as DecorumPrivate | null;
                    if (p) {
                      p.conditions ??= [];
                      p.sharedConditionsReceived ??= [];
                      p.sharedConditionIds ??= [];
                    }
                    setDecorumPrivate(p);
                    break;
                  }
                  case "splendorPrivate": {
                    const p = data as SplendorPrivate | null;
                    if (p) p.reserved ??= {};
                    setSplendorPrivate(p);
                    break;
                  }
                  case "mafiaPrivate": {
                    const p = data as MafiaPrivate | null;
                    if (p?.currentBoxView) p.currentBoxView.tokens ??= [];
                    setMafiaPrivate(p);
                    break;
                  }
                }
              },
              () => {
                if (!active || privatePath !== branch) return;
                clearPrivate();
                setPrivateError(
                  "私人資料暫時無法讀取。你的座位已保留，請重新載入私人資料。",
                );
              },
            );
        }
        setRoom(value);
        setLoaded(true);
        setError("");
      },
      fail,
    );
    const presenceFail = (e: unknown) => {
      if (active) setPresenceError(errorMessage(e));
    };
    const unsubscribePresence = onValue(
      ref(db, `sessions/${code}/presence`),
      (snap) => {
        if (active) {
          setPresence(snap.val() ?? {});
          setPresenceError("");
        }
      },
      presenceFail,
    );
    const unsubscribeConnection = onValue(
      ref(db, ".info/connected"),
      (snap) => {
        const online = snap.val() === true;
        setConnected(online);
        if (!online) return;
        connection = push(
          ref(db, `sessions/${code}/presence/${uid}/connections`),
        );
        const current = connection;
        const lastSeen = ref(db, `sessions/${code}/presence/${uid}/lastSeen`);
        void (async () => {
          await onDisconnect(current).remove();
          await onDisconnect(lastSeen).set(serverTimestamp());
          if (active) {
            await set(current, true);
            await set(lastSeen, serverTimestamp());
          } else {
            await onDisconnect(current).cancel();
            await remove(current);
          }
        })().catch(presenceFail);
      },
      presenceFail,
    );
    return () => {
      active = false;
      unsubscribeRoom();
      unsubscribePrivate?.();
      unsubscribePresence();
      unsubscribeConnection();
      if (connection)
        void update(ref(db, `sessions/${code}/presence/${uid}`), {
          [`connections/${connection.key}`]: null,
          lastSeen: serverTimestamp(),
        }).catch(() => {});
    };
  }, [code, uid, attempt]);
  return {
    room,
    role,
    bombRole,
    mafiaPrivate,
    decorumPrivate,
    splendorPrivate,
    saboteurPrivate,
    dancePrivate,
    presence,
    connected,
    loaded,
    error: error || privateError || presenceError,
    privateError,
    retry: () => setAttempt((n) => n + 1),
  };
}
