import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { firebase } from "./config";
function auth() {
  if (!firebase) throw new Error("登入服務尚未設定");
  return firebase.auth;
}
export async function signInAccount(email: string, password: string) {
  const service = auth();
  await setPersistence(service, browserLocalPersistence);
  return signInWithEmailAndPassword(service, email.trim(), password);
}
export async function registerAccount(email: string, password: string) {
  const service = auth();
  await setPersistence(service, browserLocalPersistence);
  return createUserWithEmailAndPassword(service, email.trim(), password);
}
export async function resetAccountPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth(), email.trim());
  } catch (e) {
    if (!(
      e &&
      typeof e === "object" &&
      "code" in e &&
      e.code === "auth/user-not-found"
    ))
      throw e;
  }
}
export async function signOutAccount() {
  await signOut(auth());
  localStorage.removeItem("lastRoom");
  localStorage.removeItem("nickname");
}
export function safeReturnPath(value: unknown) {
  return typeof value === "string" &&
    /^\/(games|join|room\/[A-HJ-NP-Z2-9]{6}|create\/[a-z-]+)(\?[^#]*)?$/.test(
      value,
    )
    ? value
    : "/games";
}
