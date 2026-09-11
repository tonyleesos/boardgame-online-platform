import type { DecorColor } from "../../../../functions/src/shared/decorum";
export const paintColors: Record<DecorColor, string> = { red: "#cc7866", yellow: "#e7bd61", blue: "#6796ae", green: "#809b79" };
import { Bath, BedDouble, CookingPot, Sofa, Lamp, Sprout, Frame, Shapes, Landmark, Disc3, Sparkles } from "lucide-react";

export const roomIcons = { livingRoom: Sofa, bedroom: BedDouble, bedroom2: BedDouble, bathroom: Bath, kitchen: CookingPot };
export const objectIcons = { lamp: Lamp, curio: Sprout, wallHanging: Frame };
export const styleIcons = { modern: Shapes, antique: Landmark, retro: Disc3, unusual: Sparkles };
