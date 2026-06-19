/**
 * MapLoader.js
 * 
 * Construye el mapa del juego de forma procedural.
 * En Fase 1 usamos geometría generada en código.
 * En Fase 2+ cargará GLTF real.
 * 
 * Convención de nombres:
 *   col_*    → mesh de colisión (Cannon estático)
 *   spawn_*  → punto de spawn del jugador
 *   rail_*   → trigger de grind
 *   ramp_*   → rampa interactiva
 *   wall_*   → pared
 * 
 * Devuelve: { sceneGroup, colliders, spawnPoints, rails, ramps, meshes }
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class MapLoader {
  /**
   * @param {import('../engine/PhysicsWorld.js').PhysicsWorld} physicsWorld
   */
  constructor(physicsWorld) {
    this.physicsWorld = physicsWorld;
  }

  /** Versión async — carga GLTF para plaza, procedural para park/streets */
  async buildAsync(mapId = 'plaza') {
    if (mapId === 'plaza') return await this._buildSkateparkGLTF();
    return this.build(mapId);
  }

  build(mapId = 'plaza') {
    switch (mapId) {
      case 'park': return this._buildPark();
      case 'streets': return this._buildStreets();
      default: return this._buildPlaza();
    }
  }

  async _buildSkateparkGLTF() {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/models/skatepark_environment.glb');
    const root = gltf.scene;

    const SCALE = 1.0;
    root.scale.setScalar(SCALE);

    // Centrar en XZ (el suelo del modelo está en Y≈0)
    root.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(root);
    root.position.x -= (box3.min.x + box3.max.x) / 2;
    root.position.z -= (box3.min.z + box3.max.z) / 2;
    root.updateMatrixWorld(true);

    root.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const r = this._makeResult();
    r.sceneGroup.add(root);

    // Suelo físico (plano infinito en Y=0)
    const groundBody = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physicsWorld.addBody(groundBody);
    r.colliders.push({ body: groundBody });

    // Colisores aproximados para rampas y rails basados en bounding boxes
    const RAMP_RE  = /ramp|miniramp|topramp|playground_bup|BoomboxRamp|RampsCar/i;
    const RAIL_RE  = /pipe/i;
    const SKIP_RE  = /grass|bike|trashcan|torch|flame|phonebox|graffiti|noshadow|shadow/i;

    root.traverse(child => {
      if (!child.isMesh) return;
      const name = child.name || '';
      if (SKIP_RE.test(name)) return;

      const wb = new THREE.Box3().setFromObject(child);
      const size = new THREE.Vector3();
      wb.getSize(size);
      if (size.length() < 0.3) return; // ignorar objetos muy pequeños

      const center = new THREE.Vector3();
      wb.getCenter(center);
      const hx = Math.max(size.x / 2, 0.05);
      const hy = Math.max(size.y / 2, 0.05);
      const hz = Math.max(size.z / 2, 0.05);

      if (RAIL_RE.test(name)) {
        const body = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
        body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
        body.position.set(center.x, center.y, center.z);
        this.physicsWorld.addBody(body);
        r.colliders.push({ body });

        // Registrar como rail grindable (a lo largo del eje más largo)
        const longZ = hz > hx;
        r.rails.push({
          start: new THREE.Vector3(center.x - (longZ ? 0 : hx * 0.9), center.y, center.z - (longZ ? hz * 0.9 : 0)),
          end:   new THREE.Vector3(center.x + (longZ ? 0 : hx * 0.9), center.y, center.z + (longZ ? hz * 0.9 : 0)),
        });
      } else if (RAMP_RE.test(name)) {
        const body = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
        body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
        body.position.set(center.x, center.y, center.z);
        this.physicsWorld.addBody(body);
        r.colliders.push({ body });
      }
    });

    // Spawn por encima del suelo visible del modelo (≈Y=4.3-5)
    r.spawnPoints.push(
      new THREE.Vector3(0, 7, 0),
      new THREE.Vector3(-8, 7, 8),
      new THREE.Vector3(8, 7, -8),
    );
    return r;
  }

  _makeResult() {
    return { sceneGroup: new THREE.Group(), meshes: [], colliders: [], spawnPoints: [], rails: [], ramps: [] };
  }

  _addGround(r, color = 0x555555) {
    const { mesh, body } = this._createGround(color);
    mesh.name = 'col_ground';
    r.sceneGroup.add(mesh);
    r.meshes.push(mesh);
    r.colliders.push({ mesh, body });
  }

  _addWalls(r, size = 25) {
    const walls = [
      { x: 0, z: -size, sx: size * 2, sz: 1 },
      { x: 0, z: size, sx: size * 2, sz: 1 },
      { x: -size, z: 0, sx: 1, sz: size * 2 },
      { x: size, z: 0, sx: 1, sz: size * 2 },
    ];
    for (let i = 0; i < walls.length; i++) {
      const ws = walls[i];
      const { mesh, body } = this._createWall(ws.x, ws.z, ws.sx, ws.sz);
      mesh.name = `wall_${i}`;
      r.sceneGroup.add(mesh);
      r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
    }
  }

  _buildPlaza() {
    const r = this._makeResult();
    this._addGround(r, 0x555555);
    this._addWalls(r, 25);

    const rampDefs = [
      { x: -8, z: -8, angle: 0 },
      { x: 8, z: 8, angle: Math.PI },
      { x: -12, z: 6, angle: Math.PI * 0.25 },
      { x: 12, z: -6, angle: -Math.PI * 0.25 },
    ];
    for (let i = 0; i < rampDefs.length; i++) {
      const rp = rampDefs[i];
      const { mesh, body } = this._createRamp(rp.x, rp.z, rp.angle);
      mesh.name = `ramp_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
      r.ramps.push({ mesh, body, direction: new THREE.Vector3(0, 0, -1) });
    }

    const railDefs = [
      { x: -5, z: -10, length: 6, angle: 0 },
      { x: 5, z: 10, length: 6, angle: Math.PI },
      { x: -10, z: 0, length: 5, angle: Math.PI / 2 },
      { x: 10, z: 2, length: 5, angle: Math.PI / 2 },
      { x: 0, z: -12, length: 8, angle: Math.PI * 0.3 },
    ];
    for (let i = 0; i < railDefs.length; i++) {
      const rp = railDefs[i];
      const { mesh, body, start, end } = this._createRail(rp.x, rp.z, rp.length, rp.angle);
      mesh.name = `rail_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
      r.rails.push({ mesh, start, end });
    }

    const platforms = [
      { x: -15, z: -15, sx: 3, sz: 3, h: 1 },
      { x: 15, z: 15, sx: 3, sz: 3, h: 1 },
      { x: -15, z: 15, sx: 2, sz: 4, h: 0.5 },
      { x: 15, z: -15, sx: 4, sz: 2, h: 0.5 },
      { x: 0, z: 0, sx: 2, sz: 2, h: 0.3 },
    ];
    for (let i = 0; i < platforms.length; i++) {
      const pp = platforms[i];
      const { mesh, body } = this._createPlatform(pp.x, pp.z, pp.sx, pp.sz, pp.h, 0x44aa44);
      mesh.name = `col_platform_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
    }

    r.spawnPoints.push(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-5, 1, 5), new THREE.Vector3(5, 1, -5));
    return r;
  }

  _buildPark() {
    const r = this._makeResult();
    this._addGround(r, 0x3d6b3d); // verde parque
    this._addWalls(r, 30);

    // Bowl central (4 rampas en círculo)
    const bowlAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    for (let i = 0; i < bowlAngles.length; i++) {
      const angle = bowlAngles[i];
      const x = Math.sin(angle) * 8;
      const z = Math.cos(angle) * 8;
      const { mesh, body } = this._createRamp(x, z, angle + Math.PI);
      mesh.name = `ramp_bowl_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
      r.ramps.push({ mesh, body, direction: new THREE.Vector3(0, 0, -1) });
    }

    // Rampas extra en esquinas
    const cornerRamps = [
      { x: -20, z: -20, angle: Math.PI * 0.25 },
      { x: 20, z: -20, angle: -Math.PI * 0.25 },
      { x: -20, z: 20, angle: Math.PI * 0.75 },
      { x: 20, z: 20, angle: -Math.PI * 0.75 },
    ];
    for (let i = 0; i < cornerRamps.length; i++) {
      const rp = cornerRamps[i];
      const { mesh, body } = this._createRamp(rp.x, rp.z, rp.angle);
      mesh.name = `ramp_corner_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
      r.ramps.push({ mesh, body, direction: new THREE.Vector3(0, 0, -1) });
    }

    // Rails diagonales largos
    const rails = [
      { x: -15, z: 0, length: 10, angle: Math.PI / 4 },
      { x: 15, z: 0, length: 10, angle: -Math.PI / 4 },
      { x: 0, z: 15, length: 12, angle: 0 },
      { x: 0, z: -15, length: 12, angle: 0 },
      { x: -8, z: -8, length: 7, angle: Math.PI / 2 },
      { x: 8, z: 8, length: 7, angle: Math.PI / 2 },
    ];
    for (let i = 0; i < rails.length; i++) {
      const rp = rails[i];
      const { mesh, body, start, end } = this._createRail(rp.x, rp.z, rp.length, rp.angle);
      mesh.name = `rail_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
      r.rails.push({ mesh, start, end });
    }

    // Plataformas más altas
    const platforms = [
      { x: 0, z: 0, sx: 4, sz: 4, h: 0.5 },
      { x: -22, z: -8, sx: 6, sz: 2, h: 2 },
      { x: 22, z: 8, sx: 6, sz: 2, h: 2 },
      { x: 10, z: -20, sx: 3, sz: 3, h: 1.5 },
      { x: -10, z: 20, sx: 3, sz: 3, h: 1.5 },
    ];
    for (let i = 0; i < platforms.length; i++) {
      const pp = platforms[i];
      const { mesh, body } = this._createPlatform(pp.x, pp.z, pp.sx, pp.sz, pp.h, 0x8b7355);
      mesh.name = `col_platform_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
    }

    r.spawnPoints.push(new THREE.Vector3(0, 1, 15), new THREE.Vector3(-15, 1, 0), new THREE.Vector3(15, 1, 0));
    return r;
  }

  _buildStreets() {
    const r = this._makeResult();
    this._addGround(r, 0x333333); // asfalto oscuro
    this._addWalls(r, 35);

    // Vereda elevada (curb) — una plataforma larga a ambos lados
    const curbs = [
      { x: -18, z: 0, sx: 1.5, sz: 40, h: 0.3 },
      { x: 18, z: 0, sx: 1.5, sz: 40, h: 0.3 },
      { x: 0, z: -18, sx: 40, sz: 1.5, h: 0.3 },
      { x: 0, z: 18, sx: 40, sz: 1.5, h: 0.3 },
    ];
    for (let i = 0; i < curbs.length; i++) {
      const pp = curbs[i];
      const { mesh, body } = this._createPlatform(pp.x, pp.z, pp.sx, pp.sz, pp.h, 0x888888);
      mesh.name = `col_curb_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
    }

    // Escaleras + plataformas (como una plaza urbana)
    const stairs = [
      { x: -10, z: -10, sx: 4, sz: 4, h: 1 },
      { x: -10, z: -6, sx: 4, sz: 4, h: 0.5 },
      { x: 10, z: 10, sx: 4, sz: 4, h: 1 },
      { x: 10, z: 6, sx: 4, sz: 4, h: 0.5 },
      { x: 12, z: -12, sx: 5, sz: 2, h: 1.5 },
      { x: -12, z: 12, sx: 5, sz: 2, h: 1.5 },
    ];
    for (let i = 0; i < stairs.length; i++) {
      const pp = stairs[i];
      const { mesh, body } = this._createPlatform(pp.x, pp.z, pp.sx, pp.sz, pp.h, 0x999999);
      mesh.name = `col_stair_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
    }

    // Rampas tipo quarter-pipe en bordes
    const rampDefs = [
      { x: -20, z: 0, angle: Math.PI / 2 },
      { x: 20, z: 0, angle: -Math.PI / 2 },
      { x: 0, z: -20, angle: 0 },
      { x: 0, z: 20, angle: Math.PI },
      { x: -28, z: -28, angle: Math.PI * 0.25 },
      { x: 28, z: 28, angle: -Math.PI * 0.75 },
    ];
    for (let i = 0; i < rampDefs.length; i++) {
      const rp = rampDefs[i];
      const { mesh, body } = this._createRamp(rp.x, rp.z, rp.angle);
      mesh.name = `ramp_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
      r.ramps.push({ mesh, body, direction: new THREE.Vector3(0, 0, -1) });
    }

    // Rails urbanos (muchos, cortos)
    const railDefs = [
      { x: -10, z: -10, length: 5, angle: 0 },
      { x: 10, z: 10, length: 5, angle: 0 },
      { x: -18, z: 8, length: 6, angle: Math.PI / 2 },
      { x: 18, z: -8, length: 6, angle: Math.PI / 2 },
      { x: 0, z: 0, length: 8, angle: Math.PI / 6 },
      { x: -5, z: 15, length: 5, angle: Math.PI / 3 },
      { x: 5, z: -15, length: 5, angle: -Math.PI / 3 },
      { x: -15, z: -20, length: 10, angle: 0 },
      { x: 15, z: 20, length: 10, angle: 0 },
    ];
    for (let i = 0; i < railDefs.length; i++) {
      const rp = railDefs[i];
      const { mesh, body, start, end } = this._createRail(rp.x, rp.z, rp.length, rp.angle);
      mesh.name = `rail_${i}`;
      r.sceneGroup.add(mesh); r.meshes.push(mesh);
      r.colliders.push({ mesh, body });
      r.rails.push({ mesh, start, end });
    }

    r.spawnPoints.push(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-8, 1, -8), new THREE.Vector3(8, 1, 8));
    return r;
  }

  _createGround(color = 0x555555) {
    const size = 70;
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;

    // Física
    const shape = new CANNON.Plane();
    const body = new CANNON.Body({ mass: 0, shape, material: this.physicsWorld.defaultMaterial });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physicsWorld.addBody(body);

    return { mesh, body };
  }

  _createRamp(x, z, angle) {
    const width = 3;
    const length = 5;
    const height = 2;

    // Visual: wedge (cuña) usando un BufferGeometry personalizado
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Cara inclinada (triángulo)
      -width / 2, 0,  length / 2,   // 0
       width / 2, 0,  length / 2,   // 1
      -width / 2, height, -length / 2, // 2
       width / 2, height, -length / 2, // 3
      -width / 2, 0, -length / 2,   // 4
       width / 2, 0, -length / 2,   // 5
    ]);
    // Winding CCW visto desde el exterior de cada cara (Three.js culls CW)
    const indices = [
      // Cara inclinada (slope): normal hacia arriba-adelante (+Y+Z)
      0, 1, 3,  0, 3, 2,
      // Cara inferior: normal hacia abajo (-Y)
      0, 4, 5,  0, 5, 1,
      // Costado izquierdo (triángulo): normal hacia -X
      0, 2, 4,
      // Costado derecho (triángulo): normal hacia +X
      1, 5, 3,
      // Cara trasera: normal hacia -Z
      2, 5, 4,  2, 3, 5,
    ];
    const normals = new Float32Array(vertices.length);
    for (let i = 0; i < vertices.length; i += 3) {
      normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      roughness: 0.6,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Física: ConvexPolyhedron que coincide exactamente con la cuña visual.
    // Mucho más suave que escalones — el jugador sube la rampa sin saltos.
    const hw = width / 2;
    const hl = length / 2;
    const cvVerts = [
      new CANNON.Vec3(-hw, 0,      hl),  // 0 front-bottom-left
      new CANNON.Vec3( hw, 0,      hl),  // 1 front-bottom-right
      new CANNON.Vec3( hw, 0,     -hl),  // 2 back-bottom-right
      new CANNON.Vec3(-hw, 0,     -hl),  // 3 back-bottom-left
      new CANNON.Vec3(-hw, height, -hl), // 4 back-top-left
      new CANNON.Vec3( hw, height, -hl), // 5 back-top-right
    ];
    // Winding counter-clockwise visto desde afuera de cada cara
    const cvFaces = [
      [0, 3, 2, 1], // bottom  (normal -Y)
      [0, 1, 5, 4], // slope   (normal up-forward)
      [3, 4, 5, 2], // back    (normal -Z local)
      [0, 4, 3],    // left    (normal -X)
      [1, 2, 5],    // right   (normal +X)
    ];
    const shape = new CANNON.ConvexPolyhedron({ vertices: cvVerts, faces: cvFaces });
    const body = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
    body.addShape(shape);

    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
    body.quaternion = q;
    body.position.set(x, 0, z);
    this.physicsWorld.addBody(body);

    return { mesh, body };
  }

  _createRail(x, z, length, angle) {
    const railHeight = 0.3;
    const railWidth = 0.15;

    // Visual
    const geometry = new THREE.BoxGeometry(railWidth, railHeight, length);
    const material = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.3,
      metalness: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0.5, z);
    mesh.rotation.y = angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Física
    const shape = new CANNON.Box(new CANNON.Vec3(railWidth / 2, railHeight / 2, length / 2));
    const body = new CANNON.Body({ mass: 0, shape, material: this.physicsWorld.defaultMaterial });
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
    body.quaternion = q;
    body.position.set(x, 0.5, z);
    this.physicsWorld.addBody(body);

    // Puntos de inicio y fin del rail (para grind)
    const halfLen = length / 2;
    const start = new THREE.Vector3(x - Math.sin(angle) * halfLen, 0.5, z - Math.cos(angle) * halfLen);
    const end = new THREE.Vector3(x + Math.sin(angle) * halfLen, 0.5, z + Math.cos(angle) * halfLen);

    return { mesh, body, start, end };
  }

  _createWall(x, z, sx, sz) {
    const height = 1.5;

    const geometry = new THREE.BoxGeometry(sx, height, sz);
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.8,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const shape = new CANNON.Box(new CANNON.Vec3(sx / 2, height / 2, sz / 2));
    const body = new CANNON.Body({ mass: 0, shape, material: this.physicsWorld.defaultMaterial });
    body.position.set(x, height / 2, z);
    this.physicsWorld.addBody(body);

    return { mesh, body };
  }

  _createPlatform(x, z, sx, sz, h, color = 0x44aa44) {
    const geometry = new THREE.BoxGeometry(sx, h, sz);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const shape = new CANNON.Box(new CANNON.Vec3(sx / 2, h / 2, sz / 2));
    const body = new CANNON.Body({ mass: 0, shape, material: this.physicsWorld.defaultMaterial });
    body.position.set(x, h / 2, z);
    this.physicsWorld.addBody(body);

    return { mesh, body };
  }
}
