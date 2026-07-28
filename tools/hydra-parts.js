// ---------------------------------------------------------------------------
// Hydra cutout-rig part definitions.
//
// Everything here is in SOURCE IMAGE pixel coordinates of
// art-src/hydra-cut.png (727 x 800). Nothing is baked into an image file —
// the demo slices the render live in the browser, so these numbers can be
// tweaked and reloaded without re-exporting anything.
//
// Per part:
//   poly    - polygon (source px) enclosing the part. Cut generously and let
//             it overlap its parent; the parent draws on top of the seam.
//   pivot   - the joint this part rotates around (shoulder, elbow, hip, knee).
//   tip     - the far end of the part. pivot->tip gives the angle the part was
//             DRAWN at, which is how the rig cancels out the render's baked-in
//             action pose.
//   neutral - the angle (degrees, screen space: 0 = right, 90 = straight down)
//             this part should sit at in a relaxed standing pose.
//   parent  - which part it hangs off. null = attached to the root.
//   z       - draw order, low to high.
// ---------------------------------------------------------------------------

// Where the rig's origin sits in the source image: roughly under the body's
// centre of mass, at ground level.
export const ROOT = [400, 775];

export const PARTS = {
  torso: {
    parent: null, z: 30,
    pivot: [432, 450], tip: [468, 222], neutral: -90,
    poly: [[330, 180], [420, 168], [500, 180], [546, 232], [562, 320], [540, 402],
           [520, 464], [430, 478], [350, 470], [300, 420], [298, 300], [310, 226]],
  },
  head: {
    parent: 'torso', z: 40,
    pivot: [468, 222], tip: [455, 40], neutral: -90,
    poly: [[300, 0], [600, 0], [606, 150], [562, 214], [512, 256], [430, 252],
           [368, 216], [334, 150], [300, 60]],
  },

  // --- trailing side (screen-left). Arm reaches back and down into the
  // gauntlet fist; the fist's flame rides along on the forearm.
  upperArmBack: {
    parent: 'torso', z: 20,
    pivot: [340, 212], tip: [242, 250], neutral: 97,
    poly: [[358, 184], [300, 172], [248, 186], [212, 214], [206, 258], [252, 290],
           [312, 268], [356, 236]],
  },
  forearmBack: {
    parent: 'upperArmBack', z: 21,
    pivot: [242, 250], tip: [222, 322], neutral: 92,
    poly: [[286, 246], [242, 214], [172, 204], [88, 194], [28, 234], [14, 300],
           [34, 376], [94, 430], [162, 430], [222, 386], [272, 322]],
  },

  // --- leading side (screen-right). A raised bicep-curl guard: the elbow sits
  // LOW and the bandaged fist is held HIGH, which is why this one has to be
  // two segments — a single rotating arm can't undo that fold.
  upperArmFront: {
    parent: 'torso', z: 50,
    pivot: [502, 268], tip: [572, 402], neutral: 83,
    poly: [[468, 238], [522, 244], [562, 300], [602, 380], [600, 432], [544, 442],
           [494, 372], [458, 302]],
  },
  forearmFront: {
    parent: 'upperArmFront', z: 51,
    pivot: [572, 402], tip: [612, 285], neutral: 88,
    poly: [[544, 422], [538, 340], [554, 254], [590, 204], [656, 188], [702, 224],
           [716, 290], [706, 356], [660, 422], [610, 442], [564, 436]],
  },

  // --- legs hang off the root, not the torso (same as the vector rig).
  thighBack: {
    parent: null, z: 10,
    pivot: [355, 445], tip: [208, 573], neutral: 92,
    poly: [[298, 408], [392, 428], [382, 500], [280, 602], [193, 612], [163, 544], [228, 458]],
  },
  shinBack: {
    parent: 'thighBack', z: 11,
    pivot: [208, 573], tip: [98, 700], neutral: 90,
    poly: [[158, 528], [252, 570], [242, 642], [170, 702], [176, 762], [110, 792],
           [28, 780], [18, 700], [58, 640], [108, 588]],
  },
  thighFront: {
    parent: null, z: 60,
    pivot: [452, 450], tip: [520, 585], neutral: 88,
    poly: [[398, 418], [502, 424], [562, 500], [577, 592], [500, 617], [438, 540], [398, 480]],
  },
  shinFront: {
    parent: 'thighFront', z: 61,
    pivot: [520, 585], tip: [556, 700], neutral: 90,
    poly: [[458, 558], [572, 558], [622, 620], [652, 702], [642, 772], [520, 782],
           [448, 742], [438, 660], [468, 598]],
  },
};
