import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { safeReturnPath } from "../firebase/account";
import { ArrowRight, Crown } from "lucide-react";
import { motion } from "motion/react";
import { usePlayer } from "../app/context";
export function HomePage() {
  const player = usePlayer();
  const [name, setName] = useState(player.nickname);
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <motion.section
      className="welcome panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Crown size={52} className="gold" />
      <p className="eyebrow">YOUR SEAT AT THE TABLE</p>
      <h1>
        今晚，
        <br />
        你相信誰？
      </h1>
      <p className="muted">
        和朋友相聚圓桌，在每一場遊戲裡
        <br />
        交換線索、試探謊言、守護你的秘密。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            player.setNickname(name.trim());
            navigate(safeReturnPath(location.state?.from));
          }
        }}
      >
        <label htmlFor="nickname">讓大家認識你</label>
        <input
          id="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="輸入你的暱稱"
          required
        />
        <button className="primary" disabled={!name.trim()}>
          入座，開始冒險
          <ArrowRight size={18} />
        </button>
      </form>
      <small className="muted">已登入會員 · 分享房號邀朋友一起玩</small>
    </motion.section>
  );
}
