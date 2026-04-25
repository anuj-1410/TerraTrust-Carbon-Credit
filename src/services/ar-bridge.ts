import {NativeModules} from 'react-native';
import type {ARTier} from '../features/ar-audit/store/auditSlice';

export interface ARMeasurementResult {
  diameter_cm: number;
  confidence: number;
  tier_used: 1 | 2;
  point_count: number;
  raw_point_count?: number;
  filtered_point_count?: number;
  inlier_count?: number;
  residual_cm?: number;
  scan_distance_m?: number;
  scan_duration_ms?: number;
  fit_method?: string;
}

export interface SpeciesInferenceResult {
  species: string;
  confidence: number;
  all_scores: number[];
}

export interface HeightMeasurementResult {
  captured: 'base' | 'top';
  height_m?: number;
}

export interface HeightMeasurementCompleteResult {
  height_m: number;
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

export async function measureTreeDiameter(
  tier: 1 | 2,
): Promise<ARMeasurementResult> {
  const raw: string = await ARModule.launchDiameterMeasurement(tier);
  return JSON.parse(raw) as ARMeasurementResult;
}

export async function measureTreeHeight(): Promise<HeightMeasurementCompleteResult> {
  const raw: string = await ARModule.launchHeightMeasurement();
  return JSON.parse(raw) as HeightMeasurementCompleteResult;
}

export async function beginHeightMeasurement(): Promise<void> {
  await ARModule.beginHeightMeasurement();
}

export async function captureHeightPoint(
  pointType: 'base' | 'top',
): Promise<HeightMeasurementResult> {
  const raw: string = await ARModule.captureHeightPoint(pointType);
  return JSON.parse(raw) as HeightMeasurementResult;
}

export async function cancelHeightMeasurement(): Promise<void> {
  await ARModule.cancelHeightMeasurement();
}

export async function isMockLocationEnabled(): Promise<boolean> {
  return ARModule.checkMockLocation();
}

export async function moveAppToBackground(): Promise<boolean> {
  return ARModule.moveTaskToBack();
}

export async function identifySpecies(
  imageBase64: string,
): Promise<SpeciesInferenceResult> {
  const raw: string = await ARModule.runSpeciesInference(imageBase64);
  return JSON.parse(raw) as SpeciesInferenceResult;
}
