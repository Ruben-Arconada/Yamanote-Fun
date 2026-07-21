import type { PlayableNote } from '../data/melodies'

export type Timbre = 'bell' | 'chime'

/**
 * All sound in this game is synthesized live with the Web Audio API — there
 * are no external audio assets to license or ship. Station melodies are
 * original compositions (see data/melodies.ts); the motor/brake sounds are
 * procedural noise, not recordings.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

  private motorOsc: OscillatorNode | null = null
  private motorFilter: BiquadFilterNode | null = null
  private motorGain: GainNode | null = null
  private noiseSource: AudioBufferSourceNode | null = null
  private noiseFilter: BiquadFilterNode | null = null
  private noiseGain: GainNode | null = null

  private noiseBuffer: AudioBuffer | null = null
  private jaVoice: SpeechSynthesisVoice | null = null
  private enVoice: SpeechSynthesisVoice | null = null
  private voicesReady = false

  get ready() {
    return this.ctx !== null
  }

  /** Must be called from a user gesture (tap-to-start) to satisfy mobile autoplay rules. */
  unlock() {
    if (this.ctx) return
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.85
    this.master.connect(this.ctx.destination)

    this.noiseBuffer = this.buildNoiseBuffer()
    this.startAmbientBed()
    this.loadVoices()
  }

  private buildNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!
    const len = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private startAmbientBed() {
    const ctx = this.ctx!
    // Motor hum: a low sawtooth run through a lowpass, pitch/gain track speed.
    this.motorOsc = ctx.createOscillator()
    this.motorOsc.type = 'sawtooth'
    this.motorOsc.frequency.value = 60
    this.motorFilter = ctx.createBiquadFilter()
    this.motorFilter.type = 'lowpass'
    this.motorFilter.frequency.value = 200
    this.motorGain = ctx.createGain()
    this.motorGain.gain.value = 0
    this.motorOsc.connect(this.motorFilter)
    this.motorFilter.connect(this.motorGain)
    this.motorGain.connect(this.master!)
    this.motorOsc.start()

    // Rolling wheel/rail noise bed.
    this.noiseSource = ctx.createBufferSource()
    this.noiseSource.buffer = this.noiseBuffer
    this.noiseSource.loop = true
    this.noiseFilter = ctx.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.frequency.value = 400
    this.noiseFilter.Q.value = 0.7
    this.noiseGain = ctx.createGain()
    this.noiseGain.gain.value = 0
    this.noiseSource.connect(this.noiseFilter)
    this.noiseFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.master!)
    this.noiseSource.start()
  }

  /** speed01: 0..1 fraction of top speed. brakeAmount: 0..1 how hard braking. */
  updateAmbient(speed01: number, brakeAmount: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const eased = Math.pow(speed01, 0.6)
    this.motorOsc?.frequency.setTargetAtTime(55 + eased * 220, t, 0.08)
    this.motorFilter?.frequency.setTargetAtTime(150 + eased * 900, t, 0.08)
    this.motorGain?.gain.setTargetAtTime(speed01 > 0.01 ? 0.05 + eased * 0.12 : 0, t, 0.15)

    this.noiseFilter?.frequency.setTargetAtTime(300 + eased * 2200, t, 0.1)
    this.noiseGain?.gain.setTargetAtTime(speed01 > 0.01 ? 0.02 + eased * 0.06 : 0, t, 0.15)

    if (brakeAmount > 0.55 && speed01 > 0.03 && speed01 < 0.5) {
      this.noiseFilter?.frequency.setTargetAtTime(1800 + brakeAmount * 1500, t, 0.05)
      this.noiseGain?.gain.setTargetAtTime(0.05 + brakeAmount * 0.1, t, 0.05)
    }
  }

  playMelody(notes: PlayableNote[], timbre: Timbre = 'bell', volume = 0.5) {
    if (!this.ctx || !this.master) return
    let t = this.ctx.currentTime + 0.02
    for (const note of notes) {
      if (note.freq) this.pluck(note.freq, t, note.duration, timbre, volume)
      t += note.duration
    }
    return t - this.ctx.currentTime
  }

  private pluck(freq: number, startTime: number, duration: number, timbre: Timbre, volume: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = timbre === 'bell' ? 'sine' : 'triangle'
    osc.frequency.value = freq
    const partial = ctx.createOscillator()
    partial.type = 'sine'
    partial.frequency.value = freq * (timbre === 'bell' ? 2.76 : 2)
    const partialGain = ctx.createGain()
    partialGain.gain.value = timbre === 'bell' ? 0.18 : 0.08

    const gain = ctx.createGain()
    const attack = 0.008
    const release = Math.max(duration * 0.9, 0.15)
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(volume, startTime + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + release)

    osc.connect(gain)
    partial.connect(partialGain)
    partialGain.connect(gain)
    gain.connect(this.master!)

    osc.start(startTime)
    partial.start(startTime)
    const stopAt = startTime + attack + release + 0.05
    osc.stop(stopAt)
    partial.stop(stopAt)
  }

  private loadVoices() {
    const pick = () => {
      const voices = speechSynthesis.getVoices()
      if (!voices.length) return
      this.jaVoice = voices.find((v) => v.lang.startsWith('ja')) || null
      this.enVoice =
        voices.find((v) => v.lang.startsWith('en') && /US|GB/.test(v.lang)) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        null
      this.voicesReady = true
    }
    pick()
    if (!this.voicesReady && 'onvoiceschanged' in speechSynthesis) {
      speechSynthesis.onvoiceschanged = pick
    }
  }

  announce(textJa: string, textEn: string) {
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const utterJa = new SpeechSynthesisUtterance(textJa)
    utterJa.lang = 'ja-JP'
    utterJa.rate = 0.95
    utterJa.pitch = 1.05
    if (this.jaVoice) utterJa.voice = this.jaVoice

    const utterEn = new SpeechSynthesisUtterance(textEn)
    utterEn.lang = 'en-US'
    utterEn.rate = 0.95
    if (this.enVoice) utterEn.voice = this.enVoice

    speechSynthesis.speak(utterJa)
    speechSynthesis.speak(utterEn)
  }
}

export const audio = new AudioEngine()
