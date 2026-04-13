import Config from 'react-native-config';
import type {SamplingZone} from '../store/auditSlice';

const ENABLED_BOOLEAN_VALUES = new Set(['1', 'true', 'yes', 'on']);

export const AUDIT_DEMO_GPS_ACCURACY_METRES = 5;

export interface DemoZonePosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface ResolvedTreeCaptureLocation {
  gpsLat: number;
  gpsLng: number;
  gpsAccuracy: number;
  isSynthetic: boolean;
}

export function parseBooleanEnv(value?: string): boolean {
  if (!value) {
    return false;
  }

  return ENABLED_BOOLEAN_VALUES.has(value.trim().toLowerCase());
}

export const IS_AUDIT_DEMO_MODE = parseBooleanEnv(Config.AUDIT_DEMO_MODE);
export const IS_AUDIT_SPECIES_DETECTION_DISABLED = parseBooleanEnv(
  Config.AUDIT_SKIP_SPECIES_DETECTION,
);

export function getDemoZonePosition(
  currentZone: SamplingZone | null,
): DemoZonePosition | null {
  if (!currentZone) {
    return null;
  }

  return {
    lat: currentZone.centre_gps.lat,
    lng: currentZone.centre_gps.lng,
    accuracy: AUDIT_DEMO_GPS_ACCURACY_METRES,
  };
}

export function resolveTreeCaptureLocation(
  currentZone: SamplingZone | null,
  gpsLat: number,
  gpsLng: number,
  gpsAccuracy: number,
  isDemoMode = IS_AUDIT_DEMO_MODE,
): ResolvedTreeCaptureLocation {
  const demoZonePosition = isDemoMode ? getDemoZonePosition(currentZone) : null;

  if (demoZonePosition) {
    return {
      gpsLat: demoZonePosition.lat,
      gpsLng: demoZonePosition.lng,
      gpsAccuracy: demoZonePosition.accuracy,
      isSynthetic: true,
    };
  }

  return {
    gpsLat,
    gpsLng,
    gpsAccuracy,
    isSynthetic: false,
  };
}