import { useState } from "react";
import { usePlayer } from "../app/context";
import { useAction } from "../hooks/useAction";
import { GameDialog } from "./GameDialog";
import "../games/game-table.css";

export function NicknameDialog({ onClose }: { onClose: () => void }) {
  const player = usePlayer();
  const [name, setName] = useState(player.nickname);
  const { run, pending, error } = useAction();
  return (
    <GameDialog title="修改暱稱" onClose={onClose} dismissible={!pending}>
      <h2>讓大家記住你的名字</h2>
      <p className="muted">
        新暱稱會儲存在你的帳號，保留所有累積勝場。已進行中的房間會在下次入座時使用新暱稱。
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await player.setNickname(name);
            onClose();
          });
        }}
      >
        <label htmlFor="account-nickname">新暱稱</label>
        <input
          id="account-nickname"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={20}
          required
          disabled={pending}
          autoComplete="nickname"
        />
        <small className="muted">
          1–20 個字；排行榜會於下次讀取時更新暱稱。
        </small>
        {error && (
          <p className="error" role="alert">
            暱稱儲存失敗：{error}
          </p>
        )}
        <button
          className="primary"
          disabled={pending || !name.trim() || name.trim() === player.nickname}
        >
          {pending ? "正在儲存…" : "儲存暱稱"}
        </button>
        <button type="button" disabled={pending} onClick={onClose}>
          取消
        </button>
      </form>
    </GameDialog>
  );
}
