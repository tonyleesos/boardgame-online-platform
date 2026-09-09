import { useRef, useState } from "react";
import { errorMessage } from "../firebase/api";
export function useAction() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return { pending, error, run };
}
