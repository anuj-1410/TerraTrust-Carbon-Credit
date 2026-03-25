import {NativeModules} from 'react-native';
import type {ARTier} from '../features/ar-audit/store/auditSlice';

export interface ARMeasurementResult {
  diameter_cm: number;
  confidence: number;
  tier_used: 1 | 2;
  point_count: number;
}

export interface SpeciesInferenceResult {
  species: string;
  confidence: number;
  all_scores: number[];
}

const {ARModule} = NativeModules;

export async function detectARTier(): Promise<ARTier> {
  try {
    const support: string = await ARModule.checkDepthSupport();
    if (support === 'FULL_DEPTH') return 1;
    if (support === 'SLAM_ONLY') return 2;
    return 3;
  } catch {
    return 3;
  }
}

export async function measureTreeDiameter(): Promise<ARMeasurementResult> {
  const raw: string = await ARModule.measureCylinder();
  return JSON.parse(raw) as ARMeasurementResult;
}

export async function isMockLocationEnabled(): Promise<boolean> {
  return ARModule.checkMockLocation();
}

export async function identifySpecies(
  imageBase64: string,
): Promise<SpeciesInferenceResult> {
  const raw: string = await ARModule.runSpeciesInference(imageBase64);
  return JSON.parse(raw) as SpeciesInferenceResult;
}
