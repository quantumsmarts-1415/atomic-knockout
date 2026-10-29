"""Loudness-normalise (EBU R128, two-pass linear) and encode /tmp/ak-music/*.wav -> assets/campaign/music/*.ogg + .mp3
Usage: python3 tools/music/build.py   (run compose.py first)"""
import json, os, re, subprocess, sys

SRC = '/tmp/ak-music'
DST = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'campaign', 'music')
LOOPS = {'map_player', 'map_enemy', 'boss', 'story', 'camp', 'title'}
os.makedirs(DST, exist_ok=True)


def norm(name):
    src = f'{SRC}/{name}.wav'
    target = -19 if name in LOOPS else -16
    af = f'loudnorm=I={target}:TP=-1.5:LRA=9:print_format=json'
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-af', af, '-f', 'null', '-'], capture_output=True, text=True)
    j = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S).group(0))
    af2 = (f'loudnorm=I={target}:TP=-1.5:LRA=9:measured_I={j["input_i"]}:measured_LRA={j["input_lra"]}:'
           f'measured_TP={j["input_tp"]}:measured_thresh={j["input_thresh"]}:offset={j["target_offset"]}:linear=true,aresample=44100')
    out = f'{SRC}/{name}.norm.wav'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', af2, out], check=True)
    return out, float(j['input_i'])


for name in (sys.argv[1:] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.wav') and not f.endswith('.norm.wav'))):
    out, before = norm(name)
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', out, '-c:a', 'libvorbis', '-q:a', '3', f'{DST}/{name}.ogg'], check=True)
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', out, '-c:a', 'libmp3lame', '-b:a', '112k', f'{DST}/{name}.mp3'], check=True)
    print(f'{name}: was {before:.1f} LUFS -> {os.path.getsize(f"{DST}/{name}.ogg") // 1024} KB ogg, {os.path.getsize(f"{DST}/{name}.mp3") // 1024} KB mp3')
