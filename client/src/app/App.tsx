import { lazy, Suspense, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { MotionConfig } from "motion/react";
import type { User } from "firebase/auth";
import { useAuth } from "../hooks/useAuth";
import { PlayerContext } from "./context";
import { Layout } from "../components/Layout";
import { HomePage } from "../pages/HomePage";
import { AuthPage } from "../pages/AuthPage";
import { GameSelectPage } from "../pages/GameSelectPage";
import { RoomEntryPage } from "../pages/RoomEntryPage";
import { safeReturnPath } from "../firebase/account";
const RoomPage = lazy(() =>
  import("../pages/RoomPage").then((module) => ({ default: module.RoomPage })),
);
function GuestRoutes() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route
        path="/register"
        element={<AuthPage key="register" mode="register" />}
      />
      <Route
        path="/reset-password"
        element={<AuthPage key="reset" mode="reset" />}
      />
      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
            state={{
              from: safeReturnPath(location.pathname + location.search),
            }}
          />
        }
      />
    </Routes>
  );
}
function MemberRoutes({ user }: { user: User }) {
  const [nickname, setName] = useState(
    () => localStorage.getItem(`nickname:${user.uid}`) ?? "",
  );
  const location = useLocation();
  const destination = safeReturnPath(
    location.state?.from ?? location.pathname + location.search,
  );
  if (!nickname && location.pathname !== "/")
    return <Navigate to="/" replace state={{ from: destination }} />;
  return (
    <PlayerContext.Provider
      value={{
        uid: user.uid,
        nickname,
        setNickname: (value) => {
          localStorage.setItem(`nickname:${user.uid}`, value);
          setName(value);
        },
      }}
    >
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
          <Route path="*" element={<Navigate to={destination} replace />} />
        </Route>
      </Routes>
    </PlayerContext.Provider>
  );
}
export default function App() {
  const { user, loaded, error } = useAuth();
  if (error)
    return (
      <main className="setup panel">
        <h1>登入服務暫時無法連線</h1>
        <p role="alert" className="error">
          {error}
        </p>
        <button onClick={() => location.reload()}>重新連線</button>
      </main>
    );
  if (!loaded)
    return (
      <main className="setup panel" role="status">
        <h1>正在確認登入狀態…</h1>
      </main>
    );
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        {user ? <MemberRoutes key={user.uid} user={user} /> : <GuestRoutes />}
      </BrowserRouter>
    </MotionConfig>
  );
}
