/**
 * blur-screens.mjs
 * Usage : node scripts/blur-screens.mjs <dossier_sources>
 * Ex    : node scripts/blur-screens.mjs C:\Users\tomro\Desktop\screens_bruts
 *
 * Lit les 5 screenshots depuis le dossier source, floute les zones sensibles,
 * et enregistre les résultats dans public/ (prêts pour la landing page).
 */

import sharp from 'sharp'
import path  from 'path'
import fs    from 'fs'

const src = process.argv[2] ?? 'C:\\Users\\tomro\\Desktop\\screens_bruts'
const dst = path.resolve('public')

if (!fs.existsSync(src)) {
  console.error(`❌ Dossier source introuvable : ${src}`)
  process.exit(1)
}

// ── Helper : floute une liste de rectangles (en % de la taille de l'image)
async function blurRegions(inputPath, outputPath, regions) {
  const img    = sharp(inputPath)
  const meta   = await img.metadata()
  const W      = meta.width
  const H      = meta.height

  // Convertit les % en pixels, floute chaque région, recompose
  let pipeline = sharp(inputPath)

  const overlays = await Promise.all(
    regions.map(async ({ x, y, w, h }) => {
      const px = Math.round(x * W)
      const py = Math.round(y * H)
      const pw = Math.round(w * W)
      const ph = Math.round(h * H)

      // Extrait la zone, la floute fortement, la renvoie comme overlay
      const blurred = await sharp(inputPath)
        .extract({ left: px, top: py, width: pw, height: ph })
        .blur(20)
        .toBuffer()

      return { input: blurred, left: px, top: py }
    })
  )

  await pipeline.composite(overlays).toFile(outputPath)
  console.log(`✅ ${path.basename(outputPath)} — ${regions.length} zone(s) floutée(s)`)
}

// ── Définition des zones à flouter par écran (coordonnées en % de l'image)

const SCREENS = [

  // ── Dashboard mobile — relativement clean, on floute juste les noms de chantiers
  {
    src: 'screen-dashboard.png',
    dst: 'screen-dashboard.png',
    regions: [
      // Description anomalie "Dijoncteur en surchauffe"
      { x: 0.35, y: 0.74, w: 0.55, h: 0.04 },
    ],
  },

  // ── Profil mobile — nom + email
  {
    src: 'screen-profil.png',
    dst: 'screen-profil.png',
    regions: [
      // Nom "Tom ROMAND"
      { x: 0.10, y: 0.24, w: 0.80, h: 0.06 },
      // Email
      { x: 0.10, y: 0.30, w: 0.80, h: 0.05 },
    ],
  },

  // ── Rapport mobile — client, adresse, noms techniciens
  {
    src: 'screen-rapport.png',
    dst: 'screen-rapport.png',
    regions: [
      // "Alexandra PINOT" (sous-titre)
      { x: 0.08, y: 0.02, w: 0.60, h: 0.04 },
      // Chantier "Alexandra Pl..."
      { x: 0.08, y: 0.055, w: 0.70, h: 0.05 },
      // Adresse "1294 chemin de la Bou..."
      { x: 0.08, y: 0.10, w: 0.70, h: 0.04 },
      // "Clément HEDON"
      { x: 0.04, y: 0.32, w: 0.55, h: 0.04 },
      // "Benoît MONTESINOS"
      { x: 0.04, y: 0.60, w: 0.60, h: 0.04 },
    ],
  },

  // ── Étapes mobile — client + adresse en header
  {
    src: 'screen-etapes.png',
    dst: 'screen-etapes.png',
    regions: [
      // "Alexandra PINOT"
      { x: 0.08, y: 0.02, w: 0.60, h: 0.04 },
      // Chantier "Alexandra Pl..."
      { x: 0.08, y: 0.055, w: 0.70, h: 0.05 },
      // Adresse
      { x: 0.08, y: 0.10, w: 0.70, h: 0.04 },
    ],
  },

  // ── Planning desktop — noms colonnes + filtre + "ROMAND tom" + noms chantiers
  {
    src: 'screen-planning.png',
    dst: 'screen-planning.png',
    regions: [
      // "Vue filtrée : PVPilot" (barre orange)
      { x: 0.00, y: 0.07, w: 0.60, h: 0.05 },
      // "ROMAND tom / Admin" (coin haut droite)
      { x: 0.75, y: 0.00, w: 0.25, h: 0.07 },
      // Ligne des noms colonnes (Benoît, Clément, Jules, Mathias, Test, Tom, Vincent...)
      { x: 0.10, y: 0.23, w: 0.90, h: 0.12 },
      // Contenu cellules chantier (toutes les lignes Lun→Ven)
      { x: 0.10, y: 0.35, w: 0.90, h: 0.55 },
    ],
  },
]

// ── Run
;(async () => {
  let ok = 0
  for (const s of SCREENS) {
    const srcPath = path.join(src, s.src)
    const dstPath = path.join(dst, s.dst)

    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️  Fichier manquant (ignoré) : ${srcPath}`)
      continue
    }

    try {
      await blurRegions(srcPath, dstPath, s.regions)
      ok++
    } catch (e) {
      console.error(`❌ Erreur sur ${s.src} :`, e.message)
    }
  }

  console.log(`\n🎉 ${ok}/${SCREENS.length} écrans traités → dossier public/`)
})()
