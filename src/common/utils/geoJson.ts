import type { GeoJSONPolygon } from '../../features/land/store/landSlice';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Structural checks before coordinates reach a native map or registration request. */
export function isUsableBoundary(value: unknown): value is GeoJSONPolygon {
  const polygon = value as GeoJSONPolygon | null;
  if (
    polygon?.type !== 'Polygon' ||
    !Array.isArray(polygon.coordinates) ||
    !polygon.coordinates.length
  ) {
    return false;
  }
  return polygon.coordinates.every(
    ring =>
      Array.isArray(ring) &&
      ring.length >= 4 &&
      ring.every(
        point =>
          Array.isArray(point) &&
          point.length >= 2 &&
          Number.isFinite(point[0]) &&
          Number.isFinite(point[1]) &&
          Math.abs(point[0]) <= 180 &&
          Math.abs(point[1]) <= 90,
      ) &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1] &&
      new Set(ring.slice(0, -1).map(point => `${point[0]},${point[1]}`)).size >=
        3,
  );
}

export function isClosedPolygon(polygon: GeoJSONPolygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    return false;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

export function isPointInsidePolygon(
  point: GeoPoint,
  polygon: GeoJSONPolygon,
): boolean {
  if (
    !isUsableBoundary(polygon) ||
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng)
  ) {
    return false;
  }
  return (
    isPointInsideRing(point, polygon.coordinates[0]) &&
    !polygon.coordinates.slice(1).some(ring => isPointInsideRing(point, ring))
  );
}

function isPointInsideRing(point: GeoPoint, ring: number[][]): boolean {
  let inside = false;

  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [currentLng, currentLat] = ring[index];
    const [previousLng, previousLat] = ring[previous];

    const intersects =
      currentLat > point.lat !== previousLat > point.lat &&
      point.lng <
        ((previousLng - currentLng) * (point.lat - currentLat)) /
          (previousLat - currentLat) +
          currentLng;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function calculateAreaHectares(polygon: GeoJSONPolygon): number {
  if (!isUsableBoundary(polygon)) {
    return 0;
  }
  const [originLng, originLat] = polygon.coordinates[0][0];
  const meanLatitude =
    polygon.coordinates[0]
      .slice(0, -1)
      .reduce((sum, point) => sum + point[1], 0) /
    (polygon.coordinates[0].length - 1);
  const xScale = 111320 * Math.cos((meanLatitude * Math.PI) / 180);
  // Local projection for the preview only; PostGIS supplies the registered area.
  const areas = polygon.coordinates.map(ring => {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x1 = (ring[i][0] - originLng) * xScale;
      const y1 = (ring[i][1] - originLat) * 111320;
      const x2 = (ring[i + 1][0] - originLng) * xScale;
      const y2 = (ring[i + 1][1] - originLat) * 111320;
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  });
  return (
    Math.max(
      0,
      areas[0] - areas.slice(1).reduce((sum, area) => sum + area, 0),
    ) / 10000
  );
}
