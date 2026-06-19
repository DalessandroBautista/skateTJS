# Skate Game — Diseño del Proyecto

**Fecha:** 2026-06-18  
**Stack:** Three.js + Cannon-es + Node.js + Socket.io + PostgreSQL + Prisma  
**Referencia:** messenger.abeto.co (juego 3D web, estilo movimiento en mundo)  
**Estilo de juego:** Tony Hawk's Pro Skater — tricks, combos, objetivos, progresión  
**Estilo visual:** Realista con PBR (normal maps, roughness maps, HDR lighting, sombras)

---

## Por qué se tomaron estas decisiones

### ECS-ready desde el inicio
Los módulos del cliente siguen la convención `*Component.js` (datos puros) y `*System.js` (lógica pura), aunque no se usa un ECS real todavía. Esto permite migrar a `bitecs` o `miniplex` en el futuro con mínimo esfuerzo: los Components se registran en el ECS y los Systems cambian el acceso directo por queries. La lógica no cambia, solo la forma de acceder a los datos.

### Cannon-es para física
Alternativa considerada: Rapier.js (más moderno y performante en WASM). Se eligió Cannon-es por mejor integración documentada con Three.js y ecosistema más maduro en ejemplos de juegos web. Si en el futuro se necesita más performance, migrar a Rapier es viable.

### PostgreSQL + Prisma
Se eligió PostgreSQL sobre MongoDB porque los datos de usuario (progresión, scores, unlocks) son relacionales y benefician de esquemas rígidos. Prisma como ORM por type-safety y migraciones automáticas.

### Salas con auto-spawn
Las salas públicas se generan automáticamente cuando una se llena (máx. 30-50 jugadores por sala). No hay una sala única por mapa — hay un pool de salas por mapa (`PublicRoomPool`). Esto evita el problema de una sola sala llena bloqueando el acceso al mapa.

### Fases de construcción
Se construye por fases para validar que el juego se sienta bien antes de invertir en infraestructura de multiplayer. El mayor riesgo en juegos es que la física y los controles no sean satisfactorios — eso se resuelve en Fase 1.

---

## Arquitectura General

```
skate-game/
├── client/          # Vite + Three.js
├── server/          # Node.js + Express + Socket.io
└── shared/          # Tipos y constantes compartidas (tricks, mapas, eventos socket)
```

### Fases de construcción

| Fase | Contenido | Resultado |
|------|-----------|-----------|
| 1 | Juego local: física, movement, tricks, HUD | Jugable en un solo mapa, un jugador |
| 2 | Multiplayer: auth, salas, sync en tiempo real | Múltiples jugadores en tiempo real |
| 3 | Progresión: XP, unlocks, mapas adicionales, polish PBR | Juego completo |

---

## Módulos del Cliente

### Convención ECS
- `components/` — datos puros (sin métodos de lógica)
- `systems/` — lógica que opera sobre componentes
- Cuando se migre a ECS real: cada component se registra, cada system cambia acceso directo por queries

```
client/src/
│
├── components/
│   ├── TransformComponent.js    # position, rotation, scale
│   ├── VelocityComponent.js     # velocity, angularVelocity
│   ├── PhysicsBodyComponent.js  # referencia al Cannon-es body
│   ├── TrickStateComponent.js   # trick activo, estado (airborne/grinding/skating/idle)
│   ├── ComboComponent.js        # multiplicador, timer, secuencia actual
│   ├── ProgressionComponent.js  # xp, level, unlockedTricks[]
│   ├── NetworkComponent.js      # socketId, isLocal, lastServerUpdate
│   └── MeshComponent.js         # referencia al Three.js mesh + AnimationMixer
│
├── systems/
│   ├── PhysicsSystem.js         # Aplica fuerzas, sincroniza Cannon ↔ TransformComponent
│   ├── MovementSystem.js        # InputManager + VelocityComponent → TransformComponent
│   ├── TrickSystem.js           # Detecta inputs → actualiza TrickStateComponent
│   ├── ComboSystem.js           # TrickStateComponent → actualiza ComboComponent + score
│   ├── AnimationSystem.js       # TrickStateComponent → sincroniza clips del AnimationMixer
│   ├── CameraSystem.js          # Sigue TransformComponent del jugador local
│   ├── RenderSystem.js          # TransformComponent → sincroniza Three.js meshes
│   ├── NetworkSyncSystem.js     # Envía estado local, aplica interpolación a remotos
│   └── ProgressionSystem.js     # ComboComponent → XP → ProgressionComponent
│
├── engine/
│   ├── Renderer.js          # WebGLRenderer, post-processing (bloom, AO, sombras)
│   ├── Scene.js             # Escena Three.js, luces HDR, skybox
│   └── GameLoop.js          # requestAnimationFrame, ordena ejecución de systems
│
├── input/
│   └── InputManager.js      # Estado crudo del teclado/gamepad, sin lógica de juego
│
├── world/
│   ├── MapLoader.js         # Carga GLTF, extrae collision meshes para Cannon
│   └── InteractiveObjects.js # Rails/rampas → triggers para TrickSystem
│
├── tricks/
│   └── TrickLibrary.js      # Definición de cada trick: nombre, puntos, input, animación
│
├── network/
│   ├── SocketClient.js      # Conexión Socket.io, emite/recibe eventos
│   └── Interpolation.js     # Suaviza posiciones de jugadores remotos
│
└── ui/
    ├── HUD.js               # Score, combo, timer, XP (DOM overlay sobre canvas)
    ├── MainMenu.js          # Pantalla inicio, login, registro
    ├── LobbyUI.js           # Salas públicas/privadas, lista de jugadores
    └── Leaderboard.js       # Top scores de la sala
```

### Flujo de datos del cliente por frame

```
InputManager
    ↓
MovementSystem  →  VelocityComponent  →  PhysicsSystem  →  TransformComponent
                                                                  ↓
TrickSystem  →  TrickStateComponent  →  ComboSystem  →  ComboComponent
                      ↓                                        ↓
               AnimationSystem                        ProgressionSystem
               (MeshComponent)                        (ProgressionComponent)
                                                               ↓
                                                         HUD (UI update)
TransformComponent  →  RenderSystem  →  Three.js mesh positions
TransformComponent  →  NetworkSyncSystem  →  Socket.io emit
```

---

## Módulos del Servidor

```
server/src/
│
├── api/
│   ├── routes/
│   │   ├── auth.routes.js          # POST /register, POST /login, POST /refresh
│   │   ├── user.routes.js          # GET /me, PUT /me (perfil, progresión)
│   │   └── leaderboard.routes.js   # GET /scores/:mapId
│   └── middleware/
│       └── auth.middleware.js      # Verifica JWT en rutas protegidas
│
├── socket/
│   ├── SocketManager.js            # Inicializa Socket.io, registra handlers
│   └── handlers/
│       ├── room.handler.js         # join-room, leave-room, create-room
│       ├── player.handler.js       # player-move, player-trick, player-score
│       └── chat.handler.js         # mensajes rápidos en sala (opcional fase 2)
│
├── rooms/
│   ├── RoomManager.js              # CRUD de salas, delega a PublicRoomPool o crea privada
│   ├── Room.js                     # Estado de una sala: jugadores, mapa, scores, config
│   └── PublicRoomPool.js           # Pool de salas públicas por mapId, auto-spawn al llenarse
│
├── auth/
│   ├── jwt.js                      # Sign/verify tokens JWT
│   └── password.js                 # bcrypt hash/compare
│
├── game/
│   └── ScoreValidator.js           # Valida scores del cliente (anti-cheat básico)
│
└── db/
    ├── prisma/
    │   └── schema.prisma           # Modelos: User, Progression, Score
    └── repositories/
        ├── user.repo.js
        └── score.repo.js
```

---

## Base de Datos (Prisma Schema)

```prisma
model User {
  id            String       @id @default(cuid())
  email         String       @unique
  username      String       @unique
  passwordHash  String
  createdAt     DateTime     @default(now())
  progression   Progression?
  scores        Score[]
}

model Progression {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])
  xp             Int      @default(0)
  level          Int      @default(1)
  unlockedTricks String[] @default([])
  skin           String   @default("default")
}

model Score {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  mapId     String
  points    Int
  maxCombo  Int
  createdAt DateTime @default(now())
}
```

---

## Sistema de Salas

- **Salas públicas:** cada mapa tiene un pool (`PublicRoomPool`). Cuando una sala se llena (30-50 jugadores), se crea automáticamente otra. El jugador siempre entra a la sala con menos jugadores del mapa elegido.
- **Salas privadas:** el creador elige mapa, máximo de jugadores y contraseña opcional. Se comparte un código de sala para invitar amigos.
- **Room config:** `{ mapId, maxPlayers, isPrivate, password?, roundDuration }`

### Eventos Socket.io

| Evento (cliente → servidor) | Descripción |
|-----------------------------|-------------|
| `room:join` | Unirse a sala (pública o por código) |
| `room:create` | Crear sala privada con config |
| `room:leave` | Salir de sala |
| `player:move` | Posición + rotación del jugador (tick rate: 20/s) |
| `player:trick` | Trick ejecutado + puntos |

| Evento (servidor → cliente) | Descripción |
|-----------------------------|-------------|
| `room:state` | Estado completo de la sala al unirse |
| `room:player-joined` | Nuevo jugador entró |
| `room:player-left` | Jugador salió |
| `player:update` | Posición de otros jugadores |
| `score:update` | Leaderboard actualizado |

---

## Sistema de Tricks y Progresión

### Tricks
Cada trick en `TrickLibrary.js` tiene:
```js
{
  id: 'kickflip',
  name: 'Kickflip',
  points: 100,
  inputSequence: ['jump', 'trick1'],   // teclas requeridas
  animationClip: 'kickflip',
  requiredLevel: 1                      // nivel mínimo para ejecutarlo
}
```

### Combos
- `ComboComponent` mantiene un timer que se reinicia cada trick ejecutado
- Si el timer llega a 0 sin nuevo trick, el combo termina y se suman los puntos × multiplicador
- Multiplicador aumenta cada 3 tricks consecutivos (×1 → ×2 → ×3 → ×4 max en Fase 1)

### Progresión
- Cada trick otorga XP = `points × comboMultiplier × 0.1`
- Al subir de nivel se desbloquean tricks más complejos (special moves en niveles altos)
- La progresión se guarda en el servidor, no en el cliente

---

## Mapas

Cada mapa es un archivo GLTF con:
- **Visual mesh:** geometría y materiales PBR
- **Collision mesh:** geometría simplificada (nombrada `*_col`) para Cannon-es
- **Spawn points:** objetos vacíos nombrados `spawn_*`
- **Interactive objects:** rails y rampas nombrados `rail_*`, `ramp_*` para `InteractiveObjects.js`

### Mapas planeados (Fase 1 → 3)
| Fase | Mapa | Descripción |
|------|------|-------------|
| 1 | Skate Park genérico | Para desarrollo y pruebas |
| 2 | Buenos Aires | Plaza de Mayo / Puerto Madero |
| 3 | Tokyo | Shibuya / Harajuku |
| 3 | NYC | Brooklyn Banks / Manhattan |

---

## Shared (cliente + servidor)

```
shared/
├── constants/
│   ├── maps.js          # IDs y nombres de mapas disponibles
│   ├── tricks.js        # IDs de tricks (para evitar strings mágicos)
│   └── socketEvents.js  # Nombres de eventos Socket.io
└── types/               # (opcional) JSDoc typedefs compartidos
```

---

## Pendiente / A definir en fases posteriores

- Sistema de amigos y lista de amigos online
- Chat de texto en sala
- Cosméticos (skins, tablas)
- Replay de mejores jugadas
- Sistema de objetivos por mapa (colectar letras S-K-A-T-E, etc.)
- Anti-cheat más robusto (validación server-side de física)

---

## Plan de Sprints

Cada sprint es una unidad de trabajo completable y testeable de forma independiente.  
Criterio de "hecho": se puede ver/probar el resultado en el browser sin errores.

---

### FASE 1 — Juego Local

#### Sprint 1.1 — Setup del proyecto
**Archivos:** `package.json`, `vite.config.js`, `client/src/main.js`, `engine/Renderer.js`, `engine/Scene.js`  
**Qué se construye:**
- Monorepo con `client/` y `server/` en un mismo repo
- Vite configurado con Three.js
- Escena vacía con fondo de color, luz ambiental y direccional básica
- Loop de render funcionando (requestAnimationFrame)

**Cómo sabés que está hecho:** Abrís el browser y ves una pantalla vacía con fondo de cielo sin errores en consola.

---

#### Sprint 1.2 — Cámara en tercera persona
**Archivos:** `engine/Camera.js`, `systems/CameraSystem.js`, `components/TransformComponent.js`  
**Qué se construye:**
- Cámara que sigue a un cubo placeholder (futuro skater)
- Offset configurable (altura y distancia)
- Suavizado de movimiento con lerp

**Cómo sabés que está hecho:** Un cubo se mueve por la escena con WASD y la cámara lo sigue suavemente desde atrás.

---

#### Sprint 1.3 — Mundo físico + colisiones básicas
**Archivos:** `physics/PhysicsWorld.js`, `systems/PhysicsSystem.js`, `components/PhysicsBodyComponent.js`, `components/VelocityComponent.js`  
**Qué se construye:**
- Cannon-es inicializado con gravedad
- Plano de suelo con colisión
- El cubo placeholder cae y descansa en el suelo
- Sincronización Cannon body ↔ TransformComponent cada frame

**Cómo sabés que está hecho:** El cubo cae y queda en el piso. Si lo tirás por el aire, rebota.

---

#### Sprint 1.4 — Movimiento del skater
**Archivos:** `input/InputManager.js`, `systems/MovementSystem.js`, `components/TrickStateComponent.js` (solo el estado de movimiento)  
**Qué se construye:**
- InputManager captura teclado (WASD / flechas) y gamepad
- MovementSystem aplica fuerzas al PhysicsBody según input
- Fricción y momentum: el skate no frena instantáneo
- Estado básico: `skating` / `idle`

**Cómo sabés que está hecho:** El cubo/skater se mueve con físicas creíbles — aceleración gradual, derrape suave al girar.

---

#### Sprint 1.5 — Primer mapa (skate park placeholder)
**Archivos:** `world/MapLoader.js`, `world/InteractiveObjects.js`  
**Qué se construye:**
- MapLoader carga un GLTF simple (rampas básicas, suelo, paredes)
- Extrae meshes `*_col` y los convierte en Cannon bodies estáticos
- El jugador puede subir y bajar rampas con físicas correctas

**Cómo sabés que está hecho:** El jugador patina por el mapa, sube rampas, no atraviesa paredes.

---

#### Sprint 1.6 — Modelo del skater + animaciones
**Archivos:** `characters/SkaterModel.js`, `systems/AnimationSystem.js`, `components/MeshComponent.js`  
**Qué se construye:**
- Modelo GLTF rigged cargado (puede ser un asset free de Mixamo/Sketchfab)
- AnimationMixer con clips: `idle`, `push`, `airborne`
- AnimationSystem transiciona entre clips según `TrickStateComponent`

**Cómo sabés que está hecho:** El skater tiene modelo real, se ve la animación de empuje cuando se mueve y idle cuando está quieto.

---

#### Sprint 1.7 — Salto + estado aéreo
**Archivos:** `systems/MovementSystem.js`, `systems/PhysicsSystem.js`, `components/TrickStateComponent.js`  
**Qué se construye:**
- Input de salto (barra espaciadora)
- Detección de si el jugador está en el suelo (raycast hacia abajo)
- Estado `airborne` en TrickStateComponent
- Físicas de caída correctas (no flotar)

**Cómo sabés que está hecho:** El jugador salta, queda suspendido en el aire con animación correcta, cae con gravedad natural.

---

#### Sprint 1.8 — Tricks básicos (aéreos)
**Archivos:** `tricks/TrickLibrary.js`, `systems/TrickSystem.js`, `components/TrickStateComponent.js`  
**Qué se construye:**
- TrickLibrary con 3 tricks iniciales: Kickflip, Heelflip, 360 Flip
- TrickSystem detecta input mientras está `airborne`
- Animación del trick se reproduce en el aire
- Puntos asignados al aterrizar correctamente

**Cómo sabés que está hecho:** Saltás, presionás la tecla de trick, el skater hace la animación, al aterrizar aparecen los puntos en pantalla.

---

#### Sprint 1.9 — Grinds (rails)
**Archivos:** `world/InteractiveObjects.js`, `systems/TrickSystem.js`, `components/TrickStateComponent.js`  
**Qué se construye:**
- Rails en el mapa con trigger volumes
- Al rozar un rail con velocidad suficiente, el jugador entra en estado `grinding`
- El skater se desliza por el rail con física simplificada (sigue el eje del rail)
- Puntos por tiempo de grind

**Cómo sabés que está hecho:** El skater sube a un rail, se desliza hasta el final y sale con puntos.

---

#### Sprint 1.10 — Sistema de combo + HUD
**Archivos:** `systems/ComboSystem.js`, `components/ComboComponent.js`, `ui/HUD.js`  
**Qué se construye:**
- ComboComponent: multiplicador (×1 a ×4), timer, lista de tricks del combo
- ComboSystem: timer que corre mientras hay combo activo, se reinicia con cada trick
- HUD con DOM overlay: score total, multiplicador, timer del combo, lista de tricks encadenados
- Al terminar el combo (timer llega a 0 o caída): puntos finales se suman al score

**Cómo sabés que está hecho:** Hacés varios tricks seguidos, ves el multiplicador subir en pantalla y los puntos acumularse al terminar el combo.

---

### FASE 2 — Multiplayer ✅ COMPLETADO (2026-06-18)

> Auth, salas públicas/privadas, sync en tiempo real, chat, persistencia de scores. Servidor en :4000, cliente en :5175. SQLite vía Prisma. JWT + bcrypt. NetworkManager singleton + NetworkSystem para sync de remotos. Race condition de auto-login resuelta con flag `shown`.

#### Sprint 2.1 — Setup del servidor
**Archivos:** `server/src/index.js`, `server/package.json`, `db/prisma/schema.prisma`  
**Qué se construye:**
- Express + Socket.io corriendo en Node.js
- Prisma conectado a PostgreSQL local
- Migraciones iniciales: modelos `User`, `Progression`, `Score`
- Health check endpoint: `GET /api/health`

**Cómo sabés que está hecho:** `curl localhost:3000/api/health` devuelve `{ ok: true }`. Prisma Studio muestra las tablas vacías.

---

#### Sprint 2.2 — Auth (registro y login)
**Archivos:** `auth/jwt.js`, `auth/password.js`, `api/routes/auth.routes.js`, `api/middleware/auth.middleware.js`, `db/repositories/user.repo.js`  
**Qué se construye:**
- `POST /api/auth/register` — crea usuario con bcrypt
- `POST /api/auth/login` — valida credenciales, devuelve JWT
- `GET /api/auth/me` — devuelve datos del usuario autenticado (requiere JWT)
- Middleware que rechaza requests sin token válido

**Cómo sabés que está hecho:** Podés registrar un usuario con Postman/curl, hacer login y usar el token para llamar a `/me`.

---

#### Sprint 2.3 — Auth UI
**Archivos:** `ui/MainMenu.js`  
**Qué se construye:**
- Formulario de registro (email, username, password)
- Formulario de login
- Token JWT guardado en localStorage
- Si hay token válido, saltea la pantalla de login
- Si el token expira, redirige al login

**Cómo sabés que está hecho:** El usuario puede registrarse, loguear y la pantalla del juego aparece. Si cerrás y reabrís el browser, sigue logueado.

---

#### Sprint 2.4 — Conexión Socket.io + sala básica
**Archivos:** `socket/SocketManager.js`, `socket/handlers/room.handler.js`, `rooms/Room.js`, `rooms/RoomManager.js`, `network/SocketClient.js`  
**Qué se construye:**
- Cliente se conecta a Socket.io enviando JWT para autenticarse
- Servidor valida el token al conectar
- `room:join` crea o une al jugador a una sala hardcodeada (un solo mapa por ahora)
- `room:state` devuelve la lista de jugadores actuales

**Cómo sabés que está hecho:** Abrís dos ventanas del browser, las dos aparecen en la misma sala. El servidor loggea las conexiones con el username.

---

#### Sprint 2.5 — Sincronización de posiciones
**Archivos:** `systems/NetworkSyncSystem.js`, `network/SocketClient.js`, `network/Interpolation.js`, `socket/handlers/player.handler.js`, `characters/SkaterModel.js` (instancias remotas)  
**Qué se construye:**
- NetworkSyncSystem emite `player:move` con posición + rotación a 20 ticks/segundo
- Servidor hace broadcast a todos en la sala excepto al emisor
- RemotePlayer: instancia del modelo del skater para cada jugador remoto
- Interpolation.js suaviza la posición recibida entre ticks

**Cómo sabés que está hecho:** Abrís dos ventanas, en cada una ves al otro jugador moverse en tiempo real sin teletransportarse.

---

#### Sprint 2.6 — Sync de tricks y score en sala
**Archivos:** `socket/handlers/player.handler.js`, `game/ScoreValidator.js`, `ui/Leaderboard.js`  
**Qué se construye:**
- Cliente emite `player:trick` al ejecutar un trick (nombre, puntos)
- ScoreValidator verifica que el puntaje sea razonable (anti-cheat básico)
- Servidor actualiza el score de la sala y hace broadcast de `score:update`
- Leaderboard en HUD muestra ranking en tiempo real de todos en la sala

**Cómo sabés que está hecho:** Hacés un trick, todos en la sala ven la animación y el leaderboard se actualiza.

---

#### Sprint 2.7 — Sistema de salas completo
**Archivos:** `rooms/PublicRoomPool.js`, `rooms/RoomManager.js`, `socket/handlers/room.handler.js`, `ui/LobbyUI.js`  
**Qué se construye:**
- PublicRoomPool: pool de salas públicas por mapa, auto-spawn cuando se llena
- Sala privada: `room:create` con `{ isPrivate: true, password?, maxPlayers }`
- Código de sala para invitar amigos
- LobbyUI: lista de salas públicas disponibles por mapa, botón "crear sala privada"

**Cómo sabés que está hecho:** Podés ver la lista de salas, entrar a una pública, crear una privada y compartir el código para que otro jugador entre.

---

#### Sprint 2.8 — Persistencia de scores
**Archivos:** `api/routes/leaderboard.routes.js`, `db/repositories/score.repo.js`, `ui/Leaderboard.js`  
**Qué se construye:**
- Al terminar una sesión/ronda, el mejor score del jugador se guarda en PostgreSQL
- `GET /api/scores/:mapId` devuelve top 20 scores globales del mapa
- Leaderboard global accesible desde el lobby (no solo en sala)

**Cómo sabés que está hecho:** Jugás, salís, volvés a entrar y tu score sigue en la tabla global.

---

### FASE 3 — Progresión y Polish ✅ COMPLETADO (2026-06-19)

> XP/niveles en tiempo real, 3 mapas (Plaza/Park/Streets), tricks por nivel, skins por color de nivel (8 colores), leaderboard de sala, leaderboard global con Tab, loading screen, respawn con R, manual con M, puntos de grind, combo end flash, speed indicator, +XP notification, anti-cheat (cooldown 30s + max score), endpoint GET /api/scores/:mapId.

#### Sprint 3.1 — XP y niveles ✅
**Archivos:** `systems/ProgressionSystem.js`, `components/ProgressionComponent.js`, `api/routes/user.routes.js`, `db/repositories/user.repo.js`  
**Qué se construye:**
- ProgressionSystem calcula XP por trick (`points × comboMultiplier × 0.1`)
- Al acumular suficiente XP, el jugador sube de nivel
- El nivel y XP se sincronizan con el servidor al terminar la sesión
- HUD muestra barra de XP y nivel actual

**Cómo sabés que está hecho:** Jugás, subís de nivel, cerrás el browser, volvés y el nivel persiste.

---

#### Sprint 3.2 — Sistema de unlocks
**Archivos:** `systems/ProgressionSystem.js`, `tricks/TrickLibrary.js`, `components/ProgressionComponent.js`, `network/UnlockManager.js`  
**Qué se construye:**
- Cada trick en TrickLibrary tiene `requiredLevel`
- TrickSystem verifica antes de ejecutar un trick si el jugador tiene el nivel
- Al subir de nivel, se muestra notificación de trick desbloqueado
- Los tricks bloqueados no aparecen en el HUD

**Cómo sabés que está hecho:** Un jugador nivel 1 no puede hacer tricks avanzados. Al subir de nivel aparece "¡Nuevo trick desbloqueado: 900!".

---

#### Sprint 3.3 — Más tricks (manuals y specials)
**Archivos:** `tricks/TrickLibrary.js`, `systems/TrickSystem.js`, `components/TrickStateComponent.js`  
**Qué se construye:**
- Estado `manual` (balanceo en dos ruedas) que permite extender combos en el suelo
- 5+ tricks especiales de alto nivel (900, McTwist, etc.)
- Tricks que combinan grind + aéreo
- Animaciones para cada uno (clips nuevos en el modelo)

**Cómo sabés que está hecho:** Podés encadenar grind → manual → trick aéreo en un combo continuo.

---

#### Sprint 3.4 — Segundo mapa + estructura multimap ✅
**Archivos:** `world/MapLoader.js`, `shared/constants/maps.js`, `rooms/Room.js`, `ui/LobbyUI.js`  
**Qué se construye:**
- Segundo mapa GLTF (Buenos Aires)
- MapLoader soporta cargar cualquier mapa por ID
- LobbyUI muestra los mapas disponibles al crear/unirse a sala
- PublicRoomPool tiene pools independientes por mapa

**Cómo sabés que está hecho:** Podés elegir entre dos mapas en el lobby y jugar en cualquiera de los dos.

---

#### Sprint 3.5 — Iluminación PBR + post-processing ✅
**Archivos:** `engine/Renderer.js`, `engine/Scene.js`  
**Qué se construye:**
- HDR environment map para iluminación ambiental realista
- Sombras (PCFSoftShadowMap) activadas en luces principales
- Post-processing pipeline: bloom sutil, ambient occlusion (SSAO), tone mapping
- Materiales de los mapas actualizados con normal maps y roughness maps

**Cómo sabés que está hecho:** El juego se ve notablemente más realista. Las sombras son suaves y hay profundidad visual.

---

#### Sprint 3.6 — Cosméticos (skins)
**Archivos:** `characters/SkaterModel.js`, `components/ProgressionComponent.js`, `api/routes/user.routes.js`, `ui/MainMenu.js`  
**Qué se construye:**
- Skins del skater desbloqueables por nivel (cambios de textura/color)
- Selector de skin en el menú de perfil
- La skin seleccionada se sincroniza con otros jugadores de la sala

**Cómo sabés que está hecho:** Cambiás la skin, otros jugadores te ven con esa skin.

---

#### Sprint 3.7 — Anti-cheat + validación server-side ✅ (básico)
**Archivos:** `game/ScoreValidator.js`, `socket/handlers/player.handler.js`  
**Qué se construye:**
- ScoreValidator rechaza tricks con puntaje imposible para el nivel del jugador
- Rate limiting en `player:move` y `player:trick`
- Log de actividad sospechosa

**Cómo sabés que está hecho:** Un cliente modificado que envía scores falsos es rechazado por el servidor.

---

#### Sprint 3.8 — Tercer mapa y polish final ✅ (parcial)

> Loading screen ✅, Sound system Web Audio API ✅, Dynamic FOV ✅. Sin tercer mapa GLTF ni sonido de ambiente (sin assets).

---

### FASE 4 — Audio, Partículas y Polish Final 🔄 EN PROGRESO (2026-06-19)

#### Sprint 4.1 — Sistema de audio ✅
**Implementado:** SoundManager con Web Audio API procedural. Sonidos: jump, land, trick/whoosh, grind clank, combo end fanfarria, level-up fanfarria. Sin archivos externos.

#### Sprint 4.2 — Cámara avanzada ✅
**Implementado:** FOV dinámico (60–80) proporcional a la velocidad. A mayor velocidad el FOV aumenta, dando sensación de velocidad.

#### Sprint 4.3 — Partículas ✅ (2026-06-19)
**Implementado:** `ParticleSystem.js` con pool de 200 partículas Three.js Points.
- Polvo gris/beige en pies del skater cuando velocidad > 3 m/s (isGrounded=true)
- Chispas doradas al aterrizar un trick (via `trickState.lastTrick`)
- Chispas metálicas durante grinding (via `movementSystem.onGrindTick`)
- Fix detección de suelo: `verticalSpeed < 2.5 && pos.y < 30` para funcionar en plataformas

#### Sprint 4.4 — Tercer mapa ✅ (incluido en Sprint 3)
Ya implementado: Plaza (concreto gris), Park (verde con bowl), Streets (asfalto urbano).

#### Sprint 4.5 — Polish multijugador ✅ (2026-06-19)
**Implementado:**
- Delta compression: solo envía si posición cambió ≥ 0.05m o rotación ≥ 0.05 rad
- Trick popup flotante sobre jugadores remotos con fade+rise animation
- Popup persiste 2 segundos con opacidad decreciente

#### Sprint 4.6 — Achievements / objetivos ✅ (2026-06-19)
**Implementado:** `AchievementSystem.js` + `AchievementNotification.js` + `AchievementsScreen.js`
- 10 logros: Primera Patada, Trick Master, Combo 100/1000/5000, Velocidad Máxima, Grindero, Veterano, Puntaje Acumulado, Mago del Manual
- Toast de notificación con slide-in/out desde la derecha (borde dorado)
- Pantalla de logros con tecla L — muestra progreso de cada uno
- Persistencia en localStorage

#### Sprint 3.8 — Tercer mapa y polish final
**Archivos:** varios  
**Qué se construye:**
- Tercer mapa GLTF (Tokyo o NYC)
- Bug fixes y optimizaciones de red (delta compression en posiciones)
- Loading screen entre mapa y sala
- Sonido (efectos de tricks, música ambient por mapa)

**Cómo sabés que está hecho:** El juego se siente completo y pulido. Tres mapas disponibles, sin bugs mayores.
