"""Análisis exploratorio: RMS y frecuencia dominante en .mat del laboratorio."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from scipy.io import loadmat
from scipy.signal import welch

_backend = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend))


def analyze(path: Path) -> dict:
    m = loadmat(path, squeeze_me=True, struct_as_record=False)
    fs = float(np.squeeze(m["fs_real"]))
    sx = np.squeeze(m["senal_x"]).astype(float)
    sy = np.squeeze(m["senal_y"]).astype(float)
    sz = np.squeeze(m["senal_z"]).astype(float)
    n = min(len(sx), len(sy), len(sz))
    t_sec = n / fs
    rx = float(np.squeeze(m["rms_x"]))
    ry = float(np.squeeze(m["rms_y"]))
    rz = float(np.squeeze(m["rms_z"]))
    vib = (rx**2 + ry**2 + rz**2) ** 0.5

    win = int(fs * 0.5)
    rms_series = []
    for start in range(0, n, win):
        chunk = sz[start : start + win]
        if len(chunk) < win // 2:
            continue
        rms_series.append(float(np.sqrt(np.mean(chunk**2))))
    rms_series = np.array(rms_series)

    f, pxx = welch(sz[:n], fs=fs, nperseg=min(4096, n))
    band = (f >= 8) & (f <= 150)
    bi = int(np.argmax(pxx[band]))
    f_dom = float(f[band][bi])
    rpm_2nd = round(f_dom * 30)  # 4 cil 4T, pico = 2.º orden
    rpm_1st = round(f_dom * 60)

    return {
        "file": path.name,
        "sec": round(t_sec, 1),
        "rms_mat": round(vib, 4),
        "rms_win_min": round(float(rms_series.min()), 4) if len(rms_series) else 0,
        "rms_win_max": round(float(rms_series.max()), 4) if len(rms_series) else 0,
        "rms_win_std": round(float(rms_series.std()), 4) if len(rms_series) else 0,
        "f_dom_hz": round(f_dom, 2),
        "rpm_2nd": rpm_2nd,
        "rpm_1st": rpm_1st,
    }


def main() -> None:
    dirp = Path(r"C:\Users\ASUS\Desktop\Datos")
    files = sorted(dirp.glob("*.mat"), key=lambda p: p.name.lower())
    hdr = (
        "archivo                  dur   RMS3D   vent_min-max      std_vent  f_Hz   RPM~2o  RPM~1o"
    )
    print(hdr)
    print("-" * len(hdr))
    for p in files:
        d = analyze(p)
        print(
            f"{d['file'][:24]:24} {d['sec']:5.1f} {d['rms_mat']:7.4f} "
            f"{d['rms_win_min']:.4f}-{d['rms_win_max']:.4f}  {d['rms_win_std']:7.4f} "
            f"{d['f_dom_hz']:6.2f} {d['rpm_2nd']:7} {d['rpm_1st']:7}"
        )


if __name__ == "__main__":
    main()
