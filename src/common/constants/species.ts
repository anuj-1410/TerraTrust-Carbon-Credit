export interface Species {
  name: string;
  scientificName: string;
  woodDensity: number; // g/cm³ — used in Chave's allometric equation
}

export const APPROVED_SPECIES: Species[] = [
  {name: 'Teak', scientificName: 'Tectona grandis', woodDensity: 0.6},
  {name: 'Eucalyptus', scientificName: 'Eucalyptus spp.', woodDensity: 0.55},
  {name: 'Neem', scientificName: 'Azadirachta indica', woodDensity: 0.56},
  {name: 'Mango', scientificName: 'Mangifera indica', woodDensity: 0.54},
  {name: 'Bamboo', scientificName: 'Bambusa spp.', woodDensity: 0.7},
  {name: 'Pongamia', scientificName: 'Pongamia pinnata', woodDensity: 0.67},
  {
    name: 'Subabul',
    scientificName: 'Leucaena leucocephala',
    woodDensity: 0.56,
  },
  {
    name: 'Casuarina',
    scientificName: 'Casuarina equisetifolia',
    woodDensity: 0.69,
  },
  {
    name: 'Indian Rosewood',
    scientificName: 'Dalbergia sissoo',
    woodDensity: 0.75,
  },
  {
    name: 'Drumstick',
    scientificName: 'Moringa oleifera',
    woodDensity: 0.39,
  },
  {name: 'Amla', scientificName: 'Phyllanthus emblica', woodDensity: 0.74},
];

export const APPROVED_SPECIES_NAMES: string[] = APPROVED_SPECIES.map(
  s => s.name,
);

export const getWoodDensity = (speciesName: string): number | null => {
  const species = APPROVED_SPECIES.find(s => s.name === speciesName);
  return species?.woodDensity ?? null;
};
