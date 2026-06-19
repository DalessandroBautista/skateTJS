/**
 * TrickLibrary.js
 * 
 * Catálogo de todos los tricks disponibles en el juego.
 * Cada trick tiene:
 * - id: identificador único
 * - name: nombre visible
 * - points: puntos base
 * - inputSequence: combinación de teclas para activarlo (["jump", "trick1"])
 * - animationClip: nombre del clip de animación (para cuando tengamos modelo riggeado)
 * - requiredLevel: nivel necesario para desbloquearlo
 * - type: 'aerial' | 'grind' | 'manual' | 'special'
 */
export const TrickLibrary = [
  // --- Aéreos básicos (nivel 1) ---
  {
    id: 'kickflip',
    name: 'Kickflip',
    points: 100,
    inputSequence: ['trick1'],
    animationClip: 'kickflip',
    requiredLevel: 1,
    type: 'aerial',
  },
  {
    id: 'heelflip',
    name: 'Heelflip',
    points: 100,
    inputSequence: ['trick2'],
    animationClip: 'heelflip',
    requiredLevel: 1,
    type: 'aerial',
  },
  {
    id: '360_flip',
    name: '360 Flip',
    points: 250,
    inputSequence: ['trick1', 'trick2'],
    animationClip: '360flip',
    requiredLevel: 2,
    type: 'aerial',
  },
  // --- Aéreos intermedios (nivel 2) ---
  {
    id: 'pop_shoveit',
    name: 'Pop Shove-It',
    points: 150,
    inputSequence: ['trick2', 'trick1'],
    animationClip: 'pop_shoveit',
    requiredLevel: 2,
    type: 'aerial',
  },
  {
    id: 'varial_kickflip',
    name: 'Varial Kickflip',
    points: 300,
    inputSequence: ['trick1', 'trick1'],
    animationClip: 'varial_kickflip',
    requiredLevel: 3,
    type: 'aerial',
  },
  // --- Grabs (nivel 1, tecla Q/LB) ---
  {
    id: 'indy',
    name: 'Indy Grab',
    points: 100,
    inputSequence: ['trick3'],
    animationClip: 'indy',
    requiredLevel: 1,
    type: 'aerial',
  },
  {
    id: 'nose_grab',
    name: 'Nose Grab',
    points: 100,
    inputSequence: ['trick4'],
    animationClip: 'nose_grab',
    requiredLevel: 1,
    type: 'aerial',
  },
  {
    id: 'stalefish',
    name: 'Stalefish',
    points: 250,
    inputSequence: ['trick3', 'trick4'],
    animationClip: 'stalefish',
    requiredLevel: 2,
    type: 'aerial',
  },
  {
    id: 'mute',
    name: 'Mute Grab',
    points: 250,
    inputSequence: ['trick4', 'trick3'],
    animationClip: 'mute',
    requiredLevel: 2,
    type: 'aerial',
  },
  // --- Combos flip+grab (nivel 3) ---
  {
    id: 'varial_heelflip',
    name: 'Varial Heelflip',
    points: 350,
    inputSequence: ['trick1', 'trick3'],
    animationClip: 'varial_heelflip',
    requiredLevel: 3,
    type: 'aerial',
  },
  {
    id: 'bigspin',
    name: 'Bigspin',
    points: 350,
    inputSequence: ['trick2', 'trick4'],
    animationClip: 'bigspin',
    requiredLevel: 3,
    type: 'aerial',
  },
  // --- Especiales (nivel 3+) ---
  {
    id: 'impossible',
    name: 'Impossible',
    points: 400,
    inputSequence: ['trick2', 'trick2'],
    animationClip: 'impossible',
    requiredLevel: 4,
    type: 'special',
  },
  {
    id: 'hardflip',
    name: 'Hardflip',
    points: 350,
    inputSequence: ['trick1', 'trick2', 'trick1'],
    animationClip: 'hardflip',
    requiredLevel: 3,
    type: 'aerial',
  },
  {
    id: 'kickflip_indy',
    name: 'Kickflip Indy',
    points: 500,
    inputSequence: ['trick1', 'trick2', 'trick3'],
    animationClip: 'kickflip_indy',
    requiredLevel: 4,
    type: 'special',
  },
  // --- Specials de nivel 5 ---
  {
    id: 'nine_hundred',
    name: '900',
    points: 1500,
    inputSequence: ['trick3', 'trick3'],
    animationClip: '900',
    requiredLevel: 5,
    type: 'special',
  },
  {
    id: 'mctwist',
    name: 'McTwist',
    points: 1200,
    inputSequence: ['trick4', 'trick4'],
    animationClip: 'mctwist',
    requiredLevel: 5,
    type: 'special',
  },
  // --- Manuals (nivel 2) ---
  {
    id: 'manual',
    name: 'Manual',
    points: 50,
    inputSequence: ['manual'],
    animationClip: 'manual',
    requiredLevel: 2,
    type: 'manual',
  },
  {
    id: 'nose_manual',
    name: 'Nose Manual',
    points: 50,
    inputSequence: ['nose_manual'],
    animationClip: 'nose_manual',
    requiredLevel: 2,
    type: 'manual',
  },
  // --- Grinds (nivel 1) ---
  {
    id: '50_50',
    name: '50-50',
    points: 150,
    inputSequence: [],
    animationClip: '50_50',
    requiredLevel: 1,
    type: 'grind',
  },
  {
    id: 'smith',
    name: 'Smith Grind',
    points: 200,
    inputSequence: [],
    animationClip: 'smith',
    requiredLevel: 2,
    type: 'grind',
  },
  {
    id: 'feeble',
    name: 'Feeble Grind',
    points: 200,
    inputSequence: [],
    animationClip: 'feeble',
    requiredLevel: 2,
    type: 'grind',
  },
];

// Índice por ID para búsqueda rápida
/** @type {Map<string, { id: string, name: string, points: number, inputSequence: string[], animationClip: string, requiredLevel: number, type: string }>} */
export const TrickById = new Map(TrickLibrary.map((t) => [t.id, t]));

/**
 * Filtra los tricks disponibles para un nivel dado.
 * @param {number} level
 * @returns {typeof TrickLibrary}
 */
export function getAvailableTricks(level) {
  return TrickLibrary.filter((t) => t.requiredLevel <= level);
}
