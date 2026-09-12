import type { TransferItem, TransferPlan } from "./splendorTransfers";

interface Point {
  x: number;
  y: number;
}
export interface TransferPlayback extends Omit<TransferPlan, "items"> {
  id: number;
  items: Array<TransferItem & { origin: Point }>;
}
export const findTransferTarget = (
  root: ParentNode,
  attribute: string,
  value: string,
) => root.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(value)}"]`);
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

/** Capture before the market replaces the card or the purchase dialog closes. */
export function captureTransfer(
  plan: TransferPlan | null,
  root: HTMLElement | null,
  id: number,
): TransferPlayback | null {
  if (!plan || !root) return null;
  return {
    ...plan,
    id,
    items: plan.items.map((item) => {
      const dialog = document.querySelector(".sp-dialog[open]");
      const source =
        (dialog && findTransferTarget(dialog, "data-sp-source", item.source)) ||
        findTransferTarget(root, "data-sp-source", item.source);
      return { ...item, origin: transferCenter(source) };
    }),
  };
}
