import { lazy, Suspense, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { MotionConfig } from "motion/react";
import { useAuth } from "../hooks/useAuth";
import { PlayerContext } from "./context";
import { Layout } from "../components/Layout";
import { HomePage } from "../pages/HomePage";
import { GameSelectPage } from "../pages/GameSelectPage";
import { RoomEntryPage } from "../pages/RoomEntryPage";
const RoomPage = lazy(() =>
  import("../pages/RoomPage").then((module) => ({ default: module.RoomPage })),
);
function RoutedApp({ nickname }: { nickname: string }) {
  const location = useLocation();
  if (!nickname && location.pathname !== "/")
    return <Navigate to="/" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/games" element={<GameSelectPage />} />
        <Route path="/create/:gameId" element={<RoomEntryPage />} />
        <Route path="/join" element={<RoomEntryPage join />} />
        <Route
          path="/room/:code"
          element={
            <Suspense fallback={<p role="status">正在讀取房間…</p>}>
              <RoomPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/games" replace />} />
      </Route>
    </Routes>
  );
}
export default function App() {
  const { uid, error } = useAuth();
  const [nickname, setName] = useState(
    () => localStorage.getItem("nickname") ?? "",
  );
  if (error)
    return (
      <main className="setup panel">
        <p className="eyebrow">BOARDGAME CLUB</p>
        <h1>圓桌即將就緒</h1>
        <p role="alert" className="error">
          {error}
        </p>
        <button onClick={() => location.reload()}>重新連線</button>
      </main>
    );
  if (!uid)
    return (
      <main className="setup panel" role="status">
        <h1>正在為你留座…</h1>
        <p className="muted">安全登入中</p>
      </main>
    );
  return (
    <MotionConfig reducedMotion="user">
      <PlayerContext.Provider
        value={{
          uid,
          nickname,
          setNickname: (value) => {
            localStorage.setItem("nickname", value);
            setName(value);
          },
        }}
      >
        <BrowserRouter>
          <RoutedApp nickname={nickname} />
        </BrowserRouter>
      </PlayerContext.Provider>
    </MotionConfig>
  );
}
