// Must load before ethers/uuid capture the global crypto object.
import 'react-native-get-random-values';

/** The polyfill's legacy Chrome debugger fallback is unsuitable for wallet keys. */
export function assertSecureRandomAvailable(): void {
  const runtime = globalThis as typeof globalThis & {
    RN$Bridgeless?: boolean;
    nativeCallSyncHook?: unknown;
  };
  if (
    __DEV__ &&
    runtime.RN$Bridgeless !== true &&
    typeof runtime.nativeCallSyncHook === 'undefined'
  ) {
    throw new Error('WALLET_INSECURE_DEBUGGER');
  }
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('WALLET_RANDOM_SOURCE_UNAVAILABLE');
  }
}
