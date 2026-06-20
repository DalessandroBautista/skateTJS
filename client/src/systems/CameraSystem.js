import * as THREE from 'three';

/**
 * CameraSystem.js
 *
 * Cámara en tercera persona:
 * - El ángulo de cámara sigue la ROTACIÓN del skater (transform.rotation.y).
 * - La cámara siempre queda detrás de donde el personaje MIRA, no donde va.
 * - Esto evita el flip de 180° que ocurría al andar hacia atrás con velocidad-based.
 * - FOV y altura se adaptan a velocidad y estado de vuelo.
 */
export class CameraSystem {
  /**
   * @param {Object} options
   * @param {THREE.PerspectiveCamera} options.camera
   * @param {import('../components/TransformComponent.js').TransformComponent} options.target
   * @param {import('../components/VelocityComponent.js').VelocityComponent} options.velocity
   * @param {import('../components/TrickStateComponent.js').TrickStateComponent} [options.trickState]
   */
  constructor({ camera, target, velocity, trickState }) {
    this.camera = camera;
    this.target = target;
    this.velocity = velocity;
    this.trickState = trickState ?? null;

    this.offsetDistance = 8;
    this.positionSmoothing = 18;  // más rápido para no perder al jugador
    this.angleSmoothing = 6;

    this._smoothedAngle = 0;
    this._smoothedHeight = 4;   // altura interpolada: 4 en suelo, 5.5 en aire
    this._currentFov = 60;

    this._lookTarget = new THREE.Vector3();
    this._desiredPosition = new THREE.Vector3();
  }

  /**
   * @param {number} dt - Delta time en segundos
   */
  update(dt) {
    const playerPos = this.target.position;
    const vel = this.velocity.velocity;

    const speedXZ = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

    // Exponential smoothing: frame-rate independent. Cap a 0.5 para evitar saltos en stutter
    const posFactor  = Math.min(0.5, 1 - Math.exp(-this.positionSmoothing * dt));
    const angleFactor = 1 - Math.exp(-this.angleSmoothing * dt);
    const heightFactor = 1 - Math.exp(-5 * dt);
    const fovFactor   = 1 - Math.exp(-4 * dt);

    // --- Ángulo de cámara (detrás del facing del skater, no de la velocidad) ---
    // Seguir la rotación del personaje garantiza que la cámara siempre quede
    // detrás de donde el jugador mira, evitando el flip al andar hacia atrás.
    {
      const targetAngle = this.target.rotation.y;
      let angleDiff = targetAngle - this._smoothedAngle;
      while (angleDiff >  Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this._smoothedAngle += angleDiff * angleFactor;
    }

    // --- Altura adaptiva: sube cuando el jugador está en el aire ---
    // Usa trickState.isGrounded si disponible (basado en contactos reales de Cannon-es)
    const isGrounded = this.trickState ? this.trickState.isGrounded : (Math.abs(vel.y) < 2.5 && playerPos.y < 30);
    const targetHeight = isGrounded ? 4.0 : 5.5;
    this._smoothedHeight += (targetHeight - this._smoothedHeight) * heightFactor;

    const sin = Math.sin(this._smoothedAngle);
    const cos = Math.cos(this._smoothedAngle);

    this._desiredPosition.set(
      playerPos.x + sin * this.offsetDistance,
      playerPos.y + this._smoothedHeight,
      playerPos.z + cos * this.offsetDistance
    );
    if (this._desiredPosition.y < 1.5) this._desiredPosition.y = 1.5;

    this.camera.position.lerp(this._desiredPosition, posFactor);

    // Lookahead vertical: anticipa el movimiento vertical para no "perder" al jugador
    const vertLookahead = Math.max(-1, Math.min(2, vel.y * 0.08));
    this._lookTarget.set(playerPos.x, playerPos.y + 1 + vertLookahead, playerPos.z);
    // Guard: lookAt falla si cámara y objetivo están en la misma posición
    if (this.camera.position.distanceToSquared(this._lookTarget) > 0.001) {
      this.camera.lookAt(this._lookTarget);
    }

    // FOV dinámico
    const targetFov = 60 + Math.min(20, speedXZ * 1.5);
    this._currentFov += (targetFov - this._currentFov) * fovFactor;
    if (Math.abs(this.camera.fov - this._currentFov) > 0.1) {
      this.camera.fov = this._currentFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
