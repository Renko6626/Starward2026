"""Solve and publish a validated lunar-assisted trajectory and inspection figures."""
import argparse
from dataclasses import asdict
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from model import Model, osculating_earth_orbit
from solver import solve
from validation import validate

ROOT = Path(__file__).resolve().parents[2]
DESTINATION = ROOT/'docs/design/orbit-transfer'
FRONTEND = ROOT/'src/app/components/orbital-transfer.json'


def load_config():
    config = json.loads((Path(__file__).with_name('config.json')).read_text())
    model = Model(**config['model'])
    if not all(math.isfinite(v) and v > 0 for v in asdict(model).values()):
        raise ValueError('All model parameters must be positive finite numbers.')
    for name, value in config.items():
        if name != 'model' and (not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0):
            raise ValueError(f'{name} must be positive and finite.')
    if model.flyby_altitude_km < config['minimum_lunar_altitude_km']:
        raise ValueError('Target flyby altitude is below the minimum allowed altitude.')
    if config['check_rtol'] >= config['rtol'] or config['check_atol'] >= config['atol']:
        raise ValueError('Independent replay must use tighter integration tolerances.')
    return model, config


def sample_coast(coast):
    # Keep integrator steps around close approaches as well as a uniform grid.
    times = np.unique(np.r_[coast.t, np.linspace(0., coast.t[-1], 401)])
    return times, coast.sol(times).T


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False)+'\n')


def inspection_plot(model, coasts, burns, reference, staged):
    fig, ax = plt.subplots(figsize=(10, 7))
    if reference is not None:
        xy = (np.array(reference['points'])-model.earth)*model.distance_km
        ax.plot(xy[:, 0], xy[:, 1], '--', color='#999', linewidth=.8,
                label='Departure osculating ellipse (frozen axes)')
    for index, coast in enumerate(coasts):
        _, states = sample_coast(coast)
        xy = (states[:, :2]-model.earth)*model.distance_km
        ax.plot(xy[:, 0], xy[:, 1], color='#333333' if index == 0 else '#737373',
                linewidth=1.25, label='Earth → Moon' if index == 0 else 'Moon → L4')
    for point, label in ((model.earth, 'Earth'), (model.moon, 'Moon'), (model.l4, 'L4')):
        xy = (point-model.earth)*model.distance_km
        ax.plot(*xy, 'o', color='black', markersize=4)
        ax.annotate(label, xy, xytext=(8, 8), textcoords='offset points')
    triangle = (np.array([model.earth, model.moon, model.l4, model.earth])-model.earth)*model.distance_km
    ax.plot(triangle[:, 0], triangle[:, 1], '--', color='#aaa', linewidth=.6)
    for index, burn in enumerate(burns):
        xy = (burn['after'][:2]-model.earth)*model.distance_km
        ax.scatter(*xy, s=25, facecolor='white', edgecolor='black', zorder=4)
        ax.annotate(f'Δv{index+1}', xy, xytext=(8, -15), textcoords='offset points', fontsize=9)
    ax.set(xlabel='Earth-relative x [km]', ylabel='y [km]', title='Planar CR3BP: powered lunar assist to ideal L4')
    ax.set_aspect('equal', adjustable='datalim')
    ax.grid(color='#ddd', linewidth=.5)
    ax.legend(loc='best', fontsize=9)
    # Inspect the close approach with actual scale, rather than enlarging it in
    # the trajectory geometry sent to the homepage.
    zoom = ax.inset_axes([.06, .65, .25, .29])
    for coast in coasts:
        times = np.unique(np.r_[coast.t, np.linspace(0., coast.t[-1], 1001)])
        xy = (coast.sol(times).T[:, :2]-model.moon)*model.distance_km
        zoom.plot(xy[:, 0], xy[:, 1], color='#555', linewidth=.9)
    zoom.add_patch(plt.Circle((0, 0), model.moon_radius_km, color='#ddd'))
    p = (burns[1]['after'][:2]-model.moon)*model.distance_km
    zoom.plot(*p, 'o', color='black', markersize=3)
    zoom.set(xlim=(-5500, 5500), ylim=(-5500, 5500), title='Lunar encounter [km]')
    zoom.set_aspect('equal'); zoom.tick_params(labelsize=6)
    fig.tight_layout()
    fig.savefig(staged/'preview.svg', metadata={'Date': None})
    svg = staged/'preview.svg'
    svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
    fig.savefig(staged/'preview.png', dpi=150)
    plt.close(fig)


def publish(staged, frontend_file):
    """Swap the owned report directory, then its matching frontend payload."""
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND.parent.mkdir(parents=True, exist_ok=True)
    backup = staged.parent/'previous-report'
    previous = DESTINATION.exists()
    if previous:
        os.replace(DESTINATION, backup)
    try:
        os.replace(staged, DESTINATION)
        os.replace(frontend_file, FRONTEND)
    except Exception:
        if DESTINATION.exists():
            shutil.rmtree(DESTINATION)
        if previous:
            os.replace(backup, DESTINATION)
        raise


def generate(fingerprint):
    required = {}
    for line in Path(__file__).with_name('requirements.txt').read_text().splitlines():
        if line.strip():
            name, version = line.split('==')
            installed = importlib.metadata.version(name)
            if installed != version:
                raise ValueError(f'{name} version {installed}; install the pinned orbit requirements ({version}).')
            required[name] = installed
    model, config = load_config()
    coasts, burns, details = solve(model, config)
    report = validate(model, config, coasts, burns)
    if not report['accepted']:
        raise RuntimeError('Trajectory rejected; previous artifacts preserved.\n'+json.dumps(report, indent=2))
    reference = osculating_earth_orbit(burns[0]['after'], model)
    raw = {'frame': 'barycentric Earth–Moon rotating, nondimensional', 'model': asdict(model),
           'referenceOrbit': reference,
           'units': {'distance_km': model.distance_km, 'time_seconds': model.time_s,
                     'velocity_km_s': model.velocity_km_s}, 'arcs': [], 'burns': []}
    visual = {'schema': 1, 'inputFingerprint': fingerprint,
              'frame': 'barycentric Earth–Moon rotating, nondimensional',
              'bodies': {'earth': model.earth.tolist(), 'moon': model.moon.tolist(), 'l4': model.l4.tolist()},
              'parkingRadius': model.parking_radius,
              'radii': {'earth': model.earth_radius_km/model.distance_km, 'moon': model.moon_radius_km/model.distance_km},
              'referenceOrbit': reference, 'arcs': [], 'burns': []}
    offset = 0.
    for coast in coasts:
        times, states = sample_coast(coast)
        raw['arcs'].append({'time_nd': (times+offset).tolist(), 'states': states.tolist()})
        visual['arcs'].append(states[:, :2].tolist())
        offset += float(coast.t[-1])
    for burn in burns:
        dv = burn['after'][2:]-burn['before'][2:]
        raw['burns'].append({'name': burn['name'], 'time_nd': burn['time_nd'],
                             'before': burn['before'].tolist(), 'after': burn['after'].tolist(),
                             'delta_v_nd': dv.tolist(),
                             'delta_v_km_s': float(np.linalg.norm(dv)*model.velocity_km_s)})
        visual['burns'].append({'name': burn['name'], 'position': burn['after'][:2].tolist(),
                               'deltaV': dv.tolist()})
    report.update({'inputFingerprint': fingerprint, 'config': config, 'dependencies': required,
                   'solver': details, 'total_days': offset*model.time_s/86400,
                   'total_delta_v_km_s': sum(b['delta_v_km_s'] for b in raw['burns']),
                   'assumptions': ['Planar circular Earth–Moon model; no solar perturbation or ephemeris.',
                       'Instantaneous impulses; target ideal L4 with zero rotating velocity.',
                       'Feasible corrected trajectory; no global-optimum or calendar launch-window claim.']})
    visual['metadata'] = {
        'flightDays': report['total_days'],
        'totalDeltaVKmS': report['total_delta_v_km_s'],
        'parkingAltitudeKm': model.parking_altitude_km,
        'lunarAltitudeKm': min(c['minimum_moon']['altitude_km'] for c in report['coasts']),
        'lunarDeltaVKmS': raw['burns'][1]['delta_v_km_s'],
    }
    with tempfile.TemporaryDirectory(prefix='.orbit-build-', dir=ROOT) as work:
        work = Path(work); staged = work/'report'; staged.mkdir()
        write_json(staged/'trajectory.json', raw)
        frontend = work/'orbital-transfer.json'; write_json(frontend, visual)
        plt.rcParams['svg.hashsalt'] = fingerprint
        inspection_plot(model, coasts, burns, reference, staged)
        report['sha256'] = {file: hashlib.sha256((staged/file).read_bytes()).hexdigest()
                            for file in ['trajectory.json', 'preview.svg', 'preview.png']}
        report['frontendSha256'] = hashlib.sha256(frontend.read_bytes()).hexdigest()
        write_json(staged/'validation.json', report)
        current = subprocess.check_output(['node', str(ROOT/'scripts/orbit-assets.mjs'), '--fingerprint'], text=True).strip()
        if current != fingerprint:
            raise RuntimeError('Sources or parameters changed during generation; previous artifacts preserved. Run orbit:generate again.')
        publish(staged, frontend)
    print(f"Accepted lunar-assisted transfer: {report['total_days']:.4f} days, Δv {report['total_delta_v_km_s']:.4f} km/s")
    print(f"Independent replay L4 position error: {report['independent_replay']['terminal_position_error_km']*1000:.2f} m")
    print(f"Lunar minimum altitude: {min(c['minimum_moon']['altitude_km'] for c in report['coasts']):.3f} km")
    print('Generated: docs/design/orbit-transfer/ and src/app/components/orbital-transfer.json')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--fingerprint', required=True)
    args = parser.parse_args()
    try:
        generate(args.fingerprint)
    except Exception as error:
        parser.exit(1, str(error)+'\n')
