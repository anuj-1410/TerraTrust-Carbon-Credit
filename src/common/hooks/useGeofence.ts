import {useEffect, useState} from 'react';
import Geolocation from 'react-native-geolocation-service';
import type {GPS, SamplingZone} from '../../features/ar-audit/store/auditSlice';
import {
  getDemoZonePosition,
  IS_AUDIT_DEMO_MODE,
} from '../../features/ar-audit/utils/demoMode';
import type {GeoJSONPolygon} from '../../features/land/store/landSlice';
import {useAppSelector} from '../../store/hooks';
import {isPointInsidePolygon} from '../utils/geoJson';
import {
  GPS_RELIABLE_ACCURACY_METRES,
  ZONE_ARRIVAL_METRES,
  isMockedGeoPosition,
} from '../utils/location';

export interface GeofencePosition extends GPS {
  accuracy: number;
}

export interface UseGeofenceResult {
  isInsideBoundary: boolean;
  isAtZoneCentre: boolean;
  currentPosition: GeofencePosition | null;
  gpsAccuracy: number | null;
  hasWeakSignal: boolean;
  hasReliableFix: boolean;
  isMockedLocation: boolean;
  error: string | null;
}

function haversineDistance(a: GPS, b: GPS): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const x =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useGeofence(
  boundary: GeoJSONPolygon | null,
  currentZone: SamplingZone | null,
  _landId?: string,
): UseGeofenceResult {
  const gpsHighAccuracy = useAppSelector(
    state => state.profile.settingsHighAccuracyGPS,
  );
  const [currentPosition, setCurrentPosition] =
    useState<GeofencePosition | null>(null);
  const [lastReliableInsideBoundary, setLastReliableInsideBoundary] =
    useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMockedLocation, setIsMockedLocation] = useState(false);

  useEffect(() => {
    setLastReliableInsideBoundary(null);
  }, [boundary]);

  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      position => {
        const nextPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setCurrentPosition(nextPosition);
        setIsMockedLocation(isMockedGeoPosition(position));

        if (
          boundary &&
          nextPosition.accuracy <= GPS_RELIABLE_ACCURACY_METRES
        ) {
          setLastReliableInsideBoundary(
            isPointInsidePolygon(nextPosition, boundary),
          );
        }

        setError(null);
      },
      err => {
        setError(err.message);
      },
      {
        enableHighAccuracy: gpsHighAccuracy,
        distanceFilter: 1,
        interval: 3000,
        fastestInterval: 1000,
      },
    );

    return () => Geolocation.clearWatch(watchId);
  }, [boundary, gpsHighAccuracy]);

  const hasAccurateFix =
    currentPosition !== null &&
    currentPosition.accuracy <= GPS_RELIABLE_ACCURACY_METRES;
  const demoZonePosition = IS_AUDIT_DEMO_MODE
    ? getDemoZonePosition(currentZone)
    : null;
  const effectivePosition = demoZonePosition ?? currentPosition;
  const hasReliableEffectiveFix =
    effectivePosition !== null &&
    effectivePosition.accuracy <= GPS_RELIABLE_ACCURACY_METRES;

  // Local client-side check (fast, preliminary)
  const isInsideBoundary = demoZonePosition
    ? true
    : Boolean(
        effectivePosition &&
          boundary &&
          (hasReliableEffectiveFix
            ? isPointInsidePolygon(effectivePosition, boundary)
            : lastReliableInsideBoundary),
      );

  const isAtZoneCentre = demoZonePosition
    ? true
    : hasReliableEffectiveFix && effectivePosition && currentZone
      ? haversineDistance(effectivePosition, currentZone.centre_gps) <=
        ZONE_ARRIVAL_METRES
      : false;

  return {
    isInsideBoundary,
    isAtZoneCentre,
    currentPosition: effectivePosition,
    gpsAccuracy: effectivePosition?.accuracy ?? null,
    hasWeakSignal: demoZonePosition
      ? false
      : currentPosition !== null &&
        currentPosition.accuracy > GPS_RELIABLE_ACCURACY_METRES,
    hasReliableFix: demoZonePosition ? true : hasAccurateFix,
    isMockedLocation: demoZonePosition ? false : isMockedLocation,
    error,
  };
}
