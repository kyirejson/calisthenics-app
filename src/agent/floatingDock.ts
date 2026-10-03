export type DockAnchor = { edge: 'left' | 'right'; ratio: number };
export const DOCK_SIZE = 48;
export function dockBounds(width: number, height: number, topInset = 0, bottomInset = 0) {
  const left = 12, right = Math.max(left, width - DOCK_SIZE - 12);
  const top = Math.max(12, topInset + 12), bottom = Math.max(top, height - bottomInset - 112 - DOCK_SIZE);
  return { left, right, top, bottom };
}
export function dockPoint(anchor: DockAnchor, bounds: ReturnType<typeof dockBounds>) {
  return { x: anchor.edge === 'left' ? bounds.left : bounds.right, y: bounds.top + (bounds.bottom - bounds.top) * Math.max(0, Math.min(1, anchor.ratio)) };
}
export function snapDock(x: number, y: number, bounds: ReturnType<typeof dockBounds>): DockAnchor {
  return { edge: x < (bounds.left + bounds.right) / 2 ? 'left' : 'right', ratio: bounds.bottom === bounds.top ? 0 : Math.max(0, Math.min(1, (y - bounds.top) / (bounds.bottom - bounds.top))) };
}
