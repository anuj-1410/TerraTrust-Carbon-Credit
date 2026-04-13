jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {AUDIT_DEMO_MODE: 'false'},
}));

import type {SamplingZone} from '../../store/auditSlice';
import {
  AUDIT_DEMO_GPS_ACCURACY_METRES,
  getDemoZonePosition,
  parseBooleanEnv,
  resolveTreeCaptureLocation,
} from '../demoMode';

const mockZone: SamplingZone = {
  zone_id: 'zone-a',
  label: 'Zone A',
  centre_gps: {lat: 12.3456, lng: 78.9012},
  radius_metres: 9,
  zone_type: 'medium_density',
  sequence_order: 1,
  gedi_available: true,
  trees_scanned: 0,
  is_complete: false,
};

describe('demoMode utilities', () => {
  it('parses truthy env values', () => {
    expect(parseBooleanEnv('true')).toBe(true);
    expect(parseBooleanEnv('TRUE')).toBe(true);
    expect(parseBooleanEnv(' yes ')).toBe(true);
    expect(parseBooleanEnv('1')).toBe(true);
  });

  it('parses falsy or missing env values', () => {
    expect(parseBooleanEnv()).toBe(false);
    expect(parseBooleanEnv('false')).toBe(false);
    expect(parseBooleanEnv('0')).toBe(false);
    expect(parseBooleanEnv('off')).toBe(false);
  });

  it('returns the active zone centre for demo scans', () => {
    expect(getDemoZonePosition(mockZone)).toEqual({
      lat: mockZone.centre_gps.lat,
      lng: mockZone.centre_gps.lng,
      accuracy: AUDIT_DEMO_GPS_ACCURACY_METRES,
    });
  });

  it('uses synthetic zone coordinates when demo mode is enabled', () => {
    expect(
      resolveTreeCaptureLocation(mockZone, 1.23, 4.56, 42, true),
    ).toEqual({
      gpsLat: mockZone.centre_gps.lat,
      gpsLng: mockZone.centre_gps.lng,
      gpsAccuracy: AUDIT_DEMO_GPS_ACCURACY_METRES,
      isSynthetic: true,
    });
  });

  it('keeps live coordinates when demo mode is disabled', () => {
    expect(
      resolveTreeCaptureLocation(mockZone, 1.23, 4.56, 42, false),
    ).toEqual({
      gpsLat: 1.23,
      gpsLng: 4.56,
      gpsAccuracy: 42,
      isSynthetic: false,
    });
  });
});