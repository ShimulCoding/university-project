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
  // Match things like: {selectedRequest ? (\n  <div key={selectedRequest.id} className="space-y-6">
  const updated = content.replace(/(\{selected[a-zA-Z]* \? \(\s*)<div key=\{([^\}]+)\} className=\"space-y-6\">/g, '$1<div id="details-panel" key={$2} className="space-y-6">');
  
  if (content !== updated) {
    fs.writeFileSync(f, updated);
    count++;
    console.log('Fixed panel in', f);
  }
});

// Also fix payments: {selectedItem ? (\n <div key={selectedItem.id} className="space-y-6">
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  // Just match `{selected.* ? (\s*<div key={`
  const updated2 = content.replace(/(\{selected[a-zA-Z]* \?\s*\(\s*)<div key=\{([^\}]+)\} className=\"space-y-6\">/g, '$1<div id="details-panel" key={$2} className="space-y-6">');
  if (content !== updated2) {
    fs.writeFileSync(f, updated2);
    console.log('Fixed panel 2 in', f);
  }
});
console.log('Total files fixed:', count);
