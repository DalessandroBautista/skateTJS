/**
 * shared/constants/tricks.js
 * 
 * IDs de todos los tricks del juego.
 * Evita magic strings en TrickLibrary, TrickSystem y ScoreValidator.
 */
export const TRICK_IDS = {
  // Aéreos básicos
  KICKFLIP: 'kickflip',
  HEELFLIP: 'heelflip',
  THREE_SIXTY_FLIP: '360_flip',

  // Grinds
  FIFTY_FIFTY: '50_50',
  SMITH: 'smith',
  FEEBLE: 'feeble',
  NOSEGRIND: 'nosegrind',

  // Manuals
  MANUAL: 'manual',
  NOSE_MANUAL: 'nose_manual',

  // Especiales
  IMPOSSIBLE: 'impossible',
  HARD_FLIP: 'hardflip',
  VARIAL_KICKFLIP: 'varial_kickflip',
  THREE_SIXTY_HARD_FLIP: '360_hardflip',
  NOLLIE_FLIP: 'nollie_flip',
};
