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
  // First, undo the id="details-panel" on the inner div if it exists from previous script
  content = content.replace(/<div id="details-panel" key=\{([^\}]+)\} className="space-y-6">/g, '<div key={$1} className="space-y-6">');
  
  // Now add id="details-panel" to the top level column
  // Looking for: </Card>\n\n          <div className="space-y-6">
  const updated = content.replace(/<\/Card>\s*<div className="space-y-6">/g, '</Card>\n\n          <div id="details-panel" className="space-y-6">');
  
  if (content !== updated) {
    fs.writeFileSync(f, updated);
    count++;
    console.log('Fixed panel container in', f);
  }
});

console.log('Total files fixed:', count);
