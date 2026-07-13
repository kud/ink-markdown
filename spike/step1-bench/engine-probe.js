import { segment } from './src/segment.js';
import { createLayout, sliceLines } from './src/layout.js';
import { fixtures } from './src/fixtures.js';
const now = () => performance.now();
const pct = (a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(p/100*s.length)];};
for (const [name, src] of Object.entries(fixtures())) {
  const layout = createLayout(segment(src), 100);
  const max = Math.max(1, layout.total - 40);
  const tA = [], tB = [];
  for (let i=0;i<2000;i++){
    const off = (i*3)%max;
    let a=now(); const s=sliceLines(layout,off,40); const joined=s.join('\n'); tA.push(now()-a); // path A engine work
    a=now(); const s2=sliceLines(layout,off,56); tB.push(now()-a);                                  // path B engine work
    if(joined.length<0)console.log('x');
  }
  console.log(`${name.padEnd(16)} engine/frame  A(slice+join) p50 ${(pct(tA,50)*1000).toFixed(1)}µs p95 ${(pct(tA,95)*1000).toFixed(1)}µs  |  B(slice) p50 ${(pct(tB,50)*1000).toFixed(1)}µs`);
}
