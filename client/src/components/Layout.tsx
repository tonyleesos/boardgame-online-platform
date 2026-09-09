import { Link, Outlet } from "react-router-dom";
import { Crown, ShieldCheck } from "lucide-react";
import { emulatorMode } from "../firebase/config";
import { usePlayer } from "../app/context";
export function Layout() {
  const { nickname } = usePlayer();
  return (
    <div className="site">
      <header className="site-header">
        <Link to="/games" className="brand">
          <Crown size={26} />
          <span>
            圓桌之夜<small>BOARDGAME CLUB</small>
          </span>
        </Link>
        <span className="profile">
          <ShieldCheck size={16} />
          {nickname || "旅人"}
          {emulatorMode && <small>本機測試</small>}
        </span>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        讓距離留在桌外，讓故事發生在桌上。<span>BOARDGAME CLUB · 圓桌之夜</span>
      </footer>
    </div>
  );
}
