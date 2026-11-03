#!/usr/bin/env python3
"""Collects the real element properties used by tools/gen-element-stats.mjs (Smash Ring element stats).
Sources: mendeleev (atomic weight, melting/boiling point, Pauling EN, isotope half-lives) and the design doc's
element-stats.csv (density, Mohs, conductivity).  Gaps are filled with documented estimates (see EST below).
Output: tools/data/element-props.json   (run once; the JSON is committed so the stats are reproducible)."""
import csv, json, warnings, sys
warnings.filterwarnings('ignore')
from mendeleev import element
CSV = sys.argv[1] if len(sys.argv) > 1 else '/workspace/element-stats/element-stats.csv'
PREFIX = {'y': 1e-24, 'z': 1e-21, 'a': 1e-18, 'f': 1e-15, 'p': 1e-12, 'n': 1e-9, 'u': 1e-6, 'm': 1e-3, '': 1,
          'k': 1e3, 'M': 1e6, 'G': 1e9, 'T': 1e12, 'P': 1e15, 'E': 1e18, 'Z': 1e21, 'Y': 1e24}
BASE = {'sec': 1, 'minute': 60, 'hour': 3600, 'day': 86400, 'year': 3.156e7}
def secs(v, u):
    for b, m in BASE.items():
        if u.endswith(b) and u[:-len(b)] in PREFIX:
            return v * m * PREFIX[u[:-len(b)]]
    return None
def num(x):
    try: return float(x)
    except Exception: return None
# Estimates for values no database lists (flagged in the output as est:[...]).
EST_MP = {2: 0.95, 6: 3823, 15: 317, 16: 388, 34: 494, 50: 505,        # no triple point at 1 atm / allotropes
          104: 2400, 105: 2100, 106: 2200, 107: 2000, 108: 2000, 109: 1500, 110: 1500, 111: 1200,   # predicted, group-trend x0.8
          112: 283, 113: 700, 114: 284, 115: 670, 116: 640, 117: 723, 118: 325}
EST_MOHS = {1: 0, 2: 0, 7: 0, 8: 0, 9: 0, 10: 0, 17: 0, 18: 0, 35: 0, 36: 0, 53: 0, 54: 0, 80: 0, 86: 0,   # gas / liquid
            6: 6.0, 15: 0.5, 16: 2.0, 21: 2.5, 39: 3.0, 43: 4.0, 61: 3.0, 70: 2.5, 84: 2.5, 85: 0.5, 87: 0.1, 88: 1.5, 89: 2.0}
rows = list(csv.DictReader(open(CSV)))
out = {}
for r in rows:
    z = int(r['atomic_number']); e = element(z)
    hl = [secs(i.half_life, i.half_life_unit) for i in e.isotopes if i.half_life and i.half_life_unit]
    hl = [h for h in hl if h]
    stable = any(i.is_radioactive is False for i in e.isotopes) or (z in (83, 90, 92) and False)
    est = []
    mp = e.melting_point
    if mp is None and z in EST_MP: mp = EST_MP[z]; est.append('mp')
    if z in (6,):  mp = 3823; est.append('mp')
    mohs = num(r['mohs_hardness'])
    if mohs is None and z in EST_MOHS: mohs = EST_MOHS[z]; est.append('mohs')
    cond = num(r['electrical_conductivity_MS_per_m'])
    en = num(r['electronegativity_pauling'])
    if en is None and e.en_pauling: en = e.en_pauling
    out[z] = dict(z=z, sym=r['symbol'], name=r['element'], group=r['group'], state=r['natural_state_STP'],
        mass=e.atomic_weight, density=num(r['density_g_per_cm3']) or e.density, mp=mp, bp=num(r['boiling_point_K']) or e.boiling_point,
        mohs=mohs, cond=cond, en=en, stable=bool(stable), maxhl_s=max(hl) if hl else None, est=est)
json.dump(out, open('tools/data/element-props.json', 'w'), indent=0)
print(len(out), 'elements; missing mohs', [z for z, v in out.items() if v['mohs'] is None], 'cond', [z for z, v in out.items() if v['cond'] is None], 'en', [z for z, v in out.items() if v['en'] is None], 'mp', [z for z, v in out.items() if v['mp'] is None])
