export interface GameDefinition {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  enabled: boolean;
  supportsBots?: boolean;
}
export const games: GameDefinition[] = [
  {
    id: "criminal-dance",
    name: "犯人在跳舞",
    subtitle: "一場不斷換手的追捕",
    description:
      "犯人藏在手牌裡，隨交易與謠言悄悄換人。抓住線索，或讓最後一張犯人牌成功逃脫。",
    minPlayers: 3,
    maxPlayers: 8,
    enabled: true,
    supportsBots: true,
  },
  {
    id: "saboteur-2",
    name: "矮人礦坑 2",
    subtitle: "SABOTEUR 2 · INTO THE MINE",
    description:
      "一條通往黃金的礦道，藏著各懷心思的矮人。鋪路、設陷阱，三輪後誰能帶走最多金塊？建議 5–8 人。",
    minPlayers: 2,
    maxPlayers: 12,
    enabled: true,
    supportsBots: true,
  },
  {
    id: "mafia-de-cuba",
    name: "教父風雲：危情古巴",
    subtitle: "MAFIA DE CUBA · HAVANA 1955",
    description:
      "雪茄盒沿桌傳遞，鑽石悄悄入袋。誰是忠心手下，誰又藏著另一個身分？",
    minPlayers: 6,
    maxPlayers: 12,
    enabled: true,
    supportsBots: true,
  },
  {
    id: "splendor",
    name: "璀璨寶石",
    subtitle: "SPLENDOR · THE GEM ATELIER",
    description: "從一枚寶石，到一座珠寶王國。收集、打造，讓你的收藏閃耀全場。",
    minPlayers: 2,
    maxPlayers: 4,
    enabled: true,
    supportsBots: true,
  },
  {
    id: "decorum",
    name: "同房異夢",
    subtitle: "DÉCORUM · A HOME FOR ALL",
    description:
      "一個家，幾種理想生活。用一次次佈置與小小回應，找到室友之間的默契。",
    minPlayers: 2,
    maxPlayers: 4,
    enabled: true,
    supportsBots: false,
  },
  {
    id: "avalon",
    name: "阿瓦隆",
    subtitle: "忠誠與謊言的圓桌對決",
    description: "信任，是圓桌上最危險的賭注。在忠誠與謊言之間，找出你的盟友。",
    minPlayers: 5,
    maxPlayers: 10,
    enabled: true,
  },
  {
    id: "timebomb",
    name: "驚爆倫敦：危機進化",
    subtitle: "TIME BOMB EVOLUTION",
    description:
      "六色炸彈，各有危機。拆除保護、連續引爆與指定剪線，考驗每一步推理。",
    minPlayers: 4,
    maxPlayers: 6,
    enabled: true,
  },
  {
    id: "timebomb-classic",
    name: "驚爆倫敦",
    subtitle: "TIME BOMB · ORIGINAL",
    description:
      "一顆炸彈，一剪定生死。找到所有解除引線，在安全與謊言之間拯救倫敦。",
    minPlayers: 4,
    maxPlayers: 8,
    enabled: true,
  },
];
