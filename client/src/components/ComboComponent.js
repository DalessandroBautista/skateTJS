/**
 * ComboComponent.js
 * 
 * COMPONENTE (solo datos, sin lógica de juego).
 * 
 * Almacena el estado del combo actual:
 * - multiplier: ×1 a ×4 (sube cada 3 tricks consecutivos)
 * - timer: tiempo restante antes de que termine el combo
 * - tricks: lista de tricks en el combo actual
 * 
 * Convención ECS-ready: este archivo NO contiene lógica.
 * ComboSystem opera sobre estos datos.
 */
export class ComboComponent {
  constructor() {
    this.multiplier = 1;
    this.timer = 0;
    this.maxTimer = 3; // segundos antes de perder el combo
    this.tricks = []; // { id, name, points, timestamp }
    this.score = 0; // Puntos totales del combo actual
    this.isActive = false;
  }

  /**
   * Agrega un trick al combo y actualiza el timer.
   * @param {{ id: string, name: string, points: number }} trick
   */
  addTrick(trick) {
    this.tricks.push({ ...trick, timestamp: performance.now() });
    this.timer = this.maxTimer;
    this.isActive = true;

    // Calcular multiplicador: cada 3 tricks sube un nivel (máx ×4)
    const trickCount = this.tricks.length;
    if (trickCount >= 9) this.multiplier = 4;
    else if (trickCount >= 6) this.multiplier = 3;
    else if (trickCount >= 3) this.multiplier = 2;
    else this.multiplier = 1;

    // Calcular score del combo: suma de puntos × multiplicador
    this.score = this.tricks.reduce((sum, t) => sum + t.points, 0) * this.multiplier;
  }

  /**
   * Agrega puntos de grind/manual al combo activo (sin incrementar trick count).
   * @param {number} points
   * @param {string} label - Texto para mostrar en HUD
   */
  addBonus(points, label = 'Grind') {
    if (!this.isActive) {
      // Iniciar combo si no hay uno activo
      this.tricks.push({ id: 'grind', name: label, points, timestamp: performance.now() });
      this.timer = this.maxTimer;
      this.isActive = true;
      this.score = points;
      return;
    }
    this.timer = this.maxTimer;
    this.score += points * this.multiplier;
    // Añadir a tricks para mostrar en HUD
    this.tricks.push({ id: 'grind', name: label, points, timestamp: performance.now() });
    if (this.tricks.length > 12) this.tricks.shift();
  }

  /**
   * Termina el combo y resetea el estado.
   * @returns {number} Puntos totales finales del combo
   */
  endCombo() {
    const finalScore = this.score;
    this.multiplier = 1;
    this.timer = 0;
    this.tricks = [];
    this.score = 0;
    this.isActive = false;
    return finalScore;
  }
}
