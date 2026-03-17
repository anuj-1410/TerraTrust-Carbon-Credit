import {NativeModules} from 'react-native';
import type {ARTier} from '../features/ar-audit/store/auditSlice';

export interface ARModuleInterface {
  checkMockLocation(): Promise<boolean>;
  startARSession(tier: ARTier): Promise<void>;
  getArTier(): Promise<ARTier>;
}

export const ARBridge = NativeModules.ARModule as ARModuleInterface;
