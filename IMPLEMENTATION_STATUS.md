# V2 實作與驗證狀態

對照 `BOARDGAME_PLATFORM_IMPLEMENTATION_SPEC_V2.md`。程式與本機 Emulator 驗證已實作；正式專案設定與部署需另外完成，不能視為已上線。

| Milestone | 實作狀態 | 驗證方式 |
| --- | --- | --- |
| 1. 整理與重構 | React Router、Tailwind、Motion、Lucide、拆分頁面／hooks；保留 Time Bomb；移除 Git 追蹤的 node_modules | build、lint、Git 檢查 |
| 2. Firebase 房間 | 匿名登入、暱稱、目錄、建房／加入、房主、準備、presence、重連及離線清理 | Firebase Emulator 與獨立瀏覽器 |
| 3. Avalon 引擎 | 5–10 人、六種基本角色、知識、任務／表決規則及型別狀態機 | 24 項 Vitest 測試 |
| 4. 私密角色 | 伺服器洗牌、本人身份訂閱、預設拒絕的 RTDB Rules | 跨玩家讀取／偽造寫入皆被拒絕 |
| 5. 完整對局 | 身份、選隊、投票、任務、刺殺、結算、重開局 | 五個獨立瀏覽器完成遊戲；API 驗證十人開局 |
| 6. 完善與設定 | 繁中介面、動態效果、手機版面、錯誤、Hosting／Functions 設定及 README | 五種寬度與 browser pageerror 檢查 |

## 本機驗證

### 2026-09-11：正式站璀璨寶石開桌修復

- 正式專案為 `.firebaserc` 的 `boardgame-online-platfor-c5ebd`，已以正式 API 重現舊版 `createRoom` 回覆「此遊戲尚未開放」HTTP 400。
- 已同步部署 Functions、Realtime Database rules、Hosting，並明確設定 Functions 的亞洲區資料庫 URL。
- 已在正式服務及正式網站的手機尺寸瀏覽器驗證：1 位真人＋2 位 AI 建房、準備、開始、保留暗牌、兩位 AI 自動行動、進入第 2 輪。驗證用房間與匿名帳號已清除。
- 正式規則已確認拒絕未登入讀取、拒絕跨玩家讀取暗牌。先前本機版本「未部署」的記錄僅代表當時狀態。
- 新增 `npm run deploy` 統一建置及部署，並修正 README 與環境範例的正式專案識別。

正式網址：https://boardgame-online-platfor-c5ebd.web.app

### 2026-09-11：璀璨寶石與 AI 練習

- [x] 整合既有目錄、2–4 人房間、伺服器交易、私人暗牌、斷線重連與重開。
- [x] 基礎遊戲：拿取、保留、黃金、付款折扣、退幣、貴族、15 分最後一輪與同分判定。
- [x] 城市、貿易站、東方之路、要塞的獨立原創示範模組與競技模式。
- [x] 原創 SVG 卡牌／寶石、手機與平板市場、固定收藏列、購買預覽及強制階段對話框。
- [x] 單人練習可選 1–3 位 AI、輕鬆／標準難度；朋友房可新增／移除 AI。策略僅看公開資訊與自己的暗牌。
- [x] 全專案 172 項單元測試通過；其中 AI 以五種玩法、兩種難度及 2–4 人跑完 90 組種子開局。
- [x] Firebase Emulator 驗證五種玩法完整對局、1–3 AI 練習房隔離與原子推進、暗牌權限、錯誤動作、重連與重開；既有三套遊戲服務測試也通過。
- [x] 六項璀璨寶石瀏覽器案例通過：2／3／4 人同步、完整雙人及單人 AI 對局、1–3 位 AI、城市／貿易站／東方／要塞介面、競技模式、360／390／768／1280 px。
- [x] 七項 Avalon／驚爆倫敦瀏覽器回歸案例通過。初次遇到未啟動 Emulator 的連線失敗，啟動後重跑通過；競技設定測試改為等待伺服器確認後斷言。
- [x] lint、前後端 build 與 Git whitespace 檢查通過。未部署正式 Firebase。

詳細規則界線與驗證入口見 [璀璨寶石實作說明](docs/SPLENDOR_IMPLEMENTATION.md)。

### 2026-09-11：阿瓦隆與同房異夢更新

- [x] 阿瓦隆終局優先彈出好人／壞人勝利視窗，關閉後保留圓桌身份揭曉，可再次開啟。
- [x] 圓形拇指隊伍表決與長方形聖杯／骷髏任務牌；地圖與戰報同步使用任務圖示。
- [x] 單人練習、好友房補位、離席接手的 AI 均使用隨機名稱＋AI，避免同房重名，交易重試保持名稱一致。
- [x] 同房異夢 D1–D8 的基本功能：四個原創劇本、2–4 真人合作、秘密條件、條件引擎、回合、談心／會議、室友換房、勝負揭曉。
- [x] 圖像心願卡與可展開詳解、房屋佈置前後預覽、表情＋心願卡＋收件人會議、愛心時程、終局房屋縮圖。
- [x] 107 項單元測試；三套 Firebase Emulator 整合測試通過，包含跨玩家私密讀寫拒絕、指定分享、AI 接手與命名。
- [x] 四個同房異夢劇本以 2／3／4 個獨立瀏覽器完成談心／會議、實際佈置、合作勝利與重開，包含重新整理與 360／390／768／1280 px 版面。
- [x] 阿瓦隆五人完整對局、重開與十人版面，以及五次否決、三次失敗、兩種刺殺結局的彈窗優先順序與減少動態效果。
- [x] 14 項瀏覽器案例分批全部通過，包含阿瓦隆及兩版驚爆倫敦的 AI 完整對局；lint、前後端 production build 與 git diff 檢查通過。

詳細模組、規格對照與數位版選擇見 [同房異夢實作狀態](docs/DECORUM_IMPLEMENTATION.md)。本次驗證僅使用 `demo-boardgame` Emulator；未部署正式服務。

### 新增：AI 單人練習與驚爆倫敦

- [x] Avalon、驚爆倫敦的單人練習入口、兩級策略 AI、好友房 AI 補位。
- [x] 驚爆倫敦原版 4–8 人／危機進化 4–6 人獨立入口與 Firebase 遊戲、六色能力、宣言、重洗、勝負及重開。
- [x] 本人陣營與手牌組成分離訂閱，實際牌序僅伺服器可讀。
- [x] 原創蒸汽龐克卡面、逐張圖案手牌、安全引線圖案、六色危險計數、公開歷史、手機版面。
- [x] 62 項單元測試與兩版驚爆倫敦／Avalon Emulator 整合測試。
- [x] 完整瀏覽器驗證：多人 Avalon、單人驚爆倫敦原版／進化、單人 Avalon；包含重連、重開及手機版面。

設計、規則來源、驗證及限制見 [AI 與驚爆倫敦實作說明](docs/AI_TIMEBOMB_IMPLEMENTATION.md)。

- `npm run build`：前端與 Functions 編譯。
- `npm run lint`：前端 ESLint、Functions 嚴格型別檢查。
- `npm test`：規則與狀態機。
- `npm run test:services`：真實 Auth／Database／Functions Emulator，包含雙遊戲、AI、並發操作及 Security Rules。
- `npm run test:e2e`：五個獨立 Edge 瀏覽器 context，透過實際 UI 從建房到終局及重開，再擴充到十位玩家；重新整理保留玩家；360、390、430、768、1280 px 無水平溢出，包含十人與長暱稱。

測試只操作 `demo-boardgame`。截圖在 `.tools/screenshots/`，未加入 Git。

## 尚待正式 Firebase 設定

- [ ] 讓 Firebase CLI 登入可存取 `boardgame-online-platform` 的帳號。
- [ ] 建立 Realtime Database，取得實際 database URL。
- [ ] 啟用 Anonymous Authentication。
- [ ] 將 URL 填入 `client/.env.local` 與 Functions `DATABASE_URL`。
- [ ] 確認 Blaze 與 Functions 部署權限／區域。
- [ ] 部署 database rules、Functions、Hosting。
- [ ] 正式網域再次執行跨裝置驗收。

目前工具原本選取另一個專案，切換本專案時回報無法選取／無權存取。沒有建立新專案、啟用計費、覆蓋其他專案或進行部署。

## 實作選擇

- 使用 npm workspaces 管理 client 與 functions；保留 server 獨立套件。
- 房間／遊戲操作都由 Functions 寫入，以簡化並發與權限。正式環境需要 Functions，僅部署 Hosting 並不足以遊玩。
- presence 與遊戲資料放在同一 session 的不同受保護子節點，讓斷線回復與成員清理也可原子驗證。
- 投票不可修改；全員投完才公開組隊表決，任務票永不逐人公開。
- 預設六種角色全部啟用，角色數量由玩家配置計算。
- 房主離開依加入時間／uid 交接；阿瓦隆／驚爆倫敦由 AI 接手離席座位至終局，同房異夢則中止後由新房主重開。
- 依賴修補使用非破壞性的 `npm audit fix`；整體仍有 15 項 moderate 通報，其中 production 依賴為 11 項，high／critical 為 0。主要位於 Google SDK／Firebase CLI 的間接依賴。重現方式：`npm audit`、`npm audit --omit=dev`。不強制降級至舊版 SDK。

`conductor/` 原有 Time Bomb tracks 保留為歷史規劃；本文件追蹤 V2 Firebase / Avalon 及後續 AI / Time Bomb Evolution 工作。
