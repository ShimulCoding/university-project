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
  
  // Replace `\$\{` with `${`
  let updated = content.replace(/\\\$\\\{/g, '${');
  // Replace `\}` with `}`
  updated = updated.replace(/\\\}/g, '}');

  if (content !== updated) {
    fs.writeFileSync(f, updated);
    count++;
    console.log('Fixed broken URL template in', f);
  }
});

console.log('Total files fixed:', count);
