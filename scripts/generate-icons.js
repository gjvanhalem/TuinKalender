/**
 * One-time icon generation script for Plan-te PWA.
 * Run from the project root: node scripts/generate-icons.js
 *
 * Requires: npm install --save-dev sharp  (in the frontend dir, or globally)
 */

// Resolve sharp from the frontend's node_modules
let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = require(require('path').join(__dirname, '..', 'frontend', 'node_modules', 'sharp'));
}
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'frontend', 'public', 'favicon.svg');
const outDir = path.join(__dirname, '..', 'frontend', 'public', 'icons');

fs.mkdirSync(outDir, { recursive: true });

const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  // Standard icons
  for (const size of [192, 512]) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}x${size}.png`));
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Apple touch icon (180x180, PNG)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // Maskable icon: leaf at ~80% safe zone with surface background
  // Render leaf at 410px then extend to 512px with background colour
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: { r: 242, g: 252, b: 239, alpha: 1 }, // #f2fcef
    })
    .png()
    .toFile(path.join(outDir, 'icon-maskable-512x512.png'));
  console.log('✓ icon-maskable-512x512.png');

  console.log('\nAll icons generated in frontend/public/icons/');
}

generate().catch(err => {
  console.error('Error generating icons:', err.message);
  console.error('Make sure sharp is installed: npm install --save-dev sharp');
  process.exit(1);
});
