// ---------------------------------------------------------------------------
// Raw element properties for the characters that exist in the game.
// Units match the design doc:
//   density       g/cm³
//   mohs          Mohs hardness (kinetic attack). 0 = gas/liquid/no data
//   tensile       ultimate tensile strength, MPa (kinetic defense)
//   boiling       kelvin. null = unpublished
//   conductivity  MS/m. 0 = insulator. null = unpublished
//   en            Pauling electronegativity. null = unpublished (not zero).
//                 Nobles stay null and are immune. Any other null EN deals
//                 base chemical damage (multiplier 1).
// Adding one of the other 94 elements later is a new entry here plus a kit.
// ---------------------------------------------------------------------------

export const ELEMENTS = {
  hydra: {
    state: 'gas', family: 'nonmetal', metal: false, noble: false,
    density: 0.0000899, mohs: 0, tensile: 0, boiling: 20.27, conductivity: 0, en: 2.20,
  },
  helen: {
    state: 'gas', family: 'noble', metal: false, noble: true,
    density: 0.0001786, mohs: 0, tensile: 0, boiling: 4.22, conductivity: 0, en: null,
  },
  lillie: {
    state: 'solid', family: 'alkali', metal: true, noble: false,
    density: 0.534, mohs: 0.6, tensile: 1.5, boiling: 1617, conductivity: 11, en: 0.98,
  },
  ben: {
    state: 'solid', family: 'alkaline', metal: true, noble: false,
    density: 1.845, mohs: 5.5, tensile: 448, boiling: 2742, conductivity: 25, en: 1.57,
  },
  bord: {
    state: 'solid', family: 'metalloid', metal: false, noble: false,
    density: 2.46, mohs: 9.3, tensile: 0, boiling: 4200, conductivity: 0, en: 2.04,
  },
  // Carbon is listed as both graphite and diamond. Kinetic attack uses diamond
  // (Mohs 10) because that is the hardness the doc assigns to his kit.
  // Density, tensile strength and conductivity use graphite, the common form
  // (2.266 g/cm³, ~15 MPa, 0.1 MS/m). Boiling point is the sublimation point.
  carter: {
    state: 'solid', family: 'nonmetal', metal: false, noble: false,
    density: 2.266, mohs: 10, tensile: 15, boiling: 3915, conductivity: 0.1, en: 2.55,
  },
  nitra: {
    state: 'gas', family: 'nonmetal', metal: false, noble: false,
    density: 0.0012506, mohs: 0, tensile: 0, boiling: 77.36, conductivity: 0, en: 3.04,
  },
  oxana: {
    state: 'gas', family: 'nonmetal', metal: false, noble: false,
    density: 0.001429, mohs: 0, tensile: 0, boiling: 90.19, conductivity: 0, en: 3.44,
  },
  flora: {
    state: 'gas', family: 'halogen', metal: false, noble: false,
    density: 0.001696, mohs: 0, tensile: 0, boiling: 85.03, conductivity: 0, en: 3.98,
  },
  neo: {
    state: 'gas', family: 'noble', metal: false, noble: true,
    density: 0.0009002, mohs: 0, tensile: 0, boiling: 27.10, conductivity: 0, en: null,
  },
  natalie: {
    state: 'solid', family: 'alkali', metal: true, noble: false,
    density: 0.969, mohs: 0.5, tensile: 0, boiling: 1156, conductivity: 21, en: 0.93,
  },
  maggie: {
    state: 'solid', family: 'alkaline', metal: true, noble: false,
    density: 1.737, mohs: 2.5, tensile: 200, boiling: 1363, conductivity: 23, en: 1.31,
  },
  // Tensile is given as a range (~40–50 MPa); the midpoint is used.
  allen: {
    state: 'solid', family: 'post-transition', metal: true, noble: false,
    density: 2.699, mohs: 2.75, tensile: 45, boiling: 2743, conductivity: 38, en: 1.61,
  },
  silas: {
    state: 'solid', family: 'metalloid', metal: false, noble: false,
    density: 2.329, mohs: 6.5, tensile: 170, boiling: 3538, conductivity: 0.001, en: 1.90,
  },
  phillip: {
    state: 'solid', family: 'nonmetal', metal: false, noble: false,
    density: 1.823, mohs: 0, tensile: 0, boiling: 553.7, conductivity: 0, en: 2.19,
  },
  sully: {
    state: 'solid', family: 'nonmetal', metal: false, noble: false,
    density: 2.07, mohs: 2, tensile: 0, boiling: 717.8, conductivity: 0, en: 2.58,
  },
  chloe: {
    state: 'gas', family: 'halogen', metal: false, noble: false,
    density: 0.0032, mohs: 0, tensile: 0, boiling: 239.11, conductivity: 0, en: 3.16,
  },
  aaron: {
    state: 'gas', family: 'noble', metal: false, noble: true,
    density: 0.001784, mohs: 0, tensile: 0, boiling: 87.30, conductivity: 0, en: null,
  },
  kyle: {
    state: 'solid', family: 'alkali', metal: true, noble: false,
    density: 0.859, mohs: 0.4, tensile: 0, boiling: 1031, conductivity: 14, en: 0.82,
  },
  cal: {
    state: 'solid', family: 'alkaline', metal: true, noble: false,
    density: 1.526, mohs: 1.75, tensile: 110, boiling: 1757, conductivity: 29, en: 1.00,
  },
  scarlett: {
    state: 'solid', family: 'transition', metal: true, noble: false,
    density: 2.989, mohs: 0, tensile: 200, boiling: 3109, conductivity: 1.8, en: 1.36,
  },
  // Tensile is given as ~246–370 MPa; the midpoint is used.
  titan: {
    state: 'solid', family: 'transition', metal: true, noble: false,
    density: 4.502, mohs: 6, tensile: 308, boiling: 3560, conductivity: 2.5, en: 1.54,
  },
  van: {
    state: 'solid', family: 'transition', metal: true, noble: false,
    density: 6.099, mohs: 7, tensile: 800, boiling: 3680, conductivity: 5.0, en: 1.63,
  },
  chroma: {
    state: 'solid', family: 'transition', metal: true, noble: false,
    density: 7.192, mohs: 8.5, tensile: 550, boiling: 2944, conductivity: 7.9, en: 1.66,
  },
};
