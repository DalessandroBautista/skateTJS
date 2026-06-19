import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PMREMGenerator } from 'three';

export class GameScene {
  constructor(renderer = null) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    if (renderer) {
      this._setupEnvironment(renderer);
    }
    this._setupLights();
    this._buildSky();
  }

  _setupEnvironment(renderer) {
    const pmrem = new PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envTexture = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    this.scene.environment = envTexture;
    pmrem.dispose();
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xb0d8ff, 0x443322, 0.6);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff5e0, 2.0);
    sun.position.set(15, 30, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.directionalLight = sun;

    // Relleno suave desde el lado opuesto
    const fill = new THREE.DirectionalLight(0x8899ff, 0.3);
    fill.position.set(-10, 10, -10);
    this.scene.add(fill);
  }

  _buildSky() {
    // Gradient sky using a large sphere with vertex colors
    const skyGeo = new THREE.SphereGeometry(400, 16, 8);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      side: THREE.BackSide,
      fog: false,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  add(object) {
    this.scene.add(object);
  }

  remove(object) {
    this.scene.remove(object);
  }
}
