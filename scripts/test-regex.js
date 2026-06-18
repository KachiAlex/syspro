const str = `<input
  className={\`abc\`}
/>`;
const m = str.match(/<(input|select|textarea)\b([\s\S]*?)>/gi);
console.log('tag match:', m ? 'yes' : 'no');
if (m) {
  const inner = m[0].match(/<(input|select|textarea)\b([\s\S]*?)>/i)[2];
  console.log('inner:', JSON.stringify(inner));
  const tpl = inner.match(/className=\{`([\s\S]*?)`\}/);
  console.log('tpl match:', tpl ? tpl[1] : 'no');
}
