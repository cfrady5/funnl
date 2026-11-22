"""Procedurally generated sound effects (owned outright, no licensing needed).

Writes 48 kHz stereo 16-bit WAVs used by the Remotion compositions.
Deterministic: the same seed always yields byte-identical files.
"""
from __future__ import annotations

import argparse
import wave
from pathlib import Path

import numpy as np

SR = 48_000


def env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def tone(freq: float, dur: float, decay: float, attack=0.002, harmonics=((1, 1.0),)) -> np.ndarray:
    n = int(SR * dur)
    t = np.arange(n) / SR
    sig = sum(amp * np.sin(2 * np.pi * freq * h * t) for h, amp in harmonics)
    return sig * env(n, attack, decay)


def lowpass(x: np.ndarray, alpha: float) -> np.ndarray:
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def noise_sweep(dur: float, rng, start=0.02, end=0.4, rise=True) -> np.ndarray:
    n = int(SR * dur)
    white = rng.standard_normal(n)
    alphas = np.linspace(start, end, n) if rise else np.linspace(end, start, n)
    y = np.empty(n)
    acc = 0.0
    for i in range(n):
        acc += alphas[i] * (white[i] - acc)
        y[i] = acc
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return y * shape


def normalize(x: np.ndarray, peak_db=-3.0) -> np.ndarray:
    peak = np.max(np.abs(x)) or 1.0
    return x / peak * (10 ** (peak_db / 20))


def write(path: Path, mono: np.ndarray, width=0.0) -> None:
    left = mono
    right = np.roll(mono, int(width * SR / 1000)) if width else mono
    stereo = np.stack([left, right], axis=1)
    pcm = (np.clip(stereo, -1, 1) * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def build(out: Path) -> list[str]:
    rng = np.random.default_rng(1337)
    out.mkdir(parents=True, exist_ok=True)
    files: dict[str, np.ndarray] = {}
    # Tiresias: restrained, precise.
    files['tick'] = normalize(tone(1760, 0.12, 0.025, harmonics=((1, 1), (2, 0.25))), -8)
    files['tick-final'] = normalize(tone(2349, 0.25, 0.06, harmonics=((1, 1), (1.5, 0.3))), -6)
    files['whoosh'] = normalize(noise_sweep(0.45, rng, 0.01, 0.35), -10)
    hit = tone(55, 0.9, 0.28, attack=0.004, harmonics=((1, 1), (2, 0.4))) + 0.25 * noise_sweep(0.9, rng, 0.3, 0.02, rise=False)
    files['reveal'] = normalize(hit, -4)
    files['freeze'] = normalize(tone(880, 0.35, 0.09, harmonics=((1, 1), (3, 0.2))) + 0.3 * noise_sweep(0.35, rng, 0.2, 0.02, False), -9)
    files['outro'] = normalize(tone(440, 1.2, 0.45, attack=0.03, harmonics=((1, 1), (1.5, 0.5), (2, 0.25))), -10)
    # AntiTiresias: louder, sillier.
    n = int(SR * 0.55)
    t = np.arange(n) / SR
    saw = 2 * (t * 140 % 1) - 1
    files['buzzer'] = normalize(saw * env(n, 0.005, 0.35), -6)
    f = np.linspace(900, 180, int(SR * 0.6))
    files['boing'] = normalize(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(f), 0.003, 0.25), -6)
    files['stamp'] = normalize(tone(70, 0.5, 0.12, attack=0.001) + 0.6 * noise_sweep(0.5, rng, 0.5, 0.05, False), -3)
    for name, sig in files.items():
        write(out / f'{name}.wav', sig, width=0.4)
    return sorted(files)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='packages/video/public/sfx')
    names = build(Path(ap.parse_args().out))
    print('wrote', ', '.join(names))


if __name__ == '__main__':
    main()
