"""Acceptance gates for generated geometry, using dense coast solutions and replay."""
import numpy as np
from model import jacobi, propagate


def minimum_altitude(coast, center, radius_km, model):
    # DOP853 dense output is degree seven on each accepted interval. Fit the
    # same polynomial at eight Chebyshev nodes, then find every stationary
    # distance on that interval. This avoids missing multiple extrema in a step.
    candidates = [float(coast.t[0]), float(coast.t[-1])]
    nodes = np.cos(np.pi*(np.arange(8)+.5)/8)
    for left, right in zip(coast.t[:-1], coast.t[1:]):
        times = (left+right)/2+(right-left)*nodes/2
        # Use only the public dense-output callable, not SciPy internal fields.
        positions = np.column_stack([coast.sol(t)[:2]-center for t in times])
        px = np.polynomial.Chebyshev.fit(nodes, positions[0], 7, domain=[-1, 1])
        py = np.polynomial.Chebyshev.fit(nodes, positions[1], 7, domain=[-1, 1])
        roots = (px*px+py*py).deriv().roots()
        for root in roots:
            if abs(np.imag(root)) < 1e-7 and -1 <= np.real(root) <= 1:
                candidates.append(float((left+right)/2+(right-left)*np.real(root)/2))
    distances = [float(np.linalg.norm(coast.sol(t)[:2]-center)) for t in candidates]
    index = int(np.argmin(distances))
    return {'altitude_km': distances[index]*model.distance_km-radius_km,
            'time_nd': candidates[index]}


def validate(model, config, coasts, burns):
    failures = []
    report = {'coasts': [], 'burns': []}
    for index, coast in enumerate(coasts):
        if not coast.success or coast.status != 0 or not np.isfinite(coast.y).all():
            failures.append(f'Coast {index+1} did not integrate completely.')
        grid = np.unique(np.r_[coast.t, np.linspace(0., coast.t[-1], 513)])
        c = jacobi(coast.sol(grid).T, model)
        drift = float(np.max(np.abs(c-c[0])))
        earth = minimum_altitude(coast, model.earth, model.earth_radius_km, model)
        moon = minimum_altitude(coast, model.moon, model.moon_radius_km, model)
        if drift > config['jacobi_drift_tolerance']:
            failures.append(f'Coast {index+1} Jacobi drift exceeds tolerance.')
        if earth['altitude_km'] < 0:
            failures.append(f'Coast {index+1} intersects Earth.')
        if moon['altitude_km'] < config['minimum_lunar_altitude_km']:
            failures.append(f'Coast {index+1} violates the minimum lunar altitude.')
        report['coasts'].append({'jacobi_drift': drift, 'minimum_earth': earth, 'minimum_moon': moon})
    for burn in burns:
        before, after = burn['before'], burn['after']
        gap = float(np.linalg.norm(after[:2]-before[:2])*model.distance_km)
        dv = after[2:]-before[2:]
        if gap > config['position_tolerance_km']:
            failures.append(f"Burn {burn['name']} changes position discontinuously.")
        report['burns'].append({'name': burn['name'], 'position_gap_km': gap,
                               'delta_v_km_s': float(np.linalg.norm(dv)*model.velocity_km_s)})
    node_gap = float(np.linalg.norm(coasts[0].y[:2, -1]-coasts[1].y[:2, 0])*model.distance_km)
    target_error = float(np.linalg.norm(coasts[-1].y[:2, -1]-model.l4)*model.distance_km)
    final_speed = float(np.linalg.norm(burns[-1]['after'][2:])*model.velocity_km_s)
    if node_gap > config['position_tolerance_km'] or target_error > config['position_tolerance_km']:
        failures.append('Node or terminal position error exceeds tolerance.')
    if final_speed > config['velocity_tolerance_km_s']:
        failures.append('Post-insertion rotating velocity exceeds tolerance.')
    # Replay the full flight at tighter tolerance, applying the saved velocity
    # jump to its actual lunar endpoint rather than resetting the position.
    replay1 = propagate(burns[0]['after'], coasts[0].t[-1], model,
                        rtol=config['check_rtol'], atol=config['check_atol'])
    moon_replay_gap = float(np.linalg.norm(replay1.y[:2, -1]-coasts[1].y[:2, 0])*model.distance_km)
    replay_start = replay1.y[:, -1].copy()
    replay_start[2:] += burns[1]['after'][2:]-burns[1]['before'][2:]
    replay2 = propagate(replay_start, coasts[1].t[-1], model,
                        rtol=config['check_rtol'], atol=config['check_atol'])
    replay_target_error = float(np.linalg.norm(replay2.y[:2, -1]-model.l4)*model.distance_km)
    replay_final_speed = float(np.linalg.norm(replay2.y[2:, -1]+burns[-1]['after'][2:]-burns[-1]['before'][2:])*model.velocity_km_s)
    if max(moon_replay_gap, replay_target_error) > config['position_tolerance_km']:
        failures.append('Independent forward replay exceeds the position tolerance.')
    if replay_final_speed > config['velocity_tolerance_km_s']:
        failures.append('Independent forward replay exceeds the final velocity tolerance.')
    radial_rate = float((burns[1]['before'][:2]-model.moon) @ burns[1]['before'][2:])
    if abs(radial_rate) > 1e-8:
        failures.append('The lunar maneuver is not at a lunar apsis.')
    report.update({'node_gap_km': node_gap, 'target_error_km': target_error,
                   'post_insertion_speed_km_s': final_speed, 'lunar_radial_rate_nd': radial_rate,
                   'independent_replay': {'lunar_position_error_km': moon_replay_gap,
                       'terminal_position_error_km': replay_target_error,
                       'post_insertion_speed_km_s': replay_final_speed},
                   'accepted': not failures, 'failures': failures})
    return report
