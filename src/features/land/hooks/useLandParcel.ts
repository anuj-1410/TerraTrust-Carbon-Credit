import { useRef } from 'react';
import { useAppSelector } from '../../../store/hooks';
import type { LandParcel } from '../store/landSlice';

/** A refresh of page one cannot discard a detail opened from a later list page. */
export function useLandParcel(landId: string): LandParcel | undefined {
  const uid = useAppSelector(state => state.auth.user?.firebaseUid);
  const parcel = useAppSelector(state =>
    state.land.parcels.find(item => item.id === landId),
  );
  const cached = useRef<{ key: string; parcel?: LandParcel }>({ key: '' });
  const key = `${uid}:${landId}`;
  if (cached.current.key !== key) {
    cached.current = { key };
  }
  if (parcel && uid) {
    cached.current.parcel = parcel;
  }
  return uid ? parcel ?? cached.current.parcel : undefined;
}
