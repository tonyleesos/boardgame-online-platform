import { Link, Outlet } from "react-router-dom";
import { Crown, ShieldCheck, LogOut } from "lucide-react";
import { signOutAccount } from "../firebase/account";
import { useAction } from "../hooks/useAction";
import { emulatorMode } from "../firebase/config";
import { usePlayer } from "../app/context";
export function Layout() {
  const { nickname } = usePlayer();
  const { run, pending, error } = useAction();
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
          <span>{nickname || "會員"}</span>
          {emulatorMode && <small>本機測試</small>}
          <button
            className="quiet account-logout"
            aria-label="登出"
            title="登出"
            disabled={pending}
            onClick={() => void run(signOutAccount)}
          >
            <LogOut size={18} />
          </button>
        </span>
      </header>
      <main>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Outlet />
      </main>
      <footer>
        讓距離留在桌外，讓故事發生在桌上。<span>BOARDGAME CLUB · 圓桌之夜</span>
      </footer>
    </div>
  );
}
