"""Owned transparent player cutout (RGBA PNG) for testing the cover breakout layout."""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

from .synthetic_court import CAM_D, draw_player, project


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='fixtures/synthetic_player_cutout.png')
    args = ap.parse_args()
    target_h = 1300.0
    z = 1267.0 * 6.6 / target_h - CAM_D  # depth giving a ~1300 px tall figure
    fx, fy = project(0.0, z, 0, 0.0)
    img = np.zeros((int(fy) + 200, 1920, 3), np.uint8)
    fx, fy, h = draw_player(img, 0.0, z, 0.0, 'off', 7, 0.6)
    crop = img[max(0, int(fy - h * 1.05)):int(fy + 40), int(fx - 520):int(fx + 520)]
    mask = (crop.max(axis=2) > 0).astype(np.uint8) * 255
    mask = cv2.GaussianBlur(mask, (3, 3), 0)
    rgba = np.dstack([crop, mask])
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(args.out, rgba)
    print('wrote', args.out, rgba.shape)


if __name__ == '__main__':
    main()
