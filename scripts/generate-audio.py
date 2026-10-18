"""Generate the intro video's audio: a cartoon game-style narrator with word timings, an 8-bit chiptune
soundtrack, and retro game sound effects.

Run:  pip install edge-tts numpy   then   python scripts/generate-audio.py
Writes public/video/vo/*.mp3, public/video/sfx/*.mp3, public/video/music.mp3 and src/video/audio.json
(clip lengths and per-word timings, which drive scene timing, animation cues and captions).
Needs ffmpeg/ffprobe on PATH and an internet connection (edge-tts uses Microsoft's online voices).

The music and effects are synthesized here from square, triangle and noise waves, the same three
building blocks an 8-bit console sound chip has. The tune is original.
"""

import asyncio
import json
import subprocess
import wave
from pathlib import Path

import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "video"
MANIFEST = ROOT / "src" / "video" / "audio.json"
# A lively voice, pitched up and sped up a little, so the Old Admin sounds like a cheerful game character.
VOICE = "en-US-RogerNeural"
RATE = "+6%"
PITCH = "+12Hz"
# "Old console speaker": trim the lows and highs and add a light bit-crush. Mixed in gently so every word stays clear.
VOICE_FILTER = "highpass=f=170,lowpass=f=7000,acrusher=bits=10:samples=2:mix=0.22:mode=log:aa=0.6,volume=1.1"
SR = 44100

# Keys match the scene ids in src/video/Intro.tsx. Scenes cue their animations on these words.
NARRATION = {
    "hook": "It's two A.M. Backups, updates, cleanups, reports. All waiting.",
    "question": "What if they ran themselves?",
    "title": "That's task scheduling and automation.",
    "whenHow": "Scheduling decides when a job runs. Automation decides how, with a script. Together, the job runs itself.",
    "pipeline": "Every job follows five steps. A trigger fires, the scheduler wakes up, the script runs, it writes a log, and it verifies the result.",
    "cron": "On Linux, cron uses five fields: minute, hour, day, month, and weekday. So thirty, one, star, star, star means every day at one thirty A.M.",
    "toolsBuiltIn": "Windows has Task Scheduler and PowerShell. Linux has cron, at, Bash, and systemd timers.",
    "toolsScale": "At scale, teams use Ansible, GitHub Actions, Jenkins, Kubernetes CronJobs, and cloud schedulers.",
    "fiveIdeas": "Different tools, same five ideas: trigger, schedule, condition, dependency, and queue.",
    "orbit": "So while you sleep, the lab is cleaned, the database backed up, the servers patched, and the report sent by six.",
    "habits": "Remember three habits: log everything, verify the result, and use least privilege.",
    "site": "Here, you learn by doing: short lessons, simulators, a terminal lab, and boss battle quizzes.",
    "end": "Press start, and let's begin with lesson one!",
}


# ---------------------------------------------------------------- narration

async def speak(text: str, dest: Path) -> list:
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    words = []
    with open(dest, "wb") as fh:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append([chunk["text"], round(start, 3), round(start + chunk["duration"] / 1e7, 3)])
    return words


def game_voice(path: Path) -> None:
    """Run a narration clip through the retro speaker filter, in place. Timing does not change."""
    tmp = path.with_name(path.stem + ".raw.mp3")
    path.replace(tmp)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-af", VOICE_FILTER, "-b:a", "128k", str(path)], check=True)
    tmp.unlink()


def punctuate(words: list, text: str) -> list:
    """Swap each spoken word for the script's own token, so captions keep capitals and punctuation ("A.M.", "reports.")."""
    norm = lambda w: "".join(ch for ch in w.lower() if ch.isalnum())
    tokens = text.split()
    i = 0
    for w in words:
        for j in range(i, len(tokens)):
            if norm(tokens[j]) == norm(w[0]):
                w[0] = tokens[j]
                i = j + 1
                break
    return words


def probe_seconds(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    )
    return round(float(out.stdout.strip()), 3)


def make_narration() -> dict:
    (OUT / "vo").mkdir(parents=True, exist_ok=True)
    result = {}
    for key, text in NARRATION.items():
        dest = OUT / "vo" / f"{key}.mp3"
        words = punctuate(asyncio.run(speak(text, dest)), text)
        game_voice(dest)
        # The clip ends a little after the last word; trim to it so scenes do not wait on silence.
        end = words[-1][2] + 0.15 if words else probe_seconds(dest)
        result[key] = {"duration": round(min(end, probe_seconds(dest)), 3), "words": words}
        print(f"  vo {key:13s} {result[key]['duration']:5.2f}s  {len(words)} words")
    return result


# ---------------------------------------------------------------- helpers

def write_audio(name: str, data: np.ndarray, bitrate: str = "128k") -> None:
    """Write mono or stereo float audio (-1..1) to public/video/<name>.mp3."""
    dest = OUT / f"{name}.mp3"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if data.ndim == 1:
        data = data[:, None]
    peak = np.max(np.abs(data)) or 1.0
    data = data * (0.89 / peak)
    wav_path = dest.with_suffix(".wav")
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(data.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((data * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-b:a", bitrate, str(dest)], check=True)
    wav_path.unlink()


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def times(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def phase(freq) -> np.ndarray:
    """Running phase (in cycles) for a constant or per-sample frequency, so pitch slides stay smooth."""
    return np.cumsum(np.broadcast_to(freq, np.shape(freq)) / SR)


def square(ph: np.ndarray, duty: float = 0.5) -> np.ndarray:
    """Pulse wave, like the two pulse channels of an 8-bit console (duty 12.5%, 25% or 50%)."""
    return np.where((ph % 1.0) < duty, 1.0, -1.0)


def triangle(ph: np.ndarray) -> np.ndarray:
    """Triangle wave stepped to 16 levels, like an 8-bit console's bass channel."""
    tri = 2 * np.abs(2 * (ph % 1.0) - 1) - 1
    return np.round(tri * 7.5) / 7.5


def noise(n: int, hold: int, rng) -> np.ndarray:
    """Noise channel: random +-1 values held for `hold` samples (bigger hold = lower, grittier noise)."""
    vals = rng.choice([-1.0, 1.0], size=n // max(1, hold) + 1)
    return np.repeat(vals, max(1, hold))[:n]


def env(n: int, attack: float = 0.004, decay: float = 0.0, sustain: float = 1.0, release: float = 0.012) -> np.ndarray:
    """Simple attack / decay / sustain / release envelope over n samples, with no clicks at the ends."""
    t = np.arange(n) / SR
    e = np.ones(n) * sustain
    if decay > 0:
        e = sustain + (1 - sustain) * np.exp(-t / decay)
    e *= np.clip(t / attack, 0, 1)
    e *= np.clip((n / SR - t) / release, 0, 1)
    return e


def tone(freq, seconds: float, wave: str = "square", duty: float = 0.5, **kw) -> np.ndarray:
    n = int(seconds * SR)
    f = np.broadcast_to(freq, (n,)) if np.ndim(freq) else np.full(n, float(freq))
    ph = phase(f)
    w = triangle(ph) if wave == "triangle" else square(ph, duty)
    return w * env(n, **kw)


def place(buf: np.ndarray, clip: np.ndarray, at: float, gain: float = 1.0) -> None:
    a = int(at * SR)
    if a >= len(buf):
        return
    b = min(len(buf), a + len(clip))
    buf[a:b] += clip[: b - a] * gain


# ---------------------------------------------------------------- sound effects

def make_sfx() -> None:
    rng = np.random.default_rng(11)

    # Typing: game text-box beeps, ~13 per second at slightly random pitches; played for as long as text types.
    typing = np.zeros(int(8 * SR))
    tpos = 0.04
    while tpos < 7.9:
        f = midi(rng.choice([81, 83, 84, 86]))
        place(typing, tone(f, 0.028, duty=0.25, release=0.008), tpos, 0.5 + 0.2 * rng.random())
        tpos += 0.055 + rng.gamma(2.0, 0.012)
    write_audio("sfx/typing", typing)

    # Clock tick: a tiny noise click with a high blip.
    tick = np.zeros(int(0.12 * SR))
    place(tick, noise(int(0.02 * SR), 1, rng) * env(int(0.02 * SR), release=0.015), 0, 0.6)
    place(tick, tone(midi(96), 0.03, duty=0.125), 0.0, 0.5)
    write_audio("sfx/tick", tick)

    # Success jingle: two quick rising notes, the second one held (a "got it!" sound).
    chime = np.zeros(int(0.9 * SR))
    place(chime, tone(midi(84), 0.07, duty=0.5), 0.0)
    place(chime, tone(midi(91), 0.6, duty=0.5, decay=0.22, sustain=0.0, release=0.05), 0.07)
    write_audio("sfx/chime", chime)

    # Blips: menu-select notes, one per step, climbing a major pentatonic scale, each with a tiny upward bend.
    for i, note in enumerate([72, 74, 76, 79, 81]):
        n = int(0.16 * SR)
        f = midi(note) * (1 + 0.06 * np.clip(np.arange(n) / (0.03 * SR), 0, 1))
        blip = tone(f, 0.16, duty=0.25, decay=0.06, sustain=0.0, release=0.02)
        place(blip, tone(midi(note + 12), 0.11, duty=0.125, decay=0.04, sustain=0.0), 0.05, 0.35)
        write_audio(f"sfx/blip{i + 1}", blip)

    # Tap: a short "pop" for items landing in place (a quick downward pitch drop).
    n = int(0.09 * SR)
    f = np.linspace(midi(79), midi(67), n)
    write_audio("sfx/tap", tone(f, 0.09, duty=0.5, decay=0.03, sustain=0.0))

    # Whoosh between scenes: a soft rising "warp" slide over noise.
    dur = 0.45
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(55) * 2 ** (t / dur * 2)  # up two octaves
    warp = tone(f, dur, duty=0.125, attack=0.02, release=0.12) * np.sin(np.pi * t / dur) * 0.5
    hiss = noise(n, 3, rng) * np.sin(np.pi * t / dur) ** 2 * 0.25
    whoosh = warp + hiss
    write_audio("sfx/whoosh", np.stack([whoosh, np.roll(whoosh, 300)], axis=1))

    # Power-up swell into the title: a fast rising arpeggio that lands exactly on the downbeat (1.73 s).
    dur = 1.73
    swell = np.zeros(int(dur * SR))
    notes = [60, 64, 67, 72, 76, 79, 84, 88]
    step = 0.055
    k = 0
    pos = 0.0
    while pos < dur - 0.06:
        note = notes[k % len(notes)] + 12 * (k // len(notes) % 2)
        place(swell, tone(midi(note), step, duty=0.25, release=0.01), pos, 0.25 + 0.75 * pos / dur)
        pos += step * (1 - 0.35 * pos / dur)
        k += 1
    write_audio("sfx/swell", swell)

    # Hit: a "stage clear" fanfare stab (major chord) with a noise crash.
    dur = 2.0
    hit = np.zeros(int(dur * SR))
    for note, duty in [(60, 0.5), (64, 0.25), (67, 0.25), (72, 0.125)]:
        place(hit, tone(midi(note), 1.4, duty=duty, decay=0.45, sustain=0.0, release=0.1), 0.0, 0.32)
    place(hit, tone(midi(36), 0.8, wave="triangle", decay=0.3, sustain=0.0), 0.0, 0.8)
    crash = noise(int(1.2 * SR), 2, rng) * env(int(1.2 * SR), decay=0.25, sustain=0.0)
    place(hit, crash, 0.0, 0.35)
    write_audio("sfx/hit", hit)
    print("  sfx typing, tick, chime, blip1-5, tap, whoosh, swell, hit")


# ---------------------------------------------------------------- music

# An original, bouncy platformer-style tune in C major, 8 bars that loop.
# Melody notes are (midi, length in 16th notes); None is a rest. Every bar adds up to 16.
MELODY = [
    [(76, 2), (79, 2), (84, 2), (79, 2), (81, 3), (79, 1), (76, 4)],              # C
    [(72, 2), (76, 2), (81, 2), (76, 2), (79, 3), (77, 1), (76, 4)],              # Am
    [(77, 2), (81, 2), (84, 2), (81, 2), (79, 2), (77, 2), (76, 2), (74, 2)],     # F
    [(74, 2), (79, 2), (83, 2), (86, 2), (84, 4), (None, 4)],                     # G
    [(76, 2), (79, 2), (84, 2), (79, 2), (81, 3), (79, 1), (76, 4)],              # C
    [(76, 2), (79, 2), (83, 2), (79, 2), (81, 2), (83, 2), (84, 4)],              # Em
    [(81, 2), (84, 2), (77, 2), (81, 2), (79, 2), (76, 2), (72, 2), (76, 2)],     # F
    [(74, 3), (76, 1), (77, 2), (74, 2), (79, 4), (None, 4)],                     # G
]
# Chord for each bar: root (for the bass) and chord tones (for the arpeggio).
CHORDS = [
    (48, [60, 64, 67]),
    (45, [57, 60, 64]),
    (41, [57, 60, 65]),
    (43, [59, 62, 67]),
    (48, [60, 64, 67]),
    (40, [59, 64, 67]),
    (41, [57, 60, 65]),
    (43, [59, 62, 67]),
]


def make_music(seconds: float = 120.0) -> None:
    """Chiptune bed: pulse-wave lead, a quiet pulse arpeggio, a bouncing triangle bass and noise drums."""
    rng = np.random.default_rng(7)
    bpm = 140
    six = 60 / bpm / 4  # one 16th note
    bar = six * 16
    n = int(seconds * SR)
    lead = np.zeros(n)
    arp = np.zeros(n)
    bass = np.zeros(n)
    drums = np.zeros(n)

    kick = tone(np.linspace(midi(45), midi(28), int(0.12 * SR)), 0.12, wave="triangle", decay=0.05, sustain=0.0)
    snare = noise(int(0.14 * SR), 2, rng) * env(int(0.14 * SR), decay=0.05, sustain=0.0)
    hat = noise(int(0.04 * SR), 1, rng) * env(int(0.04 * SR), decay=0.012, sustain=0.0)

    bars = int(np.ceil(seconds / bar))
    for b in range(bars):
        start = b * bar
        section = b // 8  # 0: intro (drums + bass), then the full tune
        root, tones = CHORDS[b % 8]

        # Bass: "oom-pah" bounce on 8th notes between the root, its octave and its fifth.
        for k, off in enumerate([0, 12, 7, 12, 0, 12, 7, 12]):
            place(bass, tone(midi(root + off), six * 1.8, wave="triangle", release=0.02), start + k * 2 * six, 0.5)

        # Drums: kick on 1 and 3, snare on 2 and 4, hats on the off-beats.
        for beat in range(4):
            t0 = start + beat * 4 * six
            place(drums, kick if beat % 2 == 0 else snare, t0, 0.55 if beat % 2 == 0 else 0.22)
            place(drums, hat, t0 + 2 * six, 0.12)

        if b < 2:
            continue  # two bars of groove before the tune comes in

        # Arpeggio: chord tones in 16ths, very quiet, thin 12.5% pulse.
        for k in range(16):
            note = tones[k % 3] + (12 if (k // 3) % 2 else 0)
            place(arp, tone(midi(note), six * 0.9, duty=0.125, decay=0.05, sustain=0.3), start + k * six, 0.07)

        # Lead melody (25% pulse). Every other pass is an octave lower for variety.
        pos = start
        shift = -12 if section % 2 == 1 else 0
        for note, length in MELODY[b % 8]:
            if note is not None:
                place(lead, tone(midi(note + shift), length * six * 0.92, duty=0.25, decay=0.18, sustain=0.6), pos, 0.2)
            pos += length * six

    # A little stereo spread, like a console with a cheap echo: lead and arp slightly delayed on one side.
    d = int(0.012 * SR)
    left = bass + drums + lead + arp
    right = bass + drums + np.roll(lead, d) * 0.95 + np.roll(arp, d)
    stereo = np.stack([left, right], axis=1)
    t = np.arange(n) / SR
    stereo *= (np.clip(t / 0.3, 0, 1) * np.clip((seconds - t) / 4, 0, 1))[:, None]
    write_audio("music", stereo, "160k")
    print(f"  music ({seconds:.0f}s, {bpm} bpm chiptune)")


if __name__ == "__main__":
    print("Narration:")
    vo = make_narration()
    print("Sound effects:")
    make_sfx()
    print("Music:")
    make_music()
    MANIFEST.write_text(json.dumps({"voice": VOICE, "vo": vo}, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {MANIFEST.relative_to(ROOT)}")
