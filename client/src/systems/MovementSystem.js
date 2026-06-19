import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * MovementSystem.js
 *
 * Sprint 1.9: Grinds sobre rails.
 * - Detecta rails cercanos → entra en estado grinding
 * - Desliza al skater a lo largo del rail
 * - Sale del rail al saltar o llegar al final
 *
 * Sprint 1.7: Salto + detección de suelo + airborne.
 * - Space para saltar
 * - Raycast para detectar suelo
 *
 * Flujo: InputManager → MovementSystem → Cannon body → PhysicsSystem → TransformComponent
 */
export class MovementSystem {
  constructor({ inputManager, playerTransform, playerPhysics, trickState, interactiveObjects }) {
    this.input = inputManager;
    this.transform = playerTransform;
    this.physics = playerPhysics;
    this.trickState = trickState;
    this.interactiveObjects = interactiveObjects;

    // Movimiento horizontal
    this.acceleration = 40;
    this.maxSpeed = 12;
    this.turnSpeed = 2.5;   // rad/s — 180° tarda ~1.25s, más realista

    // Salto
    this.jumpImpulse = 6;
    this.groundThreshold = 0.6;

    // Grinds
    this.grailDetectRadius = 2;
    this.grindSpeed = 6;
    this._currentRail = null; // { start, end, point, t }
    this._grindDirection = 1;

    this._moveDir = new THREE.Vector3();
    this._force = new CANNON.Vec3();
    this._wasInAir = false;

    this._grindTimer = 0;
    this._spawnPoint = new CANNON.Vec3(0, 5, 0);
    this._manualTimer = 0;

    this.onGrindEnd = null;
    this.onGrindTick = null;
    this.onJump = null;
    this.onLand = null;
  }

  update(dt) {
    this.input.update();

    const axis = this.input.getMovementAxis();
    const body = this.physics.body;
    const pos = body.position;

    // --- Respawn manual (R) o automático (caída) ---
    if (this.input.isKeyPressed('KeyR') || pos.y < -20) {
      body.position.copy(this._spawnPoint);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      this.transform.rotation.y = 0;
      this.trickState.setState('idle');
      this._currentRail = null;
      this._grindTimer = 0;
      return;
    }

    // --- Detección de suelo ---
    // Usamos velocidad vertical baja como indicador: si el jugador se mueve
    // poco en Y (abs < 2.5 m/s) y no está demasiado alto, está "en suelo".
    // Esto funciona tanto en el piso principal como en plataformas elevadas.
    const verticalSpeed = Math.abs(body.velocity.y);
    this.trickState.isGrounded = verticalSpeed < 2.5 && pos.y < 30;

    // --- Detección de landing ---
    if (this._wasInAir && this.trickState.isGrounded) {
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
      this.trickState.setState(speed > 0.5 ? 'skating' : 'idle');
      if (this.onLand) this.onLand();
    }
    this._wasInAir = !this.trickState.isGrounded;

    // --- Estado airborne si no está en suelo ni grinding ---
    if (!this.trickState.isGrounded && this.trickState.state !== 'grinding') {
      this.trickState.setState('airborne');
    }

    this.trickState.stateTimer += dt;

    // --- Salto (Space) ---
    if (this.input.isKeyPressed('Space')) {
      if (this.trickState.state === 'grinding') {
        this._currentRail = null;
        body.velocity.y = this.jumpImpulse;
        this.trickState.setState('airborne');
        if (this.onJump) this.onJump();
      } else if (this.trickState.isGrounded) {
        body.velocity.y = this.jumpImpulse;
        this.trickState.setState('airborne');
        this._wasInAir = true;
        if (this.onJump) this.onJump();
      }
    }

    // --- Grind: detectar rail ---
    if (this.trickState.state !== 'grinding' && !this.trickState.isGrounded) {
      // Posibilidad de aterrizar en un rail
      const nearRail = this.interactiveObjects.findNearestRail(
        new THREE.Vector3(pos.x, pos.y, pos.z),
        this.grailDetectRadius
      );
      if (nearRail && pos.y - 0.5 <= nearRail.start.y + 0.3) {
        this._currentRail = nearRail;
        this.trickState.setState('grinding');
        // Dirección inicial: misma que la velocidad del jugador proyectada sobre el rail
        const railDir = new THREE.Vector3().subVectors(nearRail.end, nearRail.start).normalize();
        const playerVel = new THREE.Vector3(body.velocity.x, 0, body.velocity.z);
        this._grindDirection = playerVel.dot(railDir) >= 0 ? 1 : -1;
      }
    }

    // --- Lógica de grinding ---
    if (this.trickState.state === 'grinding' && this._currentRail) {
      this._grindTimer += dt;
      if (this.onGrindTick) this.onGrindTick();
      this._updateGrind(dt, pos, body);
      return;
    } else if (this._grindTimer > 0) {
      // Acaba de salir del grind — calcular puntos
      const pts = Math.min(1000, Math.round(this._grindTimer * 150));
      if (this.onGrindEnd) this.onGrindEnd(pts);
      this._grindTimer = 0;
      this._currentRail = null;
    }

    // --- Manual (M mantenido en el suelo mientras se mueve) ---
    if (this.input.isKeyDown('KeyM') && this.trickState.isGrounded &&
        (this.trickState.state === 'skating' || this.trickState.state === 'manual')) {
      this.trickState.setState('manual');
      this._manualTimer += dt;
      const pts = Math.round(this._manualTimer * 10);
      if (this.onManualTick) this.onManualTick(pts);
    } else if (this.trickState.state === 'manual') {
      if (this._manualTimer > 0 && this.onGrindEnd) {
        this.onGrindEnd(Math.min(500, Math.round(this._manualTimer * 100)));
      }
      this._manualTimer = 0;
      this.trickState.setState(this.trickState.isGrounded ? 'skating' : 'airborne');
    } else {
      this._manualTimer = 0;
    }

    // --- Rotación del skater (A/D) ---
    if (axis.x !== 0) {
      this.transform.rotation.y -= axis.x * this.turnSpeed * dt;
    }

    // --- Movimiento horizontal ---
    // Air control: 35% de fuerza en el aire para mantener momentum al saltar
    const airborne = !this.trickState.isGrounded && this.trickState.state !== 'grinding';

    if (axis.z < 0 && (this.trickState.isGrounded || airborne)) {
      // W: empujar hacia adelante en la dirección que el skater mira
      const skaterAngle = this.transform.rotation.y;
      this._moveDir.set(-Math.sin(skaterAngle), 0, -Math.cos(skaterAngle));

      const airFactor = airborne ? 0.35 : 1.0;
      const forceMagnitude = this.acceleration * body.mass * airFactor;
      this._force.set(
        this._moveDir.x * forceMagnitude,
        0,
        this._moveDir.z * forceMagnitude
      );
      body.applyForce(this._force, body.position);

      if (this.trickState.isGrounded && (this.trickState.state === 'idle' || this.trickState.state === 'skating')) {
        this.trickState.setState('skating');
      }
    } else if (axis.z > 0 && this.trickState.isGrounded) {
      // S: frenar — el skate no anda de espaldas
      // Para ir al otro lado: girar con A/D y luego W
      const brakeFactor = Math.pow(0.12, dt); // a 1s de presionar S → velocidad al 12%
      body.velocity.x *= brakeFactor;
      body.velocity.z *= brakeFactor;

      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
      if (speed < 0.5 && this.trickState.state !== 'idle') {
        this.trickState.setState('idle');
      }
    } else if (this.trickState.isGrounded && axis.z === 0) {
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
      if (speed < 0.5 && this.trickState.state !== 'idle') {
        this.trickState.setState('idle');
      }
    }

    // --- Limitar velocidad máxima ---
    const hSpeed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
    if (hSpeed > this.maxSpeed) {
      const scale = this.maxSpeed / hSpeed;
      body.velocity.x *= scale;
      body.velocity.z *= scale;
    }
  }

  _updateGrind(dt, pos, body) {
    const rail = this._currentRail;

    // Avanzar a lo largo del rail
    const railDir = new THREE.Vector3().subVectors(rail.end, rail.start);
    const railLen = railDir.length();
    railDir.normalize();

    // Avanzar en la dirección del grind
    let newT = rail.t + this._grindDirection * (this.grindSpeed * dt) / railLen;

    // Salir del rail al llegar al extremo (no rebotar)
    if (newT >= 1 || newT <= 0) {
      this._currentRail = null;
      this.trickState.setState('airborne');
      return;
    }

    // Posición en el rail
    const point = new THREE.Vector3().copy(rail.start).add(
      railDir.clone().multiplyScalar(newT * railLen)
    );

    // Posicionar el body sobre el rail
    body.position.set(point.x, point.y + 0.5, point.z);
    body.velocity.set(
      railDir.x * this.grindSpeed * this._grindDirection,
      0,
      railDir.z * this.grindSpeed * this._grindDirection
    );

    // Actualizar rail
    rail.t = newT;
    rail.point = point;

    // Rotar skater en dirección del rail
    this.transform.rotation.y = Math.atan2(railDir.x, railDir.z);
  }
}
