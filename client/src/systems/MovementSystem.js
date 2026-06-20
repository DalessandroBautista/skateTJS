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
    this._jumpCooldown = 0; // evita doble salto en el pico del arco

    this._moveDir = new THREE.Vector3();
    this._force = new CANNON.Vec3();
    this._wasInAir = false;
    this._airborneFrames = 0; // debounce para evitar animación de salto falsa

    this._grindTimer = 0;
    this._spawnPoint = new CANNON.Vec3(0, 8, 0); // FY=4.5 + altura spawn
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

    // Cap velocidad vertical: evita lanzamientos extremos por colisión con aristas
    if (body.velocity.y > this.jumpImpulse * 2.5) {
      body.velocity.y = this.jumpImpulse * 2.5;
    }

    // Cap horizontal: el step de física (PhysicsSystem) puede producir impulsos enormes
    // cuando la esfera toca la arista entre rampa y suelo. Este clamp corre al inicio
    // del frame siguiente al step de física, cortando la velocidad antes de que el
    // jugador vuele una distancia visible.
    const _hRaw = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
    if (_hRaw > this.maxSpeed * 1.5) {
      const _hs = (this.maxSpeed * 1.5) / _hRaw;
      body.velocity.x *= _hs;
      body.velocity.z *= _hs;
    }

    // --- Respawn manual (R) o automático (caída) ---
    if (this.input.isKeyPressed('KeyR') || pos.y < -5) {
      // Cerrar grind con puntos antes de respawnear
      if (this._grindTimer > 0 && this.onGrindEnd) {
        this.onGrindEnd(Math.min(1000, Math.round(this._grindTimer * 150)));
      }
      body.position.copy(this._spawnPoint);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      this.transform.rotation.y = 0;
      this.trickState.setState('idle');
      this._currentRail = null;
      this._grindTimer = 0;
      this._manualTimer = 0;
      this._wasInAir = false;
      this._airborneFrames = 0;
      return;
    }

    // --- Detección de suelo via contactos de Cannon-es ---
    // Más fiable que velocidad vertical: solo true si hay colisión con normal hacia arriba.
    const world = body.world;
    let isGrounded = false;
    if (world) {
      for (const contact of world.contacts) {
        if (contact.bi !== body && contact.bj !== body) continue;
        // ni apunta de bi hacia bj; si bj=player → normal apunta hacia arriba (suelo debajo)
        const upward = contact.bj === body ? contact.ni.y : -contact.ni.y;
        if (upward > 0.3) { isGrounded = true; break; }
      }
    }
    this.trickState.isGrounded = isGrounded;

    // Debounce: contar frames consecutivos sin contacto de suelo
    if (!isGrounded) {
      this._airborneFrames++;
    } else {
      this._airborneFrames = 0;
    }

    // --- Detección de landing (instantánea al recuperar contacto) ---
    if (this._wasInAir && isGrounded) {
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
      this.trickState.setState(speed > 0.5 ? 'skating' : 'idle');
      if (this.onLand) this.onLand();
      this._wasInAir = false;
    }

    // _wasInAir se activa solo tras 4+ frames sin suelo (o al saltar explícitamente)
    if (this._airborneFrames > 4) this._wasInAir = true;

    // --- Estado airborne: esperar 4 frames sin contacto para evitar animación falsa ---
    // Esto evita que micro-bumps o pérdidas de contacto de 1-2 frames activen el jump
    if (this._airborneFrames > 4 && this.trickState.state !== 'grinding') {
      this.trickState.setState('airborne');
    }

    this.trickState.stateTimer += dt;

    // --- Salto (Space) ---
    if (this.input.isKeyPressed('Space')) {
      if (this.trickState.state === 'grinding') {
        this._currentRail = null;
        body.velocity.y = this.jumpImpulse;
        this.trickState.setState('airborne');
        this._wasInAir = true;
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
      // Los pies del jugador (pos.y - 0.5) deben estar dentro de ±0.4m del rail.
      // El check original (pos.y - 0.5 <= railY + 0.3) era verdadero incluso en el
      // suelo, causando grinds falsos en rails invisibles cercanos.
      if (nearRail && Math.abs((pos.y - 0.5) - nearRail.start.y) <= 0.4) {
        // Proyectar posición del jugador sobre el rail para calcular t de entrada
        const railVec = new THREE.Vector3().subVectors(nearRail.end, nearRail.start);
        const railLen = railVec.length();
        const railDir = railVec.clone().normalize();
        if (railLen > 0.01) {
          const toPlayer = new THREE.Vector3(pos.x, pos.y, pos.z).sub(nearRail.start);
          nearRail.t = Math.max(0, Math.min(1, toPlayer.dot(railDir) / railLen));
        } else {
          nearRail.t = 0;
        }
        this._currentRail = nearRail;
        this.trickState.setState('grinding');
        // Dirección inicial: misma que la velocidad del jugador proyectada sobre el rail
        const playerVel = new THREE.Vector3(body.velocity.x, 0, body.velocity.z);
        this._grindDirection = playerVel.dot(railDir) >= 0 ? 1 : -1;
      }
    }

    // --- Lógica de grinding ---
    if (this.trickState.state === 'grinding' && this._currentRail) {
      // Si veníamos del aire, el aterrizaje es el rail
      if (this._wasInAir) this._wasInAir = false;
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
      // S: frenar
      const brakeFactor = Math.pow(0.12, dt);
      body.velocity.x *= brakeFactor;
      body.velocity.z *= brakeFactor;
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
      if (speed < 0.5 && this.trickState.state !== 'idle') {
        this.trickState.setState('idle');
      }
    } else if (axis.z === 0) {
      // Sin input: fricción fuerte en tierra, suave en aire
      // Aplica siempre para evitar deslizamiento indefinido por linearDamping bajo
      if (this.trickState.isGrounded) {
        const brakeFactor = Math.pow(0.001, dt); // ~0.3s para parar
        body.velocity.x *= brakeFactor;
        body.velocity.z *= brakeFactor;
        if (Math.abs(body.velocity.x) < 0.05) body.velocity.x = 0;
        if (Math.abs(body.velocity.z) < 0.05) body.velocity.z = 0;
        const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.z ** 2);
        if (speed < 0.5 && this.trickState.state !== 'idle') {
          this.trickState.setState('idle');
        }
      } else {
        // Drag aéreo: más suave pero evita que siga acelerando en el aire
        const airBrake = Math.pow(0.08, dt); // ~1.5s para parar en aire
        body.velocity.x *= airBrake;
        body.velocity.z *= airBrake;
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
    // Guard: rail degenerado (start === end) — salir sin crashear
    if (railLen < 0.01) {
      this._currentRail = null;
      this._airborneFrames = 5;
      this._wasInAir = true;
      this.trickState.setState('airborne');
      return;
    }
    railDir.normalize();

    // Avanzar en la dirección del grind
    let newT = rail.t + this._grindDirection * (this.grindSpeed * dt) / railLen;

    // Salir del rail al llegar al extremo (no rebotar)
    if (newT >= 1 || newT <= 0) {
      this._currentRail = null;
      this._airborneFrames = 5; // forzar detección de airborne inmediatamente
      this._wasInAir = true;
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
