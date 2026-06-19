/**
 * shared/constants/maps.js
 * 
 * IDs y nombres de todos los mapas del juego.
 * Evita magic strings en cliente y servidor.
 */
export const MAPS = {
  SKATE_PARK: {
    id: 'skate_park',
    name: 'Skate Park',
    description: 'Mapa de desarrollo con rampas básicas',
    maxPlayers: 50,
  },
  BUENOS_AIRES: {
    id: 'buenos_aires',
    name: 'Buenos Aires',
    description: 'Calles y plazas de Buenos Aires',
    maxPlayers: 50,
  },
  TOKYO: {
    id: 'tokyo',
    name: 'Tokyo',
    description: 'Shibuya y alrededores',
    maxPlayers: 50,
  },
  NYC: {
    id: 'nyc',
    name: 'New York City',
    description: 'Manhattan downtown',
    maxPlayers: 50,
  },
};

export const MAP_IDS = Object.values(MAPS).map((m) => m.id);
