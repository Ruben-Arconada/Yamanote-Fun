import * as THREE from 'three'
import { Track, TrackOffsetCurve } from './Track'
import { Train, notchLabel } from './Train'
import { City } from './City'
import { DayNightCycle } from './DayNightCycle'
import { audio } from '../audio/AudioEngine'
import { Controls } from '../ui/Controls'
import { UI } from '../ui/UI'
import { STATIONS } from '../data/stations'
import { getStationMelody, DOOR_CHIME_OPEN, DOOR_CHIME_CLOSE } from '../data/melodies'

const LOOK_YAW_LIMIT = 1.7 // ~97°, enough to look out the side windows
const LOOK_PITCH_LIMIT = 0.55

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private track: Track
  private train: Train
  private city: City
  private dayNight: DayNightCycle
  private controls: Controls
  private ui: UI
  private clock = new THREE.Clock()
  private paused = false
  private started = false
  private timeScale = 1
  private lookYaw = 0
  private lookPitch = 0

  constructor(mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.classList.add('game-canvas')
    mount.prepend(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 4500)
    this.scene.add(this.camera)

    this.track = new Track()
    this.train = new Train(this.track, {
      onDepartAnnounce: (_cur, next) => this.handleDepartAnnounce(next),
      onArrivingAnnounce: (idx) => this.handleArrivingAnnounce(idx),
      onStopped: (idx, result) => this.ui.showStopToast(idx, result),
      onMissed: (idx) => this.ui.showMissedToast(idx),
      onDoorsOpen: (idx) => this.handleDoorsOpen(idx),
      onDoorsClose: () => audio.playMelody(DOOR_CHIME_CLOSE, 'chime', 0.4),
    })
    this.city = new City(this.scene, this.track)
    this.dayNight = new DayNightCycle(this.scene)
    this.buildTrackVisual()
    this.buildCabRig()

    this.controls = new Controls(mount, {
      onNotchChange: (n) => this.train.setNotch(n),
      onLook: (dx, dy) => this.handleLook(dx, dy),
    })
    this.ui = new UI(mount, {
      onStart: () => this.start(),
      onPauseToggle: (p) => (this.paused = p),
      onTimeScaleChange: (s) => (this.timeScale = s),
    })

    window.addEventListener('resize', () => this.onResize())
    this.onResize()
    this.updateCameraFromTrain()
    this.renderer.setAnimationLoop(() => this.tick())
  }

  private start() {
    audio.unlock()
    this.started = true
    this.clock.start()
  }

  private handleLook(dx: number, dy: number) {
    const sens = 0.0032
    this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - dx * sens, -LOOK_YAW_LIMIT, LOOK_YAW_LIMIT)
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - dy * sens, -LOOK_PITCH_LIMIT, LOOK_PITCH_LIMIT)
  }

  private handleDepartAnnounce(nextIdx: number) {
    const next = STATIONS[nextIdx]
    audio.announce(`次は、${next.nameJa}、${next.nameJa}です。`, `The next station is ${next.nameEn}.`)
  }

  private handleArrivingAnnounce(idx: number) {
    const station = STATIONS[idx]
    audio.announce(`まもなく、${station.nameJa}、${station.nameJa}です。`, `We will soon make a brief stop at ${station.nameEn}.`)
  }

  private handleDoorsOpen(idx: number) {
    this.controls.syncNotch(0)
    const chimeDuration = audio.playMelody(DOOR_CHIME_OPEN, 'chime', 0.45) || 0.5
    window.setTimeout(() => {
      audio.playMelody(getStationMelody(STATIONS[idx].id), 'bell', 0.42)
    }, chimeDuration * 1000 + 120)
  }

  private buildTrackVisual() {
    const segments = 900
    const halfWidth = 4.2
    const positions: number[] = []
    const uvs: number[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const p = this.track.pointAt(t)
      const tangent = this.track.tangentAt(t)
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
      const pl = p.clone().addScaledVector(normal, halfWidth)
      const pr = p.clone().addScaledVector(normal, -halfWidth)
      positions.push(pl.x, p.y - 0.06, pl.z, pr.x, p.y - 0.06, pr.z)
      uvs.push(0, t * 300, 1, t * 300)
    }
    const indices: number[] = []
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1
      indices.push(a, b, c, b, d, c)
    }
    const bedGeo = new THREE.BufferGeometry()
    bedGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    bedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    bedGeo.setIndex(indices)
    bedGeo.computeVertexNormals()
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x3c3a36, roughness: 1 })
    const bed = new THREE.Mesh(bedGeo, bedMat)
    bed.receiveShadow = true
    this.scene.add(bed)

    // Wide ground plane so the world doesn't feel like it ends at the ballast edge.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ color: 0x232a24, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.5
    ground.receiveShadow = true
    this.scene.add(ground)

    const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.85 })
    for (const offset of [0.75, -0.75]) {
      const curve = new TrackOffsetCurve(this.track, offset)
      const railGeo = new THREE.TubeGeometry(curve, segments, 0.09, 6, true)
      const rail = new THREE.Mesh(railGeo, railMat)
      rail.castShadow = true
      rail.receiveShadow = true
      this.scene.add(rail)
    }
  }

  private buildCabRig() {
    const cab = new THREE.Group()
    this.camera.add(cab)

    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.6, metalness: 0.3 })
    const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.5), consoleMat)
    consoleMesh.position.set(0, -0.62, -0.85)
    consoleMesh.rotation.x = -0.25
    cab.add(consoleMesh)

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.7 })
    const pillarGeo = new THREE.BoxGeometry(0.12, 1.3, 0.12)
    const pillarL = new THREE.Mesh(pillarGeo, pillarMat)
    pillarL.position.set(-0.86, -0.05, -0.88)
    pillarL.rotation.z = 0.12
    cab.add(pillarL)
    const pillarR = pillarL.clone()
    pillarR.position.x = 0.86
    pillarR.rotation.z = -0.12
    cab.add(pillarR)

    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.35), pillarMat)
    visor.position.set(0, 0.56, -0.85)
    cab.add(visor)

    const lampGeo = new THREE.SphereGeometry(0.022, 8, 8)
    const lampColors = [0x33ff66, 0xffcc33, 0xff3333]
    lampColors.forEach((color, i) => {
      const lamp = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 }))
      lamp.position.set(-0.55 + i * 0.12, -0.42, -0.82)
      cab.add(lamp)
    })
  }

  private updateCameraFromTrain() {
    const t = this.train.progressFraction
    const point = this.track.pointAt(t)
    const tangent = this.track.tangentAt(t).normalize()
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()

    const eye = point.clone().addScaledVector(normal, 0.95).add(new THREE.Vector3(0, 3.3, 0))
    const worldUp = new THREE.Vector3(0, 1, 0)
    const m = new THREE.Matrix4().lookAt(eye, eye.clone().add(tangent), worldUp)
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(m)
    const lookQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.lookPitch, this.lookYaw, 0, 'YXZ'))

    this.camera.position.copy(eye)
    this.camera.quaternion.copy(baseQuat).multiply(lookQuat)
  }

  private onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    if (this.started && !this.paused) {
      this.step(dt)
    }
    this.renderer.render(this.scene, this.camera)
  }

  private step(dt: number) {
    this.dayNight.update(dt * this.timeScale)
    this.train.update(dt)
    this.city.update(dt, this.dayNight.nightFactor)
    audio.updateAmbient(this.train.speed01, this.train.brakeAmount01)
    this.controls.syncNotch(this.train.notch)
    this.updateCameraFromTrain()
    this.ui.updateClock(this.dayNight.timeOfDay, this.dayNight.phaseLabel)
    this.ui.updateTrain({
      speedKmh: this.train.speedKmh,
      notchLabel: notchLabel(this.train.notch),
      currentStationIdx: this.train.currentStationIndex,
      targetStationIdx: this.train.targetStationIndex,
      doorsOpenAmount: this.train.doorsOpenAmount,
    })
  }

}
