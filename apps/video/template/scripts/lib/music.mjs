// Generated instrumental BGM (SPEC §7.5): compose() turns project.audio.music (style, per-scene
// sections, themes, cues) plus the scene timeline into note events; renderAudio() synthesizes them
// in plain JS (wavetables, Karplus-Strong, noise drums), so no sound fonts, models or network are needed. Same settings and seed → same audio.
// Pure functions; music.mjs does the I/O.
import { UsageError } from './project.mjs'

export const ENERGY = ['low', 'mid', 'high']
export const INSTRUMENTS = ['piano', 'pad', 'strings', 'pluck', 'marimba', 'bell', 'bass', 'drums']

/**
 * Style defaults; every field can be overridden in project.audio.music. `progressions` are the
 * pools a seed picks from; `lead` plays the melody when it is among the instruments.
 */
export const PRESETS = {
  corporate: {
    bpm: 108, mode: 'major', instruments: ['piano', 'pad', 'pluck', 'bass', 'drums'], lead: 'pluck',
    progressions: {
      major: [['I', 'V', 'vi', 'IV'], ['I', 'vi', 'IV', 'V'], ['IV', 'I', 'V', 'vi'], ['I', 'IV', 'vi', 'V'], ['vi', 'IV', 'I', 'V']],
      minor: [['i', 'VI', 'III', 'VII'], ['i', 'VII', 'VI', 'VII'], ['i', 'iv', 'VII', 'III'], ['VI', 'VII', 'i', 'i']],
    },
  },
  ambient: {
    bpm: 72, mode: 'major', instruments: ['pad', 'bell', 'bass'], lead: 'bell', drumsFrom: 'high',
    progressions: {
      major: [['I', 'iii', 'IV', 'IV'], ['I', 'IV', 'I', 'IV'], ['I', 'V', 'IV', 'IV'], ['I', 'vi', 'IV', 'iii']],
      minor: [['i', 'VI', 'iv', 'i'], ['i', 'VII', 'VI', 'VII'], ['i', 'iv', 'i', 'VI'], ['i', 'III', 'VII', 'iv']],
    },
  },
  lofi: {
    bpm: 80, mode: 'major', instruments: ['piano', 'bass', 'drums'], lead: 'piano', swing: 0.16, lowpass: 3200,
    progressions: {
      major: [['ii7', 'V7', 'I7', 'vi7'], ['I7', 'vi7', 'ii7', 'V7'], ['IV7', 'iii7', 'ii7', 'I7'], ['I7', 'IV7', 'iii7', 'vi7']],
      minor: [['i7', 'iv7', 'VII7', 'III7'], ['i7', 'VI7', 'iv7', 'v7'], ['i7', 'iv7', 'i7', 'VI7'], ['VI7', 'v7', 'i7', 'i7']],
    },
  },
  cinematic: {
    bpm: 84, mode: 'major', instruments: ['strings', 'piano', 'bass', 'drums'], lead: 'piano', drumsFrom: 'high',
    progressions: {
      major: [['vi', 'IV', 'I', 'V'], ['I', 'V', 'vi', 'IV'], ['I', 'vi', 'IV', 'V'], ['IV', 'V', 'vi', 'vi'], ['vi', 'V', 'IV', 'V']],
      minor: [['i', 'VI', 'III', 'VII'], ['i', 'iv', 'VI', 'v'], ['i', 'VII', 'VI', 'VII'], ['VI', 'VII', 'i', 'i'], ['i', 'III', 'VII', 'iv']],
    },
  },
  playful: {
    bpm: 120, mode: 'major', instruments: ['marimba', 'pluck', 'bass', 'drums'], lead: 'marimba',
    progressions: {
      major: [['I', 'vi', 'IV', 'V'], ['I', 'IV', 'V', 'I'], ['I', 'V', 'vi', 'IV'], ['IV', 'V', 'I', 'vi']],
      minor: [['i', 'iv', 'VII', 'III'], ['i', 'VI', 'VII', 'i'], ['i', 'iv', 'v', 'i']],
    },
  },
}

/** Keys a seed picks from when project.audio.music.key is not set. */
const KEYS = ['C', 'D', 'Eb', 'E', 'F', 'G', 'A', 'Bb']
/** Instruments that can carry the melody, in order of preference when the preset's lead is not used. */
const MELODIC = ['piano', 'pluck', 'marimba', 'bell', 'strings']

/** Rhythm patterns per energy (low, mid, high); a seed picks one variant of each per piece. */
const PATTERNS = {
  // [beat, length in beats]
  piano: [
    [[[0, 4]], [[0, 3], [3, 1]], [[0, 2.5], [2.5, 1.5]]],
    [[[0, 2], [2, 2]], [[0, 1.5], [1.5, 1], [2.5, 1.5]], [[0, 1], [1.5, 1], [3, 1]]],
    [[[0, 1], [1, 1], [2, 1], [3, 1]], [[0, 0.5], [0.5, 1], [1.5, 1], [2.5, 0.5], [3, 1]], [[0, 1.5], [1.5, 1.5], [3, 1]]],
  ],
  // [beat, length in beats, note: 0 root, 1 the chord's fifth, 2 root an octave up]
  bass: [
    [[[0, 4, 0]], [[0, 3, 0], [3, 1, 1]]],
    [[[0, 2, 0], [2, 2, 0]], [[0, 1.5, 0], [1.5, 2.5, 0]], [[0, 1, 0], [2, 1, 1], [2.5, 1.5, 0]]],
    [
      Array.from({ length: 8 }, (_, i) => [i / 2, 0.45, i % 2 ? 2 : 0]),
      [[0, 0.9, 0], [1, 0.9, 1], [2, 0.9, 2], [3, 0.9, 1]],
      Array.from({ length: 8 }, (_, i) => [i / 2, 0.45, 0]),
    ],
  ],
  // Kick beats with the full kit / with the half kit, and hi-hat beats.
  kick: { full: [[0, 1, 2, 3], [0, 1.5, 2, 3], [0, 1.5, 2.5], [0, 2.5, 3]], half: [[0, 2], [0, 2.5], [0, 1.5, 2]] },
  hat: [[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], [0.5, 1.5, 2.5, 3.5]],
}

/** Two-bar melody rhythms: [beat, length in beats] over 8 beats. */
const MOTIF_RHYTHMS = [
  [[0, 1], [1, 1], [2, 2], [4, 1], [5, 1], [6, 2]],
  [[0, 1.5], [1.5, 0.5], [2, 2], [4, 1.5], [5.5, 0.5], [6, 2]],
  [[0, 0.5], [0.5, 0.5], [1, 1], [2, 2], [5, 1], [6, 2]],
  [[0, 2], [2, 1], [3, 1], [4, 3]],
  [[1, 1], [2, 1], [3, 1], [4, 2], [6, 1], [7, 1]],
]

const PITCH = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }
const DEGREE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** "vi" / "V7" → { degree: 5, seventh: false }. Case is ignored: chord quality follows the key. */
export function parseChord(symbol) {
  const m = /^(VII|VI|V|IV|III|II|I)(7)?$/i.exec(symbol)
  if (!m) throw new Error(`bad chord ${symbol}; use roman numerals I–VII, optionally with 7`)
  return { degree: DEGREE.indexOf(m[1].toUpperCase()), seventh: Boolean(m[2]) }
}

/** Pitch classes of a diatonic chord in `key` / `mode`, root first. */
function chordPcs({ degree, seventh }, tonic, mode) {
  const scale = SCALE[mode]
  const steps = seventh ? [0, 2, 4, 6] : [0, 2, 4]
  return steps.map((s) => {
    const i = degree + s
    return (tonic + scale[i % 7] + 12 * Math.floor(i / 7)) % 12
  })
}

/** Each pitch class placed in [low, low + 12), sorted: a closed voicing that stays in one register. */
const voice = (pcs, low) => pcs.map((pc) => low + ((pc - low) % 12 + 12) % 12).sort((a, b) => a - b)

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Settings with preset defaults filled in. What the project leaves open (key, progression, rhythm
 * patterns, the melody) is picked by the seed, so another seed gives another piece in the same style.
 */
export function resolveSettings(music = {}) {
  const presetName = music.preset ?? 'corporate'
  const preset = PRESETS[presetName]
  const mode = music.mode ?? preset.mode
  const seed = music.seed ?? 1
  const pick = mulberry32(seed ^ 0x9e3779b9)
  const choose = (list) => list[Math.floor(pick() * list.length)]
  const instruments = music.instruments ?? preset.instruments
  // Picks are drawn in a fixed order, so overriding one field leaves the others as they were.
  const key = choose(KEYS)
  const progressions = { major: choose(preset.progressions.major), minor: choose(preset.progressions.minor) }
  const rhythm = {
    piano: PATTERNS.piano.map(choose),
    bass: PATTERNS.bass.map(choose),
    kick: { full: choose(PATTERNS.kick.full), half: choose(PATTERNS.kick.half) },
    hat: choose(PATTERNS.hat),
    arp: choose(['up', 'updown', 'random']),
  }
  const motif = makeMotif(pick)
  return {
    preset: presetName,
    bpm: music.bpm ?? preset.bpm,
    key: music.key ?? key,
    mode,
    instruments,
    progression: music.progression ?? progressions[mode],
    progressions: { major: music.progression ?? progressions.major, minor: music.progression ?? progressions.minor },
    melody: music.melody !== false,
    lead: leadFor(instruments, preset.lead),
    seed,
    swing: preset.swing ?? 0,
    lowpass: preset.lowpass ?? null,
    drumsFrom: preset.drumsFrom ?? 'mid',
    rhythm,
    motif,
  }
}

/** The instrument that plays the melody: the preset's lead when used, else the first melodic one. */
function leadFor(instruments, preferred) {
  return instruments.includes(preferred) ? preferred : MELODIC.find((i) => instruments.includes(i)) ?? null
}

/**
 * A two-bar motif: [{ pos, dur, step }], `step` in scale steps above the chord root. Each bar starts
 * on a chord tone (steps 0, 2, 4, 7); the other notes move by steps or small leaps. Retries until
 * the motif uses at least three different notes, so it reads as a tune rather than a drone.
 */
function makeMotif(pick) {
  const rhythm = MOTIF_RHYTHMS[Math.floor(pick() * MOTIF_RHYTHMS.length)]
  const CHORD = [0, 2, 4, 7]
  const snap = (x) => CHORD.reduce((best, c) => (Math.abs(c - x) < Math.abs(best - x) ? c : best))
  for (let attempt = 0; ; attempt++) {
    let step = CHORD[Math.floor(pick() * 4)]
    const motif = rhythm.map(([pos, dur], i) => {
      if (i > 0) step = Math.max(0, Math.min(9, step + [-2, -1, 1, 2, 3, -3][Math.floor(pick() * 6)]))
      if (pos % 4 === 0) step = snap(step)
      return { pos, dur, step }
    })
    if (new Set(motif.map((n) => n.step)).size >= 3 || attempt >= 20) return motif
  }
}

/**
 * Musical settings of each scene: the project's, overridden by audio.music.sections[scene]. The
 * melody is the scene's theme (set in the section, else the theme of the first speaking character
 * that has one, else the theme without a character), or the seed's motif.
 */
function planParts(music, s, sections, barSec, last) {
  const themes = music.themes ?? []
  const byId = new Map(themes.map((t) => [t.id, t]))
  const list = sections.length ? sections : [{ scene: null, start: 0 }]
  return list.map((sec) => {
    const o = (sec.scene && music.sections?.[sec.scene]) || {}
    if (o.theme && !byId.has(o.theme)) throw new UsageError(`audio.music.sections.${sec.scene}.theme: no theme with id ${o.theme}`)
    const mode = o.mode ?? s.mode
    const instruments = o.instruments ?? s.instruments
    const theme = o.theme ? byId.get(o.theme)
      : (sec.speakers ?? []).map((id) => themes.find((t) => t.cast === id)).find(Boolean) ?? themes.find((t) => !t.cast) ?? null
    const lead = theme?.instrument && instruments.includes(theme.instrument) ? theme.instrument : leadFor(instruments, s.lead)
    const progression = o.progression ?? s.progressions[mode]
    return {
      scene: sec.scene,
      start: sec.start,
      bar: Math.min(last, Math.round(sec.start / barSec)),
      key: o.key ?? s.key,
      mode,
      instruments,
      energy: o.energy ?? 'mid',
      progression,
      chords: progression.map(parseChord),
      theme,
      lead: (o.melody ?? s.melody) ? lead : null,
    }
  })
}

/**
 * Lays out the piece. `sections` are [{ scene, start, speakers? }] in playback order (start in
 * seconds on the final timeline, speakers = cast ids heard in the scene); each scene's music begins
 * on the bar nearest its start, with its chord progression from the top. The last bar that leaves
 * at least 1.5 s is the tonic chord, held until `totalSec`. Cues (hit / dropout / swell) are placed
 * on the beat nearest their time.
 * Returns { settings, totalSec, beatSec, barSec, bars, sections, events }; events are
 * { inst, t, dur, notes, vel } (drums and effects: notes empty).
 */
export function compose(music = {}, { totalSec, sections = [] }) {
  const s = resolveSettings(music)
  const rand = mulberry32(s.seed)
  const beat = 60 / s.bpm
  const bar = beat * 4
  let last = Math.max(0, Math.ceil(totalSec / bar - 1e-6) - 1)
  if (last > 0 && totalSec - last * bar < 1.5) last--

  const parts = planParts(music, s, sections, bar, last)
  // Scenes shorter than a bar can land on the same bar; the later one wins.
  const partAt = (b) => parts.findLast((p) => p.bar <= b) ?? parts[0]
  const level = (e) => ENERGY.indexOf(e)
  /** The part playing bar b and its chord there (progressions restart with each scene). */
  const harmonyAt = (b) => {
    const part = partAt(b)
    const chord = part.chords[(b - Math.max(0, part.bar)) % part.chords.length]
    return { part, chord, pcs: chordPcs(chord, PITCH[part.key], part.mode) }
  }
  const { rhythm } = s

  const events = []
  const add = (inst, t, dur, notes, vel, loose = true) => {
    const jitter = loose && t > 0 ? (rand() - 0.5) * 0.012 : 0
    events.push({ inst, t: Math.max(0, t + jitter), dur, notes, vel: vel * (0.9 + 0.2 * rand()) })
  }

  for (let b = 0; b < last; b++) {
    const t0 = b * bar
    const { part, pcs } = harmonyAt(b)
    const e = level(part.energy)
    const singing = part.lead && (part.theme || e > 0)
    // Swing delays off-beat eighths.
    const at = (pos) => t0 + (pos + (s.swing && pos % 1 === 0.5 ? s.swing : 0)) * beat

    for (const inst of part.instruments) {
      if (inst === 'pad' || inst === 'strings') add(inst, t0, bar, voice(pcs, inst === 'pad' ? 55 : 52), 0.6 + 0.1 * e)
      else if (inst === 'piano') {
        for (const [pos, len] of rhythm.piano[e]) add('piano', at(pos), len * beat, voice(pcs, 55), 0.5 + 0.1 * e)
      } else if (inst === 'bass') {
        const root = voice([pcs[0]], 36)[0]
        const notes = [root, root + ((pcs[2] - pcs[0] + 12) % 12), root + 12]
        for (const [pos, len, n] of rhythm.bass[e]) add('bass', at(pos), len * beat, [notes[n]], pos % 1 ? 0.6 : 0.8)
      } else if (inst === 'drums') {
        if (e < level(s.drumsFrom)) continue
        const full = e === 2 && s.drumsFrom === 'mid'
        for (const pos of full ? rhythm.kick.full : rhythm.kick.half) add('kick', at(pos), 0.4, [], 0.9)
        if (full || s.drumsFrom === 'high') for (const pos of [1, 3]) add('snare', at(pos), 0.25, [], 0.6)
        for (const pos of rhythm.hat) add('hat', at(pos), 0.07, [], pos % 1 ? 0.45 : 0.3)
      } else if (!(inst === part.lead && singing)) {
        // pluck / marimba / bell: arpeggio over the chord, denser with energy (the lead plays the melody instead).
        const low = inst === 'bell' ? 72 : 60
        const tones = voice(pcs, low)
        if (e === 2 && inst !== 'bell') tones.push(...tones.map((n) => n + 12))
        const step = inst === 'bell' ? [2, 1, 0.5][e] : [1, 0.5, 0.5][e]
        const cycle = rhythm.arp === 'updown' ? [...tones, ...tones.slice(1, -1).reverse()] : tones
        for (let i = 0; i < Math.round(4 / step); i++) {
          const note = rhythm.arp === 'random' ? tones[Math.floor(rand() * tones.length)] : cycle[i % cycle.length]
          add(inst, at(i * step), step * beat, [note], 0.5 + 0.1 * e)
        }
      }
    }

    // Melody: a phrase starts at the scene's first bar and every phrase length after it.
    const local = b - Math.max(0, part.bar)
    const span = part.theme ? themeBars(part.theme) : 2
    if (singing && local % span === 0) {
      const phrase = part.theme ? themeNotes(part, b, harmonyAt) : motifNotes(s, part, b, harmonyAt, (local / span) % 2 === 1)
      for (const n of phrase) {
        const nb = b + Math.floor(n.pos / 4)
        if (nb >= last || partAt(nb) !== part) continue
        const pos = n.pos % 4
        const t = nb * bar + (pos + (s.swing && pos % 1 === 0.5 ? s.swing : 0)) * beat
        add(part.lead, t, n.dur * beat, [n.midi], [0.55, 0.7, 0.8][e])
      }
    }
  }

  // Ending: the tonic chord of the last scene's key rings out to the end.
  const tEnd = last * bar
  const ring = totalSec - tEnd
  const lastPart = partAt(Math.max(0, last - 1))
  const tonic = PITCH[lastPart.key]
  const tonicPcs = chordPcs({ degree: 0, seventh: false }, tonic, lastPart.mode)
  const end = (inst, dur, notes, vel) => add(inst, tEnd, dur, notes, vel, false)
  for (const inst of lastPart.instruments) {
    if (inst === 'pad' || inst === 'strings') end(inst, ring, voice(tonicPcs, inst === 'pad' ? 55 : 52), 0.65)
    else if (inst === 'piano') end('piano', ring, voice(tonicPcs, 55), 0.6)
    else if (inst === 'bass') end('bass', ring, [voice([tonic], 36)[0]], 0.7)
    else if (inst === 'drums') {
      if (level(lastPart.energy) >= level(s.drumsFrom)) end('kick', 0.4, [], 0.8)
    } else end(inst, ring, [voice([tonic], inst === 'bell' ? 72 : 60)[0]], 0.6)
  }

  applyCues(music.cues ?? [], sections, { events, beat, bar, totalSec, harmonyAt, add })

  const round = (n) => Math.round(n * 1000) / 1000
  return {
    settings: s,
    totalSec,
    beatSec: round(beat),
    barSec: round(bar),
    bars: Array.from({ length: last + 1 }, (_, b) => round(b * bar)),
    sections: parts.map((p) => ({
      scene: p.scene, start: round(p.bar * bar), energy: p.energy, key: p.key, mode: p.mode,
      progression: p.progression, instruments: p.instruments, melody: p.lead ? (p.theme?.id ?? 'motif') : null,
    })),
    events,
  }
}

/** Cues on the final timeline: dropouts first (they silence the music), then hits and swells. */
function applyCues(cues, sections, { events, beat, bar, totalSec, harmonyAt, add }) {
  const timeOf = (cue) => {
    const sec = sections.find((x) => x.scene === cue.scene)
    if (!sec) throw new UsageError(`audio.music.cues: scene ${cue.scene} is not in the video`)
    return Math.min(totalSec, Math.max(0, Math.round((sec.start + (cue.at ?? 0)) / beat) * beat))
  }
  for (const cue of cues.filter((c) => c.type === 'dropout')) {
    const to = timeOf(cue)
    const from = Math.max(0, to - (cue.beats ?? 1) * beat)
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]
      if (ev.t >= from - 0.01 && ev.t < to - 0.01) events.splice(i, 1)
      else if (ev.t < from && ev.t + ev.dur > from) ev.dur = from - ev.t
    }
  }
  for (const cue of cues.filter((c) => c.type !== 'dropout')) {
    const t = timeOf(cue)
    if (cue.type === 'hit') {
      const { pcs } = harmonyAt(Math.floor(t / bar))
      add('kick', t, 0.4, [], 1, false)
      add('crash', t, 2.5, [], 0.9, false)
      add('bass', t, 2 * beat, [voice([pcs[0]], 28)[0]], 0.9, false)
    } else {
      const len = (cue.beats ?? 4) * beat
      add('riser', Math.max(0, t - len), Math.min(len, t), [], 0.9, false)
    }
  }
}

/** Bars a theme spans (its notes cover 1–4 bars). */
const themeBars = (theme) => Math.max(1, Math.ceil(Math.max(...theme.notes.map((n) => n.beat + n.beats)) / 4 - 1e-9))

/** MIDI note of a scale step above the tonic (steps may be negative or above an octave). */
function scaleNote(tonic, mode, step) {
  const scale = SCALE[mode]
  return 60 + tonic + scale[((step % 7) + 7) % 7] + 12 * Math.floor(step / 7)
}

/** A phrase's notes moved by octaves so they sit around C5, whatever the key. */
function centre(notes) {
  const mean = notes.reduce((sum, n) => sum + n.midi, 0) / notes.length
  const shift = 12 * Math.round((72 - mean) / 12)
  return notes.map((n) => ({ ...n, midi: n.midi + shift }))
}

/**
 * A theme starting at bar b, in the scene's key and mode (a major theme turns minor in a minor
 * scene). `degree` 1 is the tonic; a note at the start of a bar that is not in that bar's chord
 * moves to the nearest chord tone, so the theme never clashes with the harmony.
 */
function themeNotes(part, b, harmonyAt) {
  const tonic = PITCH[part.key]
  return centre(part.theme.notes.map(({ beat, beats, degree }) => {
    let step = degree - 1
    if (beat % 4 === 0) {
      const { pcs } = harmonyAt(b + beat / 4)
      const fits = (st) => pcs.includes(scaleNote(tonic, part.mode, st) % 12)
      step = [0, -1, 1, -2, 2].map((d) => step + d).find(fits) ?? step
    }
    return { pos: beat, dur: beats, midi: scaleNote(tonic, part.mode, step) }
  }))
}

/**
 * The seed's motif over bars b and b + 1: steps are taken from each bar's chord root. An `answer`
 * (every other repeat) ends on the root of its last chord.
 */
function motifNotes(s, part, b, harmonyAt, answer) {
  const tonic = PITCH[part.key]
  return centre(s.motif.map(({ pos, dur, step }, i) => {
    const { chord } = harmonyAt(b + Math.floor(pos / 4))
    const st = answer && i === s.motif.length - 1 ? (step >= 4 ? 7 : 0) : step
    return { pos, dur, midi: scaleNote(tonic, part.mode, chord.degree + st) }
  }))
}

// ── Synthesis ────────────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)
const TABLE = 2048

/** One cycle of a waveform with the given harmonic amplitudes, peak-normalized. */
function table(amps) {
  const t = new Float32Array(TABLE)
  for (let i = 0; i < TABLE; i++) amps.forEach((a, k) => (t[i] += a * Math.sin((TAU * (k + 1) * i) / TABLE)))
  const peak = t.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  return t.map((v) => v / peak)
}
const SOFT = table([1, 0.5, 0.25, 0.12])
const SAW = table(Array.from({ length: 16 }, (_, k) => 1 / (k + 1)))
const BRIGHT = table([1, 0.7, 0.5, 0.35, 0.25, 0.18, 0.12, 0.08])
const TRI = table([1, 0, 1 / 9, 0, 1 / 25, 0, 1 / 49])
const read = (tab, phase) => tab[Math.floor((phase - Math.floor(phase)) * TABLE)]

/** Attack / decay / sustain level / release envelope at time t of a note held for `dur`. */
function adsr(t, dur, a, d, s, r) {
  const held = t < a ? t / a : t < a + d ? 1 - ((1 - s) * (t - a)) / d : s
  if (t <= dur) return held
  const level = dur < a ? dur / a : dur < a + d ? 1 - ((1 - s) * (dur - a)) / d : s
  return Math.max(0, level * (1 - (t - dur) / r))
}

/** Each voice returns a mono buffer starting at the event time. */
const VOICES = {
  pad: (ev, sr) => detuned(ev, sr, SOFT, [-4, 4], { a: 0.5, d: 0.5, s: 0.8, r: 0.8 }),
  strings: (ev, sr) => lowpass(detuned(ev, sr, SAW, [-3, 0, 3], { a: 0.35, d: 0.4, s: 0.85, r: 0.6 }), 2500, sr),
  piano(ev, sr) {
    const len = Math.min(ev.dur + 0.3, 4)
    return note(len, sr, (t) => {
      let v = 0
      for (const m of ev.notes) {
        const f = hz(m)
        v += read(BRIGHT, f * t) * Math.exp(-t * 5) + 0.8 * read(SOFT, f * t) * Math.exp(-t * 1.1)
      }
      return (v / Math.sqrt(ev.notes.length)) * Math.min(1, t / 0.003) * (t > ev.dur ? Math.max(0, 1 - (t - ev.dur) / 0.25) : 1)
    })
  },
  pluck(ev, sr, rand) {
    // Karplus-Strong: a noise burst through a delay line with averaging.
    const out = new Float32Array(Math.ceil(Math.min(ev.dur + 0.5, 2.5) * sr))
    const period = Math.max(2, Math.round(sr / hz(ev.notes[0])))
    const line = Float32Array.from({ length: period }, () => rand() * 2 - 1)
    for (let i = 0; i < out.length; i++) {
      const j = i % period
      const v = line[j]
      line[j] = 0.996 * 0.5 * (v + line[(j + 1) % period])
      out[i] = v
    }
    return fadeTail(out, sr)
  },
  marimba(ev, sr) {
    const f = hz(ev.notes[0])
    return note(Math.min(1.2, ev.dur + 0.6), sr, (t) => Math.sin(TAU * f * t) * Math.exp(-t * 6) + 0.3 * Math.sin(TAU * 4 * f * t) * Math.exp(-t * 20))
  },
  bell(ev, sr) {
    const f = hz(ev.notes[0])
    const partials = [[1, 1, 1.2], [2.76, 0.5, 2.5], [5.4, 0.25, 4], [8.93, 0.12, 6]]
    return note(3, sr, (t) => partials.reduce((v, [ratio, amp, decay]) => v + amp * Math.sin(TAU * f * ratio * t) * Math.exp(-t * decay), 0) * Math.min(1, t / 0.002))
  },
  bass(ev, sr) {
    const f = hz(ev.notes[0])
    return note(ev.dur + 0.1, sr, (t) => (read(TRI, f * t) + 0.5 * Math.sin(TAU * f * t)) * adsr(t, ev.dur, 0.01, 0.15, 0.7, 0.08))
  },
  kick(ev, sr) {
    let phase = 0
    return note(0.45, sr, (t) => {
      phase += (45 + 105 * Math.exp(-t * 30)) / sr
      return Math.sin(TAU * phase) * Math.exp(-t * 9)
    })
  },
  snare(ev, sr, rand) {
    let prev = 0
    return note(0.25, sr, (t) => {
      const n = rand() * 2 - 1
      const hp = n - prev
      prev = n
      return 0.7 * hp * Math.exp(-t * 22) + 0.5 * Math.sin(TAU * 185 * t) * Math.exp(-t * 35)
    })
  },
  crash(ev, sr, rand) {
    let prev = 0
    return note(2.5, sr, (t) => {
      const n = rand() * 2 - 1
      const hp = n - prev
      prev = n
      return hp * Math.exp(-t * 2.2) * Math.min(1, t / 0.002)
    })
  },
  riser(ev, sr, rand) {
    // Noise that grows louder and brighter until the cue.
    let low = 0
    return note(ev.dur, sr, (t) => {
      const x = t / ev.dur
      low += (0.02 + 0.5 * x) * (rand() * 2 - 1 - low)
      return low * x * x * 2
    })
  },
  hat(ev, sr, rand) {
    let p1 = 0
    let p2 = 0
    return note(0.07, sr, (t) => {
      const n = rand() * 2 - 1
      const h1 = n - p1
      const h2 = h1 - p2
      p1 = n
      p2 = h1
      return h2 * Math.exp(-t * 55)
    })
  },
}

/** Level and stereo position (-1 left … 1 right) of each voice in the mix. */
const MIX = {
  pad: [0.22, 0], strings: [0.2, 0], piano: [0.3, -0.1], pluck: [0.22, 0.3], marimba: [0.25, -0.25],
  bell: [0.12, 0.3], bass: [0.35, 0], kick: [0.55, 0], snare: [0.3, 0.05], hat: [0.12, 0.25],
  crash: [0.1, -0.2], riser: [0.16, 0],
}

function note(len, sr, fn) {
  const out = new Float32Array(Math.ceil(len * sr))
  for (let i = 0; i < out.length; i++) out[i] = fn(i / sr)
  return out
}

function detuned(ev, sr, tab, cents, { a, d, s, r }) {
  const len = ev.dur + r
  const freqs = ev.notes.flatMap((m) => cents.map((c) => hz(m) * 2 ** (c / 1200)))
  const norm = 1 / Math.sqrt(freqs.length)
  const rate = 5
  const depth = 0.001
  return note(len, sr, (t) => {
    // Phase of f · (1 + depth · sin(2π · rate · t)), integrated, so the vibrato stays ±depth.
    const wobble = (depth * (1 - Math.cos(TAU * rate * t))) / (TAU * rate)
    let v = 0
    for (const [k, f] of freqs.entries()) v += read(tab, f * (t + wobble) + k * 0.37)
    return v * norm * adsr(t, ev.dur, a, d, s, r)
  })
}

function lowpass(buf, cutoff, sr) {
  const k = 1 - Math.exp((-TAU * cutoff) / sr)
  let y = 0
  for (let i = 0; i < buf.length; i++) buf[i] = y += k * (buf[i] - y)
  return buf
}

/** Short fade at the end of a buffer so a cut-off note does not click. */
function fadeTail(buf, sr, sec = 0.05) {
  const n = Math.min(buf.length, Math.round(sec * sr))
  for (let i = 0; i < n; i++) buf[buf.length - 1 - i] *= i / n
  return buf
}

/**
 * Synthesizes a composed score. Returns { left, right } Float32Arrays of totalSec at `sr`,
 * peak-normalized to about -1 dBFS, with a 1 s fade-out at the end.
 */
export function renderAudio(score, sr = 48000) {
  const n = Math.ceil(score.totalSec * sr)
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  const rand = mulberry32(score.settings.seed + 7919)
  for (const ev of score.events) {
    const buf = VOICES[ev.inst](ev, sr, rand)
    const [gain, pan] = MIX[ev.inst]
    const gl = gain * ev.vel * Math.cos(((pan + 1) * Math.PI) / 4)
    const gr = gain * ev.vel * Math.sin(((pan + 1) * Math.PI) / 4)
    const start = Math.round(ev.t * sr)
    const end = Math.min(n, start + buf.length)
    for (let i = start; i < end; i++) {
      left[i] += buf[i - start] * gl
      right[i] += buf[i - start] * gr
    }
  }
  if (score.settings.lowpass) for (const ch of [left, right]) lowpass(ch, score.settings.lowpass, sr)
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  const fade = Math.min(n, Math.round(sr))
  const scale = peak > 0 ? 0.89 / peak : 0
  for (let i = 0; i < n; i++) {
    const g = scale * Math.min(1, (n - i) / fade, i / (0.01 * sr))
    left[i] *= g
    right[i] *= g
  }
  return { left, right }
}

/** 16-bit stereo PCM WAV bytes. */
export function wav({ left, right }, sr = 48000) {
  const n = left.length
  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 4, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 4, 40)
  const pcm = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(pcm(left[i]), 44 + i * 4)
    buf.writeInt16LE(pcm(right[i]), 46 + i * 4)
  }
  return buf
}
