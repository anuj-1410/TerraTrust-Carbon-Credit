export interface Species {
  name: string;
  scientificName: string;
  woodDensity: number; // g/cm^3 - used in Chave's allometric equation
  modelLabel: string;
}

export const SPECIES_NOT_APPROVED_LABEL = 'NOT_APPROVED';

export const SPECIES_MODEL_CONFIG = {
  inputSize: 224,
  uiFallbackThreshold: 0.6,
  hardAcceptanceThreshold: 0.8,
  notApprovedIndex: 0,
} as const;

export const SPECIES_MODEL_LABEL_ORDER = [
  SPECIES_NOT_APPROVED_LABEL,
  'amla',
  'bamboo',
  'casuarina',
  'drumstick',
  'eucalyptus',
  'indian_rosewood',
  'mango',
  'neem',
  'pongamia',
  'subabul',
  'teak',
] as const;

export const APPROVED_SPECIES: Species[] = [
  {
    name: 'Teak',
    scientificName: 'Tectona grandis',
    woodDensity: 0.6,
    modelLabel: 'teak',
  },
  {
    name: 'Eucalyptus',
    scientificName: 'Eucalyptus spp.',
    woodDensity: 0.55,
    modelLabel: 'eucalyptus',
  },
  {
    name: 'Neem',
    scientificName: 'Azadirachta indica',
    woodDensity: 0.56,
    modelLabel: 'neem',
  },
  {
    name: 'Mango',
    scientificName: 'Mangifera indica',
    woodDensity: 0.54,
    modelLabel: 'mango',
  },
  {
    name: 'Bamboo',
    scientificName: 'Bambusa spp.',
    woodDensity: 0.7,
    modelLabel: 'bamboo',
  },
  {
    name: 'Pongamia',
    scientificName: 'Pongamia pinnata',
    woodDensity: 0.67,
    modelLabel: 'pongamia',
  },
  {
    name: 'Subabul',
    scientificName: 'Leucaena leucocephala',
    woodDensity: 0.56,
    modelLabel: 'subabul',
  },
  {
    name: 'Casuarina',
    scientificName: 'Casuarina equisetifolia',
    woodDensity: 0.69,
    modelLabel: 'casuarina',
  },
  {
    name: 'Indian Rosewood',
    scientificName: 'Dalbergia sissoo',
    woodDensity: 0.75,
    modelLabel: 'indian_rosewood',
  },
  {
    name: 'Drumstick',
    scientificName: 'Moringa oleifera',
    woodDensity: 0.39,
    modelLabel: 'drumstick',
  },
  {
    name: 'Amla',
    scientificName: 'Phyllanthus emblica',
    woodDensity: 0.74,
    modelLabel: 'amla',
  },
];

export const APPROVED_SPECIES_NAMES: string[] = APPROVED_SPECIES.map(
  species => species.name,
);

const MODEL_LABEL_TO_DISPLAY_NAME = Object.fromEntries(
  APPROVED_SPECIES.map(species => [species.modelLabel, species.name]),
) as Record<string, string>;

function normalizeSpeciesLookup(speciesValue: string): string {
  return speciesValue
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function normalizeSpeciesName(speciesValue: string): string | null {
  const normalizedValue = normalizeSpeciesLookup(speciesValue);

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === 'not approved') {
    return 'Not Approved';
  }

  const species = APPROVED_SPECIES.find(
    entry =>
      normalizeSpeciesLookup(entry.name) === normalizedValue ||
      normalizeSpeciesLookup(entry.modelLabel) === normalizedValue,
  );

  return species?.name ?? MODEL_LABEL_TO_DISPLAY_NAME[normalizedValue] ?? null;
}

export function isApprovedSpeciesName(speciesValue: string): boolean {
  const normalizedName = normalizeSpeciesName(speciesValue);
  return Boolean(normalizedName && normalizedName !== 'Not Approved');
}

export const getWoodDensity = (speciesName: string): number | null => {
  const normalizedName = normalizeSpeciesName(speciesName);
  if (!normalizedName || normalizedName === 'Not Approved') {
    return null;
  }

  const species = APPROVED_SPECIES.find(entry => entry.name === normalizedName);
  return species?.woodDensity ?? null;
};
