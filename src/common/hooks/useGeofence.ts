import {useEffect, useState} from 'react';
import Geolocation from 'react-native-geolocation-service';
import type {GPS} from '../../features/ar-audit/store/auditSlice';

interface UseGeofenceResult {
  isInsideZone: boolean;
  currentPosition: GPS | null;
  error: string | null;
}

function getDistanceMetres(a: GPS, b: GPS): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const x =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useGeofence(
  centre: GPS,
  radiusMetres: number,
): UseGeofenceResult {
  const [currentPosition, setCurrentPosition] = useState<GPS | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      position => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setError(null);
      },
      err => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        interval: 3000,
        fastestInterval: 1000,
      },
    );

    return () => Geolocation.clearWatch(watchId);
  }, [centre.lat, centre.lng, radiusMetres]);

  const isInsideZone = currentPosition
    ? getDistanceMetres(currentPosition, centre) <= radiusMetres
    : false;

  return {isInsideZone, currentPosition, error};
}
