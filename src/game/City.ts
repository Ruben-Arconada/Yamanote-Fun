import * as THREE from 'three'
import type { Track } from './Track'
import { STATIONS, prevStationIndex, nextStationIndex } from '../data/stations'
import { makeStationSignTexture, makePlatformTileTexture, makeTactilePavingTexture, makeWindowGridTexture } from './signage'

const THEME_GROUPS = ['business', 'downtown', 'shitamachi', 'green', 'youth', 'bay'] as const
const N = STATIONS.length

const PLATFORM_TOP = 1.2
const COLUMN_HEIGHT = 5.0
const COLUMN_Y = PLATFORM_TOP + COLUMN_HEIGHT / 2
const COLUMN_TOP = PLATFORM_TOP + COLUMN_HEIGHT
const ROOF_THICK = 0.5
const ROOF_Y = COLUMN_TOP + ROOF_THICK / 2
const SIGN_Y = 4.15
const SIGN_W = 7
const SIGN_H = SIGN_W / (1024 / 384)
const FRAME_W = SIGN_W + 0.4
const FRAME_H = SIGN_H + 0.28
const ROD_Y = (SIGN_Y + FRAME_H / 2 + (COLUMN_TOP + 0.05)) / 2
const ROD_LEN = COLUMN_TOP + 0.05 - (SIGN_Y + FRAME_H / 2)
const COLUMN_XS = [-12, -4, 4, 12]
const PASSENGERS_PER_STATION = 6

/** Rough crowd density by hour — busiest around the morning/evening rush, quiet overnight. */
function crowdDensityForHour(hour: number): number {
  const proximity = (center: number, width: number) => Math.max(0, 1 - Math.abs(((hour - center + 12 + 24) % 24) - 12) / width)
  const rush = Math.max(proximity(8, 2.5), proximity(18, 2.5))
  return THREE.MathUtils.clamp(0.16 + rush * 0.84, 0, 1)
}

interface ThemeGroup {
  instanced: THREE.InstancedMesh
  material: THREE.MeshStandardMaterial
}

interface PassengerSlot {
  basePosition: THREE.Vector3
  baseQuaternion: THREE.Quaternion
  phase: number
  visibilityRoll: number
}

interface SignEntry {
  index: number
  material: THREE.MeshStandardMaterial
}

/**
 * Procedural city dressing scattered along the track: generic buildings
 * (grouped by district "theme" so their window-glow can be animated in bulk),
 * platforms + signage at all 30 stations built from a shared library of
 * InstancedMesh props (one draw call per prop type regardless of station
 * count — see Marco's perf guardrail), and a handful of bespoke props at the
 * busiest landmark stations.
 */
export class City {
  private scene: THREE.Scene
  private track: Track
  private themeGroups = new Map<string, ThemeGroup>()
  private videoScreenMaterials: THREE.ShaderMaterial[] = []
  private nightGlowMaterials: THREE.MeshStandardMaterial[] = []
  private lampMaterials: THREE.MeshStandardMaterial[] = []
  private signEntries: SignEntry[] = []
  private passengerMesh!: THREE.InstancedMesh
  private passengerSlots: PassengerSlot[] = []
  private time = 0

  constructor(scene: THREE.Scene, track: Track) {
    this.scene = scene
    this.track = track
    this.buildBuildings()
    this.buildPlatforms()
    this.buildPassengers()
  }

  private buildBuildings() {
    const perTheme = 200
    const dummy = new THREE.Object3D()
    const windowTex = makeWindowGridTexture(6, 10)

    for (const theme of THEME_GROUPS) {
      const geo = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshStandardMaterial({
        color: 0x555555,
        map: windowTex.map,
        roughness: 0.85,
        metalness: 0.05,
        emissive: 0xffffff,
        emissiveMap: windowTex.emissiveMap,
        emissiveIntensity: 0,
      })
      const instanced = new THREE.InstancedMesh(geo, material, perTheme)
      instanced.castShadow = true
      instanced.receiveShadow = true
      instanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(perTheme * 3), 3)
      this.scene.add(instanced)
      this.themeGroups.set(theme, { instanced, material })
    }

    const counters = new Map<string, number>(THEME_GROUPS.map((t) => [t, 0]))
    const trackLen = this.track.getLength()
    const tintColor = new THREE.Color()

    for (let s = 0; s < N; s++) {
      const station = STATIONS[s]
      const group = this.themeGroups.get(station.theme.district)!
      group.material.color.setHex(station.theme.buildingColor)

      const markerA = this.track.markerFor(s).tFraction
      const markerB = this.track.markerFor((s + 1) % N).tFraction
      const span = ((markerB - markerA + 1) % 1) || 0.02
      const buildingsHere = Math.max(2, Math.round((span * trackLen) / 55))

      for (let b = 0; b < buildingsHere; b++) {
        const t = markerA + span * ((b + 0.5) / buildingsHere)
        const point = this.track.pointAt(t)
        const tangent = this.track.tangentAt(t)
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
        const side = b % 2 === 0 ? 1 : -1
        const offset = 34 + Math.random() * 70
        const height = 14 + Math.random() * (station.landmark ? 70 : 34)
        const width = 10 + Math.random() * 12
        const depth = 10 + Math.random() * 12

        const pos = point.clone().add(normal.clone().multiplyScalar(side * offset))
        dummy.position.set(pos.x, height / 2, pos.z)
        dummy.scale.set(width, height, depth)
        dummy.rotation.y = Math.random() * Math.PI
        dummy.updateMatrix()

        const globalIdx = counters.get(station.theme.district)!
        if (globalIdx < perTheme) {
          group.instanced.setMatrixAt(globalIdx, dummy.matrix)
          const shade = 0.85 + Math.random() * 0.3
          tintColor.setHex(0xffffff).multiplyScalar(shade)
          group.instanced.setColorAt(globalIdx, tintColor)
          counters.set(station.theme.district, globalIdx + 1)
        } else if (import.meta.env.DEV) {
          console.warn(`City: hit perTheme=${perTheme} cap for district "${station.theme.district}" — some background buildings were skipped.`)
        }
      }
    }
    for (const theme of THEME_GROUPS) {
      const group = this.themeGroups.get(theme)!
      group.instanced.instanceMatrix.needsUpdate = true
      if (group.instanced.instanceColor) group.instanced.instanceColor.needsUpdate = true
      group.instanced.count = counters.get(theme) || 0
    }
  }

  private buildPlatforms() {
    const dummy = new THREE.Object3D()

    const platformMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.9, map: makePlatformTileTexture() })
    ;(platformMat.map as THREE.Texture).repeat.set(10, 3)
    const platformSlab = new THREE.InstancedMesh(new THREE.BoxGeometry(30, 1.2, 8), platformMat, N)
    platformSlab.receiveShadow = true

    const safetyMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0, roughness: 0.6 })
    const safetyStrip = new THREE.InstancedMesh(new THREE.BoxGeometry(29, 0.08, 0.4), safetyMat, N)

    const tactileMat = new THREE.MeshStandardMaterial({ map: makeTactilePavingTexture(), roughness: 0.85 })
    const tactileStrip = new THREE.InstancedMesh(new THREE.BoxGeometry(29, 0.06, 0.5), tactileMat, N)

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.55, metalness: 0.25 })
    const roof = new THREE.InstancedMesh(new THREE.BoxGeometry(30, ROOF_THICK, 9), roofMat, N)
    roof.castShadow = true

    const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.5, metalness: 0.3 })
    const fascia = new THREE.InstancedMesh(new THREE.BoxGeometry(30, 0.5, 0.15), fasciaMat, N)

    const columnMat = new THREE.MeshStandardMaterial({ color: 0x4c5a4a, metalness: 0.35, roughness: 0.55 })
    const columns = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, COLUMN_HEIGHT, 0.42), columnMat, N * COLUMN_XS.length)
    columns.castShadow = true
    const columnBandMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.6 })
    const columnBands = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.35, 0.46), columnBandMat, N * COLUMN_XS.length)
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x333844, metalness: 0.4, roughness: 0.5 })
    const struts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), strutMat, N * COLUMN_XS.length)

    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff2c0, emissiveIntensity: 0 })
    const lampBody = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 8, 8), lampMat, N * 5)
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.5, roughness: 0.4 })
    const lampHousing = new THREE.InstancedMesh(new THREE.ConeGeometry(0.4, 0.35, 10, 1, true), housingMat, N * 5)

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x505860, metalness: 0.7, roughness: 0.3 })
    const signFrame = new THREE.InstancedMesh(new THREE.BoxGeometry(FRAME_W, FRAME_H, 0.15), frameMat, N)
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xc9c9c9, metalness: 0.6, roughness: 0.4 })
    const signRods = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, Math.max(ROD_LEN, 0.15), 6), rodMat, N * 2)

    const benchMat = new THREE.MeshStandardMaterial({ color: 0x2f6b46, roughness: 0.7 })
    const bench = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.9, 0.7), benchMat, N)
    const vendingMat = new THREE.MeshStandardMaterial({ color: 0xd7dde3, emissive: 0x224466, emissiveIntensity: 0.15, roughness: 0.4, metalness: 0.2 })
    const vending = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 1.9, 0.9), vendingMat, N)
    const clockPoleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.4 })
    const clockPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), clockPoleMat, N)
    const clockFaceMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ec, emissive: 0x111111, roughness: 0.5 })
    const clockFace = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 20), clockFaceMat, N)
    const mapBoardMat = new THREE.MeshStandardMaterial({ color: 0xeceadf, roughness: 0.7 })
    const mapBoard = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1.1, 0.08), mapBoardMat, N)

    const instancedPools: THREE.InstancedMesh[] = [
      platformSlab, safetyStrip, tactileStrip, roof, fascia, columns, columnBands, struts,
      lampBody, lampHousing, signFrame, signRods, bench, vending, clockPole, clockFace, mapBoard,
    ]

    const put = (mesh: THREE.InstancedMesh, index: number, group: THREE.Group, local: THREE.Vector3, yRot = 0, xRot = 0) => {
      dummy.position.copy(local).applyMatrix4(group.matrixWorld)
      dummy.quaternion.copy(group.quaternion)
      if (yRot) dummy.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yRot))
      if (xRot) dummy.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), xRot))
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    }

    for (let s = 0; s < N; s++) {
      const station = STATIONS[s]
      const marker = this.track.markerFor(s)
      const point = this.track.pointAt(marker.tFraction)
      const tangent = this.track.tangentAt(marker.tFraction)

      const group = new THREE.Group()
      group.position.copy(point)
      group.lookAt(point.clone().add(tangent))
      group.updateMatrixWorld(true)
      this.scene.add(group)

      put(platformSlab, s, group, new THREE.Vector3(0, 0.6, 6))
      put(safetyStrip, s, group, new THREE.Vector3(0, 1.24, 9.55))
      put(tactileStrip, s, group, new THREE.Vector3(0, 1.23, 9.0))
      put(roof, s, group, new THREE.Vector3(0, ROOF_Y, 6))
      put(fascia, s, group, new THREE.Vector3(0, COLUMN_TOP - 0.15, 10.55))

      COLUMN_XS.forEach((px, i) => {
        const idx = s * COLUMN_XS.length + i
        put(columns, idx, group, new THREE.Vector3(px, COLUMN_Y, 9))
        put(columnBands, idx, group, new THREE.Vector3(px, PLATFORM_TOP + 0.6, 9))
        put(struts, idx, group, new THREE.Vector3(px, COLUMN_TOP - 0.05, 8.1), 0, Math.PI * 0.18)
      })

      const lampXs = [-13, -6.5, 0, 6.5, 13]
      lampXs.forEach((lx, i) => {
        const idx = s * lampXs.length + i
        put(lampBody, idx, group, new THREE.Vector3(lx, 5.75, 6))
        put(lampHousing, idx, group, new THREE.Vector3(lx, 5.95, 6))
      })

      put(signFrame, s, group, new THREE.Vector3(0, SIGN_Y, 9.4))
      ;[-1, 1].forEach((side, i) => {
        const idx = s * 2 + i
        put(signRods, idx, group, new THREE.Vector3(side * (FRAME_W / 2 - 0.15), ROD_Y, 9.4))
      })

      put(bench, s, group, new THREE.Vector3(-9, PLATFORM_TOP + 0.45, 7.2))
      put(vending, s, group, new THREE.Vector3(9.5, PLATFORM_TOP + 0.95, 7.6))
      put(clockPole, s, group, new THREE.Vector3(4.5, PLATFORM_TOP + 1.3, 7.8))
      put(clockFace, s, group, new THREE.Vector3(4.5, PLATFORM_TOP + 2.65, 7.8), 0, Math.PI / 2)
      put(mapBoard, s, group, new THREE.Vector3(-4.5, PLATFORM_TOP + 1.4, 7.75))

      const prev = STATIONS[prevStationIndex(s)]
      const next = STATIONS[nextStationIndex(s)]
      const signTex = makeStationSignTexture({
        nameEn: station.nameEn,
        nameJa: station.nameJa,
        nameKana: station.nameKana,
        code: `JY${String(s + 1).padStart(2, '0')}`,
        prevNameEn: prev.nameEn,
        nextNameEn: next.nameEn,
      })
      const signMat = new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: 0xffffff,
        emissiveMap: signTex,
        emissiveIntensity: 0.05,
        roughness: 0.7,
      })
      this.signEntries.push({ index: s, material: signMat })
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(SIGN_W, SIGN_H), signMat)
      sign.position.set(0, SIGN_Y, 9.4 + 0.08)
      group.add(sign)
      const signBack = new THREE.Mesh(new THREE.PlaneGeometry(SIGN_W, SIGN_H), signMat)
      signBack.position.set(0, SIGN_Y, 9.4 - 0.08)
      signBack.rotation.y = Math.PI
      group.add(signBack)

      // A second, smaller repeater sign on its own pole near the actual stop
      // point (z≈0) — the canopy sign above sits far up the platform, so a
      // stopped train had no readable nameboard close to where its doors are.
      const nearSignW = SIGN_W * 0.5
      const nearSignH = nearSignW / (1024 / 384)
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x505860, metalness: 0.5, roughness: 0.4 })
      const nearPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 8), poleMat)
      nearPole.position.set(10.5, 1.2 + 1.8, 2.6)
      group.add(nearPole)
      const nearSign = new THREE.Mesh(new THREE.PlaneGeometry(nearSignW, nearSignH), signMat)
      nearSign.position.set(10.5, 1.2 + 3.6 + nearSignH / 2, 2.6)
      nearSign.rotation.y = -Math.PI / 2
      group.add(nearSign)
      const nearSignBack = nearSign.clone()
      nearSignBack.rotation.y = Math.PI / 2
      group.add(nearSignBack)

      this.addLandmarkProps(station.id, group, station.theme.accentColor)
    }

    for (const mesh of instancedPools) {
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
    }
    this.lampMaterials.push(lampMat)
  }

  private addLandmarkProps(id: string, group: THREE.Group, accent: number) {
    switch (id) {
      case 'tokyo': {
        const facade = new THREE.Mesh(
          new THREE.BoxGeometry(46, 16, 12),
          new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.8 }),
        )
        facade.position.set(0, 8, -14)
        group.add(facade)
        for (const dx of [-18, 0, 18]) {
          const dome = new THREE.Mesh(
            new THREE.SphereGeometry(4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x4a2a20 }),
          )
          dome.position.set(dx, 16, -14)
          group.add(dome)
        }
        break
      }
      case 'ueno': {
        for (let i = 0; i < 10; i++) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0x4a3527 }))
          const canopy = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2, 8, 6), new THREE.MeshStandardMaterial({ color: 0x5f8a4a, roughness: 1 }))
          const gx = (Math.random() - 0.5) * 60 - 25
          const gz = 20 + Math.random() * 20
          trunk.position.set(gx, 2, gz)
          canopy.position.set(gx, 5.5, gz)
          trunk.castShadow = canopy.castShadow = true
          group.add(trunk, canopy)
        }
        break
      }
      case 'ikebukuro': {
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(9, 12, 110, 16),
          new THREE.MeshStandardMaterial({ color: 0x5a6478, emissive: accent, emissiveIntensity: 0, roughness: 0.4, metalness: 0.3 }),
        )
        tower.position.set(-70, 55, -40)
        tower.castShadow = true
        this.nightGlowMaterials.push(tower.material as THREE.MeshStandardMaterial)
        group.add(tower)
        break
      }
      case 'shinjuku': {
        for (let i = 0; i < 6; i++) {
          const h = 90 + Math.random() * 90
          const tower = new THREE.Mesh(
            new THREE.BoxGeometry(14 + Math.random() * 10, h, 14 + Math.random() * 10),
            new THREE.MeshStandardMaterial({ color: 0x3d4658, emissive: 0x223355, emissiveIntensity: 0, metalness: 0.4, roughness: 0.35 }),
          )
          tower.position.set(-60 + i * 22, h / 2, -60 - (i % 2) * 20)
          tower.castShadow = true
          this.nightGlowMaterials.push(tower.material as THREE.MeshStandardMaterial)
          group.add(tower)
        }
        break
      }
      case 'harajuku': {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xb5482f }))
        beam.position.set(0, 9, 14)
        const legGeo = new THREE.CylinderGeometry(0.6, 0.6, 9, 8)
        const legMat = new THREE.MeshStandardMaterial({ color: 0xb5482f })
        const legL = new THREE.Mesh(legGeo, legMat)
        legL.position.set(-5.5, 4.5, 14)
        const legR = new THREE.Mesh(legGeo, legMat)
        legR.position.set(5.5, 4.5, 14)
        group.add(beam, legL, legR)
        for (let i = 0; i < 5; i++) {
          const shop = new THREE.Mesh(
            new THREE.BoxGeometry(8, 8 + Math.random() * 6, 8),
            new THREE.MeshStandardMaterial({ color: [0xff5da2, 0xffc857, 0x5ad1e0, 0x8fce6a][i % 4], emissive: 0x111111, emissiveIntensity: 0 }),
          )
          shop.position.set(-40 + i * 20, 5, -30)
          this.nightGlowMaterials.push(shop.material as THREE.MeshStandardMaterial)
          group.add(shop)
        }
        break
      }
      case 'shibuya': {
        const screenGeo = new THREE.PlaneGeometry(20, 12)
        const screenMat = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: `
            varying vec2 vUv; uniform float uTime;
            void main(){
              vec3 c = 0.5 + 0.5*cos(uTime + vUv.xyx*6.0 + vec3(0.0,2.0,4.0));
              gl_FragColor = vec4(c, 1.0);
            }`,
        })
        this.videoScreenMaterials.push(screenMat)
        const screen = new THREE.Mesh(screenGeo, screenMat)
        screen.position.set(-30, 14, -20)
        screen.rotation.y = Math.PI * 0.15
        group.add(screen)
        break
      }
      case 'shinagawa': {
        const bay = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.MeshStandardMaterial({ color: 0x1f5a78, roughness: 0.2, metalness: 0.3 }),
        )
        bay.rotation.x = -Math.PI / 2
        bay.position.set(90, -0.4, 0)
        group.add(bay)
        break
      }
    }
  }

  private buildPassengers() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
    const geo = new THREE.CapsuleGeometry(0.22, 1.0, 4, 8)
    const total = N * PASSENGERS_PER_STATION
    this.passengerMesh = new THREE.InstancedMesh(geo, bodyMat, total)
    this.passengerMesh.castShadow = true
    this.passengerMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3)

    const tempObj = new THREE.Object3D()
    const tint = new THREE.Color()
    const bodyTints = [0x2b2b2b, 0x3a3f4a, 0x555049, 0x2d4a4a, 0x4a2d2d, 0x40382e]

    for (let s = 0; s < N; s++) {
      const marker = this.track.markerFor(s)
      const point = this.track.pointAt(marker.tFraction)
      const tangent = this.track.tangentAt(marker.tFraction)
      tempObj.position.copy(point)
      tempObj.lookAt(point.clone().add(tangent))
      tempObj.updateMatrixWorld(true)

      for (let p = 0; p < PASSENGERS_PER_STATION; p++) {
        const idx = s * PASSENGERS_PER_STATION + p
        const local = new THREE.Vector3(-12 + Math.random() * 24, PLATFORM_TOP + 0.72, 6.6 + Math.random() * 1.6)
        const worldPos = local.applyMatrix4(tempObj.matrixWorld)
        const yaw = Math.random() * Math.PI * 2
        const q = tempObj.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw))

        this.passengerSlots.push({ basePosition: worldPos, baseQuaternion: q, phase: Math.random() * Math.PI * 2, visibilityRoll: Math.random() })
        tint.setHex(bodyTints[Math.floor(Math.random() * bodyTints.length)])
        this.passengerMesh.setColorAt(idx, tint)
      }
    }
    if (this.passengerMesh.instanceColor) this.passengerMesh.instanceColor.needsUpdate = true
    this.scene.add(this.passengerMesh)
    this.updatePassengers(0.5)
  }

  private updatePassengers(density: number) {
    const dummy = new THREE.Object3D()
    for (let i = 0; i < this.passengerSlots.length; i++) {
      const slot = this.passengerSlots[i]
      dummy.position.copy(slot.basePosition)
      dummy.quaternion.copy(slot.baseQuaternion)
      dummy.rotateY(Math.sin(this.time * 0.6 + slot.phase) * 0.12)
      dummy.scale.setScalar(slot.visibilityRoll < density ? 1 : 0)
      dummy.updateMatrix()
      this.passengerMesh.setMatrixAt(i, dummy.matrix)
    }
    this.passengerMesh.instanceMatrix.needsUpdate = true
  }

  update(dt: number, nightFactor: number, targetStationIndex: number, timeOfDay: number) {
    this.time += dt
    for (const group of this.themeGroups.values()) {
      group.material.emissiveIntensity = nightFactor * 1.3
    }
    for (const mat of this.videoScreenMaterials) {
      mat.uniforms.uTime.value = this.time
    }
    for (const mat of this.lampMaterials) {
      mat.emissiveIntensity = nightFactor * 1.6
    }
    for (const mat of this.nightGlowMaterials) {
      mat.emissiveIntensity = nightFactor * 0.9
    }
    const baseSignGlow = THREE.MathUtils.lerp(0.05, 1.1, nightFactor)
    const pulse = (Math.sin(this.time * 4) * 0.5 + 0.5) * 0.7
    for (const entry of this.signEntries) {
      entry.material.emissiveIntensity = entry.index === targetStationIndex ? baseSignGlow + pulse : baseSignGlow
    }
    this.updatePassengers(crowdDensityForHour(timeOfDay))
  }
}
