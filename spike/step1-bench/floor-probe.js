import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
const h = React.createElement;
const now = () => performance.now();
const inst = render(h(Text, null, 'n=0'));
const t = [];
for (let i = 1; i <= 200; i++) { const a = now(); inst.rerender(h(Text, null, 'n=' + i)); t.push(now() - a); }
inst.unmount();
t.sort((a,b)=>a-b);
const p=(x)=>t[Math.floor(x/100*t.length)].toFixed(2);
console.log(`trivial <Text> rerender ×200 — min ${t[0].toFixed(2)}ms  p50 ${p(50)}ms  p95 ${p(95)}ms  max ${t[t.length-1].toFixed(2)}ms`);
