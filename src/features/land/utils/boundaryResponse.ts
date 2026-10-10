import {
  calculateAreaHectares,
  isUsableBoundary,
} from '../../../common/utils/geoJson';
import type { BoundarySource, LandDraft } from '../store/landSlice';

export function readBoundaryResponse(
  value: unknown,
  defaultSource?: BoundarySource,
): Partial<LandDraft> {
  const response = value as {
    geojson?: { geometry?: unknown };
    boundary?: unknown;
    boundary_source?: string;
    satellite_thumbnail_url?: unknown;
  };
  const boundary = response?.geojson?.geometry ?? response?.boundary;
  const source = response?.boundary_source ?? defaultSource;
  if (
    !isUsableBoundary(boundary) ||
    calculateAreaHectares(boundary) <= 0 ||
    !['WMS_AUTO', 'SCRAPE', 'MANUAL'].includes(source ?? '')
  ) {
    throw new Error('BOUNDARY_RESPONSE_INVALID');
  }
  return {
    boundary,
    boundarySource: source as BoundarySource,
    fetchStatus: 'success',
    satelliteThumbnailUrl:
      typeof response.satellite_thumbnail_url === 'string'
        ? response.satellite_thumbnail_url
        : null,
  };
}
