import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')

// Fond orange + soleil blanc au centre
async function generateIcon(size, outputPath) {
  const radius = Math.round(size * 0.18)
  const cx = size / 2
  const cy = size / 2

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#f97316"/>
      <!-- Cercle central (soleil) -->
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="white"/>
      <!-- Rayons -->
      ${[0,45,90,135,180,225,270,315].map(angle => {
        const rad = (angle * Math.PI) / 180
        const r1 = radius + size * 0.07
        const r2 = radius + size * 0.16
        const x1 = cx + r1 * Math.cos(rad)
        const y1 = cy + r1 * Math.sin(rad)
        const x2 = cx + r2 * Math.cos(rad)
        const y2 = cy + r2 * Math.sin(rad)
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="white" stroke-width="${Math.round(size * 0.055)}" stroke-linecap="round"/>`
      }).join('')}
    </svg>`

  await sharp(Buffer.from(svg)).png().toFile(outputPath)
  console.log(`✓ ${outputPath}`)
}

await generateIcon(192, `${publicDir}/pwa-192.png`)
await generateIcon(512, `${publicDir}/pwa-512.png`)
await generateIcon(180, `${publicDir}/apple-touch-icon.png`)
console.log('Icônes PWA générées.')
