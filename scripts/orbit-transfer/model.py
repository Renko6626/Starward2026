"""Planar Earth–Moon CR3BP, barycentric rotating coordinates, normalized units."""
from dataclasses import dataclass
import math
import numpy as np
from scipy.integrate import solve_ivp


@dataclass(frozen=True)
class Model:
    distance_km: float = 384748.91  # Ren et al. Table 1, chosen circular separation.
    earth_gm: float = 398600.435507  # JPL DE440, km^3/s^2.
    moon_gm: float = 4902.800118
    earth_radius_km: float = 6378.1363
    moon_radius_km: float = 1738.1
    parking_altitude_km: float = 200.0
    flyby_altitude_km: float = 150.0

    @property
    def mu(self):
        return self.moon_gm / (self.earth_gm + self.moon_gm)

    @property
    def time_s(self):
        return math.sqrt(self.distance_km**3 / (self.earth_gm + self.moon_gm))

    @property
    def velocity_km_s(self):
        return self.distance_km / self.time_s

    @property
    def earth(self):
        return np.array([-self.mu, 0.])

    @property
    def moon(self):
        return np.array([1-self.mu, 0.])

    @property
    def l4(self):
        return np.array([.5-self.mu, math.sqrt(3)/2])

    @property
    def parking_radius(self):
        return (self.earth_radius_km + self.parking_altitude_km) / self.distance_km

    @property
    def flyby_radius(self):
        return (self.moon_radius_km + self.flyby_altitude_km) / self.distance_km


def rhs(_time, state, model):
    x, y, vx, vy = state
    dx1, dx2 = x+model.mu, x-1+model.mu
    r1 = math.hypot(dx1, y)
    r2 = math.hypot(dx2, y)
    return np.array([vx, vy,
        x + 2*vy - (1-model.mu)*dx1/r1**3 - model.mu*dx2/r2**3,
        y - 2*vx - (1-model.mu)*y/r1**3 - model.mu*y/r2**3])


def jacobi(states, model):
    states = np.asarray(states)
    x, y, vx, vy = np.moveaxis(states, -1, 0)
    r1 = np.hypot(x+model.mu, y)
    r2 = np.hypot(x-1+model.mu, y)
    return x*x+y*y+2*(1-model.mu)/r1+2*model.mu/r2-vx*vx-vy*vy


def propagate(state, duration, model, *, rtol=2e-10, atol=2e-12, events=None):
    result = solve_ivp(lambda t, s: rhs(t, s, model), (0., duration), np.asarray(state),
                       method='DOP853', rtol=rtol, atol=atol, dense_output=True,
                       max_step=.03, events=events)
    if not result.success:
        raise RuntimeError(f'Trajectory integration failed: {result.message}')
    return result


def parking_state(angle, model):
    direction = np.array([math.cos(angle), math.sin(angle)])
    tangent = np.array([-direction[1], direction[0]])
    speed = math.sqrt((1-model.mu)/model.parking_radius)-model.parking_radius
    return np.r_[model.earth+model.parking_radius*direction, speed*tangent]


def osculating_earth_orbit(state, model):
    """Two-body ellipse in inertial axes frozen at departure.

    This neglects lunar gravity and subsequent burns. Rotating
    geocentric velocity gains omega cross r before deriving Kepler elements.
    Unbound or radial states do not define a full elliptical reference.
    """
    radius = np.asarray(state[:2])-model.earth
    velocity = np.asarray(state[2:])+np.array([-radius[1], radius[0]])
    gm = 1-model.mu
    distance = np.linalg.norm(radius)
    energy = .5*np.dot(velocity, velocity)-gm/distance
    momentum = radius[0]*velocity[1]-radius[1]*velocity[0]
    if energy >= 0 or abs(momentum) < 1e-14:
        return None
    eccentricity_vector = ((np.dot(velocity, velocity)-gm/distance)*radius
                           -np.dot(radius, velocity)*velocity)/gm
    eccentricity = float(np.linalg.norm(eccentricity_vector))
    if eccentricity >= 1:
        return None
    periapsis = eccentricity_vector/eccentricity if eccentricity > 1e-12 else radius/distance
    tangent = np.array([-periapsis[1], periapsis[0]])
    anomaly = math.atan2(np.dot(radius, tangent), np.dot(radius, periapsis))
    angles = np.linspace(anomaly, anomaly+math.copysign(2*math.pi, momentum), 1025)
    distances = (momentum**2/gm)/(1+eccentricity*np.cos(angles))
    points = model.earth+distances[:, None]*(np.cos(angles)[:, None]*periapsis
                                           +np.sin(angles)[:, None]*tangent)
    points[-1] = points[0]
    return {'definition': 'Earth-centered inertial osculating ellipse, axes frozen at departure',
            'frame': 'Earth-centered inertial axes frozen at departure; translated to Earth position',
            'after_burn': 'departure', 'semi_major_axis_nd': float(-gm/(2*energy)),
            'eccentricity': eccentricity, 'points': points.tolist()}
