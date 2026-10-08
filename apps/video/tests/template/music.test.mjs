// music.mjs against temp projects (scenes with fixed durationSec, so no TTS is needed), plus the
// pure composition in lib/music.mjs.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterEach, describe, test } from 'node:test'
import { PRESETS, compose, parseChord, renderAudio, resolveSettings } from '../../template/scripts/lib/music.mjs'
import { baseProject, baseScene, makeProject } from './helpers.mjs'

const require = createRequire(import.meta.url)
const ffprobe = require('ffprobe-static').path
const duration = (file) => Number(spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout)

const timeline = [
  { scene: 'scene-001', start: 0 },
  { scene: 'scene-002', start: 9.1 },
]
const lowHigh = { 'scene-001': { energy: 'low' }, 'scene-002': { energy: 'high' } }
const insts = (score, from, to) => new Set(score.events.filter((e) => e.t >= from && e.t < to).map((e) => e.inst))
const melodyOf = (score, inst = 'piano') => score.events.filter((e) => e.inst === inst && e.notes.length === 1)

describe('compose', () => {
  test('scenes start on the nearest bar and set the layers', () => {
    // corporate: 108 BPM → a bar is 2.222 s; 9.1 s is nearest to bar 4 (8.889 s).
    const score = compose({ sections: lowHigh }, { totalSec: 20, sections: timeline })
    assert.deepEqual(score.sections.map((s) => s.start), [0, 8.889])
    assert.ok(!insts(score, 0, 8.8).has('kick'), 'low energy has no drums')
    assert.ok(insts(score, 9, 17).has('snare'), 'high energy has the full kit')
  })

  test('ends on a held tonic chord', () => {
    const score = compose({ key: 'D' }, { totalSec: 20, sections: timeline })
    const lastBar = score.bars.at(-1)
    const pad = score.events.filter((e) => e.inst === 'pad').at(-1)
    assert.ok(Math.abs(pad.t - lastBar) < 0.01)
    assert.ok(pad.t + pad.dur >= 19.99 && 20 - lastBar >= 1.5)
    assert.deepEqual(pad.notes.map((n) => n % 12).sort((a, b) => a - b), [2, 6, 9]) // D F# A
  })

  test('instruments, progression and minor mode are respected', () => {
    const score = compose({ instruments: ['bell', 'bass'], mode: 'minor', key: 'A', progression: ['i7'], melody: false }, { totalSec: 10, sections: timeline })
    assert.deepEqual([...insts(score, 0, 10)].sort(), ['bass', 'bell'])
    assert.equal(score.events.find((e) => e.inst === 'bass').notes[0] % 12, 9)
  })

  test('the same seed gives the same piece, another seed a different one', () => {
    const a = compose({ seed: 5 }, { totalSec: 12, sections: timeline })
    assert.deepEqual(compose({ seed: 5 }, { totalSec: 12, sections: timeline }).events, a.events)
    assert.notDeepEqual(compose({ seed: 6 }, { totalSec: 12, sections: timeline }).events, a.events)
  })

  test('a seed picks key, progression, rhythm and motif; set fields always win', () => {
    const picks = [1, 2, 3, 4, 5, 6].map((seed) => resolveSettings({ preset: 'cinematic', mode: 'minor', seed }))
    const distinct = (f) => new Set(picks.map((p) => JSON.stringify(f(p)))).size
    assert.ok(distinct((p) => p.progression) >= 3, 'progressions vary')
    assert.ok(distinct((p) => p.key) >= 2, 'keys vary')
    assert.ok(distinct((p) => p.motif) >= 5, 'motifs vary')
    assert.ok(distinct((p) => p.rhythm) >= 3, 'rhythms vary')
    for (const p of picks) assert.ok(PRESETS.cinematic.progressions.minor.some((prog) => prog.join() === p.progression.join()))
    const fixed = resolveSettings({ preset: 'cinematic', mode: 'minor', seed: 2, key: 'E', progression: ['i', 'v'] })
    assert.equal(fixed.key, 'E')
    assert.deepEqual(fixed.progression, ['i', 'v'])
    assert.deepEqual(fixed.motif, picks[1].motif, 'overriding key and progression keeps the other picks')
  })

  test('the seed motif plays in mid and high scenes only, in the key; melody: false turns it off', () => {
    const score = compose({ preset: 'cinematic', mode: 'minor', key: 'A', sections: lowHigh }, { totalSec: 20, sections: timeline })
    const notes = melodyOf(score)
    assert.ok(notes.length >= 6)
    assert.ok(notes.every((n) => n.t > 8.5), 'no motif in the low scene')
    const aMinor = new Set([9, 11, 0, 2, 4, 5, 7])
    assert.ok(notes.every((n) => aMinor.has(n.notes[0] % 12) && n.notes[0] >= 60 && n.notes[0] <= 86))
    assert.equal(melodyOf(compose({ preset: 'cinematic', melody: false }, { totalSec: 20, sections: timeline })).length, 0)
  })

  test('a section can change mode, key, chords and instruments; its progression restarts', () => {
    const music = {
      preset: 'cinematic', key: 'C', melody: false,
      sections: { 'scene-002': { mode: 'minor', key: 'A', progression: ['iv', 'i'], instruments: ['strings', 'bass'] } },
    }
    const score = compose(music, { totalSec: 20, sections: timeline })
    // cinematic: 84 BPM → bar 2.857 s; scene-002 starts on bar 3 (8.571 s).
    const [first, second] = score.sections
    assert.equal(first.mode, 'major')
    assert.deepEqual([second.key, second.mode, second.start], ['A', 'minor', 8.571])
    assert.deepEqual([...insts(score, 8.6, 16)].sort(), ['bass', 'strings'])
    const strings = score.events.find((e) => e.inst === 'strings' && e.t > 8.5)
    assert.deepEqual(strings.notes.map((n) => n % 12).sort((a, b) => a - b), [2, 5, 9], 'starts on iv of A minor (D F A)')
  })

  test('themes follow the speaking character, turn minor in a minor scene, and fit the chords', () => {
    const hero = { id: 'hero', cast: 'mimi', notes: [{ beat: 0, beats: 1, degree: 1 }, { beat: 1, beats: 1, degree: 3 }, { beat: 2, beats: 2, degree: 5 }] }
    const music = {
      preset: 'cinematic', key: 'C', progression: ['I'], themes: [hero],
      sections: { 'scene-002': { mode: 'minor' } },
    }
    const score = compose(music, { totalSec: 20, sections: [{ ...timeline[0], speakers: ['mimi'] }, { ...timeline[1], speakers: ['mimi'] }] })
    assert.deepEqual(score.sections.map((s) => s.melody), ['hero', 'hero'])
    const notes = melodyOf(score)
    const pcsIn = (from, to) => notes.filter((n) => n.t >= from && n.t < to).slice(0, 3).map((n) => n.notes[0] % 12)
    assert.deepEqual(pcsIn(0, 2.8), [0, 4, 7], 'C E G in C major')
    assert.deepEqual(pcsIn(8.5, 11.4), [0, 3, 7], 'C Eb G in C minor')
    // A downbeat that is not a chord tone moves to the nearest one: degree 2 (D) over I (C E G).
    const snapped = compose({ ...music, sections: {}, themes: [{ id: 'main', notes: [{ beat: 0, beats: 2, degree: 2 }, { beat: 2, beats: 2, degree: 2 }] }] }, { totalSec: 6, sections: timeline.slice(0, 1) })
    const [down, off] = melodyOf(snapped).map((n) => n.notes[0] % 12)
    assert.ok([0, 4].includes(down))
    assert.equal(off, 2, 'off-beat notes stay as written')
  })

  test('without the character speaking, the unbound theme is used; a section can pick a theme', () => {
    const themes = [
      { id: 'hero', cast: 'mimi', notes: [{ beat: 0, beats: 4, degree: 1 }, { beat: 4, beats: 4, degree: 5 }] },
      { id: 'main', notes: [{ beat: 0, beats: 4, degree: 3 }, { beat: 4, beats: 4, degree: 1 }] },
    ]
    const score = compose({ themes, sections: { 'scene-002': { theme: 'hero' } } }, { totalSec: 20, sections: timeline })
    assert.deepEqual(score.sections.map((s) => s.melody), ['main', 'hero'])
    assert.throws(() => compose({ themes, sections: { 'scene-002': { theme: 'nope' } } }, { totalSec: 20, sections: timeline }), /no theme with id nope/)
  })

  test('cues: dropout silences the beats before, hit lands on the beat, swell rises into it', () => {
    // corporate: 108 BPM → beat 0.556 s. scene-002 starts at 9.1 s; at 1 → 10.1 s, nearest beat 10.0 s.
    const cues = [
      { scene: 'scene-002', at: 1, type: 'dropout', beats: 2 },
      { scene: 'scene-002', at: 1, type: 'hit' },
      { scene: 'scene-001', at: 4, type: 'swell', beats: 2 },
    ]
    const score = compose({ cues, sections: lowHigh }, { totalSec: 20, sections: timeline })
    const silent = score.events.filter((e) => e.t < 10 - 0.01 && e.t + e.dur > 8.889 + 0.01)
    assert.deepEqual(silent, [], 'nothing sounds in the 2 beats before the hit')
    assert.deepEqual(score.events.filter((e) => Math.abs(e.t - 10) < 1e-6).map((e) => e.inst).sort(), ['bass', 'crash', 'kick'])
    const riser = score.events.find((e) => e.inst === 'riser')
    assert.ok(Math.abs(riser.t + riser.dur - 3.889) < 1e-3 && Math.abs(riser.dur - 1.111) < 1e-3)
    assert.throws(() => compose({ cues: [{ scene: 'scene-009', type: 'hit' }] }, { totalSec: 20, sections: timeline }), /scene-009 is not in the video/)
  })

  test('renders the exact length without clipping', () => {
    const cues = [{ scene: 'scene-001', at: 1, type: 'hit' }, { scene: 'scene-001', at: 2, type: 'swell' }]
    const { left, right } = renderAudio(compose({ preset: 'playful', cues }, { totalSec: 3, sections: timeline }), 8000)
    assert.equal(left.length, 24000)
    assert.ok([...left, ...right].every((v) => Number.isFinite(v) && Math.abs(v) <= 0.9))
  })

  test('rejects chords that are not I–VII', () => {
    assert.throws(() => parseChord('VIII'), /bad chord/)
    assert.deepEqual(parseChord('ii7'), { degree: 1, seventh: true })
  })
})

describe('music.mjs', () => {
  let p
  afterEach(() => p?.cleanup())

  function project(audio, { durationSec = 3, cast } = {}) {
    const proj = baseProject()
    if (audio) proj.project.audio = audio
    if (cast) proj.project.cast = cast
    return makeProject({
      project: proj,
      scenes: [
        { id: 'scene-001', dir: 'scenes/001-hook', scene: baseScene('scene-001', { durationSec }), script: '【咪咪】我好想飛。\n' },
        { id: 'scene-002', dir: 'scenes/002-cta', scene: baseScene('scene-002', { durationSec: 4, visual: { type: 'motion-graphic', description: 'cta', transitionIn: 'fade' } }) },
      ],
    })
  }

  test('fits the music to the timeline and writes the plan', () => {
    const cast = [{ id: 'mimi', name: '咪咪' }]
    const themes = [{ id: 'hero', cast: 'mimi', notes: [{ beat: 0, beats: 2, degree: 1 }, { beat: 2, beats: 2, degree: 5 }] }]
    p = project({ music: { preset: 'lofi', themes, sections: { 'scene-002': { energy: 'high' } } } }, { cast })
    const r = p.run('music.mjs')
    assert.equal(r.code, 0, r.stderr)
    assert.match(r.stdout, /set audio\.bgm to "assets\/music\.mp3"/)
    assert.match(r.stdout, /scene-001 .* melody: hero/)
    // 3 s + 4 s minus the 0.5 s fade overlap.
    assert.ok(Math.abs(duration(p.path('assets/music.mp3')) - 6.5) < 0.1)
    const info = p.read('assets/music.json')
    assert.equal(info.totalSec, 6.5)
    assert.equal(info.bpm, 80)
    assert.deepEqual(info.sections.map((s) => [s.scene, s.energy, s.melody]), [['scene-001', 'mid', 'hero'], ['scene-002', 'high', 'motif']])
    assert.equal(p.run('validate.mjs').code, 0)
  })

  test('--preview estimates lengths from script.md before tts', () => {
    p = project({ music: {} }, { durationSec: null })
    assert.equal(p.run('music.mjs').code, 1, 'the real run needs narration')
    const r = p.run('music.mjs', ['--preview'])
    assert.equal(r.code, 0, r.stderr)
    assert.match(r.stdout, /estimated from script\.md for scene-001/)
    // 【咪咪】我好想飛。 → 5 characters → max(2, 5 / 4 + 0.5) = 2 s; + 4 s − 0.5 s overlap.
    assert.ok(Math.abs(duration(p.path('brief/music/preview.mp3')) - 5.5) < 0.1)
    assert.ok(!existsSync(p.path('assets/music.mp3')))
  })

  test('needs audio.music, except for --sample', () => {
    p = project()
    const r = p.run('music.mjs')
    assert.equal(r.code, 1)
    assert.match(r.stderr, /audio\.music is not set/)
    assert.equal(p.run('music.mjs', ['--sample']).code, 0)
    assert.ok(Math.abs(duration(p.path('brief/music/sample.mp3')) - 24) < 0.1)
    assert.ok(!existsSync(p.path('assets/music.mp3')))
  })

  test('validate checks scene, theme and cast references', () => {
    p = project({
      music: {
        themes: [{ id: 'hero', cast: 'nobody', notes: [{ beat: 0, beats: 1, degree: 1 }, { beat: 14, beats: 4, degree: 1 }] }],
        sections: { 'scene-009': { energy: 'low' }, 'scene-002': { theme: 'ghost' } },
        cues: [{ scene: 'scene-007', type: 'hit' }],
      },
    })
    const r = p.run('validate.mjs')
    const out = r.stdout + r.stderr
    assert.equal(r.code, 1)
    for (const msg of [/sections lists scene-009/, /theme: no theme with id ghost/, /cues: scene scene-007/, /cast nobody is not in project\.cast/, /past 16 beats/]) assert.match(out, msg)
  })
})
