import { useEffect, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { firebase, configError } from "../firebase/config";
import { errorMessage } from "../firebase/api";
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(configError);
  useEffect(() => {
    if (!firebase) return;
    let active = true,
      version = 0;
    const unsubscribe = onIdTokenChanged(
      firebase.auth,
      async (current) => {
        const revision = ++version;
        try {
          const token =
            current && !current.isAnonymous
              ? await current.getIdTokenResult()
              : null;
          if (!active || revision !== version) return;
          setUser(
            token?.signInProvider === "password" && current?.email
              ? current
              : null,
          );
          setLoaded(true);
          setError(null);
        } catch (e) {
          if (active && revision === version) {
            setUser(null);
            setLoaded(true);
            setError(errorMessage(e));
          }
        }
      },
      (e) => {
        if (active) {
          setUser(null);
          setLoaded(true);
          setError(errorMessage(e));
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return { user, loaded, error };
}
