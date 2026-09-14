import { createContext, useContext } from "react";
export const PlayerContext = createContext<{
  uid: string;
  nickname: string;
  setNickname: (value: string) => Promise<void>;
}>({ uid: "", nickname: "", setNickname: async () => {} });
export const usePlayer = () => useContext(PlayerContext);
