import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, DoorOpen } from "lucide-react";
import { usePlayer } from "../app/context";
import { createRoom, joinRoom } from "../firebase/api";
import { useAction } from "../hooks/useAction";
import { games } from "../games/catalog";
export function RoomEntryPage({ join = false }: { join?: boolean }) {
  const { nickname } = usePlayer();
  const { gameId = "avalon" } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const { pending, error, run } = useAction();
  const game = games.find((g) => g.id === gameId && g.enabled);
  const [params] = useSearchParams();
  const practice = !join && game?.supportsBots !== false && params.get("mode") === "practice";
  const [playerCount, setPlayerCount] = useState(game?.minPlayers ?? 5);
  const [botLevel, setBotLevel] = useState<"casual" | "standard">("standard");
  return (
    <section className="panel entry">
      <Link className="back" to="/games">
        <ArrowLeft size={16} />
        返回遊戲大廳
      </Link>
      <DoorOpen size={36} className="gold" />
      <p className="eyebrow">{join ? "JOIN THE TABLE" : "HOST A NIGHT"}</p>
      <h1>
        {join
          ? "朋友在等你。"
          : practice
            ? "一個人，也能開一桌。"
            : "為冒險留一張桌。"}
      </h1>
      <p className="muted">
        {join
          ? "輸入朋友分享的六碼房號，即可入座。"
          : `${game?.name ?? "遊戲未開放"} · ${game?.minPlayers}–${game?.maxPlayers} 人。${practice ? "AI 會補滿其他座位。" : "建立後將房號分享給朋友。"}`}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const room = join
              ? await joinRoom(nickname, code)
              : await createRoom(nickname, gameId, {
                  mode: practice ? "practice" : "friends",
                  playerCount,
                  botLevel,
                });
            localStorage.setItem("lastRoom", room.code);
            navigate(`/room/${room.code}`);
          });
        }}
      >
        {practice && (
          <>
            <label htmlFor="table-size">對局人數（包含你）</label>
            <select
              id="table-size"
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
            >
              {Array.from(
                {
                  length: (game?.maxPlayers ?? 5) - (game?.minPlayers ?? 5) + 1,
                },
                (_, i) => (game?.minPlayers ?? 5) + i,
              ).map((n) => (
                <option key={n} value={n}>
                  1 位玩家 ＋ {n - 1} 位 AI
                </option>
              ))}
            </select>
            <label htmlFor="bot-level">AI 難度</label>
            <select
              id="bot-level"
              value={botLevel}
              onChange={(e) =>
                setBotLevel(e.target.value as "casual" | "standard")
              }
            >
              <option value="casual">輕鬆 · 更多隨機選擇</option>
              <option value="standard">標準 · 參考公開紀錄推理</option>
            </select>
            <p className="fine">
              策略型 AI
              只知道自己的情報，不會偷看你的身份或牌序。發言可能是虛張聲勢。
            </p>
          </>
        )}
        {!join && gameId.startsWith("timebomb") && (
          <p className="edition-note">
            {gameId === "timebomb-classic"
              ? "原版規則 · 一顆炸彈，翻開即引爆"
              : "危機進化 · 六色炸彈與拆除保護"}
          </p>
        )}
        {join && (
          <>
            <label htmlFor="code">房間代碼</label>
            <input
              className="code-input"
              id="code"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="ABC234"
              required
              pattern="[A-HJ-NP-Z2-9]{6}"
            />
          </>
        )}
        <button
          className="primary"
          disabled={pending || (join ? code.length !== 6 : !game)}
        >
          {pending
            ? "正在連線…"
            : join
              ? "加入房間"
              : practice
                ? "建立練習桌"
                : "建立房間"}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
