# 血與刃的白薔薇：實作與驗證

2026-09-25。本次完成本機程式與測試，尚未部署正式站。

## 可用內容

- 平台遊戲目錄、朋友房、準備／開局、斷線重連、再開一局。
- 八人完整遊戲：私密身分、三張手牌、夜晚相認、雙刃換牌、金幣、水晶、出牌／跳過、匿名洗牌、計分、立即及最終勝負。
- 12 種水晶，包括綁定出牌依賴、私密隨機查看、暗刃情報、出牌後換牌。
- AI 練習：1 位玩家 + 7 位 AI；輕鬆／標準兩種難度。朋友房也能加入 AI。
- AI 決策函式只接收公開狀態和該 AI 的私人資料，無法查看其他玩家資料或貢獻來源。發言不公開出牌／跳過、未使用水晶號碼或私密情報。
- 65:100 比例原創 SVG 卡片、祭壇、雙方計分軌、金幣、水晶；手機放大手牌、横滑座位、桌機牌桌。
- 一般動作約 650ms、出牌飛行約 900ms、分批翻牌約 1–2 秒；快速模式與系統減少動態效果。
- 既有登入機制保持不變：平台現行為 email/password 會員登入，沒有另開匿名登入。

## 資料與安全

沿用既有 Cloud Functions 與 RTDB 根交易：

| 路徑 | 內容／存取 |
| --- | --- |
| `sessions/{code}/public/rose` | 房內玩家可讀的牌桌、完成狀態、匿名翻牌與結算 |
| `sessions/{code}/rosePrivate/{uid}` | 本人身分、手牌、水晶、合法情報；只有對應真人 uid 可讀 |
| `sessions/{code}/secret/rose` | 出牌來源、備用牌、綁定限制、請求去重；客戶端無權讀寫 |

所有牌局寫入由伺服器處理。每個操作驗證身分、階段、輪序、牌權、效果限制與含版本的 phaseToken。actionId 收據讓重送不會重複執行；不同分頁用過期版本送出動作會被拒絕。

正常翻牌只有新的 revealId 和牌型。水晶 2 才包含出牌者；此時 UI 也不演出洗牌。決定期間凍結公開手牌張數，避免從數量變化推知出牌／跳過。出牌對應表在結算後清空。水晶 11 未確認的查看可重連恢復，確認後刪除。

暫時離線保留座位；明確離開會中止本局，不把秘密身分轉交代打。此行為會在離房視窗說明。

## 人數與規則核對

規則資料集中在 `functions/src/shared/bladesRose.ts` 的 `PLAYER_COUNT_RULES`。

| 人數 | 身分配置 | 白方安全花苞門檻 | 血刃擊殺門檻 | 開放 |
| --- | --- | --- | --- | --- |
| 5、6、7、9、10 | 未填入，待官方圖板 | 待核對 | 待核對 | 否 |
| 8 | 白薔薇 1、司教 1、信者 3、雙刃 1、巨刃 1、暗刃 1 | 5，且白薔薇安全獻祭 | 6，或擊殺白薔薇 | 是 |

八人值採用使用者提供規格 §25 的 verified fixture，並在資料 verificationNote 註明來源；本次沒有獨立取得清楚的官方圖板。其餘人數沒有推算數字，朋友房會阻止開局，AI 人數選單只提供八人。

核對時查閱 [Moaideas 官方遊戲頁](https://www.jp.moaideas.net/bladerose)，確認有官方說明書連結；該 PDF 約 90 MB，瀏覽讀取工具無法處理。正式宣稱全 5–10 人支援前，仍需取得相應圖板的六種角色數量及雙方門檻。

水晶 3／4 的可跳過語意、5 的順序依賴、10 的目標選擇替換牌、12 與 1 相同效果，以及終局檢查白方手中花朵，採用提供規格中的數位契約。若實體版本有差異，須以清楚的魔法書／說明書修訂與增補測試。

## 驗證

- `npm test`：18 個檔案、472 項全部通過；其中本遊戲 49 項。
- AI 單元測試在兩種難度各完成 40 場 seeded 對局，共 80 場，驗證合法行動與結束性。
- `node tests/blades-rose-integration.mjs`：本次 497 項 Emulator 檢查通過，包含八位會員完整對局、跨 uid／未登入／外人拒讀、直接寫入拒絕、重複操作、並行競爭、重開、真人與七位 AI 完整練習對局。由於隨機對局長度不同，每次檢查總數可能不同。
- `npx playwright test tests/browser/blades-rose.spec.ts`：兩項通過；360px／1440px、兩個獨立登入、開局、私人視窗、出牌、來源翻牌、重連、減少動態效果、AI 練習入口與自動推進。
- `npm run lint`、`npm run build`：通過。
- 截圖：`.tools/screenshots/blades-rose-mobile.png`、`.tools/screenshots/blades-rose-desktop.png`（本機驗證產物，不加入 Git）。

## 開發與後續發佈

主要新增檔案：

- `functions/src/shared/bladesRose.ts`：型別、規則資料、卡片／技能定義、序列化正規化。
- `functions/src/bladesRose/engine.ts`：可信遊戲引擎。
- `functions/src/bladesRose/bot.ts`：有限資訊 AI。
- `client/src/games/blades-and-rose/`：牌桌、原創卡片與響應式樣式。
- `tests/blades-rose.test.ts`、`tests/blades-rose-integration.mjs`、`tests/browser/blades-rose.spec.ts`。

啟動本機 Emulator 後執行 `npm run dev:emulator`；遊戲目錄選「血與刃的白薔薇」，可建立朋友房或 AI 練習桌。單獨規則測試為 `npm run test:blades-rose`，Emulator 已啟動時可執行 `npm run test:blades-rose:services`。

本次環境的 Java 在 `C:/Program Files/Android/Android Studio/jbr`；啟動 Emulator 時需將其 `bin` 加入該程序的 PATH。本機 HTTP／HTTPS proxy 會阻礙 RTDB emulator，測試啟動程序移除 proxy 環境變數後正常，沒有修改全機設定。

正式發佈必須同步更新 Functions、Database Rules、Hosting。這次未執行部署，也未變更正式資料。
