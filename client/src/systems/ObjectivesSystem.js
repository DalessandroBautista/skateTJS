/**
 * ObjectivesSystem.js
 *
 * Fase 5: Objetivos por sesión.
 * - 3 misiones aleatorias por partida (del pool de ~14)
 * - Tracking de progreso en tiempo real
 * - Callback onComplete(mission) cuando una misión se completa
 * - También trackea gaps (zonas airborne entre dos puntos)
 */

const MISSION_POOL = [
  { id: 'tricks_5',    text: 'Hacé 5 tricks',               type: 'tricks',      target: 5 },
  { id: 'tricks_10',   text: 'Hacé 10 tricks',              type: 'tricks',      target: 10 },
  { id: 'grinds_3',    text: 'Completá 3 grinds',           type: 'grinds',      target: 3 },
  { id: 'grinds_5',    text: 'Completá 5 grinds',           type: 'grinds',      target: 5 },
  { id: 'combo_500',   text: 'Conseguí 500 pts en un combo',type: 'combo',       target: 500 },
  { id: 'combo_1000',  text: '1000 pts en un combo',        type: 'combo',       target: 1000 },
  { id: 'letters_3',   text: 'Colectá 3 letras S-K-A-T-E', type: 'letters',     target: 3 },
  { id: 'letters_5',   text: '¡Completá S-K-A-T-E!',       type: 'letters',     target: 5 },
  { id: 'speed_30',    text: 'Alcanzá 30 km/h',             type: 'speed',       target: 30 / 3.6 },
  { id: 'kickflip_3',  text: 'Hacé 3 Kickflips',            type: 'trick_id',    trickId: 'kickflip', target: 3 },
  { id: 'grabs_3',     text: 'Hacé 3 grabs (Q o E)',        type: 'grab',        target: 3 },
  { id: 'manual_3s',   text: 'Manual de 3+ segundos',       type: 'manual',      target: 3 },
  { id: 'score_5k',    text: 'Acumulá 5000 puntos',         type: 'total_score', target: 5000 },
  { id: 'score_10k',   text: 'Acumulá 10.000 puntos',       type: 'total_score', target: 10000 },
];

const GRAB_IDS = new Set(['indy', 'nose_grab', 'stalefish', 'mute', 'varial_heelflip', 'bigspin', 'kickflip_indy', 'nine_hundred', 'mctwist']);

export class ObjectivesSystem {
  constructor() {
    this._missions = this._pickMissions(3);
    this._progress = Object.fromEntries(this._missions.map(m => [m.id, 0]));
    this._completed = new Set();
    this._onComplete = null;
    this._totalScore = 0;
  }

  /** @param {(mission: object) => void} fn */
  onComplete(fn) { this._onComplete = fn; }

  getMissions() {
    return this._missions.map(m => ({
      ...m,
      progress: this._progress[m.id],
      done: this._completed.has(m.id),
    }));
  }

  // --- Hooks desde el juego ---

  onTrick(trickId) {
    this._inc('tricks', 1);
    if (GRAB_IDS.has(trickId)) this._inc('grab', 1);
    this._missions.filter(m => m.type === 'trick_id' && m.trickId === trickId).forEach(m => {
      this._incMission(m, 1);
    });
    this._checkAll();
  }

  onGrindEnd() {
    this._inc('grinds', 1);
    this._checkAll();
  }

  onComboEnd(score) {
    this._missions.filter(m => m.type === 'combo').forEach(m => {
      if (score > (this._progress[m.id] || 0)) {
        this._progress[m.id] = score;
      }
    });
    this._checkAll();
  }

  onTotalScore(added) {
    this._totalScore += added;
    this._missions.filter(m => m.type === 'total_score').forEach(m => {
      this._progress[m.id] = this._totalScore;
    });
    this._checkAll();
  }

  onSpeedUpdate(speed) {
    this._missions.filter(m => m.type === 'speed').forEach(m => {
      if (speed > (this._progress[m.id] || 0)) this._progress[m.id] = speed;
    });
    this._checkAll();
  }

  onLetterCollected(count) {
    this._missions.filter(m => m.type === 'letters').forEach(m => {
      this._progress[m.id] = count;
    });
    this._checkAll();
  }

  onManualEnd(duration) {
    this._missions.filter(m => m.type === 'manual').forEach(m => {
      if (duration > (this._progress[m.id] || 0)) this._progress[m.id] = duration;
    });
    this._checkAll();
  }

  // --- Internos ---

  _inc(type, amount) {
    this._missions.filter(m => m.type === type).forEach(m => this._incMission(m, amount));
  }

  _incMission(mission, amount) {
    if (this._completed.has(mission.id)) return;
    this._progress[mission.id] = (this._progress[mission.id] || 0) + amount;
  }

  _checkAll() {
    for (const m of this._missions) {
      if (this._completed.has(m.id)) continue;
      if ((this._progress[m.id] || 0) >= m.target) {
        this._completed.add(m.id);
        if (this._onComplete) this._onComplete(m);
      }
    }
  }

  _pickMissions(count) {
    const shuffled = [...MISSION_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}
