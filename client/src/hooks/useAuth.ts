import { useEffect, useState } from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
} from "firebase/auth";
import { firebase, configError } from "../firebase/config";
import { errorMessage } from "../firebase/api";
let signingIn: Promise<unknown> | undefined;
export function useAuth() {
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(configError);
  useEffect(() => {
    const auth = firebase?.auth;
    if (!auth) return;
    let active = true;
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (active) setUid(user?.uid ?? null);
      },
      (e) => {
        if (active) setError(errorMessage(e));
      },
    );
    signingIn ??= setPersistence(auth, browserLocalPersistence)
      .then(() => auth.authStateReady())
      .then(async () => {
        if (!auth.currentUser) await signInAnonymously(auth);
      })
      .finally(() => {
        signingIn = undefined;
      });
    signingIn.catch((e) => {
      if (active) setError(errorMessage(e));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return { uid, error };
}
