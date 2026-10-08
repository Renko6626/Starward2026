"""R/07 preliminary sizing study; no product model is changed.

Run: python docs/design/torifune-truss-sizing.py
Writes the adjacent JSON calculation record. SI units internally.

This is a conditional hand-calculation model, not a finite-element model or
flight qualification. Rod screening includes gross-section stress, reduced
Euler buckling and a reduced elastic plate-buckling estimate. It excludes
joints, shell/frame local stress, thermal stress, fatigue, global stability,
shear flexibility, deployment and flexible multibody/control dynamics.
"""

import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
layout_uri = (ROOT / "experiments/station/ring-romantic/src/model/layout.js").as_uri()
LAYOUT = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    f"const m = await import({json.dumps(layout_uri)}); console.log(JSON.stringify(m.layout));",
], text=True))
C, W = LAYOUT["confirmed"], LAYOUT["working"]

# Reference 6061-T6 properties. These are study assumptions, not an approved
# material specification. No as-welded strength is inferred from parent metal.
E, RHO, NU, FY = 70e9, 2700.0, 0.33, 240e6
STRESS_LIMIT = FY / 2
LOAD_FACTOR, SHARING_FACTOR = 2.0, 1.25
BUCKLING_REDUCTION = 0.5
AXIAL_ACCEL, TRANSVERSE_ACCEL = 0.03, 0.01
G = 9.80665


def section(b_mm, t_mm):
    b, t = b_mm / 1000, t_mm / 1000
    a = b * b - (b - 2 * t) ** 2
    i = (b ** 4 - (b - 2 * t) ** 4) / 12
    plate_stress = 4 * math.pi ** 2 * E / (12 * (1 - NU ** 2)) * (t / (b - 2 * t)) ** 2
    return {"outer_mm": b_mm, "wall_mm": t_mm, "area_m2": a,
            "I_m4": i, "Z_m3": i / (b / 2), "mass_kg_per_m": a * RHO,
            "reduced_plate_stress_Pa": BUCKLING_REDUCTION * plate_stress}


def rod_check(name, b, t, length, tension=0.0, compression=0.0):
    s = section(b, t)
    gross_capacity = s["area_m2"] * STRESS_LIMIT
    euler = BUCKLING_REDUCTION * math.pi ** 2 * E * s["I_m4"] / length ** 2
    compression_capacity = min(gross_capacity, euler, s["area_m2"] * s["reduced_plate_stress_Pa"])
    ratio = max(tension / gross_capacity, compression / compression_capacity)
    return {"name": name, "section": s, "effective_length_m": length,
            "design_tension_N": tension, "design_compression_N": compression,
            "tension_screen_capacity_N": gross_capacity,
            "compression_screen_capacity_N": compression_capacity,
            "utilization": ratio, "within_selected_screen": ratio <= 1}


def beam_check(name, b, t, span, service_force, distribution="centre", cantilever=False):
    s = section(b, t)
    if cantilever:
        moment = service_force * span
        deflection = service_force * span ** 3 / (3 * E * s["I_m4"])
    elif distribution == "uniform":
        moment = service_force * span / 8
        deflection = 5 * service_force * span ** 3 / (384 * E * s["I_m4"])
    else:
        moment = service_force * span / 4
        deflection = service_force * span ** 3 / (48 * E * s["I_m4"])
    design_moment = moment * LOAD_FACTOR * SHARING_FACTOR
    stress = design_moment / s["Z_m3"]
    limit = min(STRESS_LIMIT, s["reduced_plate_stress_Pa"])
    return {"name": name, "section": s, "span_m": span,
            "service_force_N": service_force, "design_moment_Nm": design_moment,
            "design_bending_stress_Pa": stress, "stress_limit_Pa": limit,
            "service_deflection_m": deflection, "stress_utilization": stress / limit,
            "within_selected_stress_screen": stress <= limit}


omega_main = math.sqrt(C["gravityTarget"] * G / W["floorRadius"])
omega_counter = C["counterRpmTarget"] * 2 * math.pi / 60
main_mass_radius = 54.0  # bounding assumption: all main rotating mass at floor radius
counter_mass_radius = W["counterStorageRadius"]
counter_to_main_mass = omega_main * main_mass_radius ** 2 / (omega_counter * counter_mass_radius ** 2)
main_accel = omega_main ** 2 * main_mass_radius
counter_accel = omega_counter ** 2 * counter_mass_radius

# Dimensions read from current topology, which are not all layout parameters.
# Core: core.js brackets at -57,-44,-36,-23,-10,10,23,35,44.
# The present -10..10 interval is 20 m; proposed support spacing is <=10 m.
main_spoke_span, main_spoke_depth, main_spoke_width = 39.7, 8.4, 3.2
counter_spoke_span, counter_spoke_depth, counter_spoke_width = 31.0, 4.4, 2.6
main_bay, counter_bay = main_spoke_span / 7, counter_spoke_span / 7


def scenario(main_mass, fixed_mass, heavy_sections=False):
    counter_mass = main_mass * counter_to_main_mass
    total_mass = main_mass + counter_mass + fixed_mass
    factor = LOAD_FACTOR * SHARING_FACTOR
    cases = []
    # Independent bounding idealizations: (A) all radial load goes through
    # spokes; (B) uniform closed ring carries its own centrifugal hoop load.
    # They must not be added as a claimed solved load split.
    for label, mass, accel, span, depth, bay, b, t in [
        ("main_spoke", main_mass, main_accel, main_spoke_span, main_spoke_depth, main_bay,
         350 if heavy_sections else 280, 14 if heavy_sections else 10),
        ("counter_spoke", counter_mass, counter_accel, counter_spoke_span, counter_spoke_depth, counter_bay,
         400 if heavy_sections else 300, 20 if heavy_sections else 14),
    ]:
        radial_per_chord = mass * accel / 16
        axial_bending_per_chord = (mass / 4 * AXIAL_ACCEL * span) / (2 * depth)
        # Upper-bound sum on tension side; compression examined separately.
        cases.append(rod_check(label, b, t, bay,
            tension=factor * (radial_per_chord + axial_bending_per_chord),
            compression=factor * axial_bending_per_chord))
        # Out-of-plane root shear carried by two braced faces. Candidate
        # brace is diagonal across the axial depth and one radial bay.
        diagonal = math.hypot(depth, bay)
        shear_per_brace = factor * mass / 4 * AXIAL_ACCEL / (2 * depth / diagonal)
        cases.append(rod_check(label + "_axial_face_brace",
                               200 if heavy_sections else 160, 10 if heavy_sections else 8, diagonal,
                               tension=shear_per_brace, compression=shear_per_brace))
    for label, mass, accel, radius in [
        ("main_ring_external_chord", main_mass, main_accel, main_mass_radius),
        ("counter_ring_chord", counter_mass, counter_accel, counter_mass_radius),
    ]:
        hoop_per_chord = mass * accel / (2 * math.pi * 4)
        chord_b, chord_t = ((350, 12) if label == "counter_ring_chord" else (300, 12)) if heavy_sections else ((280, 10) if label == "counter_ring_chord" else (250, 8))
        cases.append(rod_check(label, chord_b, chord_t, 2 * radius * math.sin(math.pi / 32),
                               tension=factor * hoop_per_chord))
    # Core load envelope: equal four-chord axial sharing + a conservative
    # equivalent transverse bending moment, total mass at half load x 30 m.
    core_spacing = 2 * 5.15 / math.sqrt(2)
    core_moment = total_mass * TRANSVERSE_ACCEL / 2 * 30
    core_axial_per_chord = total_mass * AXIAL_ACCEL / 4
    core_bend_per_chord = core_moment / (2 * core_spacing)
    cases.append(rod_check("core_chord_proposed_supports", 350, 12, 10,
        tension=factor * core_bend_per_chord,
        compression=factor * (core_axial_per_chord + core_bend_per_chord)))
    cases.append(rod_check("core_chord_existing_20m_gap", 350, 12, 20,
        compression=factor * (core_axial_per_chord + core_bend_per_chord)))
    # The implemented core uses shell-conforming rings and short seats.
    # Straight face diagonals were rejected because they intersect modules.
    # Restraint stiffness and the equivalent EI remain conditional on the
    # shell/ring load path; a successful rod screen does not establish them.
    # Four axial end-frame beams per main habitat segment are assumed to
    # share each segment's radial load, as a simply supported uniform load.
    # The shell/floor must actually distribute that load; concentrated loads
    # would give a different result.
    frame_force = main_mass / W["mainSegments"] * main_accel / 4
    cases.append(beam_check("main_ring_16.4m_transverse_frame",
                            600 if heavy_sections else 450, 25, 16.4,
                            frame_force, distribution="uniform"))
    # Current thrust frame is planar. Screen one radial beam as an axial-load
    # cantilever: this retains a large local beam instead of assuming an
    # unmodeled cone/truss. Real central plate, fixity and connections pending.
    thrust = total_mass * AXIAL_ACCEL
    cases.append(beam_check("planar_engine_radial_beam",
                            800 if heavy_sections else 650, 40 if heavy_sections else 35,
                            math.hypot(5.4, 5.4), thrust / 4, cantilever=True))
    return {"main_rotating_mass_kg": main_mass, "counter_rotating_mass_kg": counter_mass,
            "fixed_and_propulsion_mass_kg": fixed_mass, "station_mass_kg": total_mass,
            "total_thrust_at_0_03_m_s2_N": thrust, "checks": cases}


energy_span = W["solarRootZ"] - 4.5
energy_bay = (W["solarRootZ"] - 5) / 8
energy_height = 3.0
energy_mass = 30000.0  # one side: arrays + radiators + structure + equipment
energy_force = energy_mass * AXIAL_ACCEL
# Bounding placement of all side mass at the furthest wing tip; conservative
# for root moment. Treats wing-root moment as transferred into the truss.
energy_overhang = W["solarWingLength"]
energy_moment = energy_force * (energy_span + energy_overhang)
energy_chord_force = LOAD_FACTOR * SHARING_FACTOR * energy_moment / (2 * energy_height)
energy_section = section(200, 6)
energy_EI = E * (energy_section["area_m2"] * energy_height ** 2 + 4 * energy_section["I_m4"])
energy_deflection = (energy_force * energy_span ** 3 / 3 + energy_force * energy_overhang * energy_span ** 2 / 2) / energy_EI
energy_diagonal = math.hypot(energy_height, energy_bay)
energy_brace_force = LOAD_FACTOR * SHARING_FACTOR * energy_force / (2 * energy_height / energy_diagonal)

wing_mass, wing_depth, wing_bay = 3000.0, 0.4, 2.5
wing_length = W["solarWingLength"]
wing_force = wing_mass * AXIAL_ACCEL
wing_moment = wing_force * wing_length / 2
wing_chord_force = LOAD_FACTOR * SHARING_FACTOR * wing_moment / (2 * wing_depth)
wing_section = section(50, 3)
wing_EI = E * (wing_section["area_m2"] * wing_depth ** 2 + 4 * wing_section["I_m4"])
wing_diagonal = math.hypot(wing_depth, wing_bay)
wing_brace_force = LOAD_FACTOR * SHARING_FACTOR * wing_force / (2 * wing_depth / wing_diagonal)

radiator_mass, radiator_depth = 4000.0, 0.6
radiator_length = W["radiatorLength"]
radiator_force = radiator_mass * AXIAL_ACCEL
radiator_bay = radiator_length / 6
radiator_chord_force = LOAD_FACTOR * SHARING_FACTOR * radiator_force * radiator_length / 2 / (2 * radiator_depth)
radiator_section = section(80, 4)
radiator_EI = E * (radiator_section["area_m2"] * radiator_depth ** 2 + 4 * radiator_section["I_m4"])
radiator_diagonal = math.hypot(radiator_depth, radiator_bay)
radiator_brace_force = LOAD_FACTOR * SHARING_FACTOR * radiator_force / (2 * radiator_depth / radiator_diagonal)

# One full water tank plus 10% tank/cradle allowance. Two axial tank rows
# share each of two tangential floor beams, so one beam carries one full
# tank's weight. All loads collapsed to centre for an upper bending bound.
tank_volume = math.pi * W["counterTankRadius"] ** 2 * W["counterTankBarrelLength"] + 4/3 * math.pi * W["counterTankRadius"] ** 2 * W["counterTankCapDepth"]
tank_mass = tank_volume * 1000 * 1.1
tank_floor_force = tank_mass * counter_accel

wing_checks = [
    rod_check("energy_chord", 200, 6, energy_bay, compression=energy_chord_force),
    rod_check("energy_new_vertical_face_brace", 100, 5, energy_diagonal,
              tension=energy_brace_force, compression=energy_brace_force),
    rod_check("solar_mast_chord", 50, 3, wing_bay, compression=wing_chord_force),
    rod_check("solar_mast_compression_diagonal_25mm", 25, 2, wing_diagonal,
              tension=wing_brace_force, compression=wing_brace_force),
    rod_check("solar_mast_compression_diagonal_20mm", 20, 2, wing_diagonal,
              compression=wing_brace_force),
    rod_check("radiator_proposed_0_6m_back_truss_chord", 80, 4, radiator_bay,
              compression=radiator_chord_force),
    rod_check("radiator_proposed_back_truss_diagonal", 60, 3, radiator_diagonal,
              tension=radiator_brace_force, compression=radiator_brace_force),
    beam_check("counter_water_tank_floor_beam_existing_80mm", 80, 4, W["counterDepth"], tank_floor_force),
    beam_check("counter_water_tank_floor_beam_proposed_250mm", 250, 10, W["counterDepth"], tank_floor_force),
]

pressure = 80000.0  # candidate cabin pressure, not an approved pressure spec
passage_area = C["ecologicalClearHeight"] * C["usableAxialWidth"]
pressure_force = pressure * passage_area

result = {
    "status": "conditional preliminary analytical screening; no product model changes",
    "sources": [
        "https://www.hydro.com/globalassets/01-products--services/extruded-profiles/americas/ena-resources/alloy-data-sheets/hydro_2019_data_sheet_6061.pdf",
        "https://d2zo35mdb530wx.cloudfront.net/_legacy/UCPthyssenkruppBAMXUK/assets.files/material-data-sheets/aluminium/aluminium-6061.pdf",
        "https://ntrs.nasa.gov/api/citations/20120008187/downloads/20120008187.pdf",
        "https://ntrs.nasa.gov/api/citations/19890009140/downloads/19890009140.pdf",
    ],
    "assumptions": {"material_reference_only": "6061-T6, mechanically joined parent metal",
        "E_Pa": E, "density_kg_m3": RHO, "reference_yield_Pa": FY,
        "stress_screen_Pa": STRESS_LIMIT, "load_factor": LOAD_FACTOR,
        "load_sharing_factor": SHARING_FACTOR, "buckling_reduction": BUCKLING_REDUCTION,
        "effective_length_factor_K": 1.0, "axial_acceleration_m_s2": AXIAL_ACCEL,
        "transverse_acceleration_m_s2": TRANSVERSE_ACCEL,
        "main_mass_radius_m": main_mass_radius,
        "counter_to_main_mass_for_ideal_angular_momentum_balance": counter_to_main_mass,
        "all_mass_cases_are_assumed_not_measured": True,
        "deflections_are_ideal_service_load_estimates_without_joint_or_shear_compliance": True,
        "study_deflection_targets_m_not_flight_requirements": {
            "energy_wing_root": 0.10, "solar_mast_relative_to_root": wing_length / 200,
            "radiator_relative_to_root": 0.10, "main_transverse_frame": 16.4 / 300}},
    "mass_budget_context_not_measured": {
        "main_floor_area_at_54m_by_16m_m2": 2 * math.pi * W["floorRadius"] * C["usableAxialWidth"],
        "wet_substrate_density_kg_m3_assumed": 1500,
        "full_floor_0_2m_substrate_mass_kg": 2 * math.pi * W["floorRadius"] * C["usableAxialWidth"] * 0.2 * 1500,
        "note": "3000 t is a scenario, not an inventory. Coverage/depth, shell, shielding, water and equipment may make 6000 t more appropriate. Counter-ring mass is imposed by ideal angular momentum balance, not proven storage capacity."},
    "geometry_snapshot": {"layout": LAYOUT, "main_spoke_span_m": main_spoke_span,
        "main_spoke_depth_m": main_spoke_depth, "counter_spoke_span_m": counter_spoke_span,
        "counter_spoke_depth_m": counter_spoke_depth, "energy_span_m": energy_span,
        "energy_bay_m": energy_bay, "main_ring_axial_frame_span_m": 16.4,
        "core_before_change_max_bracket_spacing_m": 20, "core_proposed_restrained_spacing_m": 10,
        "core_rendered_support_stations_m": W.get("coreSupportStations", []),
        "core_rendered_max_support_spacing_m": max((b-a for a,b in zip(W.get("coreSupportStations", []), W.get("coreSupportStations", [])[1:])), default=None)},
    "scenarios": {"low": scenario(1.5e6, 4e6), "reference": scenario(3e6, 4e6),
                  "high_with_reference_sections": scenario(6e6, 4e6),
                  "high_with_heavier_sections": scenario(6e6, 4e6, heavy_sections=True)},
    "wings_and_tank_checks": wing_checks,
    "service_deflection_estimates_m": {
        "energy_truss_root_to_wing_root": energy_deflection,
        "solar_mast_weak_axis_relative_to_its_root": wing_force * wing_length ** 3 / (8 * wing_EI),
        "radiator_with_proposed_back_truss_relative_to_root": radiator_force * radiator_length ** 3 / (8 * radiator_EI)},
    "assumed_attachment_masses_kg": {"energy_each_side": energy_mass, "solar_each_wing": wing_mass,
        "radiator_each_panel": radiator_mass, "full_water_tank_with_10percent_hardware": tank_mass},
    "main_pressure_interface": {"pressure_Pa_assumed": pressure, "pressure_cut_area_m2_upper_rectangle": passage_area,
        "service_pressure_end_force_N": pressure_force,
        "factored_pressure_only_force_N": LOAD_FACTOR * SHARING_FACTOR * pressure_force,
        "minimum_net_tension_area_m2_at_screen_stress_pressure_only": LOAD_FACTOR * SHARING_FACTOR * pressure_force / STRESS_LIMIT,
        "note": "Pressure shell/collar must carry this separately; add actual spin/bending/interface loads in detailed design. External 250 mm chords are NOT credited with carrying pressure."},
    "required_conditions": [
        "Core chords must have effective lateral restraint in both transverse directions at <=10 m spacing. Implemented rings and seats require shell/ring stiffness verification; no straight cross-shell face braces are credited.",
        "Energy box truss needs vertical-face diagonals and a real four-chord root load path.",
        "Solar mast needs transverse end frames and bracing on its currently unbraced 0.4 m faces; the weak-axis results assume this.",
        "Radiator requires a 0.6 m deep rear load-bearing truss or a separately verified stiff structural panel.",
        "Ring shell-to-spoke and storage supports must actually distribute assumed loads; uniform sharing is unverified.",
        "Main habitat circumferential pressure load carried by pressure shell and permanent load-bearing collars.",
        "650 mm local planar thrust beams require real moment-resisting roots; a conical thrust truss would be a different design.",
    ],
    "excluded": ["joint capacity and stiffness", "thermal gradients and restraint", "fatigue and damage tolerance",
        "actual mass/inertia inventory", "pressure shell/frame analysis", "ring global instability",
        "full truss FEM, modes, torsion and controls", "launch and deployment load cases",
        "inventory-dependent angular momentum balancing", "engine/tank attachment load sharing"],
}

output = Path(__file__).with_name("torifune-truss-sizing-results.json")
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(f"Written {output}")
for scenario_name, data in result["scenarios"].items():
    print(f"\n{scenario_name}: main={data['main_rotating_mass_kg']/1000:.0f} t; counter={data['counter_rotating_mass_kg']/1000:.0f} t; total={data['station_mass_kg']/1000:.0f} t")
    for check in data["checks"]:
        ratio = check.get("utilization", check.get("stress_utilization"))
        print(f"  {check['name']}: utilization={ratio:.3f}")
print("\nwings and tank supports:")
for check in wing_checks:
    ratio = check.get("utilization", check.get("stress_utilization"))
    print(f"  {check['name']}: utilization={ratio:.3f}")
print("\nIdeal service deflections (mm):", {k: round(v*1000, 1) for k,v in result['service_deflection_estimates_m'].items()})
