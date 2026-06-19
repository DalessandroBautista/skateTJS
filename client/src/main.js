/**
 * main.js
 *
 * Sprint 2: Auth + Multiplayer + Rooms.
 * El juego arranca después del login (o como invitado).
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Renderer } from './engine/Renderer.js';
import { GameScene } from './engine/Scene.js';
import { GameLoop } from './engine/GameLoop.js';
import { PhysicsWorld } from './engine/PhysicsWorld.js';
import { TransformComponent } from './components/TransformComponent.js';
import { VelocityComponent } from './components/VelocityComponent.js';
import { PhysicsBodyComponent } from './components/PhysicsBodyComponent.js';
import { TrickStateComponent } from './components/TrickStateComponent.js';
import { ComboComponent } from './components/ComboComponent.js';
import { MeshComponent } from './components/MeshComponent.js';
import { InputManager } from './input/InputManager.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { TrickSystem } from './systems/TrickSystem.js';
import { ComboSystem } from './systems/ComboSystem.js';
import { AnimationSystem } from './systems/AnimationSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { NetworkSystem } from './systems/NetworkSystem.js';
import { MapLoader } from './world/MapLoader.js';
import { TrickLibrary } from './tricks/TrickLibrary.js';
import { InteractiveObjects } from './world/InteractiveObjects.js';
import { SkaterModel } from './world/SkaterModel.js';
import { HUD } from './ui/HUD.js';
import { LoginScreen } from './ui/LoginScreen.js';
import { RoomUI } from './ui/RoomUI.js';
import { ChatUI } from './ui/ChatUI.js';
import { RoomLeaderboard } from './ui/RoomLeaderboard.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { GlobalLeaderboard } from './ui/GlobalLeaderboard.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { achievementSystem } from './systems/AchievementSystem.js';
import { AchievementNotification } from './ui/AchievementNotification.js';
import { AchievementsScreen } from './ui/AchievementsScreen.js';
import { ObjectivesSystem } from './systems/ObjectivesSystem.js';
import { ObjectivesHUD } from './ui/ObjectivesHUD.js';
import { SkateLetters } from './world/SkateLetters.js';
import { ReplaySystem } from './systems/ReplaySystem.js';
import { SkinSelector } from './ui/SkinSelector.js';
import { soundManager } from './audio/SoundManager.js';
import { networkManager } from './network/NetworkManager.js';

// --- Flujo: Login → Sala → Juego ---
new LoginScreen({
  onReady: (user) => {
    let shown = false;
    const showRoom = () => {
      if (shown) return;
      shown = true;
      new RoomUI({ onEnterRoom: (roomData) => startGame(user, roomData) });
    };

    networkManager.on('connected', showRoom);
    networkManager.connect();

    // Si ya estaba conectado cuando llegamos acá (reconexión rápida)
    if (networkManager.socket?.connected) showRoom();
  },
});

function startGame(user, roomData) {
  const loading = new LoadingScreen(roomData?.mapId || 'plaza');

  // --- Engine ---
  const canvas = document.getElementById('game-canvas');
  const renderer = new Renderer(canvas);
  const gameScene = new GameScene(renderer.renderer);
  const gameLoop = new GameLoop();

  // --- Cámara ---
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 6, 12);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // --- Física ---
  const physicsWorld = new PhysicsWorld();

  // --- Mapa ---
  const mapLoader = new MapLoader(physicsWorld);
  const mapData = mapLoader.build(roomData?.mapId || 'plaza');
  gameScene.add(mapData.sceneGroup);

  const interactiveObjects = new InteractiveObjects();
  interactiveObjects.load(mapData);

  // --- Skin selector ---
  const skinSelector = new SkinSelector();
  const savedSkin = skinSelector.currentSkin;

  // --- Modelo del skater local ---
  const skaterGroup = SkaterModel.build(user?.level || 1, savedSkin);
  gameScene.add(skaterGroup);
  const meshComponent = new MeshComponent({ model: skaterGroup });

  // --- Cuerpo físico del jugador ---
  const playerShape = new CANNON.Cylinder(0.5, 0.5, 1.0, 8);
  const playerBody = new CANNON.Body({
    mass: 5,
    shape: playerShape,
    material: physicsWorld.defaultMaterial,
    position: new CANNON.Vec3(0, 5, 0),
    angularDamping: 0.99,
    linearDamping: 0.2,
  });
  playerBody.angularFactor = new CANNON.Vec3(0, 0, 0);
  physicsWorld.addBody(playerBody);

  // --- Componentes ---
  const playerTransform = new TransformComponent({ position: new THREE.Vector3(0, 5, 0) });
  const playerVelocity = new VelocityComponent();
  const playerPhysics = new PhysicsBodyComponent({ body: playerBody, isStatic: false });
  const trickState = new TrickStateComponent({ state: 'idle' });
  const combo = new ComboComponent();

  // --- Input ---
  const inputManager = new InputManager();

  // --- Systems ---
  const movementSystem = new MovementSystem({
    inputManager, playerTransform, playerPhysics, trickState, interactiveObjects,
  });

  const physicsSystem = new PhysicsSystem({ physicsWorld });
  physicsSystem.register(playerTransform, playerPhysics, playerVelocity);

  const trickSystem = new TrickSystem({ inputManager, trickState, user });

  const comboSystem = new ComboSystem();
  comboSystem.register(combo, trickState);

  const animationSystem = new AnimationSystem();
  animationSystem.register(meshComponent, trickState, playerVelocity);

  const cameraSystem = new CameraSystem({ camera, target: playerTransform, velocity: playerVelocity });

  const renderSystem = new RenderSystem();
  renderSystem.register(playerTransform, skaterGroup);

  // --- Partículas ---
  const particleSystem = new ParticleSystem(gameScene.scene);

  // --- Logros ---
  const achNotif = new AchievementNotification();
  const achScreen = new AchievementsScreen();
  achievementSystem.onUnlock((ach) => {
    achNotif.show(ach);
    soundManager.playLevelUp();
  });

  // --- Objetivos de sesión + letras S-K-A-T-E ---
  const mapId = roomData?.mapId || 'plaza';
  const objectives = new ObjectivesSystem();
  const objectivesHUD = new ObjectivesHUD();
  const skateLetters = new SkateLetters(gameScene.scene, mapId);

  skateLetters.onCollect((index, letter) => {
    const count = skateLetters.count;
    objectivesHUD.refresh(objectives.getMissions(), skateLetters.state);
    objectives.onLetterCollected(count);
    hud.showTrickPopup(`¡${letter}!`);
    soundManager.playTrick();
    if (skateLetters.complete) {
      hud.showComboEnd(2000, 0);
      soundManager.playLevelUp();
      if (user) networkManager.submitScore(2000, mapId, 0);
    }
  });

  objectives.onComplete((mission) => {
    achNotif.show({ name: '¡Misión cumplida!', desc: mission.text, icon: '🎯' });
    soundManager.playComboEnd(1000);
    objectivesHUD.refresh(objectives.getMissions(), skateLetters.state);
  });

  // --- Skin selector ---
  skinSelector.onSelect((skinId) => {
    // Actualizar el modelo local
    const skin = SkaterModel.getSkinById(skinId);
    skaterGroup.traverse((child) => {
      if (!child.isMesh) return;
      const n = child.name;
      if (n === 'torso' || n === 'leftArm' || n === 'rightArm') child.material.color.setHex(skin.shirt);
      else if (n === 'board') child.material.color.setHex(skin.board);
      else if (n === 'leftLeg' || n === 'rightLeg') child.material.color.setHex(skin.pants);
    });
    networkManager.sendSkin(skinId);
  });
  // Enviar skin actual al entrar a sala (después de la conexión)
  networkManager.on('room_state', () => networkManager.sendSkin(savedSkin));

  // --- Replay del mejor combo ---
  const replaySystem = new ReplaySystem(gameScene.scene, (msg) => hud.showTrickPopup(msg));

  // --- Network ---
  const networkSystem = new NetworkSystem({
    scene: gameScene.scene,
    playerTransform,
    playerVelocity,
    trickState,
  });

  // --- UI ---
  const hud = new HUD(user);
  const chatUI = new ChatUI();
  const leaderboard = new RoomLeaderboard();
  const globalLb = new GlobalLeaderboard(roomData?.mapId || 'plaza');

  // --- Conectar eventos de juego ---
  let totalScore = 0;

  trickSystem.onTrickExecuted = (trick) => {
    combo.addTrick(trick);
    hud.showTrickPopup(trick.name);
    soundManager.playTrick();
    networkManager.sendTrick(trick.name, trick.points);
    achievementSystem.onTrick(trick.id, trick.name);
    objectives.onTrick(trick.id);
    objectivesHUD.refresh(objectives.getMissions(), skateLetters.state);
  };

  movementSystem.onGrindEnd = (pts) => {
    combo.addBonus(pts, `Grind +${pts}`);
    hud.showTrickPopup(`Grind! +${pts}`);
    soundManager.playTrick();
    networkManager.sendTrick('Grind', pts);
    const grindDuration = pts / 150;
    achievementSystem.onGrindEnd(grindDuration);
    objectives.onGrindEnd();
    objectivesHUD.refresh(objectives.getMissions(), skateLetters.state);
  };

  movementSystem.onManualTick = () => {
    const dur = movementSystem._manualTimer;
    achievementSystem.onManualEnd(dur);
    objectives.onManualEnd(dur);
  };
  movementSystem.onJump = () => soundManager.playJump();
  movementSystem.onLand = () => {
    if (trickState.lastTrick) {
      soundManager.playLandTrick();
      particleSystem.emitTrickLand(playerTransform.position);
      trickState.lastTrick = null;
    } else {
      soundManager.playLand();
    }
  };

  movementSystem.onGrindTick = () => {
    const pos = playerTransform.position;
    particleSystem.emitGrind(pos);
  };

  comboSystem.onComboEnd = async (finalScore) => {
    const trickCount = combo.tricks.length;
    totalScore += finalScore;
    leaderboard.updateLocalScore(totalScore);
    hud.showComboEnd(finalScore, trickCount);
    if (finalScore > 0) soundManager.playComboEnd(finalScore);
    achievementSystem.onComboEnd(finalScore);
    achievementSystem.onTotalScore(finalScore);
    objectives.onComboEnd(finalScore);
    objectives.onTotalScore(finalScore);
    objectivesHUD.refresh(objectives.getMissions(), skateLetters.state);
    replaySystem.onComboEnd(finalScore, Math.min(combo.tricks.length * 2 + 5, 30));

    if (user) {
      const prevLevel = user.level || 1;
      const result = await networkManager.submitScore(totalScore, roomData.mapId || 'plaza', trickCount);
      if (result?.xpGained) hud.showXpGain(result.xpGained);
      if (result?.leveledUp) {
        const newUnlocked = TrickLibrary
          .filter(t => t.requiredLevel > prevLevel && t.requiredLevel <= result.newLevel)
          .map(t => t.name);
        hud.showLevelUp(result.newLevel, newUnlocked);
        soundManager.playLevelUp();
        achievementSystem.onLevelUp(result.newLevel);
      }
    }
  };

  // --- GameLoop ---
  gameLoop.addSystem(movementSystem);
  gameLoop.addSystem(physicsSystem);
  gameLoop.addSystem(trickSystem);
  gameLoop.addSystem(comboSystem);
  gameLoop.addSystem(animationSystem);
  gameLoop.addSystem(cameraSystem);
  gameLoop.addSystem(renderSystem);
  gameLoop.addSystem(networkSystem);
  // Partículas como sistema inline (necesita acceso a velocidad)
  gameLoop.addSystem({
    update(dt) {
      const vel = playerPhysics.body.velocity;
      const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
      if (trickState.isGrounded && speed > 3) {
        particleSystem.emitDust(playerTransform.position, speed);
      }
      particleSystem.update(dt);
      achievementSystem.onSpeedUpdate(speed);
      objectives.onSpeedUpdate(speed);
      skateLetters.update(dt, playerTransform.position);
      replaySystem.record(dt, playerTransform.position, playerTransform.rotation.y);
      replaySystem.update(dt);
    }
  });

  gameLoop.setRenderFunction(() => {
    renderer.render(gameScene.scene, camera);
    const vel = playerPhysics.body.velocity;
    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
    hud.update({
      score: combo.score + totalScore,
      multiplier: combo.multiplier,
      timer: combo.timer,
      maxTimer: combo.maxTimer,
      tricks: combo.tricks,
      level: user?.level || 1,
      xp: user?.xp || 0,
      xpToNext: (user?.level || 1) * 1000,
      speed,
    });
  });

  // La sala ya fue seleccionada en RoomUI — roomData contiene mapId, players, etc.

  // --- Arranque ---
  gameLoop.start();
  loading.hide();
  soundManager.startAmbient(roomData?.mapId || 'plaza');
  if (user) achievementSystem.syncFromServer();

  // --- Debug ---
  window.__debug = { trickState, playerPhysics, combo, gameLoop };

  console.log('[SkateGame] Sprint 6 — usuario:', user?.username || 'invitado', '| mapa:', roomData?.mapId || 'plaza');
  console.log('[SkateGame] WASD/Stick mover | SPACE/A saltar | 1-4/Q/E tricks | P skin | G replay | T chat');
}
