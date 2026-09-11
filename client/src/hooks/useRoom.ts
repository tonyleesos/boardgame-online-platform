import { normalizeSplendor } from '../../../functions/src/shared/splendor';
import type { SplendorPrivate } from '../../../functions/src/shared/splendor';
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
  const [decorumPrivate, setDecorumPrivate] = useState<DecorumPrivate | null>(null);
  const [splendorPrivate, setSplendorPrivate] = useState<SplendorPrivate | null>(null);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!firebase) return;
    const db = firebase.database;
    let active = true;
    let connection: ReturnType<typeof ref> | undefined;
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
          setRole(null);
          setBombRole(null);
          setDecorumPrivate(null);
          setSplendorPrivate(null);
        }
      }
    };
    const unsubscribeRoom = onValue(
      ref(db, `sessions/${code}/public`),
      (snap) => {
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
        if (value?.splendor) normalizeSplendor(value.splendor);
        setRoom(value);
        setLoaded(true);
        setError("");
      },
      fail,
    );
    const unsubscribeRole = onValue(
      ref(db, `sessions/${code}/private/${uid}`),
      (snap) => {
        const value = snap.val() as PrivateRole | null;
        if (value) value.knowledge ??= [];
        setRole(value);
      },
      fail,
    );
    const unsubscribePresence = onValue(
      ref(db, `sessions/${code}/presence`),
      (snap) => setPresence(snap.val() ?? {}),
      fail,
    );
    const unsubscribeBomb = onValue(
      ref(db, `sessions/${code}/timebombPrivate/${uid}`),
      (snap) => {
        const value = snap.val() as BombPrivate | null;
        if (value) value.inventory ??= {};
        setBombRole(value);
      },
      fail,
    );
    const unsubscribeDecorum = onValue(
      ref(db, `sessions/${code}/decorumPrivate/${uid}`),
      (snap) => {
        const value = snap.val() as DecorumPrivate | null;
        if (value) { value.conditions ??= []; value.sharedConditionsReceived ??= []; value.sharedConditionIds ??= []; }
        setDecorumPrivate(value);
      }, fail,
    );
    const unsubscribeSplendor = onValue(ref(db, `sessions/${code}/splendorPrivate/${uid}`), snap => { const value = snap.val() as SplendorPrivate | null; if (value) value.reserved ??= {}; setSplendorPrivate(value); }, fail);
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
        })().catch(fail);
      },
      fail,
    );
    return () => {
      active = false;
      unsubscribeRoom();
      unsubscribeRole();
      unsubscribePresence();
      unsubscribeBomb();
      unsubscribeDecorum();
      unsubscribeSplendor();
      unsubscribeConnection();
      if (connection)
        void update(ref(db, `sessions/${code}/presence/${uid}`), {
          [`connections/${connection.key}`]: null,
          lastSeen: serverTimestamp(),
        }).catch(() => {});
    };
  }, [code, uid]);
  return { room, role, bombRole, decorumPrivate, splendorPrivate, presence, connected, loaded, error };
}
