"""Synthetic broadcast-angle basketball footage with exact ground truth.

The clips are generated entirely by this code, so they are owned outright and
safe to use in tests, demos and design reviews. They are *not* meant to look
like real NBA footage; they exist so the editing, rendering and computer-vision
pipelines can be validated without any licensed media.

Each scenario produces:
  <name>.mp4   1920x1080, 30 fps, H.264 (yuv420p), 8 s
  <name>.json  per-frame screen coordinates of every player and the ball, the
               camera pan, the decision frame and the actual pass target.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

W, H, FPS = 1920, 1080, 30

# --- Camera model -----------------------------------------------------------
# World: x along the court length (ft, 0..94), z depth from near sideline (0..50).
F = 1267.0  # focal length in px
CAM_D = 30.0  # camera distance behind the near sideline (ft)
CAM_H = 25.0  # camera height (ft)
HORIZON = -16.0


def project(x: float, z: float, y: float, cam_x: float) -> tuple[float, float]:
    """World point (x, z) at height y (ft) -> screen pixel."""
    d = z + CAM_D
    sx = W / 2 + (x - cam_x) * F / d
    sy = HORIZON + (CAM_H - y) * F / d
    return sx, sy


def scale_at(z: float) -> float:
    return F / (z + CAM_D)


# --- Scenario description ---------------------------------------------------
@dataclass
class Actor:
    id: str
    team: str  # 'off' | 'def'
    number: int
    keys: list[tuple[float, float, float]]  # (t, x, z)

    def pos(self, t: float) -> tuple[float, float]:
        ks = self.keys
        if t <= ks[0][0]:
            return ks[0][1], ks[0][2]
        for (t0, x0, z0), (t1, x1, z1) in zip(ks, ks[1:]):
            if t0 <= t <= t1:
                k = (t - t0) / (t1 - t0)
                k = k * k * (3 - 2 * k)
                return x0 + (x1 - x0) * k, z0 + (z1 - z0) * k
        return ks[-1][1], ks[-1][2]


@dataclass
class Scenario:
    name: str
    duration: float
    actors: list[Actor]
    handler: str
    receiver: str
    pass_start: float
    pass_end: float
    decision_time: float
    options: list[dict]  # label, actor, description
    actual_label: str
    notes: str
    interception: bool = False
    extra: dict = field(default_factory=dict)


def skip_pass_scenario() -> Scenario:
    """Drive-and-kick: weak-side help collapses, skip pass to the corner."""
    A = Actor
    actors = [
        A('o1', 'off', 7, [(0, 66, 24), (2.2, 72, 24), (3.9, 79, 25), (8, 80, 25)]),  # handler drives
        A('o2', 'off', 21, [(0, 70, 30), (1.2, 69, 29), (3.9, 82, 30), (8, 85, 28)]),  # screener rolls
        A('o3', 'off', 3, [(0, 66, 6), (8, 66, 6)]),  # near wing
        A('o4', 'off', 11, [(0, 88, 46), (3.9, 90, 47), (8, 90, 47)]),  # weak-side corner (actual)
        A('o5', 'off', 30, [(0, 72, 44), (3.9, 71, 43), (8, 71, 43)]),  # weak-side wing
        A('d1', 'def', 1, [(0, 68, 23), (2.2, 74, 23), (3.9, 80, 22.5), (8, 82, 24)]),
        A('d2', 'def', 4, [(0, 72, 29), (3.9, 84, 28), (8, 86, 27)]),
        A('d3', 'def', 8, [(0, 68, 8), (8, 68, 8)]),
        A('d4', 'def', 12, [(0, 86, 40), (3.2, 84, 31), (3.9, 84, 30), (4.6, 87, 40), (8, 89, 45)]),  # helps, then recovers late
        A('d5', 'def', 15, [(0, 74, 40), (8, 74, 40)]),
    ]
    return Scenario(
        name='synthetic_skip_pass',
        duration=8.0,
        actors=actors,
        handler='o1',
        receiver='o4',
        pass_start=4.0,
        pass_end=4.75,
        decision_time=3.9,
        options=[
            {'label': 'A', 'actor': 'o2', 'description': 'Roll man'},
            {'label': 'B', 'actor': 'o5', 'description': 'Weak-side wing'},
            {'label': 'C', 'actor': 'o4', 'description': 'Corner skip'},
            {'label': 'D', 'actor': 'o3', 'description': 'Near wing'},
        ],
        actual_label='C',
        notes='Weak-side corner defender (d4) helps on the drive, leaving the corner open for a skip pass.',
    )


def turnover_scenario() -> Scenario:
    """Lazy cross-court pass thrown straight into a defender's hands."""
    A = Actor
    actors = [
        A('o1', 'off', 2, [(0, 62, 18), (3.6, 66, 20), (8, 66, 20)]),
        A('o2', 'off', 9, [(0, 74, 26), (2.0, 82, 24), (3.6, 85, 22), (8, 86, 22)]),  # cutter, wide open
        A('o3', 'off', 14, [(0, 70, 5), (8, 71, 5)]),  # open shooter
        A('o4', 'off', 23, [(0, 72, 42), (8, 72, 42)]),  # far wing (fronted)
        A('o5', 'off', 33, [(0, 86, 44), (8, 86, 44)]),
        A('d1', 'def', 5, [(0, 64, 21), (3.6, 68, 22), (8, 68, 22)]),
        A('d2', 'def', 10, [(0, 76, 27), (8, 78, 27)]),
        A('d3', 'def', 17, [(0, 74, 10), (3.6, 76, 12), (8, 76, 12)]),  # sagged off the shooter
        A('d4', 'def', 20, [(0, 71, 37), (3.6, 70, 36), (4.4, 69.5, 33), (8, 66, 30)]),  # jumps the lane
        A('d5', 'def', 25, [(0, 84, 38), (8, 84, 38)]),
    ]
    return Scenario(
        name='synthetic_turnover',
        duration=8.0,
        actors=actors,
        handler='o1',
        receiver='d4',
        pass_start=3.7,
        pass_end=4.4,
        decision_time=3.6,
        options=[
            {'label': 'A', 'actor': 'o3', 'description': 'Open shooter'},
            {'label': 'B', 'actor': 'o2', 'description': 'Cutting teammate'},
            {'label': 'C', 'actor': 'd4', 'description': 'The defender'},
        ],
        actual_label='C',
        interception=True,
        notes='Handler ignores an open shooter and a free cutter and throws the cross-court pass into the defender.',
    )


SCENARIOS = {'skip_pass': skip_pass_scenario, 'turnover': turnover_scenario}

# --- Rendering --------------------------------------------------------------
WOOD_A = np.array([92, 140, 196], dtype=np.float32)  # BGR
WOOD_B = np.array([70, 115, 172], dtype=np.float32)
PAINT = (58, 46, 128)
LINE = (238, 240, 244)
OFF_COLOR = (240, 240, 240)
OFF_TRIM = (60, 40, 20)
DEF_COLOR = (130, 50, 25)
DEF_TRIM = (235, 200, 120)


def floor_poly(cam_x: float, pts: list[tuple[float, float]]) -> np.ndarray:
    return np.array([project(x, z, 0, cam_x) for x, z in pts], dtype=np.float32)


def draw_court(img: np.ndarray, cam_x: float, rng: np.random.Generator, grain: np.ndarray) -> None:
    # crowd / arena backdrop above the far sideline
    far_y = int(project(0, 50, 0, cam_x)[1])
    img[:] = (24, 20, 18)
    band = img[: max(0, far_y + 4)]
    if band.size:
        band[:] = (34, 28, 26)
        band += grain[: band.shape[0]]
    # wooden floor (draw large quad covering x 0..94)
    floor = floor_poly(cam_x, [(-10, -6), (110, -6), (110, 52), (-10, 52)]).astype(np.int32)
    mask = np.zeros((H, W), np.uint8)
    cv2.fillPoly(mask, [floor], 255)
    ys = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    wood = (WOOD_A * (1 - ys[..., None] * 0.35) + WOOD_B * ys[..., None] * 0.35).repeat(W, axis=1)
    # plank streaks that move with the camera
    xs = (np.arange(W, dtype=np.float32) + cam_x * 30) * 0.05
    streak = (np.sin(xs) * 6 + np.sin(xs * 0.37) * 4)[None, :, None]
    wood = np.clip(wood + streak, 0, 255).astype(np.uint8)
    img[mask > 0] = wood[mask > 0]

    def line(points, thick=4):
        p = floor_poly(cam_x, points).astype(np.int32)
        cv2.polylines(img, [p], False, LINE, thick, cv2.LINE_AA)

    # paint (key) near the right basket at x=94
    key = floor_poly(cam_x, [(75, 17), (94, 17), (94, 33), (75, 33)]).astype(np.int32)
    cv2.fillPoly(img, [key], PAINT, cv2.LINE_AA)
    line([(75, 17), (94, 17)]); line([(75, 33), (94, 33)]); line([(75, 17), (75, 33)])
    # free-throw circle
    line([(75 + 6 * math.cos(a), 25 + 6 * math.sin(a)) for a in np.linspace(math.pi / 2, 3 * math.pi / 2, 40)])
    # three-point line: corners at z=3 and z=47, arc radius 23.75 around basket (88.75, 25)
    bx, bz = 88.75, 25
    arc = [(bx + 23.75 * math.cos(a), bz + 23.75 * math.sin(a)) for a in np.linspace(math.pi - 1.18, math.pi + 1.18, 60)]
    line([(94, 3), (bx - 23.75 * math.cos(1.18) + 0.0, 3)])
    line(arc)
    line([(94, 47), (bx - 23.75 * math.cos(1.18), 47)])
    # boundaries + half-court line
    line([(0, 0), (94, 0)], 5); line([(0, 50), (94, 50)], 5); line([(94, 0), (94, 50)], 5); line([(47, 0), (47, 50)], 5)
    cc = [(47 + 6 * math.cos(a), 25 + 6 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 50)]
    line(cc)
    # hoop + backboard
    rim = floor_poly(cam_x, [(bx + 0.75 * math.cos(a), bz + 0.75 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 24)])
    rim[:, 1] -= 10 * scale_at(bz)
    cv2.polylines(img, [rim.astype(np.int32)], True, (40, 90, 235), 3, cv2.LINE_AA)
    bb_top = project(93, bz - 3, 13.5, cam_x)
    bb_bot = project(93, bz + 3, 9.5, cam_x)
    cv2.rectangle(img, (int(bb_top[0]) - 3, int(bb_top[1])), (int(bb_bot[0]) + 3, int(bb_bot[1])), (230, 230, 230), 3, cv2.LINE_AA)


def draw_player(img: np.ndarray, x: float, z: float, cam_x: float, team: str, number: int, phase: float) -> tuple[float, float, float]:
    s = scale_at(z)
    fx, fy = project(x, z, 0, cam_x)
    height = 6.6 * s
    width = 1.6 * s
    body, trim = (OFF_COLOR, OFF_TRIM) if team == 'off' else (DEF_COLOR, DEF_TRIM)
    skin = (80, 120, 170)
    # shadow
    cv2.ellipse(img, (int(fx), int(fy)), (int(width * 0.9), int(width * 0.28)), 0, 0, 360, (30, 40, 55), -1, cv2.LINE_AA)
    # legs (animated stride)
    stride = math.sin(phase) * width * 0.25
    for dx in (-width * 0.22 + stride, width * 0.22 - stride):
        cv2.line(img, (int(fx + dx), int(fy - height * 0.05)), (int(fx + dx * 0.6), int(fy - height * 0.45)), skin, max(2, int(width * 0.22)), cv2.LINE_AA)
    # shorts + jersey
    cv2.rectangle(img, (int(fx - width * 0.42), int(fy - height * 0.55)), (int(fx + width * 0.42), int(fy - height * 0.42)), body, -1, cv2.LINE_AA)
    torso = np.array([
        (fx - width * 0.5, fy - height * 0.82), (fx + width * 0.5, fy - height * 0.82),
        (fx + width * 0.42, fy - height * 0.54), (fx - width * 0.42, fy - height * 0.54),
    ], np.int32)
    cv2.fillPoly(img, [torso], body, cv2.LINE_AA)
    cv2.polylines(img, [torso], True, trim, max(1, int(s * 0.12)), cv2.LINE_AA)
    # arms
    for side in (-1, 1):
        cv2.line(img, (int(fx + side * width * 0.5), int(fy - height * 0.8)), (int(fx + side * width * 0.7), int(fy - height * 0.55)), skin, max(2, int(width * 0.18)), cv2.LINE_AA)
    # head
    cv2.circle(img, (int(fx), int(fy - height * 0.9)), int(width * 0.3), skin, -1, cv2.LINE_AA)
    # number
    txt = str(number)
    fs = max(0.3, s / 42)
    (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_DUPLEX, fs, 1)
    cv2.putText(img, txt, (int(fx - tw / 2), int(fy - height * 0.66 + th / 2)), cv2.FONT_HERSHEY_DUPLEX, fs, trim, max(1, int(fs * 1.6)), cv2.LINE_AA)
    return fx, fy, height


def ball_world(sc: Scenario, t: float, actors: dict[str, Actor]) -> tuple[float, float, float]:
    if t < sc.pass_start:
        x, z = actors[sc.handler].pos(t)
        dribble = abs(math.sin(t * math.pi * 2.4)) * 2.6 + 0.4
        return x + 0.6, z - 0.8, dribble
    if t < sc.pass_end:
        k = (t - sc.pass_start) / (sc.pass_end - sc.pass_start)
        x0, z0 = actors[sc.handler].pos(sc.pass_start)
        x1, z1 = actors[sc.receiver].pos(sc.pass_end)
        y = 4.5 + 5.0 * math.sin(math.pi * k)
        return x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, y
    x, z = actors[sc.receiver].pos(t)
    return x + 0.5, z - 0.6, 4.0


def render(sc: Scenario, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    mp4 = out_dir / f'{sc.name}.mp4'
    actors = {a.id: a for a in sc.actors}
    rng = np.random.default_rng(7)
    grain = rng.integers(-10, 10, size=(H, W, 3), dtype=np.int16).clip(-10, 10).astype(np.uint8)
    n = int(sc.duration * FPS)
    cmd = [
        'ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '15', '-movflags', '+faststart', str(mp4),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    frames = []
    cam_x = None
    for i in range(n):
        t = i / FPS
        bx, bz, by = ball_world(sc, t, actors)
        target = bx - 2  # broadcast camera follows the ball, smoothed
        cam_x = target if cam_x is None else cam_x + (target - cam_x) * 0.06
        img = np.zeros((H, W, 3), np.uint8)
        draw_court(img, cam_x, rng, grain)
        frame_gt = {'t': round(t, 4), 'cam_x': round(cam_x, 3), 'players': {}, 'ball': None}
        # depth sort: far players first
        order = sorted(sc.actors, key=lambda a: -a.pos(t)[1])
        ball_drawn = False
        bsx, bsy = project(bx, bz, by, cam_x)
        for a in order:
            x, z = a.pos(t)
            if not ball_drawn and z < bz:
                _draw_ball(img, bsx, bsy, scale_at(bz)); ball_drawn = True
            fx, fy, hgt = draw_player(img, x, z, cam_x, a.team, a.number, t * 9 + hash(a.id) % 7)
            frame_gt['players'][a.id] = {'x': round(fx, 1), 'y': round(fy, 1), 'h': round(hgt, 1), 'team': a.team}
        if not ball_drawn:
            _draw_ball(img, bsx, bsy, scale_at(bz))
        frame_gt['ball'] = {'x': round(bsx, 1), 'y': round(bsy, 1)}
        # light sensor noise so the footage is not perfectly flat
        noise = rng.normal(0, 2.0, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        # broadcast-style watermark noting the footage is synthetic
        cv2.putText(img, 'SYNTHETIC TEST FOOTAGE', (40, H - 36), cv2.FONT_HERSHEY_DUPLEX, 0.8, (210, 210, 210), 1, cv2.LINE_AA)
        proc.stdin.write(img.tobytes())
        frames.append(frame_gt)
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError('ffmpeg failed')

    dframe = int(round(sc.decision_time * FPS))
    gt_d = frames[dframe]
    handler = gt_d['players'][sc.handler]
    opts = []
    for o in sc.options:
        p = gt_d['players'][o['actor']]
        opts.append({'label': o['label'], 'description': o['description'], 'actor': o['actor'], 'x': round(p['x'] / W, 4), 'y': round(p['y'] / H, 4)})
    gt = {
        'name': sc.name,
        'generator': 'tiresias_analysis.fixtures.synthetic_court',
        'rights': {'status': 'owned', 'holder': 'Tiresias Content Engine (generated)', 'notes': 'Procedurally generated; no third-party footage.'},
        'width': W, 'height': H, 'fps': FPS, 'duration': sc.duration,
        'decision': {'time': sc.decision_time, 'frame': dframe, 'handler': {'x': round(handler['x'] / W, 4), 'y': round(handler['y'] / H, 4)}},
        'options': opts,
        'actual_label': sc.actual_label,
        'pass': {'start': sc.pass_start, 'end': sc.pass_end, 'from': sc.handler, 'to': sc.receiver, 'interception': sc.interception},
        'notes': sc.notes,
        'frames': frames,
    }
    (out_dir / f'{sc.name}.json').write_text(json.dumps(gt))
    return gt


def _draw_ball(img, x, y, s):
    r = max(4, int(0.62 * s))
    cv2.circle(img, (int(x), int(y)), r, (30, 110, 230), -1, cv2.LINE_AA)
    cv2.circle(img, (int(x), int(y)), r, (20, 50, 110), 1, cv2.LINE_AA)
    cv2.line(img, (int(x - r), int(y)), (int(x + r), int(y)), (20, 50, 110), 1, cv2.LINE_AA)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out', default='fixtures')
    ap.add_argument('--scenario', choices=[*SCENARIOS, 'all'], default='all')
    args = ap.parse_args()
    names = list(SCENARIOS) if args.scenario == 'all' else [args.scenario]
    for n in names:
        gt = render(SCENARIOS[n](), Path(args.out))
        print(f"wrote {args.out}/{gt['name']}.mp4 (+ .json), decision frame {gt['decision']['frame']}, actual {gt['actual_label']}")


if __name__ == '__main__':
    main()
