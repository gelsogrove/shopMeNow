const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const srcDir = path.join(__dirname, '../src/templates');
const destDir = path.join(__dirname, '../dist/src/templates');

console.log('📁 Copying templates from:', srcDir);
console.log('📁 To:', destDir);

copyRecursive(srcDir, destDir);

console.log('✅ Templates copied successfully');
