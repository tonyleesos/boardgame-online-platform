export type Role =
  "merlin" | "percival" | "servant" | "assassin" | "morgana" | "minion";
export type Side = "good" | "evil";
export type Phase =
  | "ROLE_REVEAL"
  | "TEAM_SELECTION"
  | "TEAM_VOTE"
  | "MISSION_VOTE"
  | "MISSION_RESULT"
  | "ASSASSINATION"
  | "GAME_OVER";
export type TeamVote = "approve" | "reject";
export type MissionVote = "success" | "fail";
export interface Player {
  isBot?: boolean;
  isProxy?: boolean;
  uid: string;
  nickname: string;
  joinedAt: number;
  ready: boolean;
}
export interface PrivateRole {
  role: Role;
  side: Side;
  knowledge: string[];
  knowledgeType: "evil" | "candidates" | "none";
}
export interface Mission {
  result: MissionVote;
  fails: number;
  team: string[];
}
export interface Game {
  id: string;
  revision: number;
  phase: Phase;
  round: number;
  leaderId: string;
  order: string[];
  selectedPlayerIds: string[];
  proposalAttempt: number;
  missionResults: Mission[];
  submitted: Record<string, boolean>;
  revealed: Record<string, boolean>;
  lastTeamVote?: {
    votes: Record<string, TeamVote>;
    approved: boolean;
    team: string[];
  };
  winner?: Side;
  winReason?: string;
  roles?: Record<string, Role>;
}
export interface Room {
  code: string;
  gameId: string;
  hostId: string;
  status: "waiting" | "playing" | "finished";
  createdAt: number;
  players: Record<string, Player>;
  game?: Game;
  timebomb?: BombGame;
  mode?: "friends" | "practice";
  bombVariant?: BombVariant;
  botLevel?: "casual" | "standard";
  botActionAt?: number;
  activity?: Array<{ uid: string; message: string; sequence: number }>;
}
export interface Session {
  public: Room;
  presence?: Record<
    string,
    { connections?: Record<string, boolean>; lastSeen?: number }
  >;
  private: Record<string, PrivateRole>;
  timebombPrivate?: Record<string, BombPrivate>;
  secret: {
    teamVotes: Record<string, TeamVote>;
    missionVotes: Record<string, MissionVote>;
    bombHands?: Record<string, Array<Wire | null>>;
  };
}
export type GameAction =
  | { type: "reveal" }
  | { type: "select"; players: string[] }
  | { type: "propose" }
  | { type: "teamVote"; vote: TeamVote }
  | { type: "missionVote"; vote: MissionVote }
  | { type: "continue" }
  | { type: "assassinate"; target: string };
export type RoomAction =
  | { type: "addBot" }
  | { type: "removeBot"; botId: string }
  | { type: "ready"; ready: boolean }
  | { type: "leave" }
  | { type: "start" }
  | { type: "rematch" }
  | { type: "recover" };
export type PlatformGameAction = GameAction | BombAction;
export const GAME_LIMITS: Record<string, { min: number; max: number }> = {
  avalon: { min: 5, max: 10 },
  timebomb: { min: 4, max: 6 },
  "timebomb-classic": { min: 4, max: 8 },
};
export const ROLE_NAMES: Record<Role, string> = {
  merlin: "梅林",
  percival: "派西維爾",
  servant: "亞瑟的忠臣",
  assassin: "刺客",
  morgana: "莫甘娜",
  minion: "莫德雷德的爪牙",
};
import type {
  BombGame,
  BombPrivate,
  BombAction,
  BombVariant,
  Wire,
} from "./timebomb";
