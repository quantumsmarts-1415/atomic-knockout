// Campaign story data: "Atomic Knockout" (the Table of elements).
// Pure data, no logic. To write a different story, copy this file and see docs/campaign-story.md.
// Campaign chapters. Map glyphs: . plain  , road  _ courtyard  f forest  ^ mountain
// ~ water  # wall  F fort  v village  T throne.
// Units are existing fighters; the lord is Hydra and must survive.
//
// Objectives (win): rout | seize (lord on `seize` tile) | boss (kill the boss) |
//                   defend (survive through enemy phase of turn `turns`) | escape (lord on an `exit` tile)
// Lines: { who: fighterId | null (narration), text, side?: 'L' | 'R' }.
// events[]: { when: { start | turn: n | enemyTurn: n | near: enemyId, dist | death: enemyId }, lines, spawn: [{ id, level, x, y, team, ai, boss }] }
// npcs[]: neutral fighters a player unit can Talk to (adjacent) to recruit.

const LORD_ID = 'hydra';

const PROLOGUE = {
  kicker: 'PROLOGUE',
  title: 'The Hum at the Edge',
  lines: [
    { who: null, text: 'The Table is a living world, built in rows and columns. Every element keeps its place, and every neighbor keeps the peace.' },
    { who: null, text: 'Lately, a strange hum has been drifting in from the farthest edge of the Table. The elders call it the Static.' },
    { who: 'helen', text: 'Hydra, even the gentlest folk of the Cloud are restless. The Static makes everyone itch for a fight.' },
    { who: 'hydra', text: 'Then something is pulling at the Table from the far edge. I want to know what, and why.' },
    { who: 'lillie', text: 'The Raiders were the first to go wild. They took the old fort on the village road, and that road is our way out of the Cloud.' },
    { who: 'hydra', text: 'We follow the road, one row at a time. Nobody gets left behind. Let us go.' },
  ],
};

const CHAPTERS = [
  {
    id: 'ch1',
    title: 'Static in the Cloud',
    kicker: 'CHAPTER 1',
    win: 'rout',
    objective: 'Rout the enemy',
    map: [
      'ff............^^',
      'f.....~~....^^^.',
      '......~~..ff....',
      ',,,,,,,,,,,,,,,,',
      '..ff..~~...v...F',
      '...f..~~........',
      '......~~..ff..f.',
      'ff....~~......^^',
      'f.............^^',
      '................',
    ],
    starts: [[0, 3], [1, 3], [0, 4], [1, 4], [0, 5], [1, 5], [2, 4], [2, 3], [2, 5], [0, 2]],
    lordSlot: 2,
    party: [
      { id: 'hydra', level: 1, lord: true },
      { id: 'helen', level: 1 },
      { id: 'lillie', level: 1 },
      { id: 'ben', level: 1 },
      { id: 'bord', level: 1 },
      { id: 'carter', level: 1 },
    ],
    enemies: [
      { id: 'chloe', level: 1, x: 11, y: 4, ai: 'aggressive' },
      { id: 'aaron', level: 1, x: 10, y: 3, ai: 'aggressive' },
      { id: 'sully', level: 1, x: 12, y: 2, ai: 'hold' },
      { id: 'cal', level: 1, x: 12, y: 6, ai: 'aggressive' },
      { id: 'phillip', level: 1, x: 13, y: 5, ai: 'hold' },
      { id: 'kyle', level: 1, x: 15, y: 4, ai: 'hold' },
    ],
    intro: [
      { who: 'hydra', text: 'The Hydrogen Cloud is the lightest place in the whole Table. Nothing here was ever meant to burn.' },
      { who: 'helen', text: 'Then why is the Raider banner flying over the old fort? Kyle and his crew are pillaging the village road.' },
      { who: 'lillie', text: 'Reactive little thieves. They grab anything that is not bonded down.' },
      { who: 'hydra', text: 'We are not letting them take the Cloud. Move out, and keep everyone together.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'lillie', text: "My heart is pounding. Is it always like this?" },
          { who: 'hydra', text: "Every time. Breathe, and look after the person next to you. That is how a line holds." },
          { who: 'helen', text: "And if anyone gets hurt, step back. There is no shame in that." },
        ],
      },
      {
        when: { near: 'kyle', dist: 5 },
        lines: [
          { who: 'kyle', text: 'Ha! Look at the little Cloud-folk, marching right up to my fort. Boys, show them what a real reaction looks like!' },
          { who: 'hydra', text: 'Kyle, you are not yourself. That hum in your head is not your own.' },
          { who: 'kyle', text: 'Hum? I hear nothing but the sound of me winning!' },
        ],
      },
    ],
    outro: [
      { who: 'kyle', text: 'You are... stable. Too stable. The hum is still there, and it is getting louder.' },
      { who: 'helen', text: 'He said the same thing the others did. The Static is real, Hydra.' },
      { who: 'hydra', text: 'He ran toward the Alkali Gate. Whatever is pulling the Raiders, it is in that fortress.' },
    ],
  },
  {
    id: 'ch2',
    title: 'The Alkali Gate',
    kicker: 'CHAPTER 2',
    win: 'seize',
    objective: 'Seize the throne with Hydra',
    map: [
      'ff..#__T___#..ff',
      'f...#_F__F_#...f',
      '....#______#....',
      '....###__###....',
      '..ff...,,...ff..',
      '......~,,~......',
      '..v...~,,~...v..',
      '......~,,~......',
      'f.....,,,,.....f',
      'ff............ff',
    ],
    starts: [[4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [6, 9], [7, 9], [8, 9], [9, 9]],
    lordSlot: 9,
    seize: [7, 0],
    party: [],
    recruits: [
      { id: 'nitra', join: 'level' },
      { id: 'oxana', join: 'level' },
      { id: 'neo', join: 'level' },
    ],
    npcs: [
      {
        id: 'flora', x: 2, y: 6, with: null,
        lines: [
          { who: 'flora', text: 'Please do not be afraid of me! I am Flora. The Static made me run all the way into this village.' },
          { who: 'hydra', text: 'You are safe now. Stay close, and we will find the end of that hum together.' },
          { who: 'flora', text: 'Then I will fight beside you. Fluorine never leaves a friend!' },
        ],
      },
    ],
    enemies: [
      { id: 'brock', level: 2, x: 5, y: 4, ai: 'aggressive' },
      { id: 'collin', level: 2, x: 11, y: 4, ai: 'aggressive' },
      { id: 'van', level: 2, x: 7, y: 3, ai: 'hold' },
      { id: 'scarlett', level: 2, x: 6, y: 1, ai: 'hold' },
      { id: 'arsenio', level: 2, x: 9, y: 1, ai: 'hold' },
      { id: 'chroma', level: 3, x: 7, y: 0, ai: 'boss', boss: true },
    ],
    intro: [
      { who: 'nitra', text: 'Hydra! Oxana, Neo and I came as soon as we heard. The Gate has closed behind the Raiders.' },
      { who: 'oxana', text: 'Chroma holds the vault throne. Whoever sits there decides who may pass the Gate.' },
      { who: 'hydra', text: 'Then I will sit there first. Break the guards at the gatehouse, and I will seize the throne.' },
      { who: 'neo', text: 'Noble and ready. Let us light the way. And look, someone is hiding in the west village.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'oxana', text: "Mind the gatehouse walls. The Raiders can see everything from up there." },
          { who: 'neo', text: "Then let us give them something worth watching. Together, now." },
          { who: 'hydra', text: "Keep moving toward the throne. We do not need to win every fight, only to arrive." },
        ],
      },
      {
        when: { near: 'chroma', dist: 4 },
        card: { id: 'chroma', name: 'CHROMA', epithet: 'Keeper of the Vault Throne' },
        lines: [
          { who: 'chroma', text: 'So the Cloud sends its little spark to my vault. Every color on this wall belongs to me!' },
          { who: 'oxana', text: 'Chroma, this is not like you. Where did you hear the hum?' },
          { who: 'chroma', text: 'It came with the Heavy Core. A voice from below the Table. It says the row at the edge is calling us all.' },
          { who: 'neo', text: 'Then we are not here to take your vault, Chroma. We are here to find out who is calling.' },
          { who: 'chroma', text: 'Find it, then. But you will have to get past my colors first!' },
        ],
      },
    ],
    outro: [
      { who: 'chroma', text: 'Pretty colors do not make a king. Titan already has the Heavy Core. You are too late.' },
      { who: 'hydra', text: 'The Heavy Core... that is where the hum is strongest. Then we go to the Core. All of us.' },
    ],
  },
  {
    id: 'ch3',
    title: 'Heavy Metal Heart',
    kicker: 'CHAPTER 3',
    win: 'boss',
    objective: 'Defeat Titan',
    map: [
      '^^^^..........^^',
      '^^f..##_T__##..f',
      '^f...#______#...',
      '....##__##__##..',
      '..f.....ff...f..',
      '.^^..~~~~~~..^^.',
      '.....~~~~~~.....',
      'f....~~~~~~....f',
      'ff...........^^f',
      'fff............f',
    ],
    starts: [[3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [4, 9], [8, 9]],
    lordSlot: 11,
    party: [],
    recruits: [
      { id: 'natalie', join: 'level' },
      { id: 'silas', join: 'level' },
    ],
    enemies: [
      { id: 'cooper', level: 2, x: 3, y: 4, ai: 'aggressive' },
      { id: 'tex', level: 3, x: 12, y: 4, ai: 'aggressive' },
      { id: 'manny', level: 3, x: 3, y: 3, ai: 'aggressive' },
      { id: 'molly', level: 3, x: 14, y: 3, ai: 'aggressive' },
      { id: 'rhoda', level: 3, x: 9, y: 4, ai: 'hold' },
      { id: 'fey', level: 3, x: 6, y: 2, ai: 'hold' },
      { id: 'zora', level: 3, x: 7, y: 4, ai: 'hold' },
      { id: 'titan', level: 5, x: 8, y: 1, ai: 'boss', boss: true },
    ],
    intro: [
      { who: 'silas', text: 'Natalie and I are with you, Hydra. The Core is a heavy place. Everything here pulls down.' },
      { who: 'natalie', text: 'Titan sits at the center of it. Strong, slow, and he hits like a collapsing star. Watch the lance.' },
      { who: 'hydra', text: 'We strip his guards and corner him. Maggie and Allen said they would find a way through the lower pass.' },
      { who: 'hydra', text: 'Stay together, and bring Titan down without hurting anyone more than we must.' },
    ],
    events: [
      {
        when: { turn: 3 },
        spawn: [
          { id: 'maggie', team: 'player', x: 7, y: 9 },
          { id: 'allen', team: 'player', x: 8, y: 9 },
        ],
        lines: [
          { who: 'maggie', text: 'Sorry we are late! The lower pass was blocked, so we made our own way.' },
          { who: 'allen', text: 'Lightweight, but sturdy. Point us at the nearest guard.' },
          { who: 'hydra', text: 'Perfect timing. Help the line hold, and press toward the throne.' },
        ],
      },
      {
        when: { near: 'titan', dist: 3 },
        card: { id: 'titan', name: 'TITAN', epithet: 'The Heaviest Heart of the Core' },
        lines: [
          { who: null, text: 'The floor hums under every step. At the far end of the hall, something very large stands up.' },
          { who: 'titan', text: 'Stop there, little Cloud. This hall is mine. The Static asked me to hold the Core, and I will.' },
          { who: 'silas', text: 'Titan, you have always been a strong, steady friend to the Table. What is it asking you to do?' },
          { who: 'titan', text: 'It asks me to stop everyone who walks toward the edge. I cannot stop hearing it. Forgive me!' },
          { who: 'natalie', text: 'Then we will be quick and careful, big friend. Hold your ground, everyone. Do not break the line.' },
          { who: 'hydra', text: 'We are not here to hurt you, Titan. But we are not turning back either.' },
        ],
      },
    ],
    outro: [
      { who: 'titan', text: 'The lightest of the elements... brought down the heaviest. Perhaps the Table does balance.' },
      { who: 'titan', text: 'Listen. The hum comes from the Last Row, at the far edge. A fighter named Ogden is sending it out.' },
      { who: 'hydra', text: 'Ogden. The last one on the Table. Then that is where we are going, however far it is.' },
    ],
  },
  {
    id: 'ch4',
    title: 'The Salt Flats',
    kicker: 'CHAPTER 4',
    win: 'defend',
    turns: 6,
    objective: 'Hold the flats for 6 turns',
    map: [
      '^^..ff......ff^^',
      '^......~~......^',
      '..ff...~~...ff..',
      '.......,,.......',
      '..~~...,,...~~..',
      '..~~..F,,F..~~..',
      '...f..v,,v..f...',
      '......,,,,......',
      'ff....,,,,....ff',
      'f..............f',
    ],
    starts: [[5, 6], [6, 6], [9, 6], [10, 6], [6, 7], [7, 7], [8, 7], [9, 7], [5, 7], [10, 7], [7, 8], [8, 8], [7, 5], [8, 5]],
    lordSlot: 6,
    party: [],
    recruits: [{ id: 'sandy', join: 'level' }],
    enemies: [
      { id: 'iona', level: 4, x: 3, y: 1, ai: 'aggressive' },
      { id: 'brock', level: 4, x: 12, y: 1, ai: 'aggressive' },
      { id: 'selena', level: 4, x: 2, y: 3, ai: 'aggressive' },
      { id: 'tessa', level: 4, x: 13, y: 3, ai: 'aggressive' },
      { id: 'tate', level: 4, x: 7, y: 0, ai: 'aggressive' },
      { id: 'kyle', level: 5, x: 5, y: 1, ai: 'aggressive' },
    ],
    intro: [
      { who: null, text: 'Past the Core, the road crosses the Salt Flats, a wide plain with nowhere to hide. A signal beacon stands on the old fort.' },
      { who: 'sandy', text: 'I am Sandy, a tin-smith by trade. I will fix anything you break, if you promise to stop breaking things.' },
      { who: 'helen', text: 'Hydra, scouts say the Halide clans are marching on the beacon. If it falls, the whole eastern road goes dark.' },
      { who: 'hydra', text: 'We do not need to win a long fight. We only need to hold the flats until dawn. Six turns. Dig in on the forts and the village.' },
    ],
    events: [
      {
        when: { turn: 3 },
        spawn: [
          { id: 'sully', level: 4, x: 7, y: 0 },
          { id: 'phillip', level: 4, x: 9, y: 0 },
        ],
        lines: [
          { who: 'kyle', text: 'We are not done! The hum says there are more of us marching in from the north!' },
          { who: 'hydra', text: 'More Raiders. Keep your lines tight, and let them come to us.' },
        ],
      },
      {
        when: { turn: 5 },
        spawn: [{ id: 'ronan', team: 'player', x: 7, y: 9 }],
        lines: [
          { who: 'ronan', text: 'Hold fast, friends! The noble gases do not fight often, but we remember who stood up for the Table.' },
          { who: 'helen', text: 'Ronan! My cousins, too, are stirring. Is the Static reaching the Noble Mists?' },
          { who: 'ronan', text: 'It is. Come to the Mist, Hydra. We will light the way through, if you can reach the gate.' },
        ],
      },
    ],
    outro: [
      { who: null, text: 'As the first light touched the flats, the Halide clans drew back. The beacon still burned.' },
      { who: 'ronan', text: 'The Mist will cover our road, but only for one night. Reach the gate at the top of the Mist and we are through.' },
      { who: 'hydra', text: 'Then we run, together. Keep the whole party close.' },
    ],
  },
  {
    id: 'ch5',
    title: 'Through the Noble Mist',
    kicker: 'CHAPTER 5',
    win: 'escape',
    objective: 'Get Hydra to the Mist Gate',
    exit: [[7, 0], [8, 0]],
    map: [
      '^^^f..._,,_..f^^',
      '^^f.....,,....f^',
      '^f..~~..,,..~..f',
      '....~~..,,..~...',
      '..ff........f...',
      '.....~~~~~~.....',
      '..f..~~~~~~.....',
      '.....,,,,,,.....',
      'f....,,,,,,....f',
      'ff............ff',
    ],
    starts: [[4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9]],
    lordSlot: 8,
    party: [],
    recruits: [],
    npcs: [
      {
        id: 'xander', x: 2, y: 4, with: 'helen',
        lines: [
          { who: 'xander', text: 'Helen? Cousin, is that really you under all this mist? I thought the Static had taken the whole family.' },
          { who: 'helen', text: 'Not yet, Xander. Come with us. We are walking toward the source, and we could use a steady friend.' },
          { who: 'xander', text: 'Then I will light the way. Noble gases glow best together!' },
        ],
      },
    ],
    enemies: [
      { id: 'pit', level: 5, x: 3, y: 3, ai: 'aggressive' },
      { id: 'ira', level: 5, x: 13, y: 3, ai: 'aggressive' },
      { id: 'oz', level: 5, x: 6, y: 2, ai: 'hold' },
      { id: 'rex', level: 5, x: 10, y: 2, ai: 'hold' },
      { id: 'wolf', level: 6, x: 7, y: 1, ai: 'hold' },
      { id: 'tara', level: 5, x: 9, y: 1, ai: 'hold' },
    ],
    intro: [
      { who: null, text: 'The Noble Mist is a cloud so still and so quiet that even the Static sounds far away. But the guards at the Mist Gate are not still at all.' },
      { who: 'ronan', text: 'The gate is at the very top, past the heavy metal guards. If Hydra reaches it, the Mist will close behind us.' },
      { who: 'hydra', text: 'So I only have to get through. The rest of you, do not take chances. Cover each other, and meet me there.' },
      { who: 'helen', text: 'Wait. I see a glow in the west, under the trees. That is the Noble light. Someone is there.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'helen', text: "I can barely see my own hands in this mist. Keep one eye on Hydra's glow." },
          { who: 'hydra', text: "Stay close and keep walking. The gate is to the north. We do not stop until everyone is through." },
        ],
      },
      {
        when: { near: 'wolf', dist: 4 },
        lines: [
          { who: 'wolf', text: 'The Gate is mine to hold. Nobody walks through the Mist while the hum asks me to stand here.' },
          { who: 'hydra', text: 'I am not here to fight you, Wolf. I only need a way past.' },
          { who: 'wolf', text: 'Then you will have to get past me, little flame. I cannot move aside.' },
        ],
      },
    ],
    outro: [
      { who: null, text: 'Hydra slipped through the Mist Gate, and the mist rolled shut behind him like a curtain.' },
      { who: 'xander', text: 'That is the last quiet place on the Table. Beyond it, the Rare Earth Vale. The hum is much louder there.' },
      { who: 'hydra', text: 'We have come this far. Let us keep going.' },
    ],
  },
  {
    id: 'ch6',
    title: 'The Rare Earth Vale',
    kicker: 'CHAPTER 6',
    win: 'rout',
    objective: 'Rout the Vale guards',
    map: [
      'ff..^^........ff',
      'f......ff.......',
      '..~~.....~~..ff.',
      '..~~..vv..~~....',
      '......,,......^^',
      '.ff...,,...ff..^',
      '......,,.......f',
      '..F...,,...F....',
      'f.............ff',
      'ff.............f',
    ],
    starts: [[3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9]],
    lordSlot: 10,
    party: [],
    recruits: [],
    npcs: [
      {
        id: 'yvette', x: 6, y: 3, with: null,
        lines: [
          { who: 'yvette', text: 'You came through the Mist! I have been hiding in this village since the hum began. My friends are not themselves.' },
          { who: 'hydra', text: 'We are trying to find the cause. Will you help us stop it?' },
          { who: 'yvette', text: 'Gladly! Ytterbium is small, but I am very reliable.' },
        ],
      },
    ],
    enemies: [
      { id: 'lana', level: 6, x: 2, y: 1, ai: 'aggressive' },
      { id: 'ceres', level: 6, x: 12, y: 2, ai: 'aggressive' },
      { id: 'dizzy', level: 6, x: 4, y: 4, ai: 'aggressive' },
      { id: 'nadia', level: 6, x: 11, y: 4, ai: 'aggressive' },
      { id: 'erin', level: 6, x: 10, y: 1, ai: 'hold' },
      { id: 'holly', level: 6, x: 8, y: 2, ai: 'hold' },
      { id: 'goldie', level: 7, x: 7, y: 1, ai: 'hold' },
    ],
    intro: [
      { who: 'xander', text: 'The Vale of the Rare Earths. Quiet, rich, and very proud. The hum is making them forget their manners.' },
      { who: 'yvette', text: '...Did somebody call my name? I am over in the village! Please be careful, they swing wide.' },
      { who: 'hydra', text: 'Clear the Vale and find Yvette. There is a village in the middle, so stay near it.' },
    ],
    events: [
      {
        when: { turn: 4 },
        spawn: [
          { id: 'sam', level: 5, x: 0, y: 4 },
          { id: 'percy', level: 5, x: 15, y: 4 },
        ],
        lines: [
          { who: 'goldie', text: 'More are coming from the sides! The Vale will not let you pass!' },
          { who: 'hydra', text: 'Reinforcements. Hold the line near the road and let them come to us.' },
        ],
      },
    ],
    outro: [
      { who: 'goldie', text: 'It stopped. For a heartbeat, the hum stopped. Thank you... I felt like myself again.' },
      { who: 'yvette', text: 'The next place is the Actinide Spire. It is a place where the elements burn out quickly. That is where it gets dangerous.' },
      { who: 'hydra', text: 'Then we will be careful, and we will be quick.' },
    ],
  },
  {
    id: 'ch7',
    title: 'The Actinide Spire',
    kicker: 'CHAPTER 7',
    win: 'seize',
    objective: 'Seize the Spire throne with Hydra',
    map: [
      'ff.###_T_###.ff.',
      'f..#__F_F__#...f',
      '...#_______#....',
      '...###_,_###....',
      '..ff..._,..ff...',
      '.....~~,,~~.....',
      '..v..~~,,~~..v..',
      '.....~~,,~~.....',
      'f.....,,,,.....f',
      'ff............ff',
    ],
    starts: [[5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9]],
    lordSlot: 10,
    seize: [7, 0],
    party: [],
    recruits: [],
    enemies: [
      { id: 'thor', level: 7, x: 4, y: 4, ai: 'aggressive' },
      { id: 'curie', level: 7, x: 11, y: 4, ai: 'aggressive' },
      { id: 'ace', level: 7, x: 5, y: 2, ai: 'hold' },
      { id: 'pluto', level: 7, x: 10, y: 2, ai: 'hold' },
      { id: 'fermi', level: 7, x: 6, y: 1, ai: 'hold' },
      { id: 'amy', level: 7, x: 9, y: 1, ai: 'hold' },
      { id: 'uri', level: 9, x: 7, y: 0, ai: 'boss', boss: true },
    ],
    intro: [
      { who: 'yvette', text: 'The Actinide Spire. Everything inside glows, and nothing inside stays still for long.' },
      { who: 'hydra', text: 'Uri holds the throne. If I seize it, the Spire gates open, and the way to the Last Row opens too.' },
      { who: 'neo', text: 'Light and glow are not the same thing as strength. We stay together, and we are fine.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'yvette', text: "Everything glows in here. It is hard to tell friend from foe." },
          { who: 'neo', text: "Foes stand in the light and friends stay close. Stand close, and you will be fine." },
          { who: 'hydra', text: "Watch your footing. Nobody goes ahead alone." },
        ],
      },
      {
        when: { near: 'uri', dist: 4 },
        card: { id: 'uri', name: 'URI', epithet: 'Warden of the Actinide Spire' },
        lines: [
          { who: null, text: 'The Spire glows from the inside, soft and green, like a lantern left burning for a very long time.' },
          { who: 'uri', text: 'Neutron and proton, bound tight. I am the heaviest thing most of the Table will ever meet. Turn back!' },
          { who: 'hydra', text: 'We do not want your throne, Uri. We want the Last Row, and Ogden.' },
          { who: 'uri', text: 'Ogden does not want to be found. The hum is how the last element asks for someone to answer it...' },
          { who: 'yvette', text: 'Then why is it hurting everyone, Uri? Nobody should have to ask for help like that.' },
          { who: 'uri', text: 'Because it does not know how to ask any other way. I cannot let you pass. Not until I know you mean it!' },
        ],
      },
      {
        when: { death: 'uri' },
        lines: [
          { who: 'uri', text: 'Go on. I felt it let go of me. Ogden is not a bad one. Only... very alone.' },
        ],
      },
    ],
    outro: [
      { who: 'uri', text: 'The throne is yours for now. The gate to the Last Row is behind it.' },
      { who: 'hydra', text: 'We will see Ogden. All of us, and we will talk, not fight, if we can.' },
    ],
  },
  {
    id: 'ch8',
    title: 'The Last Row',
    kicker: 'CHAPTER 8',
    win: 'boss',
    objective: 'Defeat Ogden',
    map: [
      '^^^^##__T__##^^^',
      '^f..#_F___F_#..^',
      'f...#_______#...',
      '....###_,_###...',
      '..ff.....,..ff..',
      '.....~~,,,~~....',
      '.....~~,,,~~....',
      '..F..~~,,,~~..F.',
      'f.....,,,,,.....',
      'ff.............f',
    ],
    starts: [[5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9]],
    lordSlot: 10,
    party: [],
    recruits: [],
    enemies: [
      { id: 'tess', level: 8, x: 4, y: 4, ai: 'aggressive' },
      { id: 'liv', level: 8, x: 12, y: 4, ai: 'aggressive' },
      { id: 'mac', level: 8, x: 5, y: 2, ai: 'hold' },
      { id: 'flo', level: 8, x: 10, y: 2, ai: 'hold' },
      { id: 'niko', level: 8, x: 6, y: 1, ai: 'hold' },
      { id: 'ford', level: 8, x: 9, y: 1, ai: 'hold' },
      { id: 'ogden', level: 12, x: 8, y: 0, ai: 'boss', boss: true },
    ],
    intro: [
      { who: null, text: 'At the far edge of the Table, the last row stands alone, a ring of cold stone and one quiet throne. The hum is almost a song here.' },
      { who: 'ronan', text: 'The noble gases are with you, Hydra. Ogden is one of us, in a way, the very last of us. Please be kind.' },
      { who: 'hydra', text: 'I will try. But if I have to fight to be heard, I will.' },
      { who: 'helen', text: 'Whatever happens, we do it together. Everyone is here.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'helen', text: "The hum is louder. It is not an attack. It sounds like someone asking a question." },
          { who: 'hydra', text: "Then we answer it when we reach him. Keep the line tight until then." },
        ],
      },
      {
        when: { near: 'ogden', dist: 4 },
        card: { id: 'ogden', name: 'OGDEN', epithet: 'The Last Element' },
        lines: [
          { who: null, text: 'The hum stops. The whole last row holds its breath. On the lone throne, a figure lifts its head.' },
          { who: 'ogden', text: 'You came all the way here. Nobody ever comes this far. I only wanted someone to answer me.' },
          { who: 'hydra', text: 'We heard you, Ogden. The Static was your call, and it hurt everyone it reached. We are here now.' },
          { who: 'ogden', text: 'I do not know how to stop it. It is part of me. Please, stop me before it tears the Table apart!' },
          { who: 'helen', text: 'He is shaking. He is as scared as we are. Hydra, we can still reach him.' },
          { who: 'hydra', text: 'Then we will. Gently, and together. Everyone, hold nothing back, but do not give up on him.' },
        ],
      },
    ],
    outro: [
      { who: 'ogden', text: 'The hum is quiet. For the first time, it is quiet. Thank you for answering me.' },
      { who: 'hydra', text: 'You are part of the Table, Ogden. The last row, but never the last friend. Come home with us.' },
      { who: null, text: 'And so the Static faded, and every element woke gently from the dream. The Table was whole again, and the last row had friends at last.' },
    ],
  },
];

/**
 * Camp conversations: short talks between party members at the base between chapters.
 * They unlock once chapter `after` (0-based) is cleared. Story only; no stat changes.
 */
const SUPPORTS = [
  { id: 's-hydra-helen', after: 0, title: 'Light Enough to Float', pair: ['hydra', 'helen'], lines: [
    { who: 'helen', text: 'You are very quiet tonight, Hydra. The first battle was hard on everyone.' },
    { who: 'hydra', text: 'I keep thinking about the Raiders. They did not look angry. They looked like they were sleepwalking.' },
    { who: 'helen', text: 'I am light, so I notice when the air changes. The hum does not feel cruel. It feels lonely.' },
    { who: 'hydra', text: 'Then we are not fighting enemies. We are waking up friends.' },
    { who: 'helen', text: 'Exactly. Now eat something. A hero who floats away is no good to anyone.' },
  ] },
  { id: 's-ben-carter', after: 0, title: 'Hard Edges', pair: ['ben', 'carter'], lines: [
    { who: 'carter', text: 'You swing that lance like it weighs nothing. How do you do that, Ben?' },
    { who: 'ben', text: 'Practice. And I never let go of it first. Let go last, hit first.' },
    { who: 'carter', text: 'Hmm. Hard to argue with that. I would like to train with you tomorrow, if you are willing.' },
    { who: 'ben', text: 'Gladly. You are the sturdiest one in camp. I will gladly learn how you stay standing.' },
  ] },
  { id: 's-lillie-nitra', after: 1, title: 'A Spark of Charge', pair: ['lillie', 'nitra'], lines: [
    { who: 'nitra', text: 'Lillie, you are always so ready to run in. Does it never worry you?' },
    { who: 'lillie', text: 'Every time. But my friends are right behind me, so I go anyway.' },
    { who: 'nitra', text: 'I am the opposite. I am slow to start, but I am steady once I do.' },
    { who: 'lillie', text: 'Then we make a good pair. I light the way, and you make sure we arrive.' },
  ] },
  { id: 's-oxana-neo', after: 1, title: 'The Colors of the Gate', pair: ['oxana', 'neo'], lines: [
    { who: 'neo', text: 'Did you see the vault walls today? Every color just kept glowing.' },
    { who: 'oxana', text: 'I did. It was lovely, and it reminded me why we guard the Gate in the first place.' },
    { who: 'neo', text: 'Chroma used to leave the lanterns lit all night, for travelers. I hope he remembers that.' },
    { who: 'oxana', text: 'He will. People remember the best of themselves when someone is kind to them.' },
  ] },
  { id: 's-silas-natalie', after: 2, title: 'Salt and Stone', pair: ['silas', 'natalie'], lines: [
    { who: 'natalie', text: 'Titan is resting now, finally. He kept saying sorry the whole way out of the Core.' },
    { who: 'silas', text: 'He was never a bad one. When something heavy is pushed, it is hard to stop it.' },
    { who: 'natalie', text: 'I am glad we did not have to be harder on him than we were.' },
    { who: 'silas', text: 'The Salt Flats are next. Keep your spirits up and your boots dry.' },
  ] },
  { id: 's-maggie-allen', after: 2, title: 'Late Again', pair: ['maggie', 'allen'], lines: [
    { who: 'allen', text: 'We arrived on turn three. Turn three! The line was nearly done without us.' },
    { who: 'maggie', text: 'We took the lower pass, Allen. That is not late. That is thorough.' },
    { who: 'allen', text: 'Fine. Thorough. But next time I am bringing a map.' },
    { who: 'maggie', text: 'And I will bring snacks. Everyone fights better with snacks.' },
  ] },
  { id: 's-helen-xander', after: 4, title: 'Noble Company', pair: ['helen', 'xander'], lines: [
    { who: 'xander', text: 'The mist is thick, but your light is easy to follow, Helen.' },
    { who: 'helen', text: 'Thank you for joining us, Xander. Most of the noble folk keep to themselves.' },
    { who: 'xander', text: 'We have had a very long quiet, and I did not realize how much I missed company.' },
    { who: 'helen', text: 'Then stay as long as you like. You will find there is always room by the fire.' },
  ] },
  { id: 's-hydra-yvette', after: 5, title: 'Rare Finds', pair: ['hydra', 'yvette'], lines: [
    { who: 'yvette', text: 'The Vale was beautiful before the Static. Every stone here sparkles in a different shade.' },
    { who: 'hydra', text: 'You know this place well. I am glad you came along with us.' },
    { who: 'yvette', text: 'The rare ones get overlooked. It means a lot that you asked me to join.' },
    { who: 'hydra', text: 'Nobody is overlooked in this party. Everyone has a place on the Table.' },
  ] },
  { id: 's-hydra-lillie', after: 6, title: 'The Night Before', pair: ['hydra', 'lillie'], lines: [
    { who: 'lillie', text: 'We are almost at the Last Row. Are you ready?' },
    { who: 'hydra', text: 'I do not think anyone is ever ready. But we are all here, and that is the part that matters.' },
    { who: 'lillie', text: 'Whatever Ogden says, we answer him kindly. Right?' },
    { who: 'hydra', text: 'Right. Get some rest. Tomorrow we finish what the Static started.' },
  ] },
];

export default {
  id: 'atomic-knockout',
  title: 'Atomic Knockout',
  lord: LORD_ID,
  prologue: PROLOGUE,
  chapters: CHAPTERS,
  supports: SUPPORTS,
};
