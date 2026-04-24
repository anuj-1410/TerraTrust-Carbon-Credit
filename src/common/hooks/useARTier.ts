import {useEffect} from 'react';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {detectAndSetARTier} from '../../features/ar-audit/store/auditSlice';
import type {ARTier} from '../../features/ar-audit/store/auditSlice';

export function useARTier(): ARTier {
  const dispatch = useAppDispatch();
  const arTier = useAppSelector(state => state.audit.arTier);

  useEffect(() => {
    dispatch(detectAndSetARTier());
  }, [dispatch]);

  return arTier;
}
