import fs from 'fs';
import path from 'path';

// Find the built assets
const clientDir = 'dist/client';
const assetsDir = path.join(clientDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('Assets directory not found');
  process.exit(1);
}

// Find CSS and JS files
const assets = fs.readdirSync(assetsDir);
const cssFile = assets.find(file => file.startsWith('styles-') && file.endsWith('.css'));
const jsFile = assets.find(file => file.startsWith('index-') && file.endsWith('.js') && file.includes('DElXnIhX')); // The main bundle

if (!cssFile || !jsFile) {
  // Fallback: find the largest JS file
  const jsFiles = assets.filter(file => file.endsWith('.js'));
  const largestJs = jsFiles.sort((a, b) => {
    const statA = fs.statSync(path.join(assetsDir, a));
    const statB = fs.statSync(path.join(assetsDir, b));
    return statB.size - statA.size;
  })[0];
  
  console.log('Found files:', { cssFile, jsFile: largestJs });
  
  // Create HTML with dynamic asset references
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Study Arena</title>
    ${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}">` : ''}
</head>
<body>
    <div id="root"></div>
    ${largestJs ? `<script type="module" src="/assets/${largestJs}"></script>` : ''}
</body>
</html>`;

  fs.writeFileSync(path.join(clientDir, 'index.html'), html);
  console.log('Created index.html with assets:', { cssFile, jsFile: largestJs });
} else {
  console.log('Found files:', { cssFile, jsFile });
  
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Study Arena</title>
    <link rel="stylesheet" href="/assets/${cssFile}">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/assets/${jsFile}"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(clientDir, 'index.html'), html);
  console.log('Created index.html');
}