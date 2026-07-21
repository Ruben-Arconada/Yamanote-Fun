// Original "departure melody" motifs, in the spirit of the short bell jingles
// (hassha melodies) played on real Japanese train platforms — but these are
// wholly original compositions written for this game, not transcriptions of
// any real JR East melody, which remain copyrighted by their composers.
//
// Each station gets a deterministic but distinct melody: a template (rhythmic
// shape, in scale-degree terms) transposed into one of a handful of keys, so
// all 30 stations feel related in style yet none repeats identically.

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9] // bright, "ekimelo"-style scale
const A4 = 440

// Templates expressed as [scaleDegreeIndexIntoPentatonic, durationBeats][]
// degree -1 means "rest"
type Note = { degree: number; beats: number; octave: 0 | 1 }
const T = (degree: number, beats: number, octave: 0 | 1 = 0): Note => ({ degree, beats, octave })

const TEMPLATES: Note[][] = [
  [T(0, 1), T(2, 1), T(4, 1), T(2, 1), T(3, 2), T(-1, 1)],
  [T(4, 0.5), T(3, 0.5), T(2, 1), T(0, 1), T(2, 2)],
  [T(0, 1), T(1, 1), T(2, 1), T(4, 1), T(2, 1), T(0, 2)],
  [T(2, 1), T(4, 1), T(3, 1), T(1, 1), T(0, 3)],
  [T(0, 0.5), T(2, 0.5), T(3, 0.5), T(4, 0.5), T(3, 1), T(1, 2)],
  [T(4, 1), T(2, 1), T(0, 1), T(1, 1), T(3, 2)],
]

const ROOTS_HZ = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0] // C D E F G A — keeps a shared "family" sound

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export interface PlayableNote {
  freq: number | null
  duration: number
}

export function getStationMelody(stationId: string, tempoBpm = 132): PlayableNote[] {
  const h = hashString(stationId)
  const template = TEMPLATES[h % TEMPLATES.length]
  const root = ROOTS_HZ[(h >> 3) % ROOTS_HZ.length]
  const beatSec = 60 / tempoBpm
  return template.map((n) => {
    if (n.degree < 0) return { freq: null, duration: n.beats * beatSec }
    const semitones = MAJOR_PENTATONIC[n.degree] + n.octave * 12
    const freq = root * Math.pow(2, semitones / 12)
    return { freq, duration: n.beats * beatSec }
  })
}

// A soft two-tone chime for doors opening/closing — generic interval, not a
// reproduction of any specific real chime.
export const DOOR_CHIME_OPEN: PlayableNote[] = [
  { freq: A4 * Math.pow(2, 7 / 12), duration: 0.18 },
  { freq: A4 * Math.pow(2, 12 / 12), duration: 0.32 },
]
export const DOOR_CHIME_CLOSE: PlayableNote[] = [
  { freq: A4 * Math.pow(2, 12 / 12), duration: 0.18 },
  { freq: A4 * Math.pow(2, 7 / 12), duration: 0.32 },
]
