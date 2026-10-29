// AI-vs-AI beatability check: plays the whole campaign in order with the autoplay AI (retrying a chapter
// after a defeat, like a player would), over many seeds. Prints per-chapter first-try win rate and turns.
//   node tools/campaign-balance.mjs [seeds=30] [srcDir=../src]
const seeds = Number(process.argv[2] || 30);
const src = process.argv[3] ? new URL(`file://${process.argv[3]}/`) : new URL('../src/', import.meta.url);
const m = await import(new URL('campaign/index.js', src));
const { newCampaign, createBattle, autoplayChapter, afterVictory, CHAPTERS } = m;
const stats = CHAPTERS.map(() => ({ tries: 0, wins: 0, turns: 0, lost: 0 }));
let cleared = 0;
for (let seed = 1; seed <= seeds; seed++) {
  let save = newCampaign();
  let ok = true;
  for (let ci = 0; ci < CHAPTERS.length && ok; ci++) {
    let won = false;
    for (let attempt = 0; attempt < 3 && !won; attempt++) {
      const b = createBattle(save, ci, seed * 100 + ci * 7 + attempt);
      const r = autoplayChapter(b, 40);
      stats[ci].tries++;
      if (r.result === 'victory') {
        won = true;
        if (attempt === 0) stats[ci].wins++;
        stats[ci].turns += r.turns;
        stats[ci].lost += b.fallen().length;
        save = afterVictory(save, ci, b.commit());
      }
    }
    if (!won) ok = false;
  }
  if (ok) cleared++;
}
console.log('chapter  first-try win%  avg turns  avg allies lost');
stats.forEach((s, i) => console.log(`${String(i + 1).padStart(5)}  ${String(Math.round((100 * s.wins) / seeds)).padStart(12)}  ${(s.turns / Math.max(1, s.wins)).toFixed(1).padStart(9)}  ${(s.lost / Math.max(1, s.wins)).toFixed(1).padStart(10)}`));
console.log(`full campaign cleared with <=3 tries per chapter: ${cleared}/${seeds}`);
