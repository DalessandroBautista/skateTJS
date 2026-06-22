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

    root.scale.setScalar(1.0);
    root.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(root);
    root.position.x -= (box3.min.x + box3.max.x) / 2;
    root.position.z -= (box3.min.z + box3.max.z) / 2;
    root.updateMatrixWorld(true);

    root.traverse(child => {
      if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });

    const r = this._makeResult();
    r.sceneGroup.add(root);

    // ── FLOOR_Y via raycast ────────────────────────────────────────────────
    // gltfBox.min.y = fondo del modelo (parte inferior de los meshes), no la
    // superficie caminable. Raycaster desde arriba encuentra la cara superior
    // del suelo real.
    const gltfBox = new THREE.Box3().setFromObject(root);
    const FLOOR_Y = this._raycastFloorY(root, gltfBox.min.y);
    console.log('[MapLoader] FLOOR_Y detectado (raycast):', FLOOR_Y.toFixed(3));

    const addPhysicsPlane = (y, rotEuler) => {
      const b = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
      b.addShape(new CANNON.Plane());
      b.quaternion.setFromEuler(...rotEuler);
      b.position.set(0, y, 0);
      this.physicsWorld.addBody(b);
      r.colliders.push({ body: b });
    };
    addPhysicsPlane(FLOOR_Y, [-Math.PI / 2, 0, 0]);       // suelo principal
    addPhysicsPlane(FLOOR_Y - 10, [-Math.PI / 2, 0, 0]);  // red de seguridad

    // ── Paredes invisibles ceñidas al PISO JUGABLE real ──────────────────
    // gltfBox cubre TODO el modelo (muebles gigantes incluidos) → ±32, muy
    // lejos del piso caminable. Usamos el bounding box del mesh del suelo real
    // para que el jugador no pueda salir de la zona jugable hacia la decoración.
    const fb = this._floorMeshBounds(root, FLOOR_Y);
    const bounds = fb || { minX: -10.5, maxX: 10.5, minZ: -17, maxZ: 15.5 };
    console.log('[MapLoader] límites del piso jugable:', JSON.stringify(bounds));

    const WALL_H = 12;
    const M = 0.4; // margen hacia afuera para no tapar el borde visual
    const x0 = bounds.minX - M, x1 = bounds.maxX + M;
    const z0 = bounds.minZ - M, z1 = bounds.maxZ + M;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const wy = FLOOR_Y + WALL_H / 2;
    const addWallBox = (x, y, z, sx, sy, sz) => {
      const b = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
      b.addShape(new CANNON.Box(new CANNON.Vec3(sx, sy, sz)));
      b.position.set(x, y, z);
      this.physicsWorld.addBody(b);
      r.colliders.push({ body: b });
    };
    addWallBox(cx, wy, z1, hx, WALL_H / 2, 0.5); // pared +Z
    addWallBox(cx, wy, z0, hx, WALL_H / 2, 0.5); // pared -Z
    addWallBox(x1, wy, cz, 0.5, WALL_H / 2, hz); // pared +X
    addWallBox(x0, wy, cz, 0.5, WALL_H / 2, hz); // pared -X

    // ── Obstáculos de skatepark (rails, rampas, funbox) ───────────────────
    this._addSkateparkObstacles(r, FLOOR_Y);

    // Spawn points — 2m sobre el suelo físico real
    r.spawnPoints.push(
      new THREE.Vector3(0,  FLOOR_Y + 2, 0),
      new THREE.Vector3(-8, FLOOR_Y + 2, 8),
      new THREE.Vector3( 8, FLOOR_Y + 2,-8),
    );
    r.floorY = FLOOR_Y; // exponer para que main.js ajuste spawn y offset visual
    return r;
  }

  /**
   * Encuentra el Y de la superficie caminable del GLTF usando raycast.
   * Samplea una grilla 3x3 alrededor del centro y devuelve la mediana de los
   * hits horizontales para ignorar rampas y decoraciones elevadas.
   * @param {THREE.Object3D} root
   * @param {number} fallback - valor si no hay hits
   */
  _raycastFloorY(root, fallback) {
    const caster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const samples = [
      [0,0],[3,0],[-3,0],[0,3],[0,-3],
      [3,3],[-3,3],[3,-3],[-3,-3]
    ];
    const ys = [];
    for (const [x, z] of samples) {
      caster.set(new THREE.Vector3(x, 200, z), down);
      const hits = caster.intersectObject(root, true);
      for (const h of hits) {
        // Normal en world space — usar Math.abs porque muchos GLTF tienen
        // normales del suelo apuntando hacia abajo (caras invertidas en Blender)
        const wn = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        if (Math.abs(wn.y) > 0.7) { ys.push(h.point.y); break; }
      }
    }
    console.log('[MapLoader] raycast floor hits Y:', ys.length ? ys.map(v => v.toFixed(3)).join(', ') : '(sin hits → fallback ' + fallback.toFixed(3) + ')');
    if (ys.length === 0) return fallback;
    ys.sort((a, b) => a - b);
    return ys[Math.floor(ys.length / 2)]; // mediana → ignora outliers
  }

  /**
   * Identifica el mesh del suelo (raycast al centro) y devuelve su bounding box
   * en XZ. Sirve para ceñir las paredes al área jugable real.
   * @returns {{minX:number,maxX:number,minZ:number,maxZ:number}|null}
   */
  _floorMeshBounds(root, floorY) {
    const caster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    // Probar varios puntos del centro hasta dar con el mesh del piso
    for (const [x, z] of [[0, 0], [0, -4], [4, 0], [-4, 4]]) {
      caster.set(new THREE.Vector3(x, floorY + 200, z), down);
      const hits = caster.intersectObject(root, true);
      for (const h of hits) {
        if (!h.object.isMesh || !h.face) continue;
        const wn = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        if (Math.abs(wn.y) > 0.6 && Math.abs(h.point.y - floorY) < 0.8) {
          const box = new THREE.Box3().setFromObject(h.object);
          return {
            minX: box.min.x, maxX: box.max.x,
            minZ: box.min.z, maxZ: box.max.z,
          };
        }
      }
    }
    return null;
  }

  /**
   * Construye un layout de skatepark (rails, rampas, funbox) con geometría
   * visible Y colisión, posicionado sobre el suelo del mapa GLTF en floorY.
   * Los rails se registran para grind geométrico (sin cuerpo de física, que
   * causaría lanzamientos al chocar con la esfera del jugador al saltar).
   */
  _addSkateparkObstacles(r, floorY) {
    // ── Grind rails (caños metálicos) ──────────────────────────────────
    this._addGrindRail(r, -6, -3, 9, 0, floorY);          // izquierda, eje Z
    this._addGrindRail(r,  6, -3, 9, 0, floorY);          // derecha, eje Z
    this._addGrindRail(r,  0,  6, 7, Math.PI / 2, floorY); // central, eje X

    // ── Funbox (plataforma con ledge grindable arriba) + rampa de acceso ──
    this._addFunbox(r, 0, -11, 6, 1, 4, floorY);
    // Rampa de acceso pegada al borde +Z del funbox (sube desde el centro)
    this._addRampObstacle(r, 0, -7.5, 0, floorY, 1, 4, 3);

    // ── Rampas (wedge) ─────────────────────────────────────────────────
    // angle orienta la cara baja (subible) hacia el centro del mapa, de modo
    // que el jugador las sube viniendo desde el spawn y salta hacia la pared.
    this._addRampObstacle(r, 0, 13, Math.PI, floorY);   // frente: sube hacia +Z
    this._addRampObstacle(r, -7, -14, 0, floorY);        // esquina: sube hacia -Z
    this._addRampObstacle(r, 7, -14, 0, floorY);         // esquina: sube hacia -Z
  }

  /** Caño grindable visible. No agrega cuerpo de física (grind es geométrico). */
  _addGrindRail(r, x, z, length, angle, floorY) {
    const railY = floorY + 0.55;
    const group = new THREE.Group();

    // Amarillo emisivo → indica visualmente que el caño es grindable
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffaa00, emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.3 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, length, 14), tubeMat);
    tube.rotation.x = Math.PI / 2; // alinear con Z local
    tube.castShadow = true; tube.receiveShadow = true;
    group.add(tube);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x555560, metalness: 0.7, roughness: 0.45 });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), postMat);
      post.position.set(0, -0.30, s * (length / 2 - 0.4));
      post.castShadow = true;
      group.add(post);
    }

    group.position.set(x, railY, z);
    group.rotation.y = angle;
    r.sceneGroup.add(group);

    const sinA = Math.sin(angle), cosA = Math.cos(angle);
    r.rails.push({
      start: new THREE.Vector3(x - sinA * length / 2, railY, z - cosA * length / 2),
      end:   new THREE.Vector3(x + sinA * length / 2, railY, z + cosA * length / 2),
      t: 0,
    });
  }

  /** Funbox: caja sólida (colisión Box) con un rail grindable en el borde superior. */
  _addFunbox(r, x, z, sx, h, sz, floorY) {
    const topY = floorY + h;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3f55, roughness: 0.85, metalness: 0.1 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat);
    mesh.position.set(x, floorY + h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    r.sceneGroup.add(mesh);

    // Borde superior con franja de color (estética skatepark)
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.5, metalness: 0.3 });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.05, 0.12, sz + 0.05), edgeMat);
    edge.position.set(x, topY - 0.02, z);
    edge.castShadow = true;
    r.sceneGroup.add(edge);

    const body = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, h / 2, sz / 2)));
    body.position.set(x, floorY + h / 2, z);
    this.physicsWorld.addBody(body);
    r.colliders.push({ body });

    // Rails grindables a lo largo de los dos bordes superiores (eje X)
    for (const s of [-1, 1]) {
      r.rails.push({
        start: new THREE.Vector3(x - sx / 2, topY + 0.05, z + s * sz / 2),
        end:   new THREE.Vector3(x + sx / 2, topY + 0.05, z + s * sz / 2),
        t: 0,
      });
    }
  }

  /** Rampa wedge con colisión ConvexPolyhedron, base apoyada en floorY. */
  _addRampObstacle(r, x, z, angle, floorY, height = 1.8, width = 4, length = 5) {
    const hw = width / 2, hl = length / 2;

    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -hw, 0,  hl,  hw, 0,  hl,
      -hw, height, -hl,  hw, height, -hl,
      -hw, 0, -hl,  hw, 0, -hl,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex([
      0, 1, 3,  0, 3, 2,   // slope
      0, 4, 5,  0, 5, 1,   // bottom
      0, 2, 4,             // left
      1, 5, 3,             // right
      2, 5, 4,  2, 3, 5,   // back
    ]);
    geometry.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ color: 0x7a4fff, roughness: 0.55, metalness: 0.25 });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, floorY, z);
    mesh.rotation.y = angle;
    mesh.castShadow = true; mesh.receiveShadow = true;
    r.sceneGroup.add(mesh);

    // ── Colisión: Box DELGADO inclinado, no ConvexPolyhedron ──────────────
    // El wedge convexo tenía caras laterales verticales (altura `height`) que
    // actuaban como paredes: bloqueaban salir por los costados, cruzar en
    // diagonal, y la colisión esfera-poliedro de Cannon es tosca en aristas.
    // Un box delgado alineado con la cara inclinada da colisión esfera-box
    // suave y, al ser fino, deja entrar/salir libremente por cualquier lado.
    const theta = Math.atan2(height, length); // pendiente de la rampa
    const slopeLen = Math.hypot(length, height);
    // Grosor GRANDE: el box llena el volumen del wedge y su fondo queda hundido
    // bajo el piso, así no queda hueco debajo de la pendiente (el jugador no se
    // mete por abajo). La cara superior sigue coincidiendo con la pendiente
    // (ver localY), y como se patina por encima, se puede salir por los costados.
    const T = height + 0.8;

    const body = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hw, T / 2, slopeLen / 2)));
    // Inclinar θ sobre X, luego orientar `angle` sobre Y
    const qTilt = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1, 0, 0), theta);
    const qYaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
    body.quaternion = qYaw.mult(qTilt);
    // Centro del box: punto medio de la cara inclinada, hundido T/2 bajo ella
    const localY = height / 2 - Math.cos(theta) * T / 2;
    const localZ = -Math.sin(theta) * T / 2;
    body.position.set(
      x + localZ * Math.sin(angle),
      floorY + localY,
      z + localZ * Math.cos(angle),
    );
    this.physicsWorld.addBody(body);
    r.colliders.push({ body });
    r.ramps.push({ mesh, body, direction: new THREE.Vector3(0, 0, -1) });
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
      r.rails.push({ mesh, start, end, t: 0 });
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
      r.rails.push({ mesh, start, end, t: 0 });
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
      r.rails.push({ mesh, start, end, t: 0 });
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

    // Física — box fino en X, largo en Z local, rotado para alinear con el rail
    const body = new CANNON.Body({ mass: 0, material: this.physicsWorld.defaultMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(railWidth / 2, railHeight / 2, length / 2)));
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
    body.quaternion = q;
    body.position.set(x, 0.5, z);
    this.physicsWorld.addBody(body);

    // Puntos de inicio y fin del rail (para grind) — incluye t:0 inicial
    const halfLen = length / 2;
    const start = new THREE.Vector3(x - Math.sin(angle) * halfLen, 0.5, z - Math.cos(angle) * halfLen);
    const end = new THREE.Vector3(x + Math.sin(angle) * halfLen, 0.5, z + Math.cos(angle) * halfLen);

    return { mesh, body, start, end, t: 0 };
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
