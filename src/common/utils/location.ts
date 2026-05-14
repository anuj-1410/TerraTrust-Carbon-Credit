import Geolocation, {
  type GeoError,
  type GeoOptions,
  type GeoPosition,
} from 'react-native-geolocation-service';

export const GPS_RELIABLE_ACCURACY_METRES = 20;
export const ZONE_ARRIVAL_METRES = 10;

export function hasValidGpsCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

export function isMockedGeoPosition(position: Pick<GeoPosition, 'mocked'> | null | undefined): boolean {
  return position?.mocked === true;
}

export function getCurrentLocationFix(
  options?: GeoOptions,
): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      options,
    );
  });
}

export function formatLocationError(error: GeoError | Error | unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as {message?: unknown}).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return 'Unable to read your live location.';
}
