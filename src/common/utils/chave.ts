import type {TreeSample} from '../../features/ar-audit/store/auditSlice';
import {getWoodDensity} from '../constants/species';

export function calculateChaveAGB(
  dbhCm: number,
  heightM: number,
  woodDensity: number,
): number {
  if (dbhCm <= 0 || heightM <= 0 || woodDensity <= 0) {
    return 0;
  }

  return 0.0673 * Math.pow(woodDensity * dbhCm * dbhCm * heightM, 0.976);
}

export function estimateTco2eFromTrees(scannedTrees: TreeSample[]): number {
  if (scannedTrees.length === 0) {
    return 0;
  }

  const totalAGB = scannedTrees.reduce((sum, tree) => {
    const woodDensity = tree.wood_density || getWoodDensity(tree.species) || 0.55;
    const heightM = tree.ar_height_m ?? 10;
    return sum + calculateChaveAGB(tree.dbh_cm, heightM, woodDensity);
  }, 0);

  const tCO2e = (totalAGB / 1000) * 0.47 * 3.67;
  return Math.round(tCO2e * 100) / 100;
}