/**
 * ComboSystem.js
 * 
 * SYSTEM (lógica que opera sobre componentes).
 * 
 * Gestiona el combo: timer, multiplicador y puntaje total.
 * - Cuando el timer llega a 0, el combo termina y se suman los puntos
 * - Cada trick nuevo reinicia el timer
 * - El multiplicador sube cada 3 tricks (×1 → ×2 → ×3 → ×4)
 * 
 * Flujo: TrickSystem → ComboSystem → ComboComponent → HUD
 */
export class ComboSystem {
  constructor() {
    /**
     * @type {Array<{
     *   combo: import('../components/ComboComponent.js').ComboComponent,
     *   trickState: import('../components/TrickStateComponent.js').TrickStateComponent
     * }>}
     */
    this.entities = [];

    /**
     * Callback cuando un combo termina (para actualizar HUD y puntaje total).
     * @type {(score: number) => void}
     */
    this.onComboEnd = null;
  }

  /**
   * @param {import('../components/ComboComponent.js').ComboComponent} combo
   * @param {import('../components/TrickStateComponent.js').TrickStateComponent} trickState
   */
  register(combo, trickState) {
    this.entities.push({ combo, trickState });
  }

  /**
   * @param {number} dt - Delta time en segundos
   */
  update(dt) {
    for (let i = 0; i < this.entities.length; i++) {
      const { combo, trickState } = this.entities[i];

      if (!combo.isActive) continue;

      // Reducir timer
      combo.timer -= dt;

      // Si el timer llega a 0, terminar combo
      if (combo.timer <= 0) {
        const finalScore = combo.endCombo();
        console.log(`[Combo] Terminado! ${finalScore} puntos`);
        if (this.onComboEnd) {
          this.onComboEnd(finalScore);
        }
      }
    }
  }
}
