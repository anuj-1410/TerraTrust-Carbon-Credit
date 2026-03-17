import {useEffect} from 'react';
import {useAppDispatch, useAppSelector} from '../../store/hooks';
import {setArTier} from '../../features/ar-audit/store/auditSlice';
import type {ARTier} from '../../features/ar-audit/store/auditSlice';
import {ARBridge} from '../../services/ar-bridge';

export function useARTier(): ARTier {
  const dispatch = useAppDispatch();
  const arTier = useAppSelector(
    state => (state.audit as unknown as {arTier: ARTier}).arTier,
  );

  useEffect(() => {
    let mounted = true;

    ARBridge.getArTier()
      .then(tier => {
        if (mounted) {
          dispatch(setArTier(tier));
        }
      })
      .catch(() => {
        // Default to Tier 3 (manual) if detection fails
      });

    return () => {
      mounted = false;
    };
  }, [dispatch]);

  return arTier;
}
