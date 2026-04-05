import {useEffect, useRef, useState, useCallback} from 'react';
import Geolocation from 'react-native-geolocation-service';
import type {GPS, SamplingZone} from '../../features/ar-audit/store/auditSlice';
import type {GeoJSONPolygon} from '../../features/land/store/landSlice';
import {useAppSelector} from '../../store/hooks';

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
const GRACE_PERIOD_MS = 30_000;
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

function pointInPolygon(point: GPS, polygon: GeoJSONPolygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; // [lng, lat]
    const [xj, yj] = ring[j];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
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

  const lastGoodPosition = useRef<GeofencePosition | null>(null);
  const lastGoodTime = useRef<number>(0);

  const getEffectivePosition = useCallback((): GeofencePosition | null => {
    if (currentPosition && currentPosition.accuracy <= ACCURACY_THRESHOLD) {
      lastGoodPosition.current = currentPosition;
      lastGoodTime.current = Date.now();
      return currentPosition;
    }
    // Grace period: use last good position for up to 30 seconds
    if (
      lastGoodPosition.current &&
      Date.now() - lastGoodTime.current <= GRACE_PERIOD_MS
    ) {
      return lastGoodPosition.current;
    }
    return null;
  }, [currentPosition]);

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

  const effectivePos = getEffectivePosition();

  // Local client-side check (fast, preliminary)
  const localInside =
    effectivePos && boundary ? pointInPolygon(effectivePos, boundary) : false;
  const isInsideBoundary = localInside;

  const isAtZoneCentre =
    effectivePos && currentZone
      ? haversineDistance(effectivePos, currentZone.centre_gps) <=
        ZONE_ARRIVAL_METRES
      : false;

  return {
    isInsideBoundary,
    isAtZoneCentre,
    currentPosition: effectivePos,
    gpsAccuracy: currentPosition?.accuracy ?? null,
    hasWeakSignal: (currentPosition?.accuracy ?? 0) > ACCURACY_THRESHOLD,
    error,
  };
}
