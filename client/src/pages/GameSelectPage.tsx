import { Link } from "react-router-dom";
import { ArrowRight, Users, Swords, Timer, Sparkles, House } from "lucide-react";
import { motion } from "motion/react";
import { games } from "../games/catalog";
export function GameSelectPage() {
  const lastRoom = localStorage.getItem("lastRoom");
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow">GATHER YOUR PARTY</p>
        <h1>好戲，從這一桌開始。</h1>
        <p className="muted">
          選一款遊戲，邀朋友入座。剩下的，交給你們的默契。
        </p>
      </section>
      {lastRoom && (
        <p>
          <Link className="button" to={`/room/${lastRoom}`}>
            返回上次的房間 · {lastRoom}
          </Link>
        </p>
      )}
      <div className="catalog">
        {games.map((game, i) => (
          <motion.article
            key={game.id}
            className={`game-card ${game.id}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="game-art">
              <span className="tag">
                {game.enabled ? (
                  <>
                    <Sparkles size={13} />
                    今晚開玩
                  </>
                ) : (
                  "即將登場"
                )}
              </span>
              {game.id === "decorum" ? <House strokeWidth={.8} /> : game.id === "avalon" ? (
                <Swords strokeWidth={0.7} />
              ) : (
                <Timer strokeWidth={0.7} />
              )}
              {game.id.startsWith("timebomb") && <div className="bomb-cover" />}
              <div className="art-rings" />
            </div>
            <div className="game-copy">
              <p className="eyebrow">{game.subtitle}</p>
              <h2>{game.name}</h2>
              <p className="muted">{game.description}</p>
              <p className="meta">
                <Users size={16} />
                {game.minPlayers}–{game.maxPlayers} 人
                <span>{game.id === "decorum" ? "合作 · 佈置 · 默契" : "推理 · 陣營 · 朋友"}</span>
              </p>
              {game.enabled ? (
                <div className="actions">
                  <Link className="button primary" to={`/create/${game.id}`}>
                    建立房間
                    <ArrowRight size={17} />
                  </Link>
                  <Link className="button" to="/join">
                    加入房間
                  </Link>
                </div>
              ) : (
                <button disabled>敬請期待</button>
              )}
              {game.supportsBots !== false && <Link
                className="button practice-link"
                to={`/create/${game.id}?mode=practice`}
              >
                單人練習 · 與 AI 對局
              </Link>}
            </div>
          </motion.article>
        ))}
      </div>
      <aside className="tip">
        <ShieldIcon />
        每個身份都有秘密，每一票都會改變故事。建議搭配語音通話一起遊玩。
      </aside>
    </>
  );
}
function ShieldIcon() {
  return <Swords size={20} />;
}
