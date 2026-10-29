// A tiny, complete story to copy from (one chapter, no extras). It is not used by the game;
// tests/campaign.test.js checks that it validates and plays. See docs/campaign-story.md.
export default {
  id: 'example-mini',
  title: 'Example Story',
  lord: 'hydra',                       // the unit that must survive; must be in chapter 1's party
  prologue: {
    kicker: 'PROLOGUE',
    title: 'A Quiet Morning',
    lines: [
      { who: null, text: 'Narration uses who: null.' },
      { who: 'hydra', text: 'Dialogue uses a fighter id. Portraits come from the fighter art.' },
    ],
  },
  chapters: [
    {
      id: 'ex1',
      kicker: 'CHAPTER 1',
      title: 'First Steps',
      objective: 'Rout the enemy',
      win: 'rout',                      // rout | seize | boss | defend | escape
      map: [                            // . plain  , road  _ courtyard  f forest  ^ mountain  ~ water  # wall  F fort  v village  T throne
        '..........',
        '..ff....F.',
        ',,,,,,,,,,',
        '..f...~~..',
        '..........',
      ],
      starts: [[0, 2], [1, 2], [0, 1], [0, 3]],   // player start tiles [x, y], one per party member
      lordSlot: 0,                                // which start tile the lord takes
      party: [                                    // chapter 1 only: later chapters carry the saved party
        { id: 'hydra', level: 1, lord: true },
        { id: 'helen', level: 1 },
        { id: 'ben', level: 1 },
      ],
      enemies: [
        { id: 'chloe', level: 1, x: 8, y: 2, ai: 'aggressive' },   // ai: aggressive | hold | boss
        { id: 'cal', level: 1, x: 9, y: 3, ai: 'hold' },
      ],
      intro: [{ who: 'hydra', text: 'Shown before the battle.' }],
      outro: [{ who: 'hydra', text: 'Shown after the victory.' }],
      events: [
        { when: { turn: 2 }, lines: [{ who: 'helen', text: 'Plays at the start of turn 2.' }] },
      ],
    },
  ],
  supports: [                                     // optional camp conversations, unlocked after chapter index `after` is cleared
    { id: 's-ex', after: 0, title: 'Camp Talk', pair: ['hydra', 'helen'], lines: [{ who: 'helen', text: 'A camp conversation.' }] },
  ],
};
