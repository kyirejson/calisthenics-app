import type { GeoPoint } from './geo';

export const MAP_TILE_SIZE = 256;
export const MAP_MIN_ZOOM = 9;
export const MAP_MAX_ZOOM = 16;
export function validGeoPoint(point: GeoPoint | null | undefined): point is GeoPoint {
  return Boolean(point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180);
}
export function worldX(lng: number, zoom: number) { return ((lng + 180) / 360) * MAP_TILE_SIZE * 2 ** zoom; }
export function worldY(lat: number, zoom: number) {
  const rad = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * MAP_TILE_SIZE * 2 ** zoom;
}
/** Keep nearby longitudes nearby even when a route crosses ±180 degrees. */
export function wrappedWorldX(lng: number, zoom: number, reference: number) {
  const size = MAP_TILE_SIZE * 2 ** zoom;
  const dx = worldX(lng, zoom) - reference;
  return reference + ((dx + size / 2) % size + size) % size - size / 2;
}

export function fitTrackViewport(trail: readonly GeoPoint[], current: GeoPoint | null, width: number, height: number) {
  const points = [...trail, ...(validGeoPoint(current) ? [current] : [])].filter(validGeoPoint);
  if (!points.length) return { center: null, zoom: MAP_MAX_ZOOM };
  if (points.length === 1 || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { center: points.at(-1)!, zoom: MAP_MAX_ZOOM };
  const size = MAP_TILE_SIZE * 2 ** MAP_MAX_ZOOM;
  const firstX = worldX(points[0].longitude, MAP_MAX_ZOOM);
  const xs = points.map(p => wrappedWorldX(p.longitude, MAP_MAX_ZOOM, firstX));
  const ys = points.map(p => worldY(p.latitude, MAP_MAX_ZOOM));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = Math.min(32, Math.max(8, Math.min(width, height) * .12));
  let zoom = MAP_MAX_ZOOM;
  while (zoom > MAP_MIN_ZOOM && ((maxX - minX) * 2 ** (zoom - MAP_MAX_ZOOM) > width - 2 * pad
    || (maxY - minY) * 2 ** (zoom - MAP_MAX_ZOOM) > height - 2 * pad)) zoom--;
  const longitude = (((minX + maxX) / 2 / size * 360 - 180 + 540) % 360) - 180;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * ((minY + maxY) / 2) / size))) * 180 / Math.PI;
  return { center: { latitude, longitude }, zoom };
}
