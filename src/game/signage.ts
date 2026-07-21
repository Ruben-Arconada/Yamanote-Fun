import * as THREE from 'three'

/** Draws a stylized JR-style station sign (not a copy of any real signage artwork). */
export function makeStationSignTexture(nameEn: string, nameJa: string, accent: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 192
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#f5f3ec'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const accentHex = '#' + accent.toString(16).padStart(6, '0')
  ctx.fillStyle = accentHex
  ctx.fillRect(0, 0, canvas.width, 22)
  ctx.fillRect(0, canvas.height - 14, canvas.width, 14)

  ctx.fillStyle = '#1a1a1a'
  ctx.textAlign = 'center'
  ctx.font = '700 64px "Hiragino Sans", "Noto Sans JP", sans-serif'
  ctx.fillText(nameJa, canvas.width / 2, 108)

  ctx.font = '600 40px Arial, sans-serif'
  ctx.fillStyle = '#333'
  ctx.fillText(nameEn.toUpperCase(), canvas.width / 2, 160)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** LED-style destination roll sign inside the cab / on the platform indicator. */
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
