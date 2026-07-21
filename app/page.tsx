"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Station = {
  code: string;
  en: string;
  jp: string;
  distance: number;
  motif: number[];
};

type HudState = {
  speed: number;
  distance: number;
  power: number;
  brake: number;
  score: number;
  stationIndex: number;
  limit: number;
  clock: string;
  phase: string;
  signal: "GREEN" | "YELLOW" | "RED";
  status: string;
  lateness: number;
  arrived: boolean;
};

type AudioRig = {
  context: AudioContext;
  master: GainNode;
  traction: OscillatorNode;
  tractionGain: GainNode;
  rail: OscillatorNode;
  railGain: GainNode;
  filter: BiquadFilterNode;
};

const stations: Station[] = [
  { code: "JY20", en: "Shibuya", jp: "渋谷", distance: 740, motif: [67, 71, 74, 79] },
  { code: "JY21", en: "Ebisu", jp: "恵比寿", distance: 620, motif: [69, 72, 76, 74] },
  { code: "JY22", en: "Meguro", jp: "目黒", distance: 780, motif: [64, 68, 71, 76] },
  { code: "JY23", en: "Gotanda", jp: "五反田", distance: 690, motif: [62, 66, 69, 73] },
  { code: "JY24", en: "Osaki", jp: "大崎", distance: 810, motif: [65, 69, 72, 77] },
  { code: "JY25", en: "Shinagawa", jp: "品川", distance: 860, motif: [60, 64, 67, 72] },
  { code: "JY26", en: "Takanawa Gateway", jp: "高輪ゲートウェイ", distance: 650, motif: [72, 76, 79, 83] },
  { code: "JY27", en: "Tamachi", jp: "田町", distance: 760, motif: [67, 70, 74, 72] },
  { code: "JY28", en: "Hamamatsucho", jp: "浜松町", distance: 840, motif: [64, 67, 71, 76] },
  { code: "JY29", en: "Shimbashi", jp: "新橋", distance: 710, motif: [69, 73, 76, 81] },
  { code: "JY30", en: "Yurakucho", jp: "有楽町", distance: 610, motif: [66, 69, 73, 78] },
  { code: "JY01", en: "Tokyo", jp: "東京", distance: 680, motif: [72, 76, 79, 84] },
  { code: "JY02", en: "Kanda", jp: "神田", distance: 590, motif: [62, 65, 69, 74] },
  { code: "JY03", en: "Akihabara", jp: "秋葉原", distance: 650, motif: [71, 74, 78, 83] },
  { code: "JY04", en: "Okachimachi", jp: "御徒町", distance: 560, motif: [67, 71, 74, 76] },
  { code: "JY05", en: "Ueno", jp: "上野", distance: 630, motif: [64, 67, 72, 76] },
  { code: "JY06", en: "Uguisudani", jp: "鶯谷", distance: 710, motif: [69, 72, 76, 81] },
  { code: "JY07", en: "Nippori", jp: "日暮里", distance: 740, motif: [65, 69, 74, 77] },
  { code: "JY08", en: "Nishi-Nippori", jp: "西日暮里", distance: 610, motif: [62, 67, 71, 74] },
  { code: "JY09", en: "Tabata", jp: "田端", distance: 720, motif: [64, 68, 71, 76] },
  { code: "JY10", en: "Komagome", jp: "駒込", distance: 670, motif: [67, 70, 74, 79] },
  { code: "JY11", en: "Sugamo", jp: "巣鴨", distance: 620, motif: [65, 69, 72, 77] },
  { code: "JY12", en: "Otsuka", jp: "大塚", distance: 690, motif: [60, 64, 69, 72] },
  { code: "JY13", en: "Ikebukuro", jp: "池袋", distance: 870, motif: [69, 73, 76, 81] },
  { code: "JY14", en: "Mejiro", jp: "目白", distance: 680, motif: [64, 67, 71, 76] },
  { code: "JY15", en: "Takadanobaba", jp: "高田馬場", distance: 710, motif: [67, 71, 76, 79] },
  { code: "JY16", en: "Shin-Okubo", jp: "新大久保", distance: 650, motif: [62, 66, 71, 74] },
  { code: "JY17", en: "Shinjuku", jp: "新宿", distance: 820, motif: [71, 74, 78, 83] },
  { code: "JY18", en: "Yoyogi", jp: "代々木", distance: 570, motif: [65, 69, 72, 76] },
  { code: "JY19", en: "Harajuku", jp: "原宿", distance: 720, motif: [67, 72, 76, 79] },
];

const phaseName = (minutes: number) => {
  if (minutes < 300) return "深夜 · Deep night";
  if (minutes < 420) return "夜明け · Dawn";
  if (minutes < 720) return "朝 · Morning";
  if (minutes < 1020) return "昼 · Daylight";
  if (minutes < 1140) return "夕焼け · Golden hour";
  if (minutes < 1260) return "薄暮 · Blue hour";
  return "夜 · City lights";
};

const formatClock = (minutes: number) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const initialHud: HudState = {
  speed: 0,
  distance: stations[1].distance,
  power: 0,
  brake: 0,
  score: 1000,
  stationIndex: 0,
  limit: 65,
  clock: "05:18",
  phase: "夜明け · Dawn",
  signal: "GREEN",
  status: "Ready for departure",
  lateness: 0,
  arrived: false,
};

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

export default function Home() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioRig | null>(null);
  const simRef = useRef({
    started: false,
    speed: 0,
    distance: stations[1].distance,
    power: 0,
    brake: 0,
    score: 1000,
    stationIndex: 0,
    elapsed: 0,
    dayMinutes: 318,
    arrived: false,
    dwell: 0,
    muted: false,
  });
  const [hud, setHud] = useState<HudState>(initialHud);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const current = stations[hud.stationIndex];
  const next = stations[(hud.stationIndex + 1) % stations.length];

  const initAudio = useCallback(() => {
    if (audioRef.current) {
      void audioRef.current.context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = 0.42;
    master.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 620;
    filter.Q.value = 2.4;
    filter.connect(master);

    const traction = context.createOscillator();
    traction.type = "sawtooth";
    const tractionGain = context.createGain();
    tractionGain.gain.value = 0;
    traction.connect(tractionGain).connect(filter);
    traction.start();

    const rail = context.createOscillator();
    rail.type = "square";
    const railGain = context.createGain();
    railGain.gain.value = 0;
    rail.connect(railGain).connect(filter);
    rail.start();
    audioRef.current = { context, master, traction, tractionGain, rail, railGain, filter };
  }, []);

  const playChime = useCallback((motif: number[], soft = false) => {
    const rig = audioRef.current;
    if (!rig || simRef.current.muted) return;
    const now = rig.context.currentTime + 0.04;
    motif.forEach((note, index) => {
      const oscillator = rig.context.createOscillator();
      const gain = rig.context.createGain();
      oscillator.type = index % 2 === 0 ? "sine" : "triangle";
      oscillator.frequency.value = midiToHz(note);
      gain.gain.setValueAtTime(0.0001, now + index * 0.24);
      gain.gain.exponentialRampToValueAtTime(soft ? 0.07 : 0.14, now + index * 0.24 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.24 + 0.52);
      oscillator.connect(gain).connect(rig.master);
      oscillator.start(now + index * 0.24);
      oscillator.stop(now + index * 0.24 + 0.56);
    });
  }, []);

  const setPower = useCallback((notch: number) => {
    const sim = simRef.current;
    if (!sim.started || sim.arrived) return;
    sim.power = Math.min(4, Math.max(0, notch));
    if (sim.power > 0) sim.brake = 0;
  }, []);

  const setBrake = useCallback((notch: number) => {
    const sim = simRef.current;
    if (!sim.started) return;
    sim.brake = Math.min(8, Math.max(0, notch));
    if (sim.brake > 0) sim.power = 0;
  }, []);

  const coast = useCallback(() => {
    simRef.current.power = 0;
    simRef.current.brake = 0;
  }, []);

  const startRun = useCallback(() => {
    initAudio();
    const sim = simRef.current;
    sim.started = true;
    sim.power = 1;
    sim.brake = 0;
    setStarted(true);
    playChime(current.motif, true);
  }, [current.motif, initAudio, playChime]);

  const toggleMute = useCallback(() => {
    initAudio();
    const nextMuted = !simRef.current.muted;
    simRef.current.muted = nextMuted;
    setMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.master.gain.setTargetAtTime(nextMuted ? 0 : 0.42, audioRef.current.context.currentTime, 0.03);
    }
  }, [initAudio]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") setPower(simRef.current.power + 1);
      if (event.key === "ArrowDown") setBrake(simRef.current.brake + 1);
      if (event.key === " ") {
        event.preventDefault();
        coast();
      }
      if (event.key.toLowerCase() === "e") setBrake(8);
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [coast, setBrake, setPower]);

  useEffect(() => {
    const mount = viewportRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#8fb7c9");
    scene.fog = new THREE.Fog("#8fb7c9", 28, 205);
    const camera = new THREE.PerspectiveCamera(61, mount.clientWidth / mount.clientHeight, 0.1, 320);
    camera.position.set(0, 3.45, 8.2);
    camera.lookAt(0, 2.25, -45);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight("#d8efff", "#26302c", 1.35);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#ffe1ae", 2.4);
    sun.position.set(-22, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    scene.add(sun);

    const world = new THREE.Group();
    scene.add(world);
    const moving: THREE.Object3D[] = [];
    const nightMaterials: THREE.MeshStandardMaterial[] = [];

    const trackBed = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 0.34, 280),
      new THREE.MeshStandardMaterial({ color: "#34383b", roughness: 1 }),
    );
    trackBed.position.set(0, 0.05, -108);
    trackBed.receiveShadow = true;
    scene.add(trackBed);

    [-1.55, 1.55].forEach((x) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.2, 280),
        new THREE.MeshStandardMaterial({ color: "#c4ccd0", metalness: 0.8, roughness: 0.28 }),
      );
      rail.position.set(x, 0.37, -108);
      rail.receiveShadow = true;
      scene.add(rail);
    });

    for (let i = 0; i < 82; i += 1) {
      const sleeper = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.16, 0.42),
        new THREE.MeshStandardMaterial({ color: i % 4 === 0 ? "#61594e" : "#4d4942", roughness: 1 }),
      );
      sleeper.position.set(0, 0.24, 18 - i * 3.2);
      sleeper.userData.wrap = 262;
      sleeper.receiveShadow = true;
      moving.push(sleeper);
      world.add(sleeper);
    }

    const buildingPalette = ["#b8b3aa", "#8d969c", "#d4c5b2", "#777d83", "#a39b91"];
    for (let i = 0; i < 56; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const width = 5 + ((i * 7) % 9);
      const height = 7 + ((i * 13) % 29);
      const depth = 7 + ((i * 5) % 12);
      const z = 12 - Math.floor(i / 2) * 10.2;
      const facade = new THREE.MeshStandardMaterial({
        color: buildingPalette[i % buildingPalette.length],
        roughness: 0.88,
        emissive: new THREE.Color(i % 3 === 0 ? "#f4bd72" : "#8fc7dc"),
        emissiveIntensity: 0.02,
      });
      nightMaterials.push(facade);
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), facade);
      building.position.set(side * (8.8 + width / 2 + ((i * 3) % 8)), height / 2, z);
      building.userData.wrap = 285;
      building.castShadow = true;
      building.receiveShadow = true;
      moving.push(building);
      world.add(building);

      if (i % 3 === 0) {
        const signMaterial = new THREE.MeshStandardMaterial({
          color: i % 2 ? "#ec5b52" : "#4f8cbd",
          emissive: i % 2 ? "#ec5b52" : "#4f8cbd",
          emissiveIntensity: 0.2,
        });
        nightMaterials.push(signMaterial);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 3.8), signMaterial);
        sign.position.set(-side * (width / 2 + 0.12), height * 0.64, 0);
        sign.rotation.y = Math.PI / 2;
        building.add(sign);
      }
    }

    for (let i = 0; i < 26; i += 1) {
      const pole = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: "#5c6468", metalness: 0.55, roughness: 0.56 });
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.17, 7.6, 0.17), postMat);
      post.position.set(-5.8, 3.8, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.14, 0.14), postMat);
      arm.position.set(0, 7.25, 0);
      pole.add(post, arm);
      pole.position.z = 15 - i * 10.5;
      pole.userData.wrap = 273;
      moving.push(pole);
      world.add(pole);
    }

    const signalGroup = new THREE.Group();
    const signalPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 5.6, 0.22),
      new THREE.MeshStandardMaterial({ color: "#4b5356", metalness: 0.5 }),
    );
    signalPost.position.y = 2.8;
    const signalBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 1.7, 0.5),
      new THREE.MeshStandardMaterial({ color: "#202628", roughness: 0.62 }),
    );
    signalBox.position.y = 5.45;
    const signalLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 18, 18),
      new THREE.MeshStandardMaterial({ color: "#50e58a", emissive: "#50e58a", emissiveIntensity: 4 }),
    );
    signalLamp.position.set(0, 5.62, 0.28);
    signalGroup.add(signalPost, signalBox, signalLamp);
    signalGroup.position.set(5.1, 0, -72);
    scene.add(signalGroup);

    const stationGroup = new THREE.Group();
    const platformMat = new THREE.MeshStandardMaterial({ color: "#c7c4ba", roughness: 0.96 });
    [-1, 1].forEach((side) => {
      const platform = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.35, 95), platformMat);
      platform.position.set(side * 7.45, 0.56, -18);
      platform.receiveShadow = true;
      stationGroup.add(platform);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.08, 95),
        new THREE.MeshStandardMaterial({ color: "#f0cf3f", emissive: "#c39b1e", emissiveIntensity: 0.12 }),
      );
      edge.position.set(side * 4.1, 1.27, -18);
      stationGroup.add(edge);
      for (let col = 0; col < 8; col += 1) {
        const column = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 5.2, 0.22),
          new THREE.MeshStandardMaterial({ color: "#dde2df", metalness: 0.28 }),
        );
        column.position.set(side * 7.2, 3.6, -50 + col * 12);
        stationGroup.add(column);
      }
    });
    stationGroup.position.z = -150;
    scene.add(stationGroup);

    const boardCanvas = document.createElement("canvas");
    boardCanvas.width = 1024;
    boardCanvas.height = 256;
    const boardContext = boardCanvas.getContext("2d");
    const boardTexture = new THREE.CanvasTexture(boardCanvas);
    boardTexture.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 1.9),
      new THREE.MeshBasicMaterial({ map: boardTexture, side: THREE.DoubleSide }),
    );
    board.position.set(-4.02, 3.25, -3);
    board.rotation.y = Math.PI / 2;
    stationGroup.add(board);
    let drawnStation = -1;
    const drawStationBoard = (stationIndex: number) => {
      if (!boardContext || drawnStation === stationIndex) return;
      drawnStation = stationIndex;
      const target = stations[(stationIndex + 1) % stations.length];
      boardContext.fillStyle = "#f5f2e9";
      boardContext.fillRect(0, 0, 1024, 256);
      boardContext.fillStyle = "#111b1a";
      boardContext.font = "700 96px sans-serif";
      boardContext.fillText(target.jp, 54, 116);
      boardContext.font = "600 38px sans-serif";
      boardContext.fillText(target.en.toUpperCase(), 58, 176);
      boardContext.fillStyle = "#78b82a";
      boardContext.fillRect(0, 218, 1024, 38);
      boardContext.fillStyle = "#ffffff";
      boardContext.font = "700 30px sans-serif";
      boardContext.fillText(target.code, 850, 247);
      boardTexture.needsUpdate = true;
    };

    const cabMaterial = new THREE.MeshStandardMaterial({ color: "#141918", roughness: 0.64, metalness: 0.15 });
    const cab = new THREE.Group();
    const dash = new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.1, 2.1), cabMaterial);
    dash.position.set(0, 1.6, 6.25);
    dash.rotation.x = -0.12;
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 7.2, 0.35), cabMaterial);
    leftFrame.position.set(-4.28, 4.2, 5.6);
    leftFrame.rotation.z = -0.05;
    const rightFrame = leftFrame.clone();
    rightFrame.position.x = 4.28;
    rightFrame.rotation.z = 0.05;
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.45, 0.45), cabMaterial);
    topFrame.position.set(0, 7.15, 5.55);
    cab.add(dash, leftFrame, rightFrame, topFrame);
    scene.add(cab);

    const clock = new THREE.Clock();
    let animationId = 0;
    let hudTimer = 0;
    let lastStation = 0;

    const resize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const renderFrame = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const sim = simRef.current;
      const speedMs = sim.speed / 3.6;

      if (sim.started) {
        sim.elapsed += dt;
        sim.dayMinutes = (sim.dayMinutes + dt * 8.2) % 1440;
        if (!sim.arrived) {
          const resistance = sim.speed > 0.1 ? 0.035 + sim.speed * 0.0005 : 0;
          const acceleration = sim.power * 0.19 - sim.brake * 0.31 - resistance;
          sim.speed = THREE.MathUtils.clamp(sim.speed + acceleration * dt * 3.6, 0, 92);
          sim.distance -= (sim.speed / 3.6) * dt;
          const dynamicLimit = sim.distance < 45 ? 15 : sim.distance < 115 ? 30 : sim.distance < 260 ? 45 : 65;
          if (sim.speed > dynamicLimit + 2) sim.score = Math.max(0, sim.score - (sim.speed - dynamicLimit) * dt * 0.42);

          if (sim.distance <= 9 && sim.speed <= 1.8) {
            const accuracy = Math.abs(sim.distance);
            sim.arrived = true;
            sim.dwell = 5.8;
            sim.power = 0;
            sim.brake = 5;
            sim.score = Math.max(0, sim.score + Math.round(260 - accuracy * 17));
            playChime(stations[(sim.stationIndex + 1) % stations.length].motif);
          } else if (sim.distance < -45 && sim.speed <= 1.8) {
            sim.arrived = true;
            sim.dwell = 4.4;
            sim.power = 0;
            sim.brake = 5;
            sim.score = Math.max(0, sim.score - 180);
          }
        } else {
          sim.speed = Math.max(0, sim.speed - dt * 4.8);
          sim.dwell -= dt;
          if (sim.dwell <= 0) {
            sim.stationIndex = (sim.stationIndex + 1) % stations.length;
            const after = stations[(sim.stationIndex + 1) % stations.length];
            sim.distance = after.distance;
            sim.arrived = false;
            sim.brake = 0;
            sim.power = 1;
            sim.elapsed = 0;
          }
        }
      }

      const travel = speedMs * dt * 0.94;
      moving.forEach((object) => {
        object.position.z += travel;
        if (object.position.z > 24) object.position.z -= Number(object.userData.wrap ?? 270);
      });

      const stationZ = -Math.max(-8, Math.min(155, sim.distance * 0.2));
      stationGroup.position.z = stationZ;
      drawStationBoard(sim.stationIndex);

      const signalState = sim.distance < 70 ? "RED" : sim.distance < 230 ? "YELLOW" : "GREEN";
      const signalColors = { GREEN: "#50e58a", YELLOW: "#ffd04a", RED: "#ff5a55" } as const;
      const lampMaterial = signalLamp.material as THREE.MeshStandardMaterial;
      lampMaterial.color.set(signalColors[signalState]);
      lampMaterial.emissive.set(signalColors[signalState]);
      signalGroup.position.z = sim.distance < 235 ? -Math.max(16, sim.distance * 0.28) : -72;

      const day = sim.dayMinutes / 1440;
      const sunHeight = Math.sin((day - 0.25) * Math.PI * 2);
      const daylight = THREE.MathUtils.clamp((sunHeight + 0.18) * 1.25, 0.035, 1);
      const dawnGlow = Math.max(0, 1 - Math.abs(day - 0.25) / 0.11);
      const duskGlow = Math.max(0, 1 - Math.abs(day - 0.76) / 0.12);
      const warm = Math.max(dawnGlow, duskGlow);
      const night = 1 - daylight;
      const skyDay = new THREE.Color("#75b9dc");
      const skyNight = new THREE.Color("#071320");
      const sky = skyNight.clone().lerp(skyDay, daylight);
      sky.lerp(new THREE.Color("#e89068"), warm * 0.42);
      scene.background = sky;
      if (scene.fog) scene.fog.color.copy(sky);
      ambient.intensity = 0.18 + daylight * 1.28;
      ambient.color.set(daylight > 0.4 ? "#dbefff" : "#6784a0");
      sun.intensity = daylight * 2.8;
      sun.color.set(warm > 0.22 ? "#ffbf82" : "#fff1d0");
      sun.position.x = Math.cos(day * Math.PI * 2) * 42;
      sun.position.y = 8 + daylight * 38;
      nightMaterials.forEach((material) => {
        material.emissiveIntensity = 0.03 + night * 1.8;
      });

      camera.position.y = 3.45 + Math.sin(sim.elapsed * (2.1 + sim.speed * 0.12)) * Math.min(0.025, sim.speed * 0.0005);
      camera.rotation.z = Math.sin(sim.elapsed * 0.45) * Math.min(0.0028, sim.speed * 0.00008);

      const rig = audioRef.current;
      if (rig) {
        const now = rig.context.currentTime;
        const activeGain = sim.started && !sim.muted ? Math.min(0.085, sim.speed * 0.0012) : 0;
        rig.traction.frequency.setTargetAtTime(52 + sim.speed * 4.4 + sim.power * 12, now, 0.08);
        rig.tractionGain.gain.setTargetAtTime(activeGain, now, 0.09);
        rig.rail.frequency.setTargetAtTime(5 + sim.speed * 0.72, now, 0.08);
        rig.railGain.gain.setTargetAtTime(activeGain * 0.34, now, 0.09);
        rig.filter.frequency.setTargetAtTime(460 + sim.speed * 17, now, 0.12);
      }

      hudTimer += dt;
      if (hudTimer > 0.09) {
        hudTimer = 0;
        const limit = sim.distance < 45 ? 15 : sim.distance < 115 ? 30 : sim.distance < 260 ? 45 : 65;
        const lateness = Math.round(sim.elapsed - 52);
        const status = sim.arrived
          ? Math.abs(sim.distance) <= 3
            ? "PERFECT STOP · 定位置"
            : sim.distance < -9
              ? "OVERRUN · 停止位置修正"
              : "DOORS OPEN · 乗降中"
          : sim.distance < 120
            ? "BRAKE CURVE · 制動"
            : sim.speed > limit + 2
              ? "OVERSPEED · 減速"
              : sim.power > 0
                ? "POWER · 力行"
                : sim.brake > 0
                  ? "BRAKE · 制動"
                  : "COAST · 惰行";
        setHud({
          speed: sim.speed,
          distance: sim.distance,
          power: sim.power,
          brake: sim.brake,
          score: Math.round(sim.score),
          stationIndex: sim.stationIndex,
          limit,
          clock: formatClock(sim.dayMinutes),
          phase: phaseName(sim.dayMinutes),
          signal: signalState,
          status,
          lateness,
          arrived: sim.arrived,
        });
      }

      if (lastStation !== sim.stationIndex) lastStation = sim.stationIndex;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material?.dispose();
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [playChime]);

  return (
    <main className="game-shell">
      <div ref={viewportRef} className="world" aria-label="Vista 3D desde la cabina del tren" />
      <div className="sky-grain" aria-hidden="true" />

      <header className="top-bar">
        <div className="brand-lockup">
          <span className="loop-mark" aria-hidden="true" />
          <div>
            <strong>YAMANOTE // LOOP</strong>
            <span>Tokyo cab study · 山手線</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="icon-button" type="button" onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar sonido"}>
            {muted ? "SOUND OFF" : "SOUND ON"}
          </button>
          <button className="icon-button" type="button" onClick={() => setHelpOpen(true)} aria-label="Abrir guía">
            GUIDE
          </button>
        </div>
      </header>

      <section className="route-card" aria-label="Próxima estación">
        <div className="route-line">
          <span className="station-dot current-dot" />
          <span className="route-progress" style={{ "--progress": `${Math.max(2, Math.min(100, 100 - (hud.distance / next.distance) * 100))}%` } as React.CSSProperties} />
          <span className="station-dot next-dot" />
        </div>
        <div className="route-names">
          <div>
            <small>FROM · 発</small>
            <span>{current.en}</span>
          </div>
          <div className="next-name">
            <small>NEXT · 次</small>
            <strong>{next.jp}</strong>
            <span>{next.en}</span>
          </div>
          <span className="station-code">{next.code}</span>
        </div>
      </section>

      <aside className="time-card" aria-label="Hora y fase del día">
        <span className="live-dot" />
        <div>
          <strong>{hud.clock}</strong>
          <span>{hud.phase}</span>
        </div>
      </aside>

      <section className="speed-cluster" aria-label="Velocidad">
        <div className="speed-ring" style={{ "--speed": `${Math.min(100, hud.speed) * 3.6}deg` } as React.CSSProperties}>
          <span className="speed-number">{Math.round(hud.speed)}</span>
          <small>km/h</small>
        </div>
        <div className="speed-meta">
          <span className={`signal-pill signal-${hud.signal.toLowerCase()}`}><i />{hud.signal}</span>
          <span>LIMIT {hud.limit}</span>
          <span>{Math.max(0, Math.round(hud.distance))} m TO STOP</span>
        </div>
      </section>

      <section className="status-strip" aria-live="polite">
        <span>{hud.status}</span>
        <div>
          <small>RUN SCORE</small>
          <strong>{hud.score.toString().padStart(4, "0")}</strong>
        </div>
        <div>
          <small>SCHEDULE</small>
          <strong className={hud.lateness > 4 ? "late" : ""}>{hud.lateness > 0 ? `+${hud.lateness}s` : `${hud.lateness}s`}</strong>
        </div>
      </section>

      <section className="cab-controls" aria-label="Controles de conducción">
        <div className="notch-readout">
          <small>MASTER CONTROLLER</small>
          <strong className={hud.brake >= 8 ? "emergency" : ""}>
            {hud.brake >= 8 ? "EB" : hud.brake > 0 ? `B${hud.brake}` : hud.power > 0 ? `P${hud.power}` : "N"}
          </strong>
          <span>{hud.brake > 0 ? "BRAKE" : hud.power > 0 ? "POWER" : "NEUTRAL"}</span>
        </div>
        <div className="control-pad">
          <button
            type="button"
            className="drive-button power-button"
            onPointerDown={() => setPower(hud.power + 1)}
            aria-label="Aumentar potencia"
          >
            <span>POWER</span>
            <strong>＋</strong>
          </button>
          <button type="button" className="drive-button coast-button" onPointerDown={coast} aria-label="Punto muerto">
            <span>COAST</span>
            <strong>N</strong>
          </button>
          <button
            type="button"
            className="drive-button brake-button"
            onPointerDown={() => setBrake(hud.brake + 1)}
            aria-label="Aumentar freno"
          >
            <span>BRAKE</span>
            <strong>−</strong>
          </button>
        </div>
        <button type="button" className="emergency-button" onClick={() => setBrake(8)} aria-label="Freno de emergencia">
          EB
        </button>
      </section>

      {!started && (
        <section className="start-screen">
          <div className="start-card">
            <div className="start-kicker"><span /> TOKYO · 05:18 · INNER LOOP</div>
            <h1>Take the first train<br /><em>through a waking city.</em></h1>
            <p>
              Una cabina 3D mobile-first. Domina la inercia, respeta las señales y detén el tren en la marca exacta mientras Tokio recorre un día completo.
            </p>
            <button type="button" className="start-button" onClick={startRun}>
              <span>ENTER THE CAB</span>
              <small>運転開始 · activar sonido</small>
            </button>
            <div className="crew-consensus">
              <div>{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>
              <p><strong>7 / 7 crew consensus</strong><br />Playful · immersive · respectful</p>
            </div>
          </div>
          <p className="unofficial-note">Independent interactive tribute · no afiliado a JR East</p>
        </section>
      )}

      {helpOpen && (
        <section className="guide-overlay" role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <div className="guide-card">
            <button className="guide-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Cerrar guía">×</button>
            <span className="eyebrow">DRIVER&apos;S POCKET MANUAL</span>
            <h2 id="guide-title">Conduce con oído y tacto.</h2>
            <div className="guide-grid">
              <div><b>01</b><strong>Potencia</strong><p>Sube hasta P4. Deja que el tren gane velocidad y pasa a N antes del límite.</p></div>
              <div><b>02</b><strong>Freno</strong><p>Aplica B1–B5 progresivamente. La zona de parada empieza a 120 m.</p></div>
              <div><b>03</b><strong>Precisión</strong><p>Detente a ±3 m para la parada perfecta. El exceso de velocidad resta puntos.</p></div>
              <div><b>04</b><strong>Teclado</strong><p>↑ potencia · ↓ freno · espacio N · E emergencia.</p></div>
            </div>
            <div className="sound-note">
              <span>♪</span>
              <p>Las melodías de este prototipo son composiciones originales sintetizadas en el navegador, inspiradas en la cultura ferroviaria japonesa. No se redistribuyen MIDIs comerciales ni melodías oficiales.</p>
            </div>
          </div>
        </section>
      )}

      <div className="orientation-hint">Gira el móvil para una cabina panorámica · 横向き推奨</div>
    </main>
  );
}
