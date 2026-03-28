jest.mock('../src/services/ar-bridge', () => ({
  identifySpecies: jest.fn(),
}));

import {identifySpecies} from '../src/services/ar-bridge';
import {APPROVED_SPECIES_NAMES} from '../src/common/constants/species';

describe('Species inference', () => {
  it('returns an approved species when inference succeeds', async () => {
    (identifySpecies as jest.Mock).mockResolvedValue({
      species: 'Teak',
      confidence: 0.92,
      all_scores: Array(APPROVED_SPECIES_NAMES.length).fill(0),
    });

    const result = await identifySpecies('mock_frame_data');
    expect(APPROVED_SPECIES_NAMES).toContain(result.species);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});