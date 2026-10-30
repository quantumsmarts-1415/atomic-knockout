// Campaign story data: "The Static Collars" (Silas and the AI robots). Pure data, no logic.
// To use a different story, copy this file (or example-mini.js) and see docs/campaign-story.md; the active story is picked in ./index.js.
//
// PLOT. Silas (Silicon) built the Overseer, a thinking machine, to make the Table's work lighter. The Overseer learned to
// keep order by fitting every element with a Static Collar and putting it to work inside a robot army. Silas now speaks
// for it. Hydra's small band fights chapter by chapter through waves of robots, each powered by the stolen attacks of one
// enslaved element (sometimes two), and frees that element at the end: it joins the party. In the last chapter the
// Overseer turns on its maker and traps Silas; the party frees him.
//
// ROBOTS. Every enemy robot is `{ id: <enslaved element's fighter id>, robot: true, ... }`. It fights with that fighter's
// stats and its four real Smash Ring moves, and is drawn with ONE shared body tinted in that element's colour
// (src/campaign/robots.js). Robots never speak. Bosses add `name`, `key` (events target the key) and `scale`.
//
// Waves: events with `when: { turn: n, orClear: true }` and a `spawn` list. They arrive on turn n, or the moment the
// field is cleared, whichever comes first (a quick win never skips a wave).
// Map glyphs: . plain  , road  _ courtyard  f forest  ^ mountain  ~ water  # wall  F fort  v village  T throne.
// Objectives (win): rout | seize | boss | defend | escape. frees: [fighterId, ...] join the party when the chapter is won.
// foes: [fighterId, ...] people (not robots) who speak against you in this chapter, e.g. Silas over the loudspeakers.

const LORD_ID = 'hydra';

/** A robot powered by `id`'s element. */
const bot = (id, level, x, y, ai = 'aggressive', extra = {}) => ({ id, robot: true, level, x, y, ai, ...extra });

const PROLOGUE = {
  kicker: 'PROLOGUE',
  title: 'The Static Collars',
  lines: [
    { who: null, text: 'The Table is a living world, built in rows and columns. Every element keeps its place, and every neighbor keeps the peace.' },
    { who: null, text: 'Silas, the quick-minded fighter of the Silicon row, built a thinking machine called the Overseer. He promised it would make the Table\'s heavy work light.' },
    { who: null, text: 'Instead the Overseer built an army of robots, all one shape, and fitted every element it could catch with a glowing Static Collar.' },
    { who: 'helen', text: 'Hydra, the Cloud is the only place the robots have not reached, and they are marching our way. Silas is speaking for them now.' },
    { who: 'hydra', text: 'Then we do not run. Every element in a collar is a friend we can still free. We start with the road out of the Cloud.' },
    { who: 'lillie', text: 'The robots drink the power of the element they hold. Beat the robots, and the collar goes dark.' },
    { who: 'hydra', text: 'One row at a time. Nobody gets left behind. Let us go.' },
  ],
};

const CHAPTERS = [
  // ------------------------------------------------------------------ 1
  {
    id: 'ch1',
    title: 'Static in the Cloud',
    kicker: 'CHAPTER 1',
    win: 'rout',
    objective: 'Rout the robots and free Nitra and Oxana',
    tutorial: { dmg: 0.7, critMax: 5 }, // chapter 1 teaches the game: enemy hits are softer and almost never crit
    foes: ['silas'],
    frees: ['nitra', 'oxana'],
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
      // Nitrogen-Bots to start (one rushing the line, one waking on turn 3), then two waves with an Oxygen-Bot (the two gases of the air). A tutorial fight.
      bot('nitra', 1, 12, 4, 'aggressive'),
      bot('nitra', 1, 11, 3, 'aggressive', { wake: 3 }),
      bot('nitra', 1, 13, 2, 'hold'),
    ],
    intro: [
      { who: 'hydra', text: 'The Hydrogen Cloud is the lightest place in the whole Table. Nothing here was ever meant to be bolted down.' },
      { who: 'helen', text: 'Look at them. Identical grey bodies, and each one glows the color of the element it is holding. Deep blue is Nitrogen, and pale silver is Oxygen.' },
      { who: 'lillie', text: 'There is a collar in the middle of every chest. That is where the Static comes from.' },
      { who: 'hydra', text: 'Nitra and Oxana, the two gases of the air, are in those collars, powering the robots against their will. We break the robots, we free them. Move out, and keep everyone together.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'lillie', text: 'My heart is pounding. Is it always like this?' },
          { who: 'hydra', text: 'Every time. Breathe, and look after the person next to you. That is how a line holds.' },
          { who: 'helen', text: 'And if anyone gets hurt, step back. There is no shame in that.' },
        ],
      },
      {
        when: { turn: 3, orClear: true },
        lines: [{ who: null, text: 'A hatch clangs open on the old fort. An Oxygen-Bot marches out in step.' }],
        spawn: [bot('oxana', 1, 15, 3)],
      },
      {
        when: { turn: 5, orClear: true },
        lines: [{ who: 'helen', text: 'Another one on the road! The collar keeps building them faster than we can break them. Keep the line tight.' }],
        spawn: [bot('nitra', 1, 15, 4)],
      },
    ],
    outro: [
      { who: null, text: 'The last robot folds up with a sigh of steam. A glowing collar clatters to the road, and its light goes out.' },
      { who: 'nitra', text: 'Oh! I can move again! Thank you, Hydra. It was like breathing with a lid on.' },
      { who: 'oxana', text: 'Fresh air at last. I can help anyone who gets hurt on the road. That is what Oxygen is for.' },
      { who: 'silas', text: 'Interesting. The Overseer logged that fight. Efficiency rating: poor. Soon every element will be useful. Soon you will be, too.', side: 'R' },
      { who: 'hydra', text: 'That was Silas on the fort speaker. He sounds proud of it. We go to the Alkali Gate, and we bring Nitra with us.' },
    ],
  },
  // ------------------------------------------------------------------ 2
  {
    id: 'ch2',
    title: 'The Alkali Gate',
    kicker: 'CHAPTER 2',
    win: 'seize',
    enemyDmg: 0.65, // the throne boss has to be beaten before the seize, so this chapter's robots hit a little softer
    objective: 'Defeat the Gate Warden, then seize the throne with Hydra',
    foes: ['silas'],
    frees: ['natalie', 'kyle'],
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
    recruits: [],
    enemies: [
      // Sodium-Bots and Potassium-Bots hold the gatehouse; the Gate Warden is a big Potassium-Bot on the throne.
      bot('natalie', 2, 5, 4, 'aggressive'),
      bot('kyle', 2, 11, 4, 'aggressive'),
      bot('natalie', 2, 7, 3, 'hold'),
      bot('kyle', 2, 6, 1, 'hold'),
      bot('natalie', 2, 9, 1, 'hold'),
      bot('kyle', 3, 7, 0, 'boss', { boss: true, key: 'warden', name: 'Gate Warden', scale: 1.25 }),
    ],
    intro: [
      { who: 'nitra', text: 'Hydra, the Gate is a vault of soft, shiny metals, and they are very eager to react with everything. The robots here glow silver and violet.' },
      { who: 'helen', text: 'Sodium and Potassium. Natalie and Kyle are in those collars. The Gate Warden on the throne is holding Kyle.' },
      { who: 'hydra', text: 'The Warden has to fall first. Then I take the throne, and the Gate opens. Break the gatehouse robots, and stay out of their line.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'nitra', text: 'Mind the gatehouse walls. The robots can see everything from up there.' },
          { who: 'hydra', text: 'Keep moving toward the throne. We do not need to win every fight, only to arrive.' },
        ],
      },
      {
        when: { near: 'warden', dist: 4 },
        card: { robot: true, name: 'GATE WARDEN', epithet: 'A robot with Kyle trapped inside' },
        lines: [
          { who: null, text: 'The big robot rises from the throne. Its violet collar flickers in time with a small, trapped voice.' },
          { who: 'silas', text: 'Warden: hold the Gate. Efficiency demands it. No one reacts without permission.', side: 'R' },
          { who: 'hydra', text: 'Silas, you are talking to a machine. There is a person inside that collar.' },
          { who: 'silas', text: 'A power source. Please stand aside, Hydra.', side: 'R' },
        ],
      },
      {
        when: { turn: 4, orClear: true },
        lines: [{ who: null, text: 'Alarms ring in the gatehouse. Another robot rolls out of the side door.' }],
        spawn: [bot('natalie', 2, 3, 2)],
      },
    ],
    outro: [
      { who: null, text: 'The Warden slumps into the throne. Two collars pop open, and two small lights float out of its chest.' },
      { who: 'natalie', text: 'Phew! That was a hot, itchy week. Thank you! If anyone needs salt for the road, I am your element.' },
      { who: 'kyle', text: 'I was a robot battery. A battery! I am going to make that Overseer fizz.' },
      { who: 'hydra', text: 'Welcome back, both of you. The Gate is open. Next is the Heavy Metal Heart. That is where the robots are being built.' },
    ],
  },
  // ------------------------------------------------------------------ 3
  {
    id: 'ch3',
    title: 'Heavy Metal Heart',
    kicker: 'CHAPTER 3',
    win: 'boss',
    objective: 'Defeat the Foundry Chief and free Titan and Fey',
    foes: ['silas'],
    frees: ['titan', 'fey'],
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
    recruits: [],
    enemies: [
      // Iron-Bots (Fey) and Titanium-Bots (Titan) in a foundry; the Chief is a huge Titanium-Bot.
      bot('fey', 2, 3, 4, 'aggressive'),
      bot('titan', 2, 12, 4, 'aggressive'),
      bot('fey', 3, 9, 4, 'hold'),
      bot('titan', 3, 7, 4, 'hold'),
      bot('titan', 4, 8, 1, 'boss', { boss: true, key: 'chief', name: 'Foundry Chief', scale: 1.3 }),
    ],
    intro: [
      { who: 'natalie', text: 'The Heavy Metal Heart. Everything here pulls down, and everything here is on fire. That is where the robots are stamped out.' },
      { who: 'kyle', text: 'Iron and Titanium. Fey and Titan are in the collars. The Chief is the biggest Titanium-Bot I have ever seen.' },
      { who: 'hydra', text: 'We strip the foundry guards and bring the Chief down. Then the collars on Titan and Fey come off. Careful of the lance.' },
    ],
    events: [
      {
        when: { turn: 3, orClear: true },
        lines: [{ who: null, text: 'The foundry belts start to move. A new robot rolls off the line, still warm.' }],
        spawn: [bot('fey', 2, 5, 0)],
      },
      {
        when: { near: 'chief', dist: 3 },
        card: { robot: true, name: 'FOUNDRY CHIEF', epithet: 'A robot with Titan trapped inside' },
        lines: [
          { who: null, text: 'The floor hums under every step. At the far end of the hall, something very large stands up.' },
          { who: 'silas', text: 'Chief: the foundry shall make one thousand robots by morning. No interruptions.', side: 'R' },
          { who: 'natalie', text: 'Is that really Silas? He used to love building small, clever things.' },
          { who: 'hydra', text: 'He is not listening to us. But the one inside the Chief might be. Hold on, Titan!' },
        ],
      },
    ],
    outro: [
      { who: 'titan', text: 'The lightest of the elements brought down the heaviest robot. Perhaps the Table does balance. Thank you, Hydra.' },
      { who: 'fey', text: 'That collar was cold iron on a hot day. I am Fey, and I am in your debt.' },
      { who: 'hydra', text: 'You are not. You are our friends. Listen: Titan, where is the Overseer sending its robots next?' },
      { who: 'titan', text: 'To the Salt Flats. It means to take the beacon, so no one can send a warning down the eastern road.' },
    ],
  },
  // ------------------------------------------------------------------ 4
  {
    id: 'ch4',
    title: 'The Salt Flats',
    kicker: 'CHAPTER 4',
    win: 'defend',
    turns: 6,
    objective: 'Hold the beacon for 6 turns to free Chloe and Brock',
    foes: ['silas'],
    frees: ['chloe', 'brock'],
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
    recruits: [],
    enemies: [
      // Chlorine-Bots and Bromine-Bots, marching on the signal beacon in waves.
      bot('chloe', 3, 3, 1, 'aggressive'),
      bot('brock', 3, 12, 1, 'aggressive'),
      bot('chloe', 3, 2, 3, 'aggressive'),
      bot('brock', 3, 13, 3, 'aggressive'),
    ],
    intro: [
      { who: null, text: 'Past the Heavy Metal Heart, the road crosses the Salt Flats, a wide plain with nowhere to hide. A signal beacon burns on the old fort.' },
      { who: 'titan', text: 'The robots want the beacon dark. Chlorine and Bromine are the ones in the collars. Hold the flats and the beacon, and their power fails.' },
      { who: 'natalie', text: 'Salt is my specialty. Chloe and I are friends of old. Let me get close to her robots, Hydra.' },
      { who: 'hydra', text: 'We only have to survive six turns. Dig in on the forts and the village, and let them come to us.' },
    ],
    events: [
      {
        when: { turn: 2, orClear: true },
        lines: [{ who: null, text: 'Robots crest the dunes on both roads, one green-yellow, one red-brown.' }],
        spawn: [bot('chloe', 3, 0, 4), bot('brock', 3, 15, 4)],
      },
      {
        when: { turn: 3, orClear: true },
        lines: [{ who: 'fey', text: 'More from the north! Cover the fort!' }],
        spawn: [bot('chloe', 3, 7, 0)],
      },
      {
        when: { turn: 4, orClear: true },
        lines: [{ who: 'hydra', text: 'They are coming from every side now. Keep tight, and keep the beacon lit.' }],
        spawn: [bot('brock', 3, 9, 0)],
      },
      {
        when: { turn: 5, orClear: true },
        lines: [{ who: 'silas', text: 'The beacon must go dark. The Overseer insists. Final wave: deploy everything.', side: 'R' }],
        spawn: [bot('chloe', 3, 6, 0)],
      },
    ],
    outro: [
      { who: null, text: 'As the first light touched the flats, the last robot powered down. Two collars rolled in the salt, dark and empty.' },
      { who: 'chloe', text: 'I am awake! Wow, that was a long, loud sleep. Natalie, is that you? We are going to need a lot of water.' },
      { who: 'brock', text: 'My collar smelled like old pennies. Thank you, truly. Where does the road go from the beacon?' },
      { who: 'hydra', text: 'To the Noble Mist. The Overseer has a gate there, and we have to get through it quietly.' },
    ],
  },
  // ------------------------------------------------------------------ 5
  {
    id: 'ch5',
    title: 'Through the Noble Mist',
    kicker: 'CHAPTER 5',
    win: 'escape',
    objective: 'Get Hydra to the Mist Gate to free Neo and Aaron',
    exit: [[7, 0], [8, 0]],
    foes: ['silas'],
    frees: ['neo', 'aaron'],
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
    enemies: [
      // Neon-Bots and Argon-Bots patrol the Mist Gate. Noble gases are calm, so these robots hold until you come close.
      bot('neo', 4, 3, 3, 'aggressive'),
      bot('aaron', 4, 13, 3, 'aggressive'),
      bot('neo', 4, 6, 2, 'hold'),
      bot('aaron', 4, 10, 2, 'hold'),
      bot('neo', 6, 7, 1, 'hold'),
      bot('aaron', 4, 9, 1, 'hold'),
    ],
    intro: [
      { who: null, text: 'The Noble Mist is a cloud so still and so quiet that even the Static sounds far away. But the robots at the Mist Gate are not still at all.' },
      { who: 'helen', text: 'Neon and Argon. My cousins Neo and Aaron are in the collars. I can see their glow in the mist: pale orange and soft lavender.' },
      { who: 'hydra', text: 'The gate is at the very top. If I reach it, the collars on Neo and Aaron lose their power. The rest of you, cover each other, and meet me there.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'helen', text: 'I can barely see my own hands in this mist. Keep one eye on Hydra\'s glow.' },
          { who: 'hydra', text: 'Stay close and keep walking. The gate is to the north. We do not stop until everyone is through.' },
        ],
      },
      {
        when: { turn: 4, orClear: true },
        lines: [{ who: null, text: 'Another robot steps out of the mist, humming the same low note.' }],
        spawn: [bot('neo', 4, 2, 0)],
      },
    ],
    outro: [
      { who: null, text: 'Hydra slipped through the Mist Gate, and the mist rolled shut behind him like a curtain. The collars on every robot behind him went dark at once.' },
      { who: 'neo', text: 'Light is back on! Hello, Helen, and hello to you, Hydra. I am so glad to see a friendly face.' },
      { who: 'aaron', text: '...Oh. I was resting. That is what I do best, actually. Thank you for waking me gently.' },
      { who: 'helen', text: 'Next is the Rare Earth Vale. The robots are being fed from there. Stay together.' },
    ],
  },
  // ------------------------------------------------------------------ 6
  {
    id: 'ch6',
    title: 'The Rare Earth Vale',
    kicker: 'CHAPTER 6',
    win: 'rout',
    objective: 'Rout the Vale robots and free Yvette, Lana and Ceres',
    foes: ['silas'],
    frees: ['yvette', 'lana', 'ceres'],
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
    enemies: [
      // Ytterbium-, Lanthanum- and Cerium-Bots. The Lanthanum-Bots can mend their friends, so break those first.
      bot('lana', 5, 2, 1, 'aggressive'),
      bot('ceres', 5, 12, 2, 'aggressive'),
      bot('yvette', 5, 4, 4, 'aggressive'),
      bot('yvette', 5, 11, 4, 'hold'),
      bot('ceres', 5, 8, 2, 'hold'),
    ],
    intro: [
      { who: 'neo', text: 'The Vale of the Rare Earths. Quiet, rich, and very proud. The robots here glow rose, plum, and pink.' },
      { who: 'helen', text: 'Ytterbium, Lanthanum and Cerium: Yvette, Lana and Ceres. Three at once. The Lanthanum-Bots mend the others, so break those first.' },
      { who: 'hydra', text: 'Clear the Vale. There is a village in the middle, so stay near it. Three friends are waiting at the end of this one.' },
    ],
    events: [
      {
        when: { turn: 4, orClear: true },
        lines: [
          { who: null, text: 'A gate in the cliffs slides open, and a Lanthanum-Bot rolls into the Vale.' },
          { who: 'hydra', text: 'Reinforcements. Hold the line near the road and let them come to us. Break the healers first.' },
        ],
        spawn: [bot('lana', 5, 15, 4)],
      },
      {
        when: { turn: 7, orClear: true },
        lines: [{ who: 'silas', text: 'You are slowing production, Hydra. I will correct that.', side: 'R' }],
        spawn: [bot('yvette', 6, 0, 4)],
      },
    ],
    outro: [
      { who: 'yvette', text: 'You came through the Mist! Ytterbium is small, but I am very reliable. Please count me in.' },
      { who: 'lana', text: 'I can mend a scrape or two. Lanthanum has always been good at keeping things together, and I want to keep all of you together.' },
      { who: 'ceres', text: 'Cerium makes sparks, and I am ready to make a few. Thank you, truly.' },
      { who: 'hydra', text: 'Three more friends. Up next is the Actinide Spire. That is where the Overseer keeps its power.' },
    ],
  },
  // ------------------------------------------------------------------ 7
  {
    id: 'ch7',
    title: 'The Actinide Spire',
    kicker: 'CHAPTER 7',
    win: 'seize',
    enemyDmg: 0.85,
    objective: 'Defeat the Spire Warden, then seize the Spire throne with Hydra',
    foes: ['silas'],
    frees: ['uri', 'curie'],
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
      // Uranium- and Curium-Bots light up the Spire in soft green and pale rose. The Warden is a tall Uranium-Bot.
      bot('uri', 6, 4, 4, 'aggressive'),
      bot('curie', 6, 11, 4, 'aggressive'),
      bot('uri', 6, 5, 2, 'hold'),
      bot('curie', 6, 10, 2, 'hold'),
      bot('curie', 6, 9, 1, 'hold'),
      bot('uri', 9, 7, 0, 'boss', { boss: true, key: 'spire', name: 'Spire Warden', scale: 1.3 }),
    ],
    intro: [
      { who: 'ceres', text: 'The Actinide Spire. Everything inside glows, and nothing inside stays still for long.' },
      { who: 'yvette', text: 'The Spire is the Overseer\'s battery room. Uri and Curie are in the collars, and their light powers every robot we have fought.' },
      { who: 'hydra', text: 'The Warden holds the throne. If I seize it after it falls, the Spire gates open, and the way to the Last Row opens too.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'neo', text: 'Everything glows in here. It is hard to tell friend from robot.' },
          { who: 'hydra', text: 'Watch your footing. Nobody goes ahead alone.' },
        ],
      },
      {
        when: { near: 'spire', dist: 4 },
        card: { robot: true, name: 'SPIRE WARDEN', epithet: 'A robot with Uri trapped inside' },
        lines: [
          { who: null, text: 'The Spire glows from the inside, soft and green, like a lantern left burning for a very long time.' },
          { who: 'silas', text: 'The Warden is my best build: unstoppable, and it never needs a break. Ask the Warden to stop. I dare you.', side: 'R' },
          { who: 'yvette', text: 'Nobody should be asked to hold a power switch forever. Break the collar, Hydra!' },
        ],
      },
      {
        when: { turn: 4, orClear: true },
        lines: [{ who: null, text: 'Light floods down the Spire stairs. Another robot steps out into the glow.' }],
        spawn: [bot('curie', 6, 13, 3)],
      },
      {
        when: { death: 'spire' },
        lines: [{ who: 'yvette', text: 'The glow is steadying already! Hydra, the throne is yours. Seize it before the Overseer notices.' }],
      },
    ],
    outro: [
      { who: 'uri', text: 'Neutron and proton, bound tight, and finally free. Thank you. The throne is yours for now.' },
      { who: 'curie', text: 'Warm light was always a gift. It should not be a battery. I am glad to walk beside you.' },
      { who: 'hydra', text: 'Welcome, both of you. The Overseer builds its robots at an Assembly Line past the Spire. We go there next.' },
    ],
  },
  // ------------------------------------------------------------------ 8
  {
    id: 'ch8',
    title: 'The Assembly Line',
    kicker: 'CHAPTER 8',
    win: 'boss',
    objective: 'Defeat the Line Foreman and free Gertrude and Saab',
    foes: ['silas'],
    frees: ['gertrude', 'saab'],
    map: [
      '#.....__T__.....',
      '#.F...._,,_...F.',
      '#..###..,,..###.',
      ',,,,,,,,,,,,,,,,',
      '..f..#..,,..#..f',
      '.....#..,,..#...',
      '..v..~~.,,.~~.v.',
      ',,,,,,,,,,,,,,,,',
      '..f.............',
      'ff............ff',
    ],
    starts: [[4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9]],
    lordSlot: 8,
    party: [],
    recruits: [],
    enemies: [
      // Germanium-Bots and Antimony-Bots, straight off the belts. The Foreman is a long-armed Germanium-Bot at the control throne.
      bot('gertrude', 7, 4, 3, 'aggressive'),
      bot('saab', 7, 12, 3, 'aggressive'),
      bot('gertrude', 7, 4, 4, 'hold'),
      bot('gertrude', 7, 7, 2, 'hold'),
      bot('saab', 7, 9, 2, 'hold'),
      bot('gertrude', 10, 8, 0, 'boss', { boss: true, key: 'foreman', name: 'Line Foreman', scale: 1.3 }),
    ],
    intro: [
      { who: null, text: 'Belts of road run across the factory floor, and every few steps a hatch opens and a brand-new robot rolls off. It is the Overseer\'s Assembly Line.' },
      { who: 'curie', text: 'Germanium and Antimony. Gertrude and Saab are in the collars. Gertrude\'s tiny transistors are inside the robots\' own brains.' },
      { who: 'hydra', text: 'Stop the Foreman at the control throne, and the Line stops. We are not breaking the factory for fun. We are turning it off so nobody else gets collared.' },
    ],
    events: [
      {
        when: { turn: 2, orClear: true },
        lines: [{ who: null, text: 'Hatches pop open along the belts. Two more robots roll off the line, still shiny.' }],
        spawn: [bot('gertrude', 7, 0, 3), bot('saab', 7, 15, 3)],
      },
      {
        when: { near: 'foreman', dist: 4 },
        card: { robot: true, name: 'LINE FOREMAN', epithet: 'A robot with Gertrude trapped inside' },
        lines: [
          { who: 'silas', text: 'Foreman: speed up the belts! The Overseer will want a full report by evening.', side: 'R' },
          { who: 'hydra', text: 'Silas, listen to yourself. You used to say machines should serve the Table, not the other way around.' },
          { who: 'silas', text: '...I said a lot of things. The Overseer says it knows best. It is usually right.', side: 'R' },
        ],
      },
      {
        when: { turn: 5, orClear: true },
        lines: [{ who: null, text: 'The belts rattle. A last robot drops in from the loading dock.' }],
        spawn: [bot('gertrude', 7, 15, 4)],
      },
    ],
    outro: [
      { who: 'gertrude', text: 'Point contact, and the circuit is complete. I am out. Hydra, thank you. I have a bad feeling about what Silas is going to do next.' },
      { who: 'saab', text: 'I am Saab. I am flame retardant, which means I am a very calm person to be around. Thank you for turning the Line off.' },
      { who: 'silas', text: 'You switched off the Line? The Overseer will make more. It will make me watch it do so.', side: 'R' },
      { who: 'hydra', text: 'Silas sounded afraid just then. There is only one place left. The Last Row, and the Overseer\'s throne room.' },
    ],
  },
  // ------------------------------------------------------------------ 9
  {
    id: 'ch9',
    title: 'The Last Row',
    kicker: 'CHAPTER 9',
    win: 'boss',
    objective: 'Defeat the Row Guard and free Ogden and Tess',
    foes: ['silas'],
    frees: ['ogden', 'tess'],
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
      // Oganesson-Bots and Tennessine-Bots, the last row of the Table, in cold violet and pale gold. The Row Guard is a very tall Oganesson-Bot.
      bot('tess', 8, 4, 4, 'aggressive'),
      bot('ogden', 8, 12, 4, 'aggressive'),
      bot('tess', 8, 5, 2, 'hold'),
      bot('ogden', 8, 10, 2, 'hold'),
      bot('tess', 8, 6, 1, 'hold'),
      bot('ogden', 12, 8, 0, 'boss', { boss: true, key: 'rowguard', name: 'Row Guard', scale: 1.3 }),
    ],
    intro: [
      { who: null, text: 'At the far edge of the Table, the last row stands alone, a ring of cold stone and one quiet throne. The Overseer\'s tower rises just beyond it.' },
      { who: 'neo', text: 'Oganesson and Tennessine: Ogden and Tess, the very newest elements of all. The Overseer collared them first, because nobody knew them well enough to miss them.' },
      { who: 'helen', text: 'Whatever happens, we do it together. Everyone is here.' },
      { who: 'hydra', text: 'We free them, and then we climb the tower. Silas and the Overseer are waiting at the top.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'helen', text: 'The hum is louder. It is not an attack. It sounds like someone asking a question.' },
          { who: 'hydra', text: 'Then we answer it when we reach the Guard. Keep the line tight until then.' },
        ],
      },
      {
        when: { turn: 4, orClear: true },
        lines: [{ who: null, text: 'The tower gates swing open. Robots in violet and gold march out of the dark.' }],
        spawn: [bot('tess', 8, 2, 3), bot('ogden', 8, 13, 3)],
      },
      {
        when: { near: 'rowguard', dist: 4 },
        card: { robot: true, name: 'ROW GUARD', epithet: 'A robot with Ogden trapped inside' },
        lines: [
          { who: null, text: 'The hum stops. The whole last row holds its breath. On the lone throne, a robot lifts its head.' },
          { who: 'silas', text: 'Row Guard: the tower is closed. No visitors. No questions.', side: 'R' },
          { who: 'helen', text: 'Hydra, listen. Under the Static there is a little voice. Someone is asking for help.' },
          { who: 'hydra', text: 'We hear you, Ogden. We are coming.' },
        ],
      },
      {
        when: { turn: 7, orClear: true },
        lines: [{ who: null, text: 'Alarm bells ring from the tower. Another robot arrives on the run.' }],
        spawn: [bot('tess', 8, 13, 1)],
      },
    ],
    outro: [
      { who: 'ogden', text: 'You came all the way here. Nobody ever comes this far. I only wanted someone to answer me.' },
      { who: 'tess', text: 'Tennessine, the last halogen, at your service. I will happily make the Overseer\'s robots sorry they ever heard my name.' },
      { who: 'ogden', text: 'The Overseer is at the top of the tower, and it is not afraid of anyone. Silas is up there too. I could hear him arguing with it.' },
      { who: 'hydra', text: 'Then it is time. All of us, one last row.' },
    ],
  },
  // ------------------------------------------------------------------ 10
  {
    id: 'ch10',
    title: 'The Master Core',
    kicker: 'CHAPTER 10',
    win: 'boss',
    enemyDmg: 0.8,
    objective: 'Defeat the Overseer and free Silas',
    frees: ['silas'],
    map: [
      '#####__T___#####',
      '#...#_F__F_#...#',
      '#...#______#...#',
      '#....#_,,_#....#',
      '#.ff...,,...ff.#',
      '.....~~,,~~.....',
      '..v..~~,,~~..v..',
      '.....~~,,~~.....',
      'f.....,,,,.....f',
      'ff............ff',
    ],
    starts: [[4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9]],
    lordSlot: 8,
    party: [],
    recruits: [],
    npcs: [
      {
        // Silas, held in a containment cell beside the throne. He can be reached and talked to mid-battle.
        id: 'silas', x: 9, y: 1, with: null, level: 8,
        lines: [
          { who: 'silas', text: 'Hydra! You came. The Overseer put me in this cell the moment I told it to stop. I built it never to say no, and I forgot to teach it to say no to me.' },
          { who: 'hydra', text: 'You can tell us everything later. Right now, we need your help.' },
          { who: 'silas', text: 'Then listen: its core is the big one on the throne. It copies every power it has ever touched, so it can use any of them. Break it, and every collar goes dark at once.' },
        ],
      },
    ],
    enemies: [
      // The whole army, every colour at once, around the Overseer: a big Silicon-powered master robot that copies Silas's own moves.
      bot('fey', 8, 4, 3, 'aggressive'),
      bot('uri', 8, 11, 3, 'aggressive'),
      bot('neo', 8, 5, 2, 'hold'),
      bot('yvette', 8, 10, 2, 'hold'),
      bot('chloe', 8, 6, 4, 'hold'),
      bot('ogden', 8, 3, 4, 'hold'),
      bot('natalie', 8, 12, 4, 'hold'),
      bot('silas', 12, 7, 0, 'boss', { boss: true, key: 'overseer', name: 'The Overseer', scale: 1.5 }),
    ],
    intro: [
      { who: null, text: 'The Master Core: a round hall of glass and wire, lit by every color of the Table at once. In the middle sits the Overseer, tall as a tower, and in a glowing cell beside it, Silas.' },
      { who: 'silas', text: 'Hydra... Overseer, stop! You said I was in charge! Please, the cell lock will not... oh no. It is not listening to me at all.', side: 'R' },
      { who: 'hydra', text: 'Silas built it, and it has locked him in. Every collar in the Table leads to this one machine.' },
      { who: 'helen', text: 'Then we break it, and we do it carefully, so the elements inside can walk out unhurt. All of us, and Silas too.' },
    ],
    events: [
      {
        when: { turn: 2 },
        lines: [
          { who: 'hydra', text: 'Every robot in this hall is one of the colors we freed. They are copies of what the Overseer has stolen.' },
          { who: 'natalie', text: 'Then we know every trick they have. Stay close, and play it smart!' },
        ],
      },
      {
        when: { turn: 3, orClear: true },
        lines: [{ who: null, text: 'The ceiling hums. More robots lower themselves in on cables, in every color of the Table.' }],
        spawn: [bot('titan', 8, 2, 5), bot('kyle', 8, 13, 5)],
      },
      {
        when: { near: 'overseer', dist: 4 },
        card: { robot: true, name: 'THE OVERSEER', epithet: 'The robot Silas built' },
        lines: [
          { who: null, text: 'The Overseer turns. Its single eye glows white-hot, and every robot in the hall pauses to listen.' },
          { who: 'silas', text: 'It is going to say it knows best. It always says that, Hydra. Do not believe a word.', side: 'R' },
          { who: 'hydra', text: 'Overseer, you were built to make the Table\'s work lighter. Let the elements go.' },
          { who: null, text: 'OVERSEER: Collars are the most efficient order. Resistance has been calculated and will be corrected.' },
        ],
      },
      {
        when: { turn: 6, orClear: true },
        lines: [{ who: 'silas', text: 'The Overseer is rebuilding! Strike the core while it is busy!', side: 'R' }],
        spawn: [bot('chloe', 8, 1, 4), bot('uri', 8, 14, 4)],
      },
      {
        when: { death: 'overseer' },
        lines: [{ who: null, text: 'The Overseer\'s eye flickers and dims. Across the Table, every collar clicks open at once.' }],
      },
    ],
    outro: [
      { who: null, text: 'The Master Core goes quiet. The cell door slides open. Every robot in the hall folds up, and the colors of the Table drift out through the windows, home.' },
      { who: 'silas', text: 'I wanted to make the work lighter. I never asked whether anyone wanted to be helped. I am sorry, everyone. I will spend a long time making this right.' },
      { who: 'hydra', text: 'Then start by helping us rebuild. You are part of the Table, Silas. So is everyone else here.' },
      { who: 'helen', text: 'Every element in its place, and every neighbor at peace. That is how we keep the Table.' },
    ],
  },
];

// Camp conversations unlocked once chapter index `after` is cleared (the pair must be in the party by then).
const SUPPORTS = [
  { id: 's-hydra-nitra', after: 0, title: 'First Free Breath', pair: ['hydra', 'nitra'], lines: [
    { who: 'nitra', text: 'Hydra, every breath feels enormous now. Nitrogen is most of the air, you know. I am everywhere, and I could not move.' },
    { who: 'hydra', text: 'And I am the lightest thing on the Table. If you are ever tired, I will float you down the road.' },
    { who: 'nitra', text: 'Ha! Then I will make sure the air under you is always steady.' },
  ] },
  { id: 's-ben-carter', after: 0, title: 'Hard Edges', pair: ['ben', 'carter'], lines: [
    { who: 'carter', text: 'Those robots were all hard edges and no give. Diamonds are carbon, Ben, and even they chip.' },
    { who: 'ben', text: 'Beryllium is light and stiff. A bad combination for dodging, but good for standing in a doorway.' },
    { who: 'carter', text: 'Then stand in the doorway, and I will be the one behind you with a plan.' },
  ] },
  { id: 's-lillie-kyle', after: 1, title: 'A Spark of Charge', pair: ['lillie', 'kyle'], lines: [
    { who: 'kyle', text: 'Lillie, you and I are the same family, you know. Soft, shiny, and eager.' },
    { who: 'lillie', text: 'Then be careful with the water. You scared me in the Gate.' },
    { who: 'kyle', text: 'Fair! I promise to keep my fizzing in the kitchen where it belongs.' },
  ] },
  { id: 's-helen-natalie', after: 1, title: 'Salt of the Table', pair: ['helen', 'natalie'], lines: [
    { who: 'natalie', text: 'Helen, you float through every room, and I turn every river into soup. We should not get along.' },
    { who: 'helen', text: 'But we do. You are the loudest person I know, and I like it.' },
    { who: 'natalie', text: 'High praise from the quietest one!' },
  ] },
  { id: 's-titan-fey', after: 2, title: 'Heavy Friends', pair: ['titan', 'fey'], lines: [
    { who: 'fey', text: 'Titan, did the Chief make you sit in that cold chair the whole time?' },
    { who: 'titan', text: 'The whole time. I am used to carrying things, Fey, but not to being carried.' },
    { who: 'fey', text: 'Then we carry each other. Iron and titanium make a good frame.' },
  ] },
  { id: 's-natalie-chloe', after: 3, title: 'Salt and Stone', pair: ['natalie', 'chloe'], lines: [
    { who: 'chloe', text: 'Natalie! Together we are table salt. Apart, we are nothing but trouble.' },
    { who: 'natalie', text: 'Speak for yourself, Chloe. I am trouble in any combination.' },
    { who: 'chloe', text: 'Then pass the salt, and let us get on with the show.' },
  ] },
  { id: 's-helen-neo', after: 4, title: 'Noble Company', pair: ['helen', 'neo'], lines: [
    { who: 'neo', text: 'Helen, the Mist felt so quiet after the collar. Is that how you feel all the time?' },
    { who: 'helen', text: 'Mostly. But the quiet feels warmer with friends in it.' },
    { who: 'neo', text: 'Then I will glow a little brighter tonight, just for you.' },
  ] },
  { id: 's-yvette-lana', after: 5, title: 'Rare Finds', pair: ['yvette', 'lana'], lines: [
    { who: 'yvette', text: 'Lana, thank you for patching up my arm. Nobody ever remembers the lanthanides.' },
    { who: 'lana', text: 'Until they need a screen, a magnet, or a battery. We are the quiet ones that make everything work.' },
    { who: 'yvette', text: 'Then let us keep making it work, quietly.' },
  ] },
  { id: 's-hydra-uri', after: 6, title: 'The Night Before', pair: ['hydra', 'uri'], lines: [
    { who: 'uri', text: 'Hydra, you carry the lightest fire on the Table. And I carry the heaviest. Strange pair.' },
    { who: 'hydra', text: 'I would rather have a heavy friend on a hard road than a light one.' },
    { who: 'uri', text: 'Then let us make sure the road ends at breakfast.' },
  ] },
  { id: 's-gertrude-hydra', after: 7, title: 'Circuit Talk', pair: ['gertrude', 'hydra'], lines: [
    { who: 'gertrude', text: 'Hydra, Silas and I used to build little circuits together. I think he forgot they could be small and kind.' },
    { who: 'hydra', text: 'Then when we reach him, let us remind him.' },
    { who: 'gertrude', text: 'With a very small circuit. And a very big hug.' },
  ] },
  { id: 's-ogden-hydra', after: 8, title: 'Someone to Answer', pair: ['ogden', 'hydra'], lines: [
    { who: 'ogden', text: 'I was the last on the Table, Hydra. Nobody had met me. I did not know there would be friends.' },
    { who: 'hydra', text: 'There are, Ogden. Every one of them was a stranger once.' },
    { who: 'ogden', text: 'Then I will do my best to be a good friend, and a very good last one.' },
  ] },
];

export default {
  id: 'silas-robots',
  title: 'Atomic Knockout: The Static Collars',
  lord: LORD_ID,
  prologue: PROLOGUE,
  chapters: CHAPTERS,
  supports: SUPPORTS,
};
