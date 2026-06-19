/**
 * AchievementSystem.js
 *
 * Logros/achievements del juego.
 * - Definición de logros con condiciones
 * - Tracking de progreso en localStorage
 * - Persistencia en servidor (si el usuario está autenticado)
 */
import { networkManager } from '../network/NetworkManager.js';

const STORAGE_KEY = 'skate_achievements';

export const ACHIEVEMENTS = [
  { id: 'first_kickflip',   name: 'Primera Patada',   desc: 'Hacé tu primer Kickflip',            icon: '🛹', check: (s) => s.totalKickflips >= 1 },
  { id: 'trick_master',     name: 'Trick Master',      desc: 'Hacé 10 tricks en el aire',          icon: '🌟', check: (s) => s.totalTricks >= 10 },
  { id: 'combo_100',        name: 'Combo Inicial',     desc: 'Conseguí 100 puntos en un combo',    icon: '💯', check: (s) => s.bestCombo >= 100 },
  { id: 'combo_1000',       name: 'Combo Millar',      desc: 'Conseguí 1000 puntos en un combo',   icon: '🔥', check: (s) => s.bestCombo >= 1000 },
  { id: 'combo_5000',       name: 'Combo Legendario',  desc: '5000 puntos en un solo combo',       icon: '👑', check: (s) => s.bestCombo >= 5000 },
  { id: 'speed_demon',      name: 'Velocidad Máxima',  desc: 'Alcanzá la velocidad máxima',        icon: '💨', check: (s) => s.maxSpeed >= 11.5 },
  { id: 'grind_3s',         name: 'Grindero',          desc: 'Grind por más de 3 segundos',        icon: '⚡', check: (s) => s.longestGrind >= 3.0 },
  { id: 'level_5',          name: 'Veterano',          desc: 'Alcanzá el nivel 5',                 icon: '🏆', check: (s) => s.maxLevel >= 5 },
  { id: 'total_10k',        name: 'Puntaje Acumulado', desc: 'Acumulá 10.000 puntos en total',     icon: '💰', check: (s) => s.totalScore >= 10000 },
  { id: 'manual_5s',        name: 'Mago del Manual',   desc: 'Mantené un manual por 5 segundos',  icon: '🤸', check: (s) => s.longestManual >= 5.0 },
];

export class AchievementSystem {
  constructor() {
    this._stats = this._loadStats();
    this._unlocked = this._loadUnlocked();
    this._notifyFn = null;
  }

  /** @param {(achievement) => void} fn */
  onUnlock(fn) {
    this._notifyFn = fn;
  }

  _loadStats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY + '_stats') || '{}');
    } catch { return {}; }
  }

  _loadUnlocked() {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY + '_unlocked') || '[]'));
    } catch { return new Set(); }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY + '_stats', JSON.stringify(this._stats));
    localStorage.setItem(STORAGE_KEY + '_unlocked', JSON.stringify([...this._unlocked]));
  }

  _update(key, value, mode = 'max') {
    if (mode === 'max') {
      this._stats[key] = Math.max(this._stats[key] || 0, value);
    } else {
      this._stats[key] = (this._stats[key] || 0) + value;
    }
  }

  _check() {
    for (const ach of ACHIEVEMENTS) {
      if (!this._unlocked.has(ach.id) && ach.check(this._stats)) {
        this._unlocked.add(ach.id);
        this._save();
        networkManager.unlockAchievement(ach.id);
        if (this._notifyFn) this._notifyFn(ach);
      }
    }
  }

  /**
   * Sincroniza logros del servidor al iniciar sesión.
   * Marca como desbloqueados los que el servidor ya tiene registrados,
   * sin disparar notificaciones (ya fueron vistos en una sesión anterior).
   */
  async syncFromServer() {
    const rows = await networkManager.fetchAchievements();
    for (const { achievementId } of rows) {
      this._unlocked.add(achievementId);
    }
    if (rows.length > 0) {
      localStorage.setItem(STORAGE_KEY + '_unlocked', JSON.stringify([...this._unlocked]));
    }
  }

  // --- Métodos para actualizar estadísticas desde el juego ---

  onTrick(trickId, trickName) {
    this._update('totalTricks', 1, 'add');
    if (trickId === 'kickflip') this._update('totalKickflips', 1, 'add');
    this._check();
  }

  onComboEnd(score) {
    this._update('bestCombo', score);
    this._check();
  }

  onTotalScore(score) {
    this._update('totalScore', score, 'add');
    this._check();
  }

  onSpeedUpdate(speed) {
    this._update('maxSpeed', speed);
    this._check();
  }

  onGrindEnd(duration) {
    this._update('longestGrind', duration);
    this._check();
  }

  onManualEnd(duration) {
    this._update('longestManual', duration);
    this._check();
  }

  onLevelUp(level) {
    this._update('maxLevel', level);
    this._check();
  }

  getAll() {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: this._unlocked.has(a.id),
      progress: this._getProgress(a),
    }));
  }

  _getProgress(ach) {
    const s = this._stats;
    switch (ach.id) {
      case 'first_kickflip':  return `${Math.min(s.totalKickflips || 0, 1)}/1`;
      case 'trick_master':    return `${Math.min(s.totalTricks || 0, 10)}/10`;
      case 'combo_100':       return `${Math.min(s.bestCombo || 0, 100)}/100 pts`;
      case 'combo_1000':      return `${Math.min(s.bestCombo || 0, 1000)}/1000 pts`;
      case 'combo_5000':      return `${Math.min(s.bestCombo || 0, 5000)}/5000 pts`;
      case 'speed_demon':     return `${((s.maxSpeed || 0) * 3.6).toFixed(0)}/41 km/h`;
      case 'grind_3s':        return `${(s.longestGrind || 0).toFixed(1)}/3.0s`;
      case 'level_5':         return `Nivel ${s.maxLevel || 1}/5`;
      case 'total_10k':       return `${s.totalScore || 0}/10000 pts`;
      case 'manual_5s':       return `${(s.longestManual || 0).toFixed(1)}/5.0s`;
      default:                return '';
    }
  }
}

export const achievementSystem = new AchievementSystem();
