"""A feasible two-coast, three-impulse lunar-assisted transfer, not global optimization."""
import math
import numpy as np
from scipy.optimize import root
from model import Model, parking_state, propagate


def solve_inbound(model, config):
    """Backward shooting from a retrograde lunar periapsis to a prograde LEO periapsis."""
    def earth_periapsis(_time, state):
        return float((state[:2]-model.earth) @ state[2:])
    earth_periapsis.terminal = True
    earth_periapsis.direction = -1  # Positive to negative while integrating backward.

    def evaluate(parameters):
        angle, speed = parameters
        radial = np.array([math.cos(angle), math.sin(angle)])
        state = np.r_[model.moon+model.flyby_radius*radial,
                      speed*np.array([radial[1], -radial[0]])]
        result = propagate(state, -2., model, events=earth_periapsis,
                           rtol=config['rtol'], atol=config['atol'])
        if not len(result.t_events[0]):
            raise ValueError('Backward coast did not reach an Earth periapsis.')
        departure = result.y_events[0][0]
        duration = -float(result.t_events[0][0])
        return state, departure, duration

    def residual(parameters):
        angle, speed = parameters
        if not np.isfinite(parameters).all() or not 1.5 < speed < 3.5:
            return np.array([10., 10.])
        try:
            _, departure, duration = evaluate(parameters)
            return [(np.linalg.norm(departure[:2]-model.earth)-model.parking_radius)/model.parking_radius,
                    (duration*model.time_s/86400-config['inbound_days'])/config['inbound_days']]
        except (ValueError, RuntimeError, FloatingPointError):
            return np.array([10., 10.])

    for guess in ([1.93*math.pi, 2.4], [1.90*math.pi, 2.35], [1.95*math.pi, 2.4]):
        solution = root(residual, guess, tol=2e-10, options={'maxfev': 160})
        if np.linalg.norm(residual(solution.x)) > 1e-8:
            continue
        _, departure, duration = evaluate(solution.x)
        radial = departure[:2]-model.earth
        angular_momentum = radial[0]*departure[3]-radial[1]*departure[2]
        if angular_momentum <= 0:
            continue
        # Replay forward; its actual endpoint becomes the common lunar node.
        coast = propagate(departure, duration, model, rtol=config['rtol'], atol=config['atol'])
        return coast, {'evaluations': int(solution.nfev), 'residual_norm': float(np.linalg.norm(solution.fun)),
                       'lunar_phase_rad': float(solution.x[0]), 'lunar_incoming_speed_nd': float(solution.x[1])}
    raise RuntimeError('No prograde LEO-to-Moon solution met the shooting constraints.')


def solve_outbound(model, lunar_state, config):
    """Correct the tangential post-flyby speed and coast duration to reach ideal L4."""
    direction = lunar_state[2:]/np.linalg.norm(lunar_state[2:])
    lower_speed = math.sqrt(model.mu/model.flyby_radius)+.02

    def evaluate(parameters):
        speed, duration = parameters
        state = np.r_[lunar_state[:2], speed*direction]
        return propagate(state, duration, model, rtol=config['rtol'], atol=config['atol'])

    def residual(parameters):
        speed, duration = parameters
        if not np.isfinite(parameters).all() or not lower_speed < speed < 3.5 or not .3 < duration < 10:
            return np.array([10., 10.])
        try:
            return evaluate(parameters).y[:2, -1]-model.l4
        except (ValueError, RuntimeError, FloatingPointError):
            return np.array([10., 10.])

    seed_speed = float(np.linalg.norm(lunar_state[2:])-.18/model.velocity_km_s)
    for days in (config['outbound_seed_days'], 10., 22.):
        guess = [seed_speed, days*86400/model.time_s]
        solution = root(residual, guess, tol=2e-10, options={'maxfev': 160})
        if np.linalg.norm(residual(solution.x))*model.distance_km > config['position_tolerance_km']/10:
            continue
        coast = evaluate(solution.x)
        return coast, {'evaluations': int(solution.nfev), 'residual_norm': float(np.linalg.norm(solution.fun)),
                       'lunar_outgoing_speed_nd': float(solution.x[0])}
    raise RuntimeError('No Moon-to-L4 solution met the terminal constraint.')


def solve(model, config):
    coast1, inbound = solve_inbound(model, config)
    coast2, outbound = solve_outbound(model, coast1.y[:, -1], config)
    departure = coast1.y[:, 0]
    angle = math.atan2(departure[1], departure[0]+model.mu)
    before_departure = parking_state(angle, model)
    arrival = coast2.y[:, -1]
    after_arrival = np.r_[arrival[:2], [0., 0.]]
    burns = [
        {'name': 'departure', 'time_nd': 0., 'before': before_departure, 'after': departure},
        {'name': 'lunar_assist', 'time_nd': float(coast1.t[-1]), 'before': coast1.y[:, -1], 'after': coast2.y[:, 0]},
        {'name': 'arrival', 'time_nd': float(coast1.t[-1]+coast2.t[-1]), 'before': arrival, 'after': after_arrival},
    ]
    return [coast1, coast2], burns, {'inbound': inbound, 'outbound': outbound}
