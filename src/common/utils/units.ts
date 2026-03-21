export function circumferenceToDiameter(circumferenceCm: number): number {
  return circumferenceCm / Math.PI;
}

export function dbhToHeight(_dbhCm: number): number {
  // TODO: Implement allometric height estimation
  // Placeholder — returns a conservative estimate
  return 0;
}

export function hectaresToAcres(hectares: number): number {
  return hectares * 2.471;
}

export function sqmToHectares(sqm: number): number {
  return sqm / 10000;
}
