import * as THREE from 'three'

/** Worn metal/plastic panel texture for the cab console and pillars. */
export function makeScuffedPanelTexture(base = '#1c1f26'): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const len = 2 + Math.random() * 10
    const angle = Math.random() * Math.PI * 2
    const shade = Math.random() < 0.5 ? 255 : 0
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},${(0.08 + Math.random() * 0.12).toFixed(3)})`
    ctx.lineWidth = 0.6 + Math.random()
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** JR Yamanote Line's official platform-sign color ("uguisu-iro"), the same on all 30 stations. */
export const YAMANOTE_LINE_COLOR = 0x8fc31f

export interface StationSignOptions {
  nameEn: string
  nameJa: string
  nameKana: string
  /** e.g. "JY01" */
  code: string
  prevNameEn: string
  nextNameEn: string
}

function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, trackingPx: number) {
  const chars = [...text]
  const widths = chars.map((ch) => ctx.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + trackingPx * (chars.length - 1)
  let x = cx - total / 2
  const prevAlign = ctx.textAlign
  ctx.textAlign = 'left'
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y)
    x += widths[i] + trackingPx
  }
  ctx.textAlign = prevAlign
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draws a stylized JR-style station sign (kanban) — original artwork, not a reproduction of real JR signage files. */
export function makeStationSignTexture(opts: StationSignOptions): THREE.CanvasTexture {
  const W = 1024
  const H = 384
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const lineHex = '#' + YAMANOTE_LINE_COLOR.toString(16).padStart(6, '0')

  ctx.fillStyle = '#f5f3ec'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = lineHex
  ctx.fillRect(0, 0, W, 44)
  ctx.fillRect(0, H - 56, W, 56)

  const badgeX = 28
  const badgeY = 58
  const badgeW = 152
  const badgeH = 152
  ctx.fillStyle = lineHex
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 20)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '700 30px Arial, sans-serif'
  ctx.fillText(opts.code.replace(/[0-9]/g, ''), badgeX + badgeW / 2, badgeY + 46)
  ctx.font = '800 78px Arial, sans-serif'
  ctx.fillText(opts.code.replace(/\D/g, ''), badgeX + badgeW / 2, badgeY + 132)

  const textCenterX = badgeX + badgeW + (W - (badgeX + badgeW)) / 2

  ctx.fillStyle = '#4a4a4a'
  ctx.font = '500 28px "Hiragino Sans", "Noto Sans JP", sans-serif'
  ctx.fillText(opts.nameKana, textCenterX, 84)

  ctx.fillStyle = '#161616'
  ctx.font = '700 98px "Hiragino Sans", "Noto Sans JP", sans-serif'
  ctx.fillText(opts.nameJa, textCenterX, 192)

  ctx.fillStyle = '#333333'
  ctx.font = '600 42px "Frutiger LT Std", "Myriad Pro", "Segoe UI", Arial, sans-serif'
  drawTracked(ctx, opts.nameEn.toUpperCase(), textCenterX, 252, 3)

  ctx.fillStyle = '#ffffff'
  ctx.font = '600 30px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('◀ ' + opts.prevNameEn.toUpperCase(), 28, H - 20)
  ctx.textAlign = 'right'
  ctx.fillText(opts.nextNameEn.toUpperCase() + ' ▶', W - 28, H - 20)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
  return tex
}

/** LED-style destination roll sign, used on the cab dashboard's "next stop" readout. */
export function makeDestinationTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#080808'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffb703'
  ctx.font = '700 56px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Generates a tileable platform floor texture: light tile grid + subtle tonal variation. */
export function makePlatformTileTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b9b3a4'
  ctx.fillRect(0, 0, size, size)
  const tile = 32
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const shade = 4 + Math.floor(Math.random() * 10)
      ctx.fillStyle = `rgba(0,0,0,${(shade / 255).toFixed(3)})`
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2)
    }
  }
  ctx.strokeStyle = 'rgba(60,55,45,0.35)'
  ctx.lineWidth = 1.5
  for (let i = 0; i <= size; i += tile) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(size, i)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Tileable ballast (crushed gravel) texture + matching roughness map for the track bed. */
export function makeBallastTexture(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rCanvas = document.createElement('canvas')
  rCanvas.width = size
  rCanvas.height = size
  const rCtx = rCanvas.getContext('2d')!

  ctx.fillStyle = '#4a463f'
  ctx.fillRect(0, 0, size, size)
  rCtx.fillStyle = '#999999'
  rCtx.fillRect(0, 0, size, size)

  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 1 + Math.random() * 2.2
    const shade = 40 + Math.floor(Math.random() * 70)
    ctx.fillStyle = `rgb(${shade + 20},${shade + 14},${shade})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    const rough = 140 + Math.floor(Math.random() * 100)
    rCtx.fillStyle = `rgb(${rough},${rough},${rough})`
    rCtx.beginPath()
    rCtx.arc(x, y, r, 0, Math.PI * 2)
    rCtx.fill()
  }

  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  const roughnessMap = new THREE.CanvasTexture(rCanvas)
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping
  return { map, roughnessMap }
}

/** Raised-dot tactile paving strip texture (also used as a pseudo bump map). */
export function makeTactilePavingTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#c9a227'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#8a6d15'
  const step = size / 4
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.beginPath()
      ctx.arc(x * step + step / 2, y * step + step / 2, step * 0.28, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Procedural window-lit texture for building facades: a grid of rectangles, some randomly "lit". */
export function makeWindowGridTexture(cols: number, rows: number): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const emCanvas = document.createElement('canvas')
  emCanvas.width = size
  emCanvas.height = size
  const emCtx = emCanvas.getContext('2d')!

  ctx.fillStyle = '#2a2e36'
  ctx.fillRect(0, 0, size, size)
  emCtx.fillStyle = '#000000'
  emCtx.fillRect(0, 0, size, size)

  const stepX = size / cols
  const stepY = size / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * stepX + stepX * 0.18
      const y = r * stepY + stepY * 0.18
      const w = stepX * 0.64
      const h = stepY * 0.64
      ctx.fillStyle = '#3d4552'
      ctx.fillRect(x, y, w, h)
      if (Math.random() < 0.4) {
        emCtx.fillStyle = Math.random() < 0.15 ? '#ffe9b0' : '#fff6da'
        emCtx.fillRect(x, y, w, h)
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  const emissiveMap = new THREE.CanvasTexture(emCanvas)
  emissiveMap.colorSpace = THREE.SRGBColorSpace
  return { map, emissiveMap }
}
