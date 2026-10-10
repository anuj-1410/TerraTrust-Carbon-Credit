import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from 'react-redux';

export interface LandOperation {
  isCurrent: () => boolean;
  signal: AbortSignal;
}

/** Focus, identity, and a synchronous lock own each asynchronous land operation. */
export function useLandOperation() {
  const store = useStore<{
    auth: { sessionReady: boolean; user: { firebaseUid: string } | null };
  }>();
  const focused = useRef(true);
  const generation = useRef(0);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    running.current = false;
  }, []);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        cancel();
      };
    }, [cancel]),
  );

  const run = useCallback(
    async (
      action: (operation: LandOperation) => Promise<void>,
      onError: (error: unknown) => void,
    ) => {
      const owner = store.getState().auth.user?.firebaseUid;
      if (
        running.current ||
        !focused.current ||
        !owner ||
        !store.getState().auth.sessionReady
      ) {
        return;
      }
      running.current = true;
      const token = ++generation.current;
      const abort = new AbortController();
      controller.current = abort;
      const isCurrent = () =>
        focused.current &&
        !abort.signal.aborted &&
        token === generation.current &&
        store.getState().auth.sessionReady &&
        store.getState().auth.user?.firebaseUid === owner;
      try {
        await action({ isCurrent, signal: abort.signal });
      } catch (error) {
        if (isCurrent()) {
          onError(error);
        }
      } finally {
        if (token === generation.current) {
          running.current = false;
          controller.current = null;
        }
      }
    },
    [store],
  );
  return { run, cancel };
}
