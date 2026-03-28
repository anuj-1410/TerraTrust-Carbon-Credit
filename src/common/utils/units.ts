export function circumferenceToDiameter(circumferenceCm: number): number {
  return circumferenceCm / Math.PI;
}

export function hectaresToAcres(hectares: number): number {
  return hectares * 2.471;
}

export function sqmToHectares(sqm: number): number {
  return sqm / 10000;
}
