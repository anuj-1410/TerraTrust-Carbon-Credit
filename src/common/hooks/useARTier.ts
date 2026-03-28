import {useEffect} from 'react';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {detectAndSetARTier} from '../../features/ar-audit/store/auditSlice';
import type {ARTier} from '../../features/ar-audit/store/auditSlice';

export function useARTier(): ARTier {
  const dispatch = useAppDispatch();
  const arTier = useAppSelector(
    state => (state.audit as unknown as {arTier: ARTier}).arTier,
  );

  useEffect(() => {
    // If arTier is already restored from MMKV (any non-null value), skip native call
    if (arTier !== null) return;

    dispatch(detectAndSetARTier());
  }, [dispatch, arTier]);

  return arTier;
}
