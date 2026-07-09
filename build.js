// build.js
const { execSync } = require('child_process');

console.log('🔨 Building NestJS...');
execSync('npm run build', { stdio: 'inherit' });

console.log('✅ Build complete!');