// Hit windows lengthened to cover the art's held, extended pose (Benjamin chose this on Oct 30 2026).
// Value = extra active frames taken from the move's endlag, so startup and the visible length do not change.
// Found with tools-free offline fitting: for each melee move with a painted body clip, the smallest extra that
// leaves at most one extended-art frame after the hit window ends (/workspace/statrework/audit/fit_hold.mjs).
export const HIT_HOLD_F = {
  ben: { basicDirectional: 9 },
  bord: { basicDirectional: 9 },
  carter: { basicDirectional: 10 },
  kyle: { basicDirectional: 17 },
  chroma: { basicDirectional: 20 },
  barry: { basicDirectional: 18 },
  ceres: { basicDirectional: 19 },
  europa: { basicDirectional: 19 },
  goldie: { basicDirectional: 18 },
  hoss: { basicDirectional: 18 },
  indy: { basicDirectional: 17 },
  nadia: { basicDirectional: 17 },
  oz: { basicDirectional: 18 },
  pit: { basicDirectional: 19 },
  polonius: { specialDirectional: 18 },
  ray: { basicDirectional: 18 },
  rex: { basicDirectional: 19 },
  ruth: { basicDirectional: 17 },
  sam: { basicDirectional: 18 },
  selena: { basicDirectional: 10 },
  tessa: { basicDirectional: 18 },
  tex: { basicDirectional: 19 },
  thule: { basicDirectional: 17 },
  yvette: { basicDirectional: 18 },
};
