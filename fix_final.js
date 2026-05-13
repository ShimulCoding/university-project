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
  if (f.endsWith('page.tsx') && !f.replace(/\\/g, '/').endsWith('dashboard/page.tsx') && !f.replace(/\\/g, '/').endsWith('dashboard/controls/page.tsx')) {
    let content = fs.readFileSync(f, 'utf8');

    // Step 1: Add id="details-panel"
    // Find: </Card>\n\n          <div className="space-y-6">
    // Some files might have arbitrary spaces, so we use regex
    const newContent1 = content.replace(/<\/Card>\s*<div className="space-y-6">/g, '</Card>\n\n          <div id="details-panel" className="space-y-6">');
    
    // Step 2: Replace `scroll={false} href={buildRelativeHref(...)` with template literal string
    // e.g. scroll={false} href={buildRelativeHref("/dashboard/audit", params, {\n                              auditLogId: log.id,\n                            })}
    const newContent2 = newContent1.replace(/scroll=\{false\}\s*href=\{buildRelativeHref\(([\s\S]*?)\)\}/g, 'href={`\\$\\{buildRelativeHref($1)\\}#details-panel`}');

    if (content !== newContent2) {
      fs.writeFileSync(f, newContent2);
      count++;
      console.log('Fixed', f);
    }
  }
});

console.log('Total files fixed:', count);
