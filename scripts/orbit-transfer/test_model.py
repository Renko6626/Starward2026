import math
import unittest
import numpy as np
from model import Model, rhs, jacobi, propagate, parking_state, osculating_earth_orbit


class OsculatingOrbitTests(unittest.TestCase):
    def test_circular_parking_orbit_converts_rotating_velocity(self):
        model = Model()
        state = parking_state(.7, model)
        orbit = osculating_earth_orbit(state, model)
        self.assertAlmostEqual(orbit['semi_major_axis_nd'], model.parking_radius)
        self.assertLess(orbit['eccentricity'], 1e-12)
        points = np.array(orbit['points'])
        np.testing.assert_allclose(np.linalg.norm(points-model.earth, axis=1), model.parking_radius)
        np.testing.assert_allclose(points[0], state[:2], atol=1e-14)
        np.testing.assert_array_equal(points[0], points[-1])

    def test_escape_state_has_no_closed_reference_orbit(self):
        model = Model()
        state = np.array([model.earth[0]+.1, 0., 0., 5.])
        self.assertIsNone(osculating_earth_orbit(state, model))


class DynamicsTests(unittest.TestCase):
    def test_l4_is_stationary_in_rotating_frame(self):
        model = Model()
        state = np.array([.5-model.mu, math.sqrt(3)/2, 0., 0.])
        np.testing.assert_allclose(rhs(0, state, model), 0, atol=2e-15)
        trajectory = propagate(state, 2., model)
        np.testing.assert_allclose(trajectory.y[:, -1], state, atol=2e-12)

    def test_unpowered_arc_conserves_jacobi(self):
        model = Model()
        initial = np.array([.3, .4, -.2, .3])
        trajectory = propagate(initial, .2, model)
        values = jacobi(trajectory.y.T, model)
        self.assertLess(float(np.ptp(values)), 1e-9)


class ValidationTests(unittest.TestCase):
    def test_earth_intersection_is_rejected(self):
        import json
        from pathlib import Path
        from validation import validate
        model = Model()
        config = json.loads(Path(__file__).with_name('config.json').read_text())
        initial = np.array([-model.mu+.9*model.earth_radius_km/model.distance_km, 0., 0., 0.])
        coast = propagate(initial, 1e-5, model)
        burns = [
            {'name': 'departure', 'before': initial, 'after': initial},
            {'name': 'lunar_assist', 'before': initial, 'after': initial},
            {'name': 'arrival', 'before': initial, 'after': initial},
        ]
        report = validate(model, config, [coast, coast], burns)
        self.assertFalse(report['accepted'])
        self.assertTrue(any('intersects Earth' in message for message in report['failures']))


class AltitudeTests(unittest.TestCase):
    def test_multiple_dense_extrema_are_all_checked(self):
        from types import SimpleNamespace
        from validation import minimum_altitude
        # A quartic dense trajectory has two known equal minima at .25 and .75,
        # and a maximum at .5. A single sign-change bracket selects the maximum.
        def state(t):
            radius = .02+(t-.25)**2*(t-.75)**2
            speed = 2*(t-.25)*(t-.75)*(2*t-1)
            return np.array([radius, 0., speed, 0.])
        coast = SimpleNamespace(t=np.array([0., 1.]), sol=state)
        model = Model()
        result = minimum_altitude(coast, np.zeros(2), 0., model)
        self.assertAlmostEqual(result['altitude_km'], .02*model.distance_km, places=6)


if __name__ == '__main__':
    unittest.main()
