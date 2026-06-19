/**
 * AnimationSystem.js
 * 
 * SYSTEM (lógica que opera sobre componentes).
 * 
 * Maneja las animaciones del skater según su TrickStateComponent.
 * Usa animación procedural (sin rig) para el placeholder.
 * 
 * Estados:
 * - idle:    Balanceo suave (esperando)
 * - skating: Movimiento de pump (empujar) al acelerar
 * - airborne: Postura en el aire
 * - grinding: Postura de grind
 * 
 * Flujo: TrickStateComponent → AnimationSystem → MeshComponent (partes del cuerpo)
 */
export class AnimationSystem {
  constructor() {
    /**
     * @type {Array<{
     *   mesh: import('../components/MeshComponent.js').MeshComponent,
     *   trickState: import('../components/TrickStateComponent.js').TrickStateComponent,
     *   velocity?: import('../components/VelocityComponent.js').VelocityComponent
     * }>}
     */
    this.entities = [];

    // Tiempo acumulado para animaciones procedurales
    this._time = 0;

    // Jugador local con FBX + AnimationMixer (Michelle)
    this._mixerPlayer = null;
  }

  /**
   * @param {import('../components/MeshComponent.js').MeshComponent} mesh
   * @param {import('../components/TrickStateComponent.js').TrickStateComponent} trickState
   * @param {import('../components/VelocityComponent.js').VelocityComponent} [velocity]
   */
  register(mesh, trickState, velocity) {
    this.entities.push({ mesh, trickState, velocity });
  }

  /**
   * Registra el jugador local (Michelle FBX) con AnimationMixer.
   * Sustituye la animación procedural del player local.
   */
  registerMixerPlayer(mixer, clips, trickState) {
    this._mixerPlayer = { mixer, clips, trickState, currentAction: null, lastState: null };
    // Arrancar con idle; si no existe, usar skate como fallback
    const startClip = clips.idle ?? clips.skate;
    if (!startClip) {
      console.warn('[AnimationSystem] No hay clips disponibles para Michelle');
      return;
    }
    const action = mixer.clipAction(startClip);
    action.play();
    this._mixerPlayer.currentAction = action;
    this._mixerPlayer.lastState = trickState.state;
  }

  /**
   * @param {number} dt - Delta time en segundos
   */
  update(dt) {
    this._time += dt;

    // Animación FBX del jugador local
    if (this._mixerPlayer) {
      this._updateMixerPlayer(dt);
    }

    // Animación procedural de jugadores remotos (bloque)
    for (let i = 0; i < this.entities.length; i++) {
      const { mesh, trickState, velocity } = this.entities[i];
      const bones = mesh.model.userData.bones;
      if (!bones) continue;

      const state = trickState.state;

      switch (state) {
        case 'idle':
          this._animateIdle(bones, dt);
          break;
        case 'skating':
          this._animateSkating(bones, dt, velocity);
          break;
        case 'airborne':
          this._animateAirborne(bones, dt);
          break;
        case 'grinding':
          this._animateGrinding(bones, dt);
          break;
      }
    }
  }

  _updateMixerPlayer(dt) {
    const { mixer, clips, trickState } = this._mixerPlayer;
    const state = trickState.state;

    if (state !== this._mixerPlayer.lastState) {
      this._mixerPlayer.lastState = state;

      let clip;
      switch (state) {
        case 'skating':  clip = clips.skate; break;
        case 'airborne': clip = clips.jump;  break;
        default:         clip = clips.idle;  break;
      }

      if (clip) {
        const next = mixer.clipAction(clip);
        if (this._mixerPlayer.currentAction && this._mixerPlayer.currentAction !== next) {
          this._mixerPlayer.currentAction.crossFadeTo(next, 0.25, true);
        }
        next.play();
        this._mixerPlayer.currentAction = next;
      }
    }

    mixer.update(dt);
  }

  _animateIdle(bones, dt) {
    // Balanceo suave del torso y cabeza
    const bob = Math.sin(this._time * 2) * 0.02;
    if (bones.torso) {
      bones.torso.position.y = 0.4 + bob;
    }
    if (bones.head) {
      bones.head.position.y = 0.9 + bob;
    }
    // Brazos relajados
    if (bones.leftArm) {
      bones.leftArm.rotation.x = 0.1;
    }
    if (bones.rightArm) {
      bones.rightArm.rotation.x = -0.1;
    }
    // Piernas rectas
    if (bones.leftLeg) {
      bones.leftLeg.rotation.x = 0;
    }
    if (bones.rightLeg) {
      bones.rightLeg.rotation.x = 0;
    }
    // Board plano
    if (bones.board) {
      bones.board.rotation.x = 0;
      bones.board.rotation.z = 0;
    }
  }

  _animateSkating(bones, dt, velocity) {
    // Movimiento de pump (piernas). La frecuencia depende de la velocidad.
    const speed = velocity ? Math.sqrt(
      velocity.velocity.x ** 2 + velocity.velocity.z ** 2
    ) : 5;
    const freq = Math.max(2, speed * 1.5);
    const phase = Math.sin(this._time * freq);

    // Piernas: movimiento alternado de pump
    if (bones.leftLeg) {
      bones.leftLeg.rotation.x = phase * 0.3;
    }
    if (bones.rightLeg) {
      bones.rightLeg.rotation.x = -phase * 0.3;
    }
    // Zapatos siguen a las piernas
    if (bones.leftShoe) {
      bones.leftShoe.position.x = -0.12;
      bones.leftShoe.position.y = -0.32;
    }
    if (bones.rightShoe) {
      bones.rightShoe.position.x = 0.12;
      bones.rightShoe.position.y = -0.32;
    }

    // Brazos: contrabalanceo
    if (bones.leftArm) {
      bones.leftArm.rotation.x = -phase * 0.2;
    }
    if (bones.rightArm) {
      bones.rightArm.rotation.x = phase * 0.2;
    }

    // Torso: leve inclinación hacia adelante
    if (bones.torso) {
      bones.torso.position.y = 0.4 + Math.abs(phase) * 0.03;
    }

    // Board: leve inclinación al pump
    if (bones.board) {
      bones.board.rotation.x = phase * 0.05;
    }
  }

  _animateAirborne(bones, dt) {
    // Postura de aire: piernas dobladas, brazos arriba, board inclinado
    if (bones.leftLeg) {
      bones.leftLeg.rotation.x = -0.5;
    }
    if (bones.rightLeg) {
      bones.rightLeg.rotation.x = -0.5;
    }
    if (bones.leftArm) {
      bones.leftArm.rotation.x = -0.8;
    }
    if (bones.rightArm) {
      bones.rightArm.rotation.x = 0.3;
    }
    // Board levantado
    if (bones.board) {
      bones.board.rotation.x = Math.sin(this._time * 10) * 0.3;
    }
    // Torso más arriba
    if (bones.torso) {
      bones.torso.position.y = 0.45;
    }
  }

  _animateGrinding(bones, dt) {
    // Postura de grind: brazos abiertos para equilibrio, board alineado
    if (bones.leftArm) {
      bones.leftArm.rotation.x = -1.0;
      bones.leftArm.rotation.z = 0.3;
    }
    if (bones.rightArm) {
      bones.rightArm.rotation.x = -1.0;
      bones.rightArm.rotation.z = -0.3;
    }
    if (bones.leftLeg) {
      bones.leftLeg.rotation.x = 0.1;
    }
    if (bones.rightLeg) {
      bones.rightLeg.rotation.x = 0.1;
    }
    if (bones.board) {
      bones.board.rotation.x = 0;
      bones.board.rotation.z = 0;
    }
    // Torso estable
    if (bones.torso) {
      bones.torso.position.y = 0.4;
    }
  }
}
