import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

export const emulatorMode = import.meta.env.MODE === "emulator";
const env = import.meta.env;
const firebaseConfig = emulatorMode
  ? {
      apiKey: "demo-key",
      authDomain: "demo-boardgame.firebaseapp.com",
      projectId: "demo-boardgame",
      databaseURL: "https://demo-boardgame-default-rtdb.firebaseio.com",
      appId: "demo-app",
    }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: env.VITE_FIREBASE_DATABASE_URL,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
const missing = Object.entries({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  databaseURL: firebaseConfig.databaseURL,
  appId: firebaseConfig.appId,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);
export let configError = missing.length
  ? `Firebase 設定尚未完成：缺少 ${missing.join("、")}。請依 README 設定 client/.env.local，或使用 npm run dev:emulator 啟動本機測試。`
  : null;
function initialize() {
  if (configError) return null;
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getDatabase(app);
  const functions = getFunctions(
    app,
    env.VITE_FIREBASE_FUNCTIONS_REGION || "asia-east1",
  );
  if (emulatorMode) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectDatabaseEmulator(database, "127.0.0.1", 9000);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  return { app, auth, database, functions };
}
export const firebase = (() => {
  try {
    return initialize();
  } catch (error) {
    configError = `Firebase 初始化失敗，請檢查 client/.env.local 的設定格式。${error instanceof Error ? error.message : ""}`;
    return null;
  }
})();
