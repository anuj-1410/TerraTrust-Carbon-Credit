import type {GeoJSONPolygon} from '../../features/land/store/landSlice';

export function isClosedPolygon(polygon: GeoJSONPolygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    return false;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

export function calculateAreaHectares(polygon: GeoJSONPolygon): number {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    return 0;
  }

  // Shoelace formula on projected coordinates (approximate for small areas)
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    area += lng1 * lat2 - lng2 * lat1;
  }
  area = Math.abs(area) / 2;

  // Convert degrees² to m² (approximate at Indian latitudes ~20°N)
  const degToMetre = 111320;
  const areaM2 = area * degToMetre * degToMetre * Math.cos((20 * Math.PI) / 180);

  return areaM2 / 10000;
}
