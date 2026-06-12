// Génère public/og-image.png (1200x630) pour les partages LinkedIn/réseaux sociaux
import sharp from 'sharp'

const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="sun" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="80" r="300" fill="#f97316" opacity="0.08"/>
  <circle cx="100" cy="580" r="250" fill="#f97316" opacity="0.06"/>

  <rect x="80" y="100" width="96" height="96" rx="24" fill="url(#sun)"/>
  <g transform="translate(104, 124)" stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none">
    <circle cx="24" cy="24" r="10"/>
    <line x1="24" y1="2" x2="24" y2="8"/>
    <line x1="24" y1="40" x2="24" y2="46"/>
    <line x1="2" y1="24" x2="8" y2="24"/>
    <line x1="40" y1="24" x2="46" y2="24"/>
    <line x1="8.5" y1="8.5" x2="12.7" y2="12.7"/>
    <line x1="35.3" y1="35.3" x2="39.5" y2="39.5"/>
    <line x1="8.5" y1="39.5" x2="12.7" y2="35.3"/>
    <line x1="35.3" y1="12.7" x2="39.5" y2="8.5"/>
  </g>

  <text x="210" y="170" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="bold" fill="#ffffff">ChantierPV</text>

  <text x="80" y="320" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="bold" fill="#ffffff">Le suivi terrain de vos chantiers</text>
  <text x="80" y="390" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="bold" fill="#f97316">photovolta&#239;ques</text>

  <text x="80" y="470" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#94a3b8">Du planning au rapport client &#8212; con&#231;u par un installateur PV,</text>
  <text x="80" y="512" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#94a3b8">pour les installateurs PV.</text>

  <rect x="80" y="555" width="320" height="2" fill="#f97316" opacity="0.5"/>
  <text x="80" y="600" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" fill="#fb923c">chantierpv.fr</text>
</svg>
`

await sharp(Buffer.from(svg)).png().toFile('public/og-image.png')
console.log('✅ public/og-image.png généré (1200x630)')
