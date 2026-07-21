import * as THREE from 'three'
import type { Track } from './Track'
import { STATIONS } from '../data/stations'
import { makeStationSignTexture } from './signage'

const THEME_GROUPS = ['business', 'downtown', 'shitamachi', 'green', 'youth', 'bay'] as const

interface ThemeGroup {
  instanced: THREE.InstancedMesh
  material: THREE.MeshStandardMaterial
}

/**
 * Procedural city dressing scattered along the track: generic buildings
 * (grouped by district "theme" so their window-glow can be animated in bulk),
 * platforms + signage at all 30 stations, and a handful of bespoke props at
 * the busiest landmark stations.
 */
export class City {
  private scene: THREE.Scene
  private track: Track
  private themeGroups = new Map<string, ThemeGroup>()
  private videoScreenMaterials: THREE.ShaderMaterial[] = []
  private nightGlowMaterials: THREE.MeshStandardMaterial[] = []
  private lampMaterials: THREE.MeshStandardMaterial[] = []
  private time = 0

  constructor(scene: THREE.Scene, track: Track) {
    this.scene = scene
    this.track = track
    this.buildBuildings()
    this.buildPlatforms()
  }

  private buildBuildings() {
    const perTheme = 90
    const dummy = new THREE.Object3D()

    for (const theme of THEME_GROUPS) {
      const geo = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.85,
        metalness: 0.05,
        emissive: 0x000000,
      })
      const instanced = new THREE.InstancedMesh(geo, material, perTheme)
      instanced.castShadow = true
      instanced.receiveShadow = true
      this.scene.add(instanced)
      this.themeGroups.set(theme, { instanced, material })
    }

    const counters = new Map<string, number>(THEME_GROUPS.map((t) => [t, 0]))
    const stations = STATIONS
    const trackLen = this.track.getLength()

    for (let s = 0; s < stations.length; s++) {
      const station = stations[s]
      const group = this.themeGroups.get(station.theme.district)!
      group.material.color.setHex(station.theme.buildingColor)
      group.material.emissive.setHex(station.theme.accentColor)

      const markerA = this.track.markerFor(s).tFraction
      const markerB = this.track.markerFor((s + 1) % stations.length).tFraction
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
          counters.set(station.theme.district, globalIdx + 1)
        }
      }
    }
    for (const theme of THEME_GROUPS) {
      const group = this.themeGroups.get(theme)!
      group.instanced.instanceMatrix.needsUpdate = true
      group.instanced.count = counters.get(theme) || 0
    }
  }

  private buildPlatforms() {
    for (let s = 0; s < STATIONS.length; s++) {
      const station = STATIONS[s]
      const marker = this.track.markerFor(s)
      const point = this.track.pointAt(marker.tFraction)
      const tangent = this.track.tangentAt(marker.tFraction)

      const group = new THREE.Group()
      group.position.copy(point)
      group.lookAt(point.clone().add(tangent))

      const platformGeo = new THREE.BoxGeometry(30, 1.2, 8)
      const platformMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 0.9 })
      const platform = new THREE.Mesh(platformGeo, platformMat)
      platform.position.set(0, 0.6, 6)
      platform.receiveShadow = true
      group.add(platform)

      const roofGeo = new THREE.BoxGeometry(30, 0.4, 9)
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x2b3040, roughness: 0.6, metalness: 0.2 })
      const roof = new THREE.Mesh(roofGeo, roofMat)
      roof.position.set(0, 6.2, 6)
      roof.castShadow = true
      group.add(roof)

      const pillarGeo = new THREE.CylinderGeometry(0.35, 0.35, 5.6, 8)
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333844, metalness: 0.4, roughness: 0.5 })
      for (const px of [-12, -4, 4, 12]) {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat)
        pillar.position.set(px, 3.4, 9)
        group.add(pillar)
      }

      const signTex = makeStationSignTexture(station.nameEn, station.nameJa, station.theme.accentColor)
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), signMat)
      sign.position.set(0, 4.6, 9.4)
      group.add(sign)
      const signBack = sign.clone()
      signBack.rotation.y = Math.PI
      group.add(signBack)

      // Platform edge lights, glow more at night via emissive material shared
      // reference so DayNightCycle can drive them.
      const lampGeo = new THREE.SphereGeometry(0.25, 8, 8)
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xfff2c0, emissiveIntensity: 0 })
      for (const lx of [-13, -6.5, 0, 6.5, 13]) {
        const lamp = new THREE.Mesh(lampGeo, lampMat)
        lamp.position.set(lx, 5.9, 6)
        group.add(lamp)
      }
      this.lampMaterials.push(lampMat)

      this.scene.add(group)
      this.addLandmarkProps(station.id, group, station.theme.accentColor)
    }
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
        this.scene.add(bay)
        break
      }
    }
  }

  update(dt: number, nightFactor: number) {
    this.time += dt
    for (const group of this.themeGroups.values()) {
      group.material.emissiveIntensity = nightFactor * 1.1
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
  }
}
