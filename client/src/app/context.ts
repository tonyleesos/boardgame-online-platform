import { createContext, useContext } from "react";
export const PlayerContext = createContext<{
  uid: string;
  nickname: string;
  setNickname: (value: string) => void;
}>({ uid: "", nickname: "", setNickname: () => {} });
export const usePlayer = () => useContext(PlayerContext);
