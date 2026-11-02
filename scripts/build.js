// Minifies css/style.css -> css/style.min.css and js/main.js -> js/main.min.js.
// Usage: npm run build
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const csso = require('csso');

const root = path.join(__dirname, '..');
const file = p => path.join(root, p);
const kb = p => (fs.statSync(file(p)).size / 1024).toFixed(1) + ' KB';

(async () => {
  const js = await minify(fs.readFileSync(file('js/main.js'), 'utf8'), {
    module: true,
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false }
  });
  fs.writeFileSync(file('js/main.min.js'), js.code + '\n');

  const css = csso.minify(fs.readFileSync(file('css/style.css'), 'utf8')).css;
  fs.writeFileSync(file('css/style.min.css'), css + '\n');

  console.log('js/main.js     ', kb('js/main.js'), '->', kb('js/main.min.js'));
  console.log('css/style.css  ', kb('css/style.css'), '->', kb('css/style.min.css'));
})().catch(err => { console.error(err); process.exit(1); });
