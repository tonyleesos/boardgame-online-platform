import { useEffect, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { GameDialog } from "./GameDialog";
import { usePlayer } from "../app/context";
import {
  errorMessage,
  getLeaderboard,
  refreshLeaderboard,
} from "../firebase/api";
import { games } from "../games/catalog";
import {
  emptyWins,
  type LeaderboardResponse,
  type LeaderboardSort,
} from "../../../functions/src/shared/leaderboard";
import "../games/game-table.css";
import "./leaderboard.css";

export function LeaderboardDialog({ onClose }: { onClose: () => void }) {
  const [sort, setSort] = useState<LeaderboardSort>("total");
  const [revision, setRevision] = useState(0);
  return (
    <GameDialog
      title="勝場排行榜"
      onClose={onClose}
      className="leaderboard-dialog"
    >
      <div className="leaderboard-intro">
        <Trophy size={34} />
        <div>
          <p className="eyebrow">EVERY VICTORY COUNTS</p>
          <h2>每一場勝利，都值得記下。</h2>
          <p className="muted">全站勝場前 5 名 · 查看玩家各遊戲紀錄</p>
        </div>
      </div>
      <div className="leaderboard-toolbar">
        <label>
          排行方式
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as LeaderboardSort)}
          >
            <option value="total">總勝場</option>
            {games
              .filter((g) => g.enabled)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </label>
        <button
          onClick={() => {
            refreshLeaderboard(sort);
            setRevision((v) => v + 1);
          }}
        >
          <RefreshCw size={16} />
          重新整理
        </button>
      </div>
      <LeaderboardResults key={`${sort}:${revision}`} sort={sort} />
      <p className="leaderboard-rules">
        朋友房獲勝的真人玩家每局 +1；合作成功與並列獲勝者皆計分。單人練習、AI
        座位（含離席接手）及中止對局不計入。榜單採短暫快取，勝場可能延遲約 1–2
        分鐘顯示；可按重新整理查看。
      </p>
    </GameDialog>
  );
}

function LeaderboardResults({ sort }: { sort: LeaderboardSort }) {
  const player = usePlayer();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getLeaderboard(sort)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [sort]);
  if (error)
    return (
      <p role="alert" className="error">
        排行榜讀取失敗：{error} 請按「重新整理」重試。
      </p>
    );
  if (!data)
    return (
      <p role="status" className="leaderboard-empty">
        正在載入勝場紀錄…
      </p>
    );
  const self = data.self ?? {
    uid: player.uid,
    nickname: player.nickname,
    totalWins: 0,
    wins: emptyWins(),
  };
  const columns = games.filter((g) => g.enabled);
  return (
    <>
      <div className="leaderboard-self">
        <span>我的累積勝場</span>
        <strong>
          {self.totalWins}
          <small> 勝</small>
        </strong>
        <span>
          {sort === "total"
            ? "繼續入座，寫下下一場勝利。"
            : `${games.find((g) => g.id === sort)?.name} · ${self.wins[sort]} 勝`}
        </span>
      </div>
      {data.entries.length === 0 ? (
        <div className="leaderboard-empty" role="status">
          <Trophy size={32} />
          <h3>第一場勝利，等你寫下。</h3>
          <p>目前還沒有這個榜單的勝場紀錄，邀朋友開一桌吧。</p>
        </div>
      ) : (
        <>
          <p className="fine">
            依勝場由高至低 · 同勝場並列名次 · 最多顯示前 {data.limit}{" "}
            位有勝場的玩家 · 左右滑動查看各遊戲
          </p>
          <div
            className="leaderboard-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="玩家各遊戲勝場明細"
          >
            <table className="leaderboard-table">
              <caption className="sr-only">
                {sort === "total"
                  ? "總勝場"
                  : games.find((g) => g.id === sort)?.name}
                排行榜
              </caption>
              <thead>
                <tr>
                  <th scope="col">名次</th>
                  <th scope="col">玩家</th>
                  <th
                    scope="col"
                    aria-sort={sort === "total" ? "descending" : undefined}
                  >
                    總勝場
                  </th>
                  {columns.map((g) => (
                    <th
                      scope="col"
                      key={g.id}
                      aria-sort={sort === g.id ? "descending" : undefined}
                    >
                      {g.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => {
                  const score =
                    sort === "total" ? entry.totalWins : entry.wins[sort];
                  const rank =
                    data.entries.findIndex(
                      (other) =>
                        (sort === "total"
                          ? other.totalWins
                          : other.wins[sort]) === score,
                    ) + 1;
                  return (
                    <tr
                      key={entry.uid}
                      className={entry.uid === player.uid ? "is-self" : ""}
                    >
                      <td>
                        <span className={`leaderboard-rank rank-${rank}`}>
                          {rank <= 3 && <Trophy size={14} />}
                          {rank}
                        </span>
                      </td>
                      <th scope="row">
                        {entry.nickname}
                        {entry.uid === player.uid && <small> 你</small>}
                      </th>
                      <td className="leaderboard-total">{entry.totalWins}</td>
                      {columns.map((g) => (
                        <td key={g.id}>
                          {
                            entry.wins[
                              g.id as Exclude<LeaderboardSort, "total">
                            ]
                          }
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
