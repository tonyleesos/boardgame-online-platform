import {
  MAFIA_HELP,
  MAFIA_ROLES,
  mafiaSetup,
} from "../../../../functions/src/shared/mafia";
import type { MafiaRole } from "../../../../functions/src/shared/mafia";

export function RumAdvice({ remaining }: { remaining: number }) {
  return (
    <p className="mafia-rum-advice">
      {remaining > 0
        ? `目前有 ${remaining} 瓶美酒。抓錯普通角色時，自動支付 1 瓶，對方不出局，調查繼續；付出最後一瓶也不會立刻結束。酒已用完後再抓錯，教父才失敗。`
        : "目前沒有美酒。下一次抓錯普通角色，遊戲就會立即結束、教父失敗。"}
      抓到探員則立即結束，不能用美酒抵銷。
    </p>
  );
}

export function MafiaRules({
  count,
  cleaner,
}: {
  count: number;
  cleaner: boolean;
}) {
  const setup = mafiaSetup(count, cleaner);
  const tokens = Object.entries(MAFIA_ROLES).flatMap(([role, name]) => {
    const quantity = setup.tokens.filter((token) => token.role === role).length;
    return quantity ? [`${name} ×${quantity}`] : [];
  });
  return (
    <div className="mafia-help">
      <h3>本局配置 · {count} 人（含教父）</h3>
      <p>
        15 顆鑽石、{setup.jokers} 瓶美酒；{tokens.join("、")}。
      </p>
      <p>
        美酒是教父抓錯普通角色時的賠禮，由系統自動支付，不需要按使用按鈕。6–7
        人：0 瓶；8–10 人：1 瓶；11–12 人：2 瓶。想練習付酒後繼續調查，可開 8
        人以上的房間（可含 AI）。
      </p>

      <h3>一、準備與秘密傳盒</h3>
      <ol>
        <li>
          教父秘密保留 0–5 顆鑽石。保留的不是贓物，不必追回；盒子開始傳遞時剩
          10–15 顆。
        </li>
        <li>
          盒子從教父左手邊開始，按畫面順時針傳遞，最後由教父右手邊交回。只有持盒者能看到當前內容。
        </li>
        <li>
          第一位玩家可先將 0 或 1
          枚角色籌碼放進黑色布袋。不能藏鑽石；藏完仍須正常拿取。袋中角色不屬於任何玩家，直到結算才公開。
        </li>
        <li>
          拿至少 1 顆鑽石就成為竊賊；或拿 1
          枚角色籌碼，成為該角色。不能兩者都拿，也不能拿多枚角色。選好後按「確認拿取並傳盒」。
        </li>
        <li>
          一般玩家有東西就必須拿。只有最後一位可主動空手離開；收到空盒也成為街頭混混。仍照常確認傳盒，別公開盒子已空。
        </li>
        <li>
          「我的口袋」可回看自己的角色、收到與傳出的盒子紀錄；這些只有本人看得到，重新整理也會保留。
        </li>
      </ol>

      <h3>二、詢問與正式指控是兩回事</h3>
      <p>
        教父先用「檢查雪茄盒」查看剩餘物品與尚待找回的鑽石。未出局玩家可在討論區說真話、說謊、懷疑別人或保持沉默；口頭承認不會自動公開角色，也不會判定勝負。
      </p>
      <p>
        可詢問：「收到時有幾顆鑽石？」「看見哪些角色？」「傳出時剩什麼？」「你拿了什麼？」比對相鄰玩家的說法，找出矛盾。AI
        適合練習拿取與指控，不會理解或回答文字推理問題。
      </p>
      <p>
        教父點選座位會打開「正式指控」確認視窗。按下「確認指控」才會要求對方交出物品，之後不能換目標。
      </p>
      <ul>
        <li>
          <strong>抓到竊賊：</strong>
          收回他全部的鑽石，該竊賊出局並停止發言；還有鑽石沒找回就繼續調查。
        </li>
        <li>
          <strong>抓錯普通角色：</strong>有酒就自動付 1
          瓶，對方公開身分但仍可討論；沒有酒可付才立即結束。已公開的角色無須再指控。
        </li>
        <li>
          <strong>抓到 FBI／CIA：</strong>
          被指控的那一名探員立即取得主要勝利，另一名探員不會跟著贏，美酒也救不了教父。司機仍須另外結算。
        </li>
      </ul>
      <p>
        例：9 人局有 1 瓶酒。第一次抓錯心腹，酒變 0
        瓶，繼續調查；接著抓到竊賊仍可追回鑽石；之後再抓錯普通角色才結束。6
        人局一開始是 0 瓶，因此第一次抓錯就結束。
      </p>

      <h3>三、每個角色怎麼贏</h3>
      <dl>
        {(Object.keys(MAFIA_ROLES) as MafiaRole[])
          .filter((role) => cleaner || role !== "CLEANER")
          .map((role) => (
            <div key={role}>
              <dt>{MAFIA_ROLES[role]}</dt>
              <dd>{MAFIA_HELP[role]}</dd>
            </div>
          ))}
      </dl>
      <p>
        例如未被抓的竊賊分別持有 2、5、5 顆，教父抓錯且無酒可付時，兩位持有 5
        顆的竊賊與所有街頭混混獲勝；持有 2
        顆者不獲勝。若根本沒有失竊鑽石，盒子回到教父就立即結算教父與心腹勝利。
      </p>
      <p>
        座位方向以玩家面向桌心為準：順時針下一位是左手邊，逆時針前一位是右手邊。司機看座位編號的前一位，第
        1
        位看最後一位；出局不會挪動座位。若右邊也是司機，一直往右追到主要勝者即可連鎖獲勝。
      </p>
      {cleaner && (
        <>
          <h3>四、進階殺手（清道夫）</h3>
          <p>
            本局以 1 枚殺手取代 1 枚心腹。每次正式指控都有 8
            秒反應時間，殺手可秘密開槍或放行；逾時視為放行。射中探員時殺手取得主要勝利，再結算司機；射錯時殺手與目標一起出局，不扣美酒。目標若是竊賊仍須交還全部鑽石，若因此全部追回，教父與心腹立即獲勝。
          </p>
        </>
      )}
    </div>
  );
}
