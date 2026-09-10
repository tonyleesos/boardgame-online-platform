// Test-only original solutions. Never import this file into application code.
import type { HouseAction } from "../functions/src/shared/decorum";
export const solutionMoves: Record<string, HouseAction[]> = {
  "demo-two-01": [
    { type: "decorPaint", roomId: "living", color: "green" },
    { type: "decorPaint", roomId: "bed", color: "yellow" },
    { type: "decorSwap", roomId: "living", objectId: "lamp-blue-modern" },
    { type: "decorRemove", roomId: "kitchen", objectType: "lamp" },
    { type: "decorAdd", roomId: "kitchen", objectId: "curio-yellow-antique" },
  ],
  "demo-two-02": [
    { type: "decorPaint", roomId: "bath", color: "yellow" },
    { type: "decorPaint", roomId: "bed", color: "yellow" },
    { type: "decorSwap", roomId: "bath", objectId: "curio-blue-retro" },
    { type: "decorSwap", roomId: "living", objectId: "lamp-blue-modern" },
    { type: "decorAdd", roomId: "living", objectId: "curio-yellow-antique" },
    { type: "decorAdd", roomId: "living", objectId: "art-green-retro" },
    { type: "decorRemove", roomId: "kitchen", objectType: "lamp" },
  ],
  "demo-three-01": [
    { type: "decorPaint", roomId: "living", color: "green" },
    { type: "decorPaint", roomId: "bed", color: "yellow" },
    { type: "decorPaint", roomId: "bath", color: "yellow" },
    { type: "decorSwap", roomId: "living", objectId: "lamp-blue-modern" },
    { type: "decorRemove", roomId: "kitchen", objectType: "lamp" },
    { type: "decorAdd", roomId: "kitchen", objectId: "curio-yellow-antique" },
  ],
  "demo-four-01": [
    { type: "decorPaint", roomId: "living", color: "green" },
    { type: "decorPaint", roomId: "bath", color: "yellow" },
    { type: "decorPaint", roomId: "bed", color: "blue" },
    { type: "decorSwap", roomId: "living", objectId: "lamp-blue-modern" },
    { type: "decorAdd", roomId: "bath", objectId: "lamp-yellow-retro" },
    { type: "decorRemove", roomId: "kitchen", objectType: "lamp" },
    { type: "decorAdd", roomId: "kitchen", objectId: "curio-yellow-antique" },
    { type: "decorRoommate", roomId: "bed", swapWith: "p2" },
  ],
};
