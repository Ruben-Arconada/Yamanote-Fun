# Sistemas añadidos en v0.1.4 y v0.1.5

Referencia técnica de los sistemas que entraron en estas dos versiones, con sus
constantes de ajuste y puntos de extensión. Complementa a `DIRECCION-ARTE.md`
(estética) y `ESTRATEGIA-GRAFICA.md` (presupuesto técnico).

## v0.1.4 — Puertas manuales y pasajeros sprite

### Puertas como gameplay (`src/game/Train.ts`, `src/game/Game.ts`, `src/ui/UI.ts`)

Estados del tren: `running → stopped → doors_open → doors_closing → running`.
Al clavar la parada las puertas NO se abren solas: el botón DOORS del HUD (y la
tecla **D**) llama a `Train.requestDoorAction()`, que abre en `stopped` y cierra
en `doors_open` una vez `boardingComplete`.

- Bonus de apertura: ≤ `OPEN_INSTANT_SECONDS` (2 s) = +30 «¡Puertas al instante!»;
  ≤ `OPEN_QUICK_SECONDS` (4,5 s) = +15. Cierre en ventana `CLOSE_WINDOW_SECONDS`
  (3,5 s tras fin de embarque) = +30 «¡Salida puntual!». Los bonus de puertas NO
  tocan la racha de paradas perfectas (`applyDoorBonus` vs `applyScore`).
- Salvavidas: auto-apertura a `OPEN_AUTO_SECONDS` (9 s), aviso a
  `CLOSE_HURRY_SECONDS` (5,5 s) y auto-cierre a `CLOSE_AUTO_SECONDS` (9,5 s) —
  sin bonus, imposible bloquearse.
- El embarque dura `BOARDING_BASE_SECONDS + crowdDensityForHour(hora) ×
  BOARDING_CROWD_SECONDS` (5,5–11 s): hora punta = andén lleno = más espera.
- Fases del botón en el HUD: `idle / can-open / boarding (con barra) /
  can-close / closing` — ver `DoorPhase` en UI.ts.

### Pasajeros 2D (`src/game/Passengers.ts`)

Sprite-sheet 100 % canvas (8 arquetipos × 2 frames idle + 4 walk, celdas
128×192) en UNA `InstancedBufferGeometry` de billboards cilíndricos + otra de
sombras de contacto (2 draw calls totales). Animación idle/walk EN el vertex
shader (uTime + fase por instancia): coste CPU cero en crucero.

- Coreografía: `beginBoarding(estación, segundos)` — bajan 2-4 viajeros, los que
  esperan caminan por waypoints (primero a la Z de su puerta, luego al borde) y
  desaparecen al «subir»; `endBoarding()` al cerrar puertas embarca a los
  rezagados. El andén se repuebla 2 estaciones después (`lastBoardedStation`).
- Visibilidad ambiental por `crowdDensityForHour` con refresco cada 1,6 s.
- **LECCIÓN DURA**: en `ShaderMaterial` custom NO usar `cameraPosition` (no se
  refresca de forma fiable — los sprites no se dibujaban). La base del billboard
  sale de las filas de `viewMatrix`:
  `vec3(viewMatrix[0].x, viewMatrix[1].x, viewMatrix[2].x)` = camera-right.
  Niebla en ShaderMaterial: `fog: true` + `UniformsLib.fog` + chunks `fog_*`.
- Es el primer ladrillo del futuro personaje a pie: misma tecnología de sprites
  + patrón «andar por waypoints sobre superficie conocida» (hoy `PLATFORM_GEOM`
  de City.ts; mañana `groundHeightAt`).

## v0.1.5 — Estaciones del año, clima, casas japonesas, pendiente

### Estaciones del año (`src/game/Seasons.ts`)

Dos ejes seleccionables en el HUD junto al reloj (chips 🌸🌿🍁⛄ y ☀️☁️🌧️),
persistidos en localStorage (`yamanote-season` / `yamanote-weather`).

Arquitectura: **pools estacionales** — cada `instanceColor` (o atributo de
vertex colors) se registra con `registerPool(kind, attr, [rango])`, que guarda
una copia de los colores de fábrica; `applySeasonToPool` los remapea con
`seasonalColor(kind, season, i, r, g, b)`. Es un repintado **one-off al cambiar
de estación**: coste por frame CERO. Biomas (`FoliageKind`): `broadleaf`
(momiji procedural en otoño con hash determinista por instancia), `pine`,
`scrub`, `sakura`, `sakuraEver`, `roof`, `terrain`, `mountain`.

- **REGLA DE ORO del overdrive**: los vertex/instance colors multiplican
  texturas oscuras (suelo ≈ 0,3 de luma; tejas ≈ 0,5). Para que una estación se
  LEA hay que superar 1.0: terreno otoño `lerp(STRAW,0.55)×1.85`, invierno
  `lerp(FROST,0.75)×2.7`, tejados invierno `lerp(SNOW_WHITE,0.82)×1.7`. Sin el
  overdrive todo queda olivo/pizarra (falló la ronda 1 del panel por esto).
- **Sakura perenne de Komagome** (decisión del director, botánicamente
  imposible a propósito): bosquecillo de 12 cerezos alrededor del andén de la
  colina registrado como `sakuraEver` (florece las 4 estaciones, sus pétalos
  caen todo el año) + 5 momiji fijos (`APPROACH_MAPLES` en `buildHillDressing`)
  en la llegada, para que en otoño convivan momiji rojo y sakura rosa en el
  mismo encuadre.
- Fuji invernal: segunda malla de nieve con snowline 0,28 (vs 0,55), conmutada
  por visibilidad en `Scenery.setSeason`.
- Invierno también encala el balasto (`ballastMat.color ×1.65`) y funde la banda
  de desgaste (`wearMat.opacity 0.25`) — en `Game.applyAtmosphere()`.

### Clima (`src/game/DayNightCycle.ts`, `src/game/Precipitation.ts`)

- `overcastGoal/overcast` en DayNightCycle: el cielo colapsa a un gris con
  **luminancia objetivo derivada del sol** (`dayLevel`) — un nublado de mediodía
  es perla LUMINOSA, no crepúsculo. Bajo nublado: sin sombras duras (o≥0,55),
  sin sol/luna/estrellas, niebla más cercana, ambient ligeramente arriba.
- `Precipitation`: cortina de 1100 quads instanciados en una caja de 38×26×38
  alrededor de la cámara, posiciones 100 % en shader (seed + uTime con mod);
  CPU por frame = 4-5 escrituras de uniform. `set(falling, snow)`:
  **invierno + lluvia = nieve** (copos lentos con vaivén, mismo sistema).
- Audio de lluvia (`AudioEngine.setRain(level)`): wash lowpass 850 Hz + patter
  bandpass 3,6 kHz destunado (playbackRate 1.31), fades de 1,2 s, respiración
  ±20 % (LFO 0.44 rad/s). La nieve entra a level 0,12 = casi muda. Coro
  estacional en `updateTimeAmbience`: primavera uguisu, verano cigarras ×2,1,
  otoño `playSuzumushi` (2 pulsos con vibrato LFO 26-34 Hz), invierno silencio
  nevado; insectos bajo lluvia con suelo 0,25 (se alejan, no se mudan).

### Casas japonesas (`Scenery.buildHouseRows`, reescrito entero)

500 casas compuestas desde ~12 pools instanciados: muros achaflanados
(`RoundedBoxGeometry` 1 segmento), tejados kirizuma (prisma) y **yosemune**
(cadera con caballete corto), irimoya = hip + gable apilado (composición, no
geometría nueva). Arquetipos: `gable` 42 % / `lplan` 20 % (ala con caballete
girado 90°) / `nikai` 16 % (dos plantas + irimoya) / `engawa` 22 % (tarima,
postes y alero). Cada parcela: cercado con hueco de puerta, 2 postes,
mini-tejadillo kirizuma sobre la puerta y camino de tierra hasta la casa (solo
en parcelas llanas, `spread < 0.4`).

- Entradas miran a la vía… salvo un **30 % `backTurned`** (desde un tren real se
  ven traseras). 
- **Laderas**: se sondea el terreno bajo el borde de la huella
  (`gMin`/`spread`) y muros/cercas/postes se ESTIRAN hacia abajo hasta el punto
  más bajo — enterrado cuesta arriba está bien, flotar cuesta abajo no
  (feedback en vivo de Rubén).
- Los postes de las balizas de distancia van 0,18 unidades POR DETRÁS del
  cartel (mismo feedback).

### Pendiente arcade (`Track.gradeYAt`, `Train.ts`)

`GRADE_ACCEL_KMH_S = 8.8` × componente Y del tangente unitario = el 16 % visual
de Komagome se comporta como un 4 % físico (factor 0,25 acordado).
`gradeYAt` es analítico (del perfil `hillGrade`), sin muestrear la curva y sin
alocaciones — no usar `tangentAt` en el bucle de física.

### Rendimiento (regla de Marco)

150-164 draw calls según vista (presupuesto ~160). `lerpKeyframes` reescrito
sobre scratch (cero clones/frame; **el Keyframe devuelto es efímero — no
cachear referencias**). Overlay de perf: tecla **P** (FPS + draws + tris; las
lecturas diurnas incluyen el pase de sombras: ~670k tris vs ~400k de noche).

### Testing sin conducir (arnés de esta casa)

`window.__game` existe en DEV. Con el panel del navegador oculto no hay rAF:
avanzar a mano — `game.train.update(1/60)` + `game.step(1/60)` en bucle +
`game.renderOnce()`. Teleport: `train.progressFraction =
track.markerFor(i).tFraction - unidades/track.getLength()`. Captura:
`renderOnce()` y en el MISMO tick dibujar el canvas GL sobre un canvas 2D →
`toDataURL`.

## Proceso de calidad: «se reúne el equipo»

v0.1.5 se aprobó con un panel de 7 jueces-persona (los ficticios de
`src/data/team.ts`, cada uno su aspecto) puntuando capturas + código en 2
rondas hasta consenso ≥8/10 en todo (ronda 2: 8,9,8,9,8,8,9). Pendientes que
dejaron anotados para v0.1.6: parar las BufferSources de lluvia a gain 0,
gotas 2D en el parabrisas, nieve cuajada en traviesas, aclarar la textura base
del suelo (~0,45 de luma) para dar margen a las estaciones, code-split del
chunk de 718 kB, lowpass a insectos bajo lluvia, y una escucha real del audio
(el panel no puede oír).
