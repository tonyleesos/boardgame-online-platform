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
    id: "decorum", name: "同房異夢", subtitle: "DÉCORUM · A HOME FOR ALL",
    description: "一個家，幾種理想生活。用一次次佈置與小小回應，找到室友之間的默契。",
    minPlayers: 2, maxPlayers: 4, enabled: true, supportsBots: false,
  },
  {
    id: "avalon",
    name: "阿瓦隆",
    subtitle: "THE RESISTANCE: AVALON",
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
