import {useEffect, useState} from 'react';
import Geolocation from 'react-native-geolocation-service';
import type {GPS, SamplingZone} from '../../features/ar-audit/store/auditSlice';
import type {GeoJSONPolygon} from '../../features/land/store/landSlice';
import {useAppSelector} from '../../store/hooks';
import {isPointInsidePolygon} from '../utils/geoJson';

export interface GeofencePosition extends GPS {
  accuracy: number;
}

export interface UseGeofenceResult {
  isInsideBoundary: boolean;
  isAtZoneCentre: boolean;
  currentPosition: GeofencePosition | null;
  gpsAccuracy: number | null;
  hasWeakSignal: boolean;
  error: string | null;
}

const ACCURACY_THRESHOLD = 20;
const ZONE_ARRIVAL_METRES = 10;

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
  const gpsHighAccuracy = useAppSelector(state => state.profile.gpsHighAccuracy);
  const [currentPosition, setCurrentPosition] =
    useState<GeofencePosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      position => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
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
  }, [gpsHighAccuracy]);

  const hasAccurateFix =
    currentPosition !== null && currentPosition.accuracy <= ACCURACY_THRESHOLD;

  // Local client-side check (fast, preliminary)
  const isInsideBoundary = Boolean(
    hasAccurateFix &&
      currentPosition &&
      boundary &&
      isPointInsidePolygon(currentPosition, boundary),
  );

  const isAtZoneCentre =
    hasAccurateFix && currentPosition && currentZone
      ? haversineDistance(currentPosition, currentZone.centre_gps) <=
        ZONE_ARRIVAL_METRES
      : false;

  return {
    isInsideBoundary,
    isAtZoneCentre,
    currentPosition,
    gpsAccuracy: currentPosition?.accuracy ?? null,
    hasWeakSignal:
      currentPosition !== null && currentPosition.accuracy > ACCURACY_THRESHOLD,
    error,
  };
}
