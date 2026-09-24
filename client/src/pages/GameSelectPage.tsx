import { MafiaArt } from "../games/mafia/MafiaArt";
import { MineCover } from "../games/saboteur/MineIllustrations";
import { DanceDrawing } from "../games/criminalDance/DanceCard";
import { useState } from "react";
import { LeaderboardDialog } from "../components/LeaderboardDialog";
import "../games/mafia/mafia.css";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Users,
  Swords,
  Timer,
  Sparkles,
  House,
  Gem,
  Trophy,
} from "lucide-react";
import { motion } from "motion/react";
import { games } from "../games/catalog";
export function GameSelectPage() {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const lastRoom = localStorage.getItem("lastRoom");
  return (
    <>
      <section className="page-intro">
        <p className="eyebrow">GATHER YOUR PARTY</p>
        <h1>好戲，從這一桌開始。</h1>
        <p className="muted">
          選一款遊戲，邀朋友入座。剩下的，交給你們的默契。
        </p>
        <button
          className="leaderboard-launch"
          onClick={() => setLeaderboardOpen(true)}
        >
          <Trophy size={19} /> 勝場排行榜 <ArrowRight size={16} />
        </button>
      </section>
      {leaderboardOpen && (
        <LeaderboardDialog onClose={() => setLeaderboardOpen(false)} />
      )}
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
              {game.id === "criminal-dance" ? (
                <DanceDrawing type="DETECTIVE" />
              ) : game.id === "saboteur-2" ? (
                <MineCover />
              ) : game.id === "mafia-de-cuba" ? (
                <MafiaArt kind="box" />
              ) : game.id === "splendor" ? (
                <Gem strokeWidth={0.8} />
              ) : game.id === "decorum" ? (
                <House strokeWidth={0.8} />
              ) : game.id === "avalon" ? (
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
                <span>
                  {game.id === "splendor"
                    ? "寶石 · 收藏 · 策略"
                    : game.id === "decorum"
                      ? "合作 · 佈置 · 默契"
                      : "推理 · 陣營 · 朋友"}
                </span>
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
              {game.supportsBots !== false && (
                <Link
                  className="button practice-link"
                  to={`/create/${game.id}?mode=practice`}
                >
                  單人練習 · 與 AI 對局
                </Link>
              )}
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
