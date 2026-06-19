/**
 * SkaterModel.js
 * 
 * Construye un skater placeholder con formas primitivas (Box).
 * En Fase 2+ se reemplazará por un modelo GLTF riggeado con animations.
 * 
 * Las partes del cuerpo están referenciadas por nombre para
 * animación procedural (AnimationSystem).
 */
import * as THREE from 'three';

// Carga el personaje Michelle (FBX Mixamo) con sus animaciones
// Devuelve { model, mixer, clips } para usar con AnimationSystem

export class SkaterModel {
  // Skins predefinidas — id, camisa, tabla, pantalón
  static SKINS = [
    { id: 'red',    label: 'Rojo',     shirt: 0xcc3333, board: 0x886644, pants: 0x334466 },
    { id: 'blue',   label: 'Azul',     shirt: 0x3388cc, board: 0x224488, pants: 0x223344 },
    { id: 'green',  label: 'Verde',    shirt: 0x33cc55, board: 0x228844, pants: 0x334422 },
    { id: 'orange', label: 'Naranja',  shirt: 0xcc8833, board: 0x884422, pants: 0x443322 },
    { id: 'purple', label: 'Violeta',  shirt: 0xaa33cc, board: 0x662288, pants: 0x331144 },
    { id: 'cyan',   label: 'Cyan',     shirt: 0x33cccc, board: 0x226688, pants: 0x224433 },
    { id: 'yellow', label: 'Amarillo', shirt: 0xddcc00, board: 0x888822, pants: 0x443300 },
    { id: 'pink',   label: 'Rosa',     shirt: 0xcc33aa, board: 0x882266, pants: 0x441133 },
  ];

  // Paleta de colores por nivel para compatibilidad sin skinId
  static SHIRT_COLORS = SkaterModel.SKINS?.map(s => s.shirt) ?? [0xcc3333];
  static BOARD_COLORS = SkaterModel.SKINS?.map(s => s.board) ?? [0x886644];

  static getSkinById(id) {
    return SkaterModel.SKINS.find(s => s.id === id) ?? SkaterModel.SKINS[0];
  }

  /**
   * @param {number} level
   * @param {string} [skinId] — si se pasa, ignora el nivel para los colores
   */
  static build(level = 1, skinId = null) {
    const group = new THREE.Group();
    const skinColor = 0xffcc99;
    const shoeColor = 0x222222;

    let shirtColor, boardColor, pantsColor;
    if (skinId) {
      const skin = SkaterModel.getSkinById(skinId);
      shirtColor = skin.shirt;
      boardColor = skin.board;
      pantsColor = skin.pants;
    } else {
      const idx = Math.min(level - 1, SkaterModel.SKINS.length - 1);
      shirtColor = SkaterModel.SKINS[idx].shirt;
      boardColor = SkaterModel.SKINS[idx].board;
      pantsColor = SkaterModel.SKINS[idx].pants;
    }

    // --- Cuerpo ---
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.6, 0.3),
      new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 })
    );
    torso.position.y = 0.4;
    torso.name = 'torso';
    group.add(torso);

    // --- Cabeza ---
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.5 })
    );
    head.position.y = 0.9;
    head.name = 'head';
    group.add(head);

    // --- Gorro / pelo ---
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0x2255aa, roughness: 0.8 })
    );
    hat.position.y = 1.0;
    hat.name = 'hat';
    group.add(hat);

    // Visera: indica dirección de movimiento (-Z = frente)
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.025, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x1144aa, roughness: 0.8 })
    );
    visor.position.set(0, 0.97, -0.18);
    visor.name = 'hatVisor';
    group.add(visor);

    // Ojos: indican la cara frontal del personaje
    const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.065, 0.88, -0.14);
    leftEye.name = 'leftEye';
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.065, 0.88, -0.14);
    rightEye.name = 'rightEye';
    group.add(rightEye);

    // --- Piernas ---
    const legGeometry = new THREE.BoxGeometry(0.12, 0.4, 0.12);
    const legMaterial = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });

    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.12, -0.1, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.12, -0.1, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    // --- Zapatos ---
    const shoeGeometry = new THREE.BoxGeometry(0.14, 0.08, 0.18);
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.9 });

    const leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    leftShoe.position.set(-0.12, -0.32, 0.03);
    leftShoe.name = 'leftShoe';
    group.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    rightShoe.position.set(0.12, -0.32, 0.03);
    rightShoe.name = 'rightShoe';
    group.add(rightShoe);

    // --- Brazos ---
    const armGeometry = new THREE.BoxGeometry(0.08, 0.3, 0.08);
    const armMaterial = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.5 });

    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.34, 0.3, 0);
    leftArm.name = 'leftArm';
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.34, 0.3, 0);
    rightArm.name = 'rightArm';
    group.add(rightArm);

    // --- Skateboard ---
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.04, 0.8),
      new THREE.MeshStandardMaterial({ color: boardColor, roughness: 0.6 })
    );
    board.position.y = -0.4;
    board.name = 'board';
    group.add(board);

    // Nariz de la tabla: punta delantera amarilla (-Z = frente)
    const boardNose = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.05, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.4 })
    );
    boardNose.position.set(0, -0.396, -0.37);
    boardNose.name = 'boardNose';
    group.add(boardNose);

    // Trucks (ejes del skate)
    const truckGeo = new THREE.BoxGeometry(0.04, 0.06, 0.04);
    const truckMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.3 });
    const frontTruck = new THREE.Mesh(truckGeo, truckMat);
    frontTruck.position.set(0, -0.38, 0.3);
    frontTruck.name = 'frontTruck';
    group.add(frontTruck);

    const backTruck = new THREE.Mesh(truckGeo, truckMat);
    backTruck.position.set(0, -0.38, -0.3);
    backTruck.name = 'backTruck';
    group.add(backTruck);

    // Ruedas
    const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
    for (const z of [0.3, -0.3]) {
      for (const x of [-0.04, 0.04]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, -0.36, z);
        wheel.name = `wheel_${x > 0 ? 'r' : 'l'}_${z > 0 ? 'f' : 'b'}`;
        group.add(wheel);
      }
    }

    // Activar sombras en todos los meshes hijos
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    group.scale.set(1, 1, 1);

    // Referencias para animación procedural
    group.userData.bones = {
      torso,
      head,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      leftShoe,
      rightShoe,
      board,
    };

    return group;
  }

  /**
   * Carga Michelle desde FBX (Mixamo) con sus 3 animaciones.
   * Solo para el jugador local — los remotos siguen usando build().
   */
  static async buildAsync() {
    const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
    const loader = new FBXLoader();

    // Cargamos los 3 FBX en paralelo
    const [skateFbx, idleFbx, jumpFbx] = await Promise.all([
      loader.loadAsync('/models/michelle_skate.fbx'),
      loader.loadAsync('/models/michelle_idle.fbx'),
      loader.loadAsync('/models/michelle_jump.fbx'),
    ]);

    // Mixamo exporta en centímetros → escalar a metros
    skateFbx.scale.setScalar(0.01);
    // Bajar el modelo para que los pies toquen el suelo físico
    // (el cylinder de physics tiene center en Y=0.5 sobre el piso)
    skateFbx.position.y = -0.9;
    // Rotar para que el frente del personaje mire en -Z (igual que el muñeco bloque)
    skateFbx.rotation.y = Math.PI;

    skateFbx.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false; // Mixamo puede tener bounding boxes incorrectos
      }
    });

    // Wrapper para que RenderSystem pueda mover/rotar sin afectar el offset interno
    const wrapper = new THREE.Group();
    wrapper.add(skateFbx);

    const mixer = new THREE.AnimationMixer(skateFbx);

    const clips = {
      skate: skateFbx.animations[0],
      idle:  idleFbx.animations[0],
      jump:  jumpFbx.animations[0],
    };

    return { model: wrapper, mixer, clips };
  }

  /** Versión fantasma semitransparente para el replay */
  static buildGhost() {
    const group = SkaterModel.build(1, 'cyan');
    group.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.4;
        child.material.color.setHex(0x44ccff);
        child.castShadow = false;
      }
    });
    return group;
  }
}
