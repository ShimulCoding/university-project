const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('frontend/src/app/dashboard');
let count = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('buildRelativeHref')) {
    // Search for <Link ... href={buildRelativeHref
    const updated = content.replace(/href=\{buildRelativeHref/g, 'scroll={false} href={buildRelativeHref');
    if (content !== updated) {
      fs.writeFileSync(f, updated);
      count++;
      console.log('Fixed', f);
    }
  }
});
console.log('Total files fixed:', count);
