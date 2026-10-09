export type Coordinate = { latitude: number; longitude: number };
export const TILE_SIZE = 256;
export const TILE_URL = 'https://tile.openstreetmap.org';
export function project(point: Coordinate, zoom: number) {
  const size = TILE_SIZE * 2 ** zoom, latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sin = Math.sin(latitude * Math.PI / 180);
  return { x: (point.longitude + 180) / 360 * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}
export function unproject(x: number, y: number, zoom: number): Coordinate {
  const size = TILE_SIZE * 2 ** zoom;
  return { longitude: ((x / size * 360) % 360 + 360) % 360 - 180, latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI };
}
export function mapTiles(center: Coordinate, zoom: number, width: number, height: number) {
  const world = project(center, zoom), left = world.x - width / 2, top = world.y - height / 2, count = 2 ** zoom;
  const tiles = [];
  for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor((top + height) / TILE_SIZE); y++) for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor((left + width) / TILE_SIZE); x++) {
    if (y < 0 || y >= count) continue;
    const wrapped = ((x % count) + count) % count;
    tiles.push({ key: `${zoom}/${wrapped}/${y}`, uri: `${TILE_URL}/${zoom}/${wrapped}/${y}.png`, x: x * TILE_SIZE - left, y: y * TILE_SIZE - top });
  }
  return tiles;
}
export function screenPoint(point: Coordinate, center: Coordinate, zoom: number, width: number, height: number) {
  const p = project(point, zoom), origin = project(center, zoom), size = TILE_SIZE * 2 ** zoom;
  let dx = p.x - origin.x;
  if (dx > size / 2) dx -= size; if (dx < -size / 2) dx += size;
  return { x: dx + width / 2, y: p.y - origin.y + height / 2 };
}
export function metresPerPixel(latitude: number, zoom: number) { return 40075016.686 * Math.cos(latitude * Math.PI / 180) / (TILE_SIZE * 2 ** zoom); }
export function fitRoute(segments: readonly Coordinate[][], width: number, height: number) {
  const all = segments.flat();
  if (!all.length) return null;
  const reference = project(all[0], 18), size = TILE_SIZE * 2 ** 18;
  let minX = reference.x, maxX = minX, minY = reference.y, maxY = minY;
  for (const point of all) {
    const p = project(point, 18); let dx = p.x - reference.x;
    if (dx > size / 2) dx -= size; if (dx < -size / 2) dx += size;
    minX = Math.min(minX, reference.x + dx); maxX = Math.max(maxX, reference.x + dx); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const ratio = Math.max((maxX - minX) / Math.max(80, width - 60), (maxY - minY) / Math.max(80, height - 110), 1);
  return { center: unproject((minX + maxX) / 2, (minY + maxY) / 2, 18), zoom: Math.max(3, Math.min(18, Math.floor(18 - Math.log2(ratio)))) };
}
