import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Crown,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  registerAccount,
  resetAccountPassword,
  signInAccount,
} from "../firebase/account";
import { useAction } from "../hooks/useAction";
import "../auth.css";
export function AuthPage({ mode }: { mode: "login" | "register" | "reset" }) {
  const { state } = useLocation();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false),
    [sent, setSent] = useState(false);
  const { run, pending, error } = useAction();
  const title =
    mode === "login"
      ? "歡迎回到圓桌"
      : mode === "register"
        ? "為自己留一個座位"
        : "找回你的帳號";
  return (
    <div className="auth-shell">
      <header className="auth-brand">
        <Crown size={30} />
        <span>
          圓桌之夜<small>BOARDGAME CLUB</small>
        </span>
      </header>
      <main className="auth-layout">
        <section className="auth-story">
          <div className="auth-table-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <Crown size={64} strokeWidth={1} />
          </div>
          <p className="eyebrow">YOUR NEXT STORY STARTS HERE</p>
          <h1>
            好朋友，
            <br />
            在下一局相見。
          </h1>
          <p>
            登入你的專屬座位，
            <br />
            讓故事從這張圓桌開始。
          </p>
          <span className="auth-assurance">
            <ShieldCheck size={17} />
            註冊會員專屬遊戲空間
          </span>
        </section>
        <section className="panel auth-card">
          <p className="eyebrow">
            {mode === "login"
              ? "WELCOME BACK"
              : mode === "register"
                ? "JOIN THE TABLE"
                : "RESET PASSWORD"}
          </p>
          <h2>{title}</h2>
          <p className="muted">
            {mode === "login"
              ? "使用已註冊的電子郵件與密碼登入。"
              : mode === "register"
                ? "建立帳號後，就能邀朋友一起開桌。"
                : "輸入註冊時使用的電子郵件。"}
          </p>
          {sent ? (
            <div role="status" className="auth-sent">
              <Mail size={36} />
              <h3>請查看你的信箱</h3>
              <p>
                若此信箱已註冊，你將收到重設密碼的郵件，也請檢查垃圾郵件匣。
              </p>
              <Link className="button primary" to="/login">
                返回登入
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (mode === "register") {
                    if (password !== confirm)
                      throw new Error("兩次輸入的密碼不一致");
                    await registerAccount(email, password);
                  } else if (mode === "login")
                    await signInAccount(email, password);
                  else {
                    await resetAccountPassword(email);
                    setSent(true);
                  }
                });
              }}
            >
              <label htmlFor="auth-email">電子郵件</label>
              <div className="auth-input">
                <Mail size={18} />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={pending}
                />
              </div>
              {mode !== "reset" && (
                <>
                  <label htmlFor="auth-password">密碼</label>
                  <div className="auth-input">
                    <LockKeyhole size={18} />
                    <input
                      id="auth-password"
                      type={visible ? "text" : "password"}
                      autoComplete={
                        mode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={mode === "register" ? 8 : undefined}
                      required
                      disabled={pending}
                    />
                    <button
                      type="button"
                      aria-label={visible ? "隱藏密碼" : "顯示密碼"}
                      className="quiet"
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </>
              )}
              {mode === "register" && (
                <>
                  <small className="fine">
                    至少 8 個字元，建議混合英文、數字與符號。
                  </small>
                  <label htmlFor="auth-confirm">確認密碼</label>
                  <div className="auth-input">
                    <LockKeyhole size={18} />
                    <input
                      id="auth-confirm"
                      type={visible ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      minLength={8}
                      required
                      disabled={pending}
                    />
                  </div>
                </>
              )}
              {mode === "login" && (
                <Link className="auth-forgot" to="/reset-password">
                  忘記密碼？
                </Link>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary auth-submit" disabled={pending}>
                {pending
                  ? "處理中…"
                  : mode === "login"
                    ? "登入"
                    : mode === "register"
                      ? "建立帳號"
                      : "寄送重設郵件"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {!sent && (
            <p className="auth-switch">
              {mode === "login" ? (
                <>
                  還沒有帳號？{" "}
                  <Link to="/register" state={state}>
                    註冊帳號
                  </Link>
                </>
              ) : (
                <>
                  {mode === "register" ? "已經有帳號？ " : ""}
                  <Link to="/login" state={state}>
                    返回登入
                  </Link>
                </>
              )}
            </p>
          )}
        </section>
      </main>
      <footer className="auth-footer">
        讓距離留在桌外，讓故事發生在桌上。
      </footer>
    </div>
  );
}
