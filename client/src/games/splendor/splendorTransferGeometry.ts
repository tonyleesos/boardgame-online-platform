import type { TransferPlan } from "./splendorTransfers";

interface Point {
  x: number;
  y: number;
}
export interface TransferPlayback extends TransferPlan {
  id: number;
}
export const findTransferTarget = (
  root: ParentNode,
  attribute: string,
  value: string,
) => root.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(value)}"]`) ??
  // Compact player panels aggregate tokens into one visible destination.
  (value.includes(":token:") ? root.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(value.replace(/:token:[^:]+$/, ":tokens"))}"]`) : null);
export function transferCenter(element: Element | null): Point {
  const rect = element?.getBoundingClientRect();
  return rect && rect.width && rect.height
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
export function visibleTransferPoint(point: Point, margin = 32): Point {
  return {
    x: Math.max(margin, Math.min(window.innerWidth - margin, point.x)),
    y: Math.max(margin, Math.min(window.innerHeight - margin, point.y)),
  };
}
