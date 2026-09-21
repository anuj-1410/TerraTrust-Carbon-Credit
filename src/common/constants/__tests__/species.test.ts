import {
  SPECIES_MODEL_CONFIG,
  SPECIES_MODEL_LABEL_ORDER,
  getWoodDensity,
  isApprovedSpeciesName,
  normalizeSpeciesName,
} from '../species';

describe('species model contract', () => {
  it('normalizes model labels to the UI display names', () => {
    expect(normalizeSpeciesName('indian_rosewood')).toBe('Indian Rosewood');
    expect(normalizeSpeciesName('NOT_APPROVED')).toBe('Not Approved');
  });

  it('recognizes approved species across UI and model naming', () => {
    expect(isApprovedSpeciesName('Amla')).toBe(true);
    expect(isApprovedSpeciesName('amla')).toBe(true);
    expect(isApprovedSpeciesName('NOT_APPROVED')).toBe(false);
  });

  it('keeps the exported manifest thresholds and label order aligned', () => {
    expect(SPECIES_MODEL_CONFIG.uiFallbackThreshold).toBe(0.6);
    expect(SPECIES_MODEL_CONFIG.hardAcceptanceThreshold).toBe(0.8);
    expect(SPECIES_MODEL_LABEL_ORDER).toHaveLength(12);
    expect(SPECIES_MODEL_LABEL_ORDER[0]).toBe('NOT_APPROVED');
  });

  it('resolves wood density from either display names or model labels', () => {
    expect(getWoodDensity('Teak')).toBe(0.6);
    expect(getWoodDensity('indian_rosewood')).toBe(0.75);
    expect(getWoodDensity('NOT_APPROVED')).toBeNull();
  });
});
