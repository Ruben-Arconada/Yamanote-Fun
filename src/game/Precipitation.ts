import * as THREE from 'three'

// ————————————————————————————————————————————————————————————————
// Rain / snow as one instanced curtain that lives in a box around the
// camera. Positions are derived entirely in the vertex shader from a
// per-instance seed + uTime (wrapped into the box), so the per-frame CPU
// cost is a handful of uniform writes (time, camera position, opacity,
// tint) and nothing else — independent of world size, per the mobile-first
// weather plan. Rain renders as thin vertical streaks; winter swaps the
// same instances into slow fluttering flakes.
// ————————————————————————————————————————————————————————————————

const COUNT = 1100
// Box the curtain recycles through, centered on the cab. Tall enough that
// streaks never visibly spawn, tight enough that every drop is near the eye.
const BOX = new THREE.Vector3(38, 26, 38)

const VERTEX = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform vec3 uCamPos;
uniform float uSnow; // 0 = rain, 1 = snow
varying vec2 vUv;
void main() {
  vUv = uv;
  // Per-instance fall speed; snow drifts down an order of magnitude slower.
  float speed = mix(16.0 + aSeed.x * 7.0, 1.2 + aSeed.x * 0.8, uSnow);
  vec3 box = vec3(${BOX.x.toFixed(1)}, ${BOX.y.toFixed(1)}, ${BOX.z.toFixed(1)});
  vec3 p;
  p.x = mod(aSeed.x * box.x + uSnow * sin(uTime * (0.8 + aSeed.z) + aSeed.y * 6.28) * 1.6, box.x) - box.x * 0.5;
  p.y = mod(aSeed.y * box.y - uTime * speed, box.y) - box.y * 0.5;
  p.z = mod(aSeed.z * box.z + uSnow * cos(uTime * (0.6 + aSeed.x) + aSeed.x * 6.28) * 1.6, box.z) - box.z * 0.5;
  p += uCamPos;
  // Streak vs flake footprint.
  vec2 size = mix(vec2(0.028, 0.55 + aSeed.y * 0.5), vec2(0.075, 0.075), uSnow);
  // Billboard around Y from the view matrix rows (never cameraPosition —
  // see Passengers.ts for the scar tissue).
  vec3 camRight = vec3(viewMatrix[0].x, viewMatrix[1].x, viewMatrix[2].x);
  vec2 right = normalize(vec2(camRight.x, camRight.z));
  vec3 world = vec3(
    p.x + right.x * position.x * size.x,
    p.y + position.y * size.y,
    p.z + right.y * position.x * size.x
  );
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uSnow;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  // Rain: soft-edged vertical streak. Snow: round flake from the same quad.
  float streak = (1.0 - abs(vUv.x - 0.5) * 2.0) * smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  float flake = 1.0 - smoothstep(0.32, 0.5, length(vUv - 0.5));
  float a = mix(streak * 0.5, flake * 0.9, uSnow) * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uTint, a);
}
`

export class Precipitation {
  /** 0 = off, 1 = full curtain; lerped smoothly by update(). */
  private targetIntensity = 0
  private intensity = 0
  private snowTarget = 0
  private mesh: THREE.Mesh
  private uniforms = {
    uTime: { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
    uSnow: { value: 0 },
    uOpacity: { value: 0 },
    uTint: { value: new THREE.Color(0xcfd8e4) },
  }

  constructor(scene: THREE.Scene) {
    const plane = new THREE.PlaneGeometry(1, 1)
    plane.translate(0, 0.5, 0)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = plane.index
    geo.attributes.position = plane.attributes.position
    geo.attributes.uv = plane.attributes.uv
    const seeds = new Float32Array(COUNT * 3)
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random() // 0..1; the shader scales by the box
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3))
    geo.instanceCount = COUNT
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3 // over the clouds, under nothing that matters
    this.mesh.visible = false
    scene.add(this.mesh)
  }

  /** Aim the curtain: falling=true starts precipitation, snow=true dresses it as flakes. */
  set(falling: boolean, snow: boolean) {
    this.targetIntensity = falling ? 1 : 0
    this.snowTarget = snow ? 1 : 0
  }

  update(dt: number, cameraPos: THREE.Vector3, nightFactor: number) {
    // Ease both the fade and the rain↔snow costume swap.
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * 1.4)
    this.uniforms.uSnow.value += (this.snowTarget - this.uniforms.uSnow.value) * Math.min(1, dt * 2)
    this.mesh.visible = this.intensity > 0.02
    if (!this.mesh.visible) return
    this.uniforms.uTime.value += dt
    this.uniforms.uCamPos.value.copy(cameraPos)
    this.uniforms.uOpacity.value = this.intensity
    // Rain reads darker by day, faintly luminous at night (city glow);
    // snow stays bright regardless.
    const snow = this.uniforms.uSnow.value
    const l = THREE.MathUtils.lerp(0.62 - nightFactor * 0.25, 0.94, snow)
    ;(this.uniforms.uTint.value as THREE.Color).setHSL(0.58, 0.12, l)
  }
}
