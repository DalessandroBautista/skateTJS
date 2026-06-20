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
  registerMixerPlayer(mixer, clips, trickState, skateGroup = null) {
    // Buscar hueso raíz (Hips) para resetear root motion residual frame a frame
    let hipBone = null;
    mixer.getRoot().traverse(child => {
      if (!hipBone && child.isBone && child.name.toLowerCase().includes('hip')) {
        hipBone = child;
      }
    });
    this._mixerPlayer = {
      mixer, clips, trickState, skateGroup,
      currentAction: null, lastState: null, hipBone,
      trickAnim: null,   // { elapsed, duration, rx, ry, rz }
    };
    // Arrancar siempre con skate (clips.idle no retargea bien al esqueleto con skin)
    const startClip = clips.skate ?? clips.idle;
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
        case 'idle':     clip = clips.idle  ?? clips.skate; break;
        case 'airborne': clip = clips.jump  ?? clips.skate; break;
        default:         clip = clips.skate;                break;
      }

      if (clip) {
        const next = mixer.clipAction(clip);
        if (next !== this._mixerPlayer.currentAction) {
          if (this._mixerPlayer.currentAction) {
            // Si el estado cambió muy rápido (<0.2s), cortar sin fade para no apilar acciones
            if (trickState.stateTimer < 0.2) {
              this._mixerPlayer.currentAction.stop();
            } else {
              this._mixerPlayer.currentAction.fadeOut(0.2);
            }
          }
          next.reset().fadeIn(0.2).play();
          this._mixerPlayer.currentAction = next;
        }
      }
    }

    // Cap de dt para evitar salto de pose en el primer frame o tras tab-switch
    mixer.update(Math.min(dt, 1 / 30));

    // Reset completo del root motion después de cada mixer.update():
    // Los clips de Mixamo a veces incluyen tracks de posición Y ROTACIÓN en el
    // objeto raíz (Armature/Scene) además del hueso Hips. Si no reseteamos la
    // rotación también, el clip de jump puede anular el rotation.y = Math.PI
    // que fija la orientación del personaje → giro de 180° visible al saltar.
    const fbxRoot = mixer.getRoot();
    fbxRoot.position.x = 0;
    fbxRoot.position.z = 0;
    fbxRoot.rotation.x = 0;
    fbxRoot.rotation.y = Math.PI; // orientación fija: FBX mira en -Z local
    fbxRoot.rotation.z = 0;
    // Hueso Hips (root motion clásico de Mixamo)
    if (this._mixerPlayer.hipBone) {
      this._mixerPlayer.hipBone.position.x = 0;
      this._mixerPlayer.hipBone.position.z = 0;
    }

    // Animación visual del truco en la patineta
    this._updateTrickAnim(dt);
  }

  _updateTrickAnim(dt) {
    const { trickState, skateGroup } = this._mixerPlayer;
    if (!skateGroup) return;

    // Iniciar animación cuando hay un truco nuevo
    if (trickState.lastTrick && !this._mixerPlayer.trickAnim) {
      this._mixerPlayer.trickAnim = this._getTrickAnim(trickState.lastTrick.id);
    }

    const ta = this._mixerPlayer.trickAnim;
    if (!ta) {
      skateGroup.rotation.set(0, 0, 0);
      return;
    }

    ta.elapsed += dt;
    // Ease in-out cuadrático
    const raw = Math.min(ta.elapsed / ta.duration, 1);
    const t = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw;

    skateGroup.rotation.x = ta.rx * t;
    skateGroup.rotation.y = ta.ry * t;
    skateGroup.rotation.z = ta.rz * t;

    if (raw >= 1) {
      this._mixerPlayer.trickAnim = null;
      skateGroup.rotation.set(0, 0, 0);
    }
  }

  _getTrickAnim(id) {
    const PI2 = Math.PI * 2;
    const base = { elapsed: 0, duration: 0.45, rx: 0, ry: 0, rz: 0 };
    switch (id) {
      case 'kickflip':        return { ...base, rz:  PI2 };
      case 'heelflip':        return { ...base, rz: -PI2 };
      case '360_flip':        return { ...base, rz: PI2, ry: PI2 };
      case 'varial_kickflip': return { ...base, rz: PI2, ry: PI2 };
      case 'varial_heelflip': return { ...base, rz: -PI2, ry: PI2 };
      case 'hardflip':        return { ...base, rz: PI2, ry: -PI2 };
      case 'pop_shoveit':     return { ...base, ry: PI2,         duration: 0.35 };
      case 'impossible':      return { ...base, rx: PI2 };
      case 'bigspin':         return { ...base, ry: PI2 * 2, rz: PI2, duration: 0.55 };
      case 'nine_hundred':    return { ...base, ry: PI2 * 3,          duration: 0.65 };
      case 'mctwist':         return { ...base, ry: PI2 * 2, rx: PI2, duration: 0.65 };
      // Grabs: la tabla no gira, se inclina levemente
      case 'indy':
      case 'nose_grab':
      case 'stalefish':
      case 'mute':            return { ...base, rx: Math.PI / 6, duration: 0.5 };
      case 'kickflip_indy':   return { ...base, rz: PI2, rx: Math.PI / 6 };
      default:                return { ...base, rz: PI2 };
    }
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
