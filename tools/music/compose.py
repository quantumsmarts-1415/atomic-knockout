"""Composes the campaign soundtrack (original). Run: python3 tools/music/compose.py [track ...]
Writes WAVs to /tmp/ak-music/ ; tools/music/build.sh normalises and encodes them to ogg + mp3."""
import os
import sys
import numpy as np
import wave
from synth import Mix, chord, parse_bar, midi, SR

OUT = '/tmp/ak-music'
os.makedirs(OUT, exist_ok=True)


def bars_of(s):
    """'bar | bar | ...' -> list of parsed bars; warns when a bar is not 4 beats."""
    res = []
    for i, b in enumerate(s.split('|')):
        notes, tot = parse_bar(b)
        if abs(tot - 4) > 1e-6:
            print(f'  ! bar {i + 1} has {tot} beats: {b.strip()}')
        res.append(notes)
    return res


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x.T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- layer helpers
def put_melody(mx, bars, inst, start_bar=0, shift=0, vel=0.8, gain=1.0, pan=0.0, send=0.25, only=None):
    for bi, notes in enumerate(bars):
        if only and not (only[0] <= bi < only[1]):
            continue
        for (b, d, m) in notes:
            mx.note(inst, m + shift, (start_bar + bi) * 4 + b, d * 0.96, vel, gain, pan, send)


def put_pad(mx, chords, inst, octave=3, vel=0.6, gain=0.5, send=0.35, spread=True, only=None):
    for bi, c in enumerate(chords):
        if only and not (only[0] <= bi < only[1]):
            continue
        tones = chord(c, octave)
        if spread:
            tones = [tones[0]] + [t + 12 if k == 2 else t for k, t in enumerate(tones[1:], 1)]
        for k, m in enumerate(tones):
            mx.note(inst, m, bi * 4, 4.0, vel, gain, (k - 1) * 0.35, send)


def put_bass(mx, chords, pattern, vel=0.8, gain=0.8, only=None):
    for bi, c in enumerate(chords):
        if only and not (only[0] <= bi < only[1]):
            continue
        t = chord(c, 2)
        r, f = t[0], t[2]
        base = bi * 4
        if pattern == 'eighths':
            seq = [r, r, r + 12, r, r, r + 12, f, r + 12]
            for i in range(8):
                mx.note('bass', seq[i], base + i * 0.5, 0.45, vel if i % 2 == 0 else vel * 0.8, gain, 0, 0.03)
        elif pattern == 'gallop':
            for i in range(16):
                mx.note('bass', r if i % 4 != 3 else r + 12, base + i * 0.25, 0.22, vel if i % 4 == 0 else vel * 0.75, gain, 0, 0.02)
        elif pattern == 'half':
            mx.note('bass', r, base, 1.9, vel, gain, 0, 0.03)
            mx.note('bass', f if bi % 2 else r, base + 2, 1.9, vel * 0.9, gain, 0, 0.03)
        elif pattern == 'whole':
            mx.note('bass', r, base, 3.95, vel, gain, 0, 0.03)
        elif pattern == 'walk':
            seq = [r, f, r + 12, f]
            for i in range(4):
                mx.note('bass', seq[i], base + i, 0.9, vel, gain, 0, 0.03)
        elif pattern == 'offbeat':
            for i in range(4):
                mx.note('bass', r, base + i + 0.5, 0.4, vel, gain, 0, 0.03)
                mx.note('bass', r - 12 if r - 12 > 24 else r, base + i, 0.4, vel * 0.9, gain, 0, 0.03)


def put_arp(mx, chords, inst, octave=4, step=0.5, vel=0.55, gain=0.5, pat='updown', pan=0.3, send=0.4, only=None):
    for bi, c in enumerate(chords):
        if only and not (only[0] <= bi < only[1]):
            continue
        t = chord(c, octave)
        seq = t + [t[0] + 12]
        if pat == 'updown':
            seq = seq + seq[-2:0:-1]
        n = int(4 / step)
        for i in range(n):
            mx.note(inst, seq[i % len(seq)], bi * 4 + i * step, step * 0.9, vel * (1.0 if i % 4 == 0 else 0.78), gain, pan * (1 if i % 2 else -1), send)


def put_drums(mx, bars, style, vel=0.8, gain=0.8, only=None):
    for bi in range(bars):
        if only and not (only[0] <= bi < only[1]):
            continue
        b = bi * 4
        last = (bi % 8 == 7)
        if style == 'march':
            for i in range(4):
                mx.drum('kick', b + i, vel if i % 2 == 0 else vel * 0.5, gain) if i % 2 == 0 else mx.drum('snare', b + i, vel * 0.8, gain)
            for i in range(8):
                mx.drum('hat', b + i * 0.5, vel * (0.7 if i % 2 == 0 else 0.45), gain * 0.7, 0.3)
            if last:
                for k in range(4):
                    mx.drum('snare', b + 3 + k * 0.25, vel * (0.5 + 0.12 * k), gain)
        elif style == 'drive':
            for i in range(4):
                mx.drum('kick', b + i, vel, gain)
            for i in (1, 3):
                mx.drum('snare', b + i, vel * 0.85, gain)
            for i in range(8):
                mx.drum('hat', b + i * 0.5 + 0.0, vel * (0.55 if i % 2 == 0 else 0.4), gain * 0.7, -0.3)
            mx.drum('ohat', b + 1.5, vel * 0.5, gain * 0.6, 0.3)
            if bi % 8 == 0:
                mx.drum('crash', b, vel * 0.7, gain * 0.7)
            if last:
                for k in range(8):
                    mx.drum('snare', b + 2 + k * 0.25, vel * (0.4 + 0.07 * k), gain)
        elif style == 'boss':
            for i in range(4):
                mx.drum('kick', b + i, vel, gain)
            mx.drum('kick', b + 1.5, vel * 0.7, gain)
            mx.drum('kick', b + 3.5, vel * 0.7, gain)
            for i in (1, 3):
                mx.drum('snare', b + i, vel * 0.95, gain)
            for i in range(16):
                mx.drum('hat', b + i * 0.25, vel * (0.5 if i % 4 == 0 else 0.3), gain * 0.7, 0.2)
            mx.drum('tomlo', b, vel * 0.9, gain * 0.8)
            if bi % 4 == 0:
                mx.drum('crash', b, vel * 0.6, gain * 0.7)
            if bi % 8 == 7:
                for k, nm in enumerate(['tom', 'tom', 'tomlo', 'tomlo', 'snare', 'snare', 'snare', 'snare']):
                    mx.drum(nm, b + 2 + k * 0.25, vel * (0.5 + 0.07 * k), gain)
        elif style == 'ominous':
            mx.drum('tomlo', b, vel, gain)
            mx.drum('tomlo', b + 2.5, vel * 0.75, gain)
            for i in (1, 3):
                mx.drum('snare', b + i, vel * 0.55, gain, 0.2)
            for i in range(8):
                mx.drum('hat', b + i * 0.5, vel * 0.3, gain * 0.6, -0.2)
            if last:
                for k in range(4):
                    mx.drum('tom', b + 3 + k * 0.25, vel * (0.5 + 0.1 * k), gain)
        elif style == 'soft':
            mx.drum('kick', b, vel * 0.55, gain)
            mx.drum('kick', b + 2.5, vel * 0.4, gain)
            for i in (1, 3):
                mx.drum('hat', b + i, vel * 0.4, gain * 0.7, 0.3)
        elif style == 'timp':
            mx.drum('tomlo', b, vel * 0.8, gain)
            if bi % 2 == 1:
                mx.drum('tom', b + 2, vel * 0.6, gain)
            if bi % 8 == 0:
                mx.drum('crash', b, vel * 0.55, gain * 0.7)


def render_track(name, mx, loop=True, **kw):
    out = mx.render(loop=loop, **kw)
    # set the level from the loud passages (99.8th percentile), then a gentle soft clip for the rare peaks
    ref = np.percentile(np.abs(out), 99.8)
    out = out / max(ref, 1e-9) * 0.62
    out = np.tanh(out * 1.15) / np.tanh(1.15)
    write_wav(f'{OUT}/{name}.wav', out * 0.9)
    print(f'{name}: {out.shape[1] / SR:.1f}s')


# ================================================================ tracks
def t_map_player():
    bpm, nb = 128, 32
    mx = Mix(bpm, nb)
    ch1 = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G']
    ch2 = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C']
    m1 = bars_of('E5:1 G5:.5 E5:.5 C6:1 B5:.5 G5:.5 | D6:1 B5:1 G5:1 B5:1 | C6:.5 B5:.5 A5:1 C6:1 E6:1 | D6:1.5 C6:.5 A5:1 F5:1 |'
                  'E5:.5 G5:.5 C6:1 E6:1.5 D6:.5 | B5:1 D6:1 G6:1.5 F6:.5 | A5:1 C6:1 F6:1 E6:.5 D6:.5 | D6:2 r:.5 G5:.5 B5:1')
    m2 = bars_of('A5:1.5 C6:.5 E6:2 | F6:1.5 E6:.5 C6:1 A5:1 | G5:1 C6:1 E6:1 G6:1 | F6:1.5 D6:.5 B5:2 |'
                 'C6:1 A5:1 E6:1.5 D6:.5 | C6:1 F6:1 A6:1 G6:.5 F6:.5 | D6:1 G6:1 F6:1 D6:1 | E6:.5 D6:.5 C6:3')
    chords = ch1 + ch1 + ch2 + ch1
    put_bass(mx, chords, 'eighths', 0.8, 0.75)
    put_drums(mx, nb, 'drive', 0.8, 0.7)
    put_pad(mx, chords, 'strings', 3, 0.55, 0.42)
    put_arp(mx, chords, 'pluck', 4, 0.5, 0.5, 0.4, only=(8, 32))
    put_melody(mx, m1, 'lead', 0, 0, 0.8, 0.55, -0.15, 0.2, only=(0, 8))
    put_melody(mx, m1, 'horn', 8, 0, 0.85, 0.6, 0.0, 0.3)
    put_melody(mx, m1, 'lead', 8, 12, 0.6, 0.3, 0.3, 0.25)
    put_melody(mx, m2, 'horn', 16, 0, 0.85, 0.6, 0.0, 0.3)
    put_melody(mx, m2, 'bell', 16, 12, 0.6, 0.3, 0.3, 0.5)
    put_melody(mx, m1, 'lead', 24, 0, 0.85, 0.5, -0.2, 0.2)
    put_melody(mx, m1, 'horn', 24, 0, 0.85, 0.55, 0.15, 0.3)
    put_melody(mx, m1, 'bell', 24, 12, 0.6, 0.28, 0.35, 0.5)
    render_track('map_player', mx)


def t_map_enemy():
    bpm, nb = 138, 32
    mx = Mix(bpm, nb)
    ch1 = ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'Bb', 'A']
    ch2 = ['Gm', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'A']
    m1 = bars_of('D5:.5 D5:.5 F5:.5 D5:.5 A5:1 G5:.5 F5:.5 | E5:.5 E5:.5 G5:.5 E5:.5 A5:1 G5:.5 E5:.5 | F5:.5 F5:.5 Bb5:.5 F5:.5 D6:1 C6:.5 Bb5:.5 | E5:.5 E5:.5 A5:.5 C#6:.5 E6:2 |'
                  'A5:.5 A5:.5 D6:.5 A5:.5 F6:1 E6:.5 D6:.5 | G5:.5 Bb5:.5 D6:1 C6:1 Bb5:1 | Bb5:1 D6:1 F6:1 D6:1 | E6:1.5 D6:.5 C#6:1 A5:1')
    m2 = bars_of('D6:1 Bb5:1 G5:2 | E6:1 C#6:1 A5:2 | F6:.5 E6:.5 D6:1 F6:2 | D6:1 F6:1 D6:2 |'
                 'Bb5:.5 D6:.5 G6:1 F6:1 D6:1 | C#6:.5 E6:.5 A6:1 G6:.5 E6:.5 C#6:1 | F6:2 D6:1 Bb5:1 | A5:1 C#6:1 E6:1 A6:1')
    chords = ch1 + ch1 + ch2 + ch1
    put_bass(mx, chords, 'gallop', 0.75, 0.7)
    put_drums(mx, nb, 'ominous', 0.85, 0.75)
    put_pad(mx, chords, 'strings', 3, 0.5, 0.38, spread=False)
    put_pad(mx, chords, 'choir', 4, 0.5, 0.3, only=(16, 32))
    put_melody(mx, m1, 'stab', 0, 0, 0.8, 0.5, -0.2, 0.2)
    put_melody(mx, m1, 'lead', 8, 0, 0.75, 0.42, 0.2, 0.2)
    put_melody(mx, m1, 'stab', 8, -12, 0.75, 0.4, 0, 0.15)
    put_melody(mx, m2, 'horn', 16, 0, 0.85, 0.6, 0, 0.3)
    put_melody(mx, m2, 'lead', 16, 12, 0.6, 0.28, 0.3, 0.3)
    put_melody(mx, m1, 'horn', 24, 0, 0.85, 0.55, -0.1, 0.3)
    put_melody(mx, m1, 'stab', 24, 0, 0.8, 0.4, 0.2, 0.2)
    put_melody(mx, m1, 'lead', 24, 12, 0.6, 0.25, 0.35, 0.3)
    put_arp(mx, chords, 'pluck', 3, 0.25, 0.4, 0.28, only=(8, 16))
    render_track('map_enemy', mx)


def t_map_player_2():
    """The very first boss theme (E minor, 156 bpm), now a third-choice map theme."""
    bpm, nb = 156, 32
    mx = Mix(bpm, nb)
    ch1 = ['Em', 'Em', 'C', 'D', 'Em', 'C', 'D', 'B7']
    ch2 = ['Am', 'Em', 'C', 'D', 'Am', 'Em', 'B7', 'B7']
    m1 = bars_of('E5:.5 G5:.5 B5:1 E6:1 D6:.5 B5:.5 | B5:.5 E6:.5 G6:1 F#6:1 E6:1 | C6:1 G5:.5 C6:.5 E6:1 D6:.5 C6:.5 | D6:1 A5:.5 D6:.5 F#6:2 |'
                  'G6:1 E6:.5 G6:.5 B6:1 A6:.5 G6:.5 | E6:1 G6:1 E6:1 C6:1 | F#6:1 A6:1 F#6:1 D6:1 | D#6:1 F#6:1 B6:1 A6:.5 F#6:.5')
    m2 = bars_of('A5:.5 C6:.5 E6:1 A6:2 | G6:1 E6:1 B5:2 | C6:.5 E6:.5 G6:1 E6:1 C6:1 | A5:.5 D6:.5 F#6:1 A6:2 |'
                 'E6:1 A6:1 G6:1 E6:1 | G6:.5 F#6:.5 E6:1 B5:1 E6:1 | D#6:.5 F#6:.5 A6:1 F#6:1 D#6:1 | B5:1 D#6:1 F#6:1 B6:1')
    chords = ch1 + ch1 + ch2 + ch1
    put_bass(mx, chords, 'gallop', 0.85, 0.75)
    put_drums(mx, nb, 'boss', 0.9, 0.8)
    put_pad(mx, chords, 'strings', 3, 0.6, 0.42)
    put_pad(mx, chords, 'choir', 4, 0.6, 0.38, only=(8, 32))
    put_arp(mx, chords, 'lead', 4, 0.25, 0.4, 0.25, only=(0, 8), pan=0.4)
    put_melody(mx, m1, 'horn', 0, 0, 0.9, 0.62, 0, 0.3)
    put_melody(mx, m1, 'lead', 8, 0, 0.8, 0.45, -0.2, 0.2)
    put_melody(mx, m1, 'horn', 8, 0, 0.9, 0.6, 0.1, 0.3)
    put_melody(mx, m2, 'horn', 16, 0, 0.95, 0.65, 0, 0.3)
    put_melody(mx, m2, 'lead', 16, 12, 0.7, 0.3, 0.3, 0.3)
    put_melody(mx, m2, 'bell', 16, 12, 0.7, 0.28, -0.3, 0.5)
    put_melody(mx, m1, 'horn', 24, 0, 0.95, 0.62, 0, 0.3)
    put_melody(mx, m1, 'stab', 24, -12, 0.9, 0.45, 0, 0.2)
    put_melody(mx, m1, 'lead', 24, 12, 0.7, 0.3, 0.3, 0.3)
    render_track('map_player_2', mx)



def put_taiko(mx, nb, vel=0.9, gain=0.9):
    """War-drum bed: heavy hits on the strong beats, a rolling pickup into every 4th bar, a big fill every 8th."""
    for bi in range(nb):
        b = bi * 4
        mx.drum('taiko', b, vel, gain, 0, 0.18)
        mx.drum('kick', b, vel, gain * 0.9)
        mx.drum('taiko', b + 1.5, vel * 0.65, gain, -0.2, 0.15)
        mx.drum('kick', b + 2, vel * 0.9, gain * 0.9)
        mx.drum('bigsnare', b + 2, vel * 0.95, gain * 0.9, 0, 0.3)
        mx.drum('taiko', b + 2.5, vel * 0.6, gain, 0.2, 0.15)
        mx.drum('kick', b + 3.5, vel * 0.7, gain * 0.9)
        for i in range(8):
            mx.drum('hat', b + i * 0.5 + 0.25, vel * (0.4 if i % 2 else 0.3), gain * 0.55, 0.35 if i % 2 else -0.35)
        if bi % 4 == 3:
            for k in range(6):
                mx.drum('taiko' if k < 4 else 'bigsnare', b + 2.5 + k * 0.25, vel * (0.5 + 0.08 * k), gain, (k - 3) * 0.12, 0.2)
        if bi % 8 == 7:
            for k in range(8):
                mx.drum(['tom', 'tom', 'tomlo', 'tomlo', 'bigsnare', 'bigsnare', 'bigsnare', 'bigsnare'][k], b + 3 + k * 0.125, vel * (0.5 + 0.07 * k), gain, (k - 4) * 0.15, 0.2)
        if bi % 8 == 0:
            mx.drum('crash', b, vel * 0.75, gain * 0.8, 0, 0.3)


def t_map_player_3():
    """The second boss theme, now a map theme: F minor with the Phrygian Gb and the harmonic-minor E natural: dark, heavy, half-time war drums over a driving distorted bass."""
    bpm, nb = 140, 32
    mx = Mix(bpm, nb, tail=5.0)
    ch1 = ['Fm', 'Fm', 'Gb', 'Gb', 'Db', 'C', 'Fm', 'C']
    ch2 = ['Bbm', 'Fm', 'Db', 'C', 'Bbm', 'Gb', 'C', 'C']
    m1 = bars_of('F5:1.5 F5:.5 Ab5:1 C6:1 | Bb5:1 Ab5:1 G5:.5 F5:.5 Ab5:1 | Gb5:1.5 Gb5:.5 Bb5:1 Db6:1 | C6:1 Bb5:1 Gb5:2 |'
                  'Ab5:1 Db6:1 F6:1.5 Eb6:.5 | E6:1 G6:1 C6:2 | F6:1.5 Eb6:.5 Db6:1 C6:1 | G5:.5 C6:.5 E6:1 Db6:2')
    m2 = bars_of('Bb5:1 Db6:1 F6:2 | C6:1.5 Db6:.5 C6:1 Ab5:1 | F6:1 Ab6:1 F6:1 Db6:1 | E6:1 G6:1 E6:2 |'
                 'F6:.5 Db6:.5 Bb5:1 Db6:1 F6:1 | Gb6:1.5 F6:.5 Db6:1 Bb5:1 | E6:.5 G6:.5 C7:1 Bb6:1 G6:1 | G6:1 E6:1 C6:2')
    chords = ch1 + ch1 + ch2 + ch1
    # weight: sub sine under everything, distorted bass driving 8ths (16ths in the big sections)
    for bi, c in enumerate(chords):
        root = chord(c, 1)[0]
        mx.note('subbass', root + 12 if root < 30 else root, bi * 4, 3.95, 0.95, 1.0, 0, 0.02)
    put_bass(mx, chords, 'eighths', 0.9, 0.8, only=(0, 8))
    put_bass(mx, chords, 'gallop', 0.95, 0.8, only=(8, 32))
    put_taiko(mx, nb, 0.95, 0.95)
    # low brass stabs on the downbeat + choir and strings for the cinematic width
    for bi, c in enumerate(chords):
        t = chord(c, 2)
        mx.note('lowbrass', t[0] + 12, bi * 4, 1.2, 0.95, 0.55, -0.15, 0.3)
        mx.note('lowbrass', t[2] + 12, bi * 4, 1.2, 0.85, 0.4, 0.15, 0.3)
        if bi % 2 == 1:
            mx.note('lowbrass', t[0] + 12, bi * 4 + 2.5, 0.5, 0.8, 0.45, 0, 0.3)
    put_pad(mx, chords, 'choir', 3, 0.7, 0.5, 0.5)
    put_pad(mx, chords, 'strings', 3, 0.55, 0.4, 0.5, only=(8, 32))
    put_arp(mx, chords, 'lead', 4, 0.25, 0.35, 0.18, only=(8, 16), pan=0.6)
    # melody: low brass + lead first time, horns doubled an octave up for the second theme, bells for sparkle
    put_melody(mx, m1, 'lowbrass', 0, -12, 0.95, 0.7, 0, 0.3)
    put_melody(mx, m1, 'horn', 0, 0, 0.8, 0.45, 0.1, 0.35)
    put_melody(mx, m1, 'horn', 8, 0, 0.95, 0.6, 0, 0.35)
    put_melody(mx, m1, 'lead', 8, 12, 0.7, 0.28, -0.3, 0.3)
    put_melody(mx, m2, 'horn', 16, 0, 1.0, 0.65, 0, 0.35)
    put_melody(mx, m2, 'lowbrass', 16, -12, 0.95, 0.55, 0, 0.3)
    put_melody(mx, m2, 'bell', 16, 12, 0.7, 0.3, 0.4, 0.6)
    put_melody(mx, m1, 'horn', 24, 0, 1.0, 0.62, 0, 0.35)
    put_melody(mx, m1, 'lowbrass', 24, -12, 0.95, 0.55, 0, 0.3)
    put_melody(mx, m1, 'lead', 24, 12, 0.75, 0.3, 0.3, 0.3)
    put_melody(mx, m1, 'bell', 24, 12, 0.7, 0.26, -0.4, 0.6)
    render_track('map_player_3', mx, rt=2.8)



def t_boss():
    """F minor with the Phrygian Gb and the harmonic-minor E natural: dark, heavy, half-time war drums over a driving distorted bass."""
    bpm, nb = 140, 32
    mx = Mix(bpm, nb, tail=5.0)
    ch1 = ['Fm', 'Fm', 'Gb', 'Gb', 'Db', 'C', 'Fm', 'C']
    ch2 = ['Bbm', 'Fm', 'Db', 'C', 'Bbm', 'Gb', 'C', 'C']
    m1 = bars_of('F5:1.5 F5:.5 Ab5:1 C6:1 | Bb5:1 Ab5:1 G5:.5 F5:.5 Ab5:1 | Gb5:1.5 Gb5:.5 Bb5:1 Db6:1 | C6:1 Bb5:1 Gb5:2 |'
                  'Ab5:1 Db6:1 F6:1.5 Eb6:.5 | E6:1 G6:1 C6:2 | F6:1.5 Eb6:.5 Db6:1 C6:1 | G5:.5 C6:.5 E6:1 Db6:2')
    m2 = bars_of('Bb5:1 Db6:1 F6:2 | C6:1.5 Db6:.5 C6:1 Ab5:1 | F6:1 Ab6:1 F6:1 Db6:1 | E6:1 G6:1 E6:2 |'
                 'F6:.5 Db6:.5 Bb5:1 Db6:1 F6:1 | Gb6:1.5 F6:.5 Db6:1 Bb5:1 | E6:.5 G6:.5 C7:1 Bb6:1 G6:1 | G6:1 E6:1 C6:2')
    chords = ch1 + ch1 + ch2 + ch1
    # weight: sub sine under everything, distorted bass driving 8ths (16ths in the big sections)
    for bi, c in enumerate(chords):
        root = chord(c, 1)[0]
        mx.note('subbass', root + 12 if root < 30 else root, bi * 4, 3.95, 0.95, 1.0, 0, 0.02)
    put_bass(mx, chords, 'eighths', 0.9, 0.8, only=(0, 8))
    put_bass(mx, chords, 'gallop', 0.95, 0.8, only=(8, 32))
    put_taiko(mx, nb, 0.95, 0.95)
    # low brass stabs on the downbeat + choir and strings for the cinematic width
    for bi, c in enumerate(chords):
        t = chord(c, 2)
        mx.note('lowbrass', t[0] + 12, bi * 4, 1.2, 0.95, 0.55, -0.15, 0.3)
        mx.note('lowbrass', t[2] + 12, bi * 4, 1.2, 0.85, 0.4, 0.15, 0.3)
        if bi % 2 == 1:
            mx.note('lowbrass', t[0] + 12, bi * 4 + 2.5, 0.5, 0.8, 0.45, 0, 0.3)
    put_pad(mx, chords, 'choir', 3, 0.7, 0.5, 0.5)
    put_pad(mx, chords, 'strings', 3, 0.55, 0.4, 0.5, only=(8, 32))
    put_arp(mx, chords, 'lead', 4, 0.25, 0.35, 0.18, only=(8, 16), pan=0.6)
    # melody: low brass + lead first time, horns doubled an octave up for the second theme, bells for sparkle
    put_melody(mx, m1, 'lowbrass', 0, -12, 0.95, 0.7, 0, 0.3)
    put_melody(mx, m1, 'horn', 0, 0, 0.8, 0.45, 0.1, 0.35)
    put_melody(mx, m1, 'horn', 8, 0, 0.95, 0.6, 0, 0.35)
    put_melody(mx, m1, 'lead', 8, 12, 0.7, 0.28, -0.3, 0.3)
    put_melody(mx, m2, 'horn', 16, 0, 1.0, 0.65, 0, 0.35)
    put_melody(mx, m2, 'lowbrass', 16, -12, 0.95, 0.55, 0, 0.3)
    put_melody(mx, m2, 'bell', 16, 12, 0.7, 0.3, 0.4, 0.6)
    put_melody(mx, m1, 'horn', 24, 0, 1.0, 0.62, 0, 0.35)
    put_melody(mx, m1, 'lowbrass', 24, -12, 0.95, 0.55, 0, 0.3)
    put_melody(mx, m1, 'lead', 24, 12, 0.75, 0.3, 0.3, 0.3)
    put_melody(mx, m1, 'bell', 24, 12, 0.7, 0.26, -0.4, 0.6)
    render_track('boss', mx, rt=2.8)


def t_story():
    bpm, nb = 66, 16
    mx = Mix(bpm, nb)
    ch = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E', 'Am']
    m = bars_of('E5:2 A5:2 | C6:3 A5:1 | G5:2 E5:2 | D5:2 B5:2 | C6:2 E6:2 | A5:3 C6:1 | B5:2 D6:2 | A5:4 |'
                'F5:2 A5:2 | G5:2 C6:2 | B5:3 G5:1 | E5:2 A5:2 | C6:2 F6:2 | E6:3 D6:1 | G#5:2 B5:2 | A5:4')
    put_pad(mx, ch, 'pad', 3, 0.6, 0.55, 0.5)
    put_pad(mx, ch, 'strings', 3, 0.35, 0.28, 0.5, only=(8, 16))
    put_bass(mx, ch, 'whole', 0.6, 0.55)
    put_arp(mx, ch, 'pluck', 4, 1.0, 0.4, 0.28, 'updown', 0.3, 0.6, only=(0, 16))
    put_melody(mx, m, 'bell', 0, 0, 0.7, 0.55, 0.0, 0.6, only=(0, 8))
    put_melody(mx, m, 'flute', 8, 0, 0.6, 0.5, 0.1, 0.5, only=(0, 16))
    put_melody(mx, m[:8], 'bell', 8, 12, 0.5, 0.25, -0.3, 0.7, only=(0, 0))
    render_track('story', mx, rt=2.6)


def t_camp():
    bpm, nb = 92, 16
    mx = Mix(bpm, nb)
    ch = ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'Gm', 'C', 'F', 'Dm', 'Bb', 'C', 'F', 'C']
    m = bars_of('A5:1 C6:1 A5:.5 G5:.5 F5:1 | D6:1 A5:1 F5:1 A5:1 | Bb5:1 D6:1 F6:1.5 D6:.5 | E6:1 C6:1 G5:2 |'
                'A5:1 C6:1 F6:1.5 E6:.5 | D6:1 F6:1 A6:1 F6:1 | D6:1.5 C6:.5 Bb5:1 A5:1 | G5:2 E5:1 G5:1 |'
                'Bb5:1 D6:1 G6:2 | E6:1 G6:1 E6:1 C6:1 | A5:1.5 C6:.5 F6:2 | F6:1 D6:1 A5:2 |'
                'Bb5:1 D6:1 F6:1 D6:1 | C6:1 E6:1 G6:2 | A6:1 F6:1 C6:2 | G5:2 r:2')
    put_bass(mx, ch, 'walk', 0.7, 0.6)
    put_drums(mx, nb, 'soft', 0.7, 0.5)
    put_pad(mx, ch, 'pad', 3, 0.5, 0.38, 0.4)
    put_arp(mx, ch, 'pluck', 4, 0.5, 0.45, 0.35, 'updown', 0.35, 0.35, only=(0, 16))
    put_melody(mx, m, 'flute', 0, 0, 0.7, 0.6, 0.0, 0.35)
    put_melody(mx, m, 'bell', 8, 12, 0.5, 0.22, 0.3, 0.6)
    render_track('camp', mx, rt=2.0)


def t_title():
    bpm, nb = 84, 16
    mx = Mix(bpm, nb)
    ch = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'A']
    m = bars_of('D5:1.5 F#5:.5 A5:2 | C#6:1.5 B5:.5 A5:2 | B5:1 D6:1 F#6:2 | E6:1.5 D6:.5 B5:2 |'
                'A5:1 D6:1 F#6:1.5 A6:.5 | E6:1.5 C#6:.5 A5:2 | B5:1 D6:1 G6:1.5 F#6:.5 | E6:2 A5:1 C#6:1 |'
                'F#6:1 D6:1 B5:2 | G6:1.5 F#6:.5 D6:2 | F#6:1 A6:1 F#6:1 D6:1 | E6:3 C#6:1 |'
                'D6:1 F#6:1 B6:1.5 A6:.5 | G6:1 B6:1 A6:1 G6:1 | F#6:1 E6:1 C#6:1 E6:1 | A5:3 r:1')
    put_bass(mx, ch, 'half', 0.8, 0.7)
    put_drums(mx, nb, 'timp', 0.9, 0.8)
    put_pad(mx, ch, 'strings', 3, 0.6, 0.5, 0.45)
    put_pad(mx, ch, 'choir', 4, 0.5, 0.3, 0.5, only=(8, 16))
    put_arp(mx, ch, 'bell', 5, 1.0, 0.4, 0.28, 'updown', 0.4, 0.7, only=(0, 16))
    put_melody(mx, m, 'horn', 0, 0, 0.85, 0.62, 0.0, 0.35)
    put_melody(mx, m, 'lead', 8, 12, 0.6, 0.25, 0.3, 0.35, only=(8, 16))
    render_track('title', mx, rt=2.4)


def t_victory():
    mx = Mix(132, 4, tail=3.5)
    ch = ['C', 'F', 'G', 'C']
    m = bars_of('G5:.5 C6:.5 E6:.5 G6:1.5 E6:.5 G6:.5 | A6:1 G6:1 F6:.5 E6:.5 D6:1 | G6:.5 E6:.5 C7:3 | r:4')
    put_pad(mx, ch[:3], 'strings', 3, 0.7, 0.55, 0.4)
    for c in chord('C', 3):
        mx.note('strings', c, 8, 3.5, 0.8, 0.5, 0, 0.4)
    put_melody(mx, m, 'horn', 0, 0, 0.95, 0.7, 0, 0.35)
    put_melody(mx, m, 'bell', 0, 12, 0.7, 0.3, 0.3, 0.6)
    put_melody(mx, m, 'lead', 0, 0, 0.8, 0.3, -0.2, 0.2)
    put_bass(mx, ch[:2] + ['G'], 'half', 0.9, 0.7)
    mx.note('bass', midi('C2'), 8, 3.5, 0.9, 0.8, 0, 0.1)
    for b in (0, 4, 8):
        mx.drum('tomlo', b, 0.9, 0.9)
    mx.drum('crash', 8, 0.8, 0.8)
    for k in range(4):
        mx.drum('snare', 6 + k * 0.5, 0.4 + 0.12 * k, 0.8)
    render_track('victory', mx, loop=False, rt=2.2)


def t_defeat():
    mx = Mix(84, 4, tail=3.5)
    ch = ['Am', 'Dm', 'Am', 'Am']
    m = bars_of('C6:1.5 B5:.5 A5:2 | F5:1.5 E5:.5 D5:2 | C5:1 E5:1 A4:2 | r:4')
    put_pad(mx, ch[:3], 'pad', 3, 0.7, 0.6, 0.5)
    put_pad(mx, ['Am'], 'strings', 3, 0.5, 0.4, 0.5, only=None)
    put_melody(mx, m, 'flute', 0, 0, 0.7, 0.6, 0.0, 0.5)
    put_melody(mx, m, 'bell', 0, 0, 0.6, 0.25, 0.2, 0.7)
    mx.note('bass', midi('A1'), 0, 3.9, 0.7, 0.8, 0, 0.1)
    mx.note('bass', midi('D2'), 4, 3.9, 0.7, 0.8, 0, 0.1)
    mx.note('bass', midi('A1'), 8, 3.9, 0.7, 0.8, 0, 0.1)
    mx.drum('tomlo', 0, 0.8, 0.8)
    mx.drum('tomlo', 8, 0.7, 0.8)
    render_track('defeat', mx, loop=False, rt=3.0)


def t_levelup():
    mx = Mix(136, 2, tail=2.5)
    seq = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6']
    for i, n in enumerate(seq):
        mx.note('lead', midi(n), i * 0.25, 0.3, 0.8, 0.5, (i - 3) * 0.1, 0.3)
        mx.note('bell', midi(n), i * 0.25, 1.0, 0.7, 0.3, (i - 3) * 0.1, 0.5)
    mx.note('horn', midi('C6'), 1.5, 1.5, 0.9, 0.6, 0, 0.4)
    mx.note('horn', midi('E6'), 1.5, 1.5, 0.9, 0.5, 0, 0.4)
    mx.note('horn', midi('G6'), 1.5, 1.5, 0.9, 0.5, 0, 0.4)
    mx.note('bell', midi('C7'), 1.5, 2.0, 0.9, 0.5, 0, 0.7)
    mx.note('bass', midi('C3'), 1.5, 1.5, 0.8, 0.6, 0, 0.1)
    mx.drum('kick', 1.5, 0.8, 0.8)
    render_track('levelup', mx, loop=False, rt=1.6)


TRACKS = dict(map_player=t_map_player, map_player_2=t_map_player_2, map_player_3=t_map_player_3, map_enemy=t_map_enemy, boss=t_boss, story=t_story, camp=t_camp, title=t_title,
              victory=t_victory, defeat=t_defeat, levelup=t_levelup)

if __name__ == '__main__':
    names = sys.argv[1:] or list(TRACKS)
    for n in names:
        TRACKS[n]()
