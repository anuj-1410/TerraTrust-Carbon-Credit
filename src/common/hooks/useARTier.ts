import {useEffect} from 'react';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {detectAndSetARTier} from '../../features/ar-audit/store/auditSlice';
import type {ARTier} from '../../features/ar-audit/store/auditSlice';

export function useARTier(): ARTier {
  const dispatch = useAppDispatch();
  const {arTier, arTierResolved} = useAppSelector(state => state.audit);

  useEffect(() => {
    if (!arTierResolved) {
      dispatch(detectAndSetARTier());
    }
  }, [arTierResolved, dispatch]);

  return arTier;
}
