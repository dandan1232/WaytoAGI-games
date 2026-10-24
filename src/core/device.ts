export interface DevicePosition {
  x: number;
  y: number;
}
/** Keep the entire draggable tool reachable, including after a viewport resize. */
export function clampDevice(
  position: DevicePosition,
  viewport: { width: number; height: number },
  size: { width: number; height: number },
): DevicePosition {
  return {
    x: Math.max(
      8,
      Math.min(position.x, Math.max(8, viewport.width - size.width - 8)),
    ),
    y: Math.max(
      72,
      Math.min(position.y, Math.max(72, viewport.height - size.height - 110)),
    ),
  };
}
