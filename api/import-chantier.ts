export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

export interface ImportedFile {
  name: string
  mimeType: string
  data?: string   // base64 pour PDF / images
  text?: string   // texte brut pour Excel/CSV/Word
}

export interface ImportResult {
  chantier: {
    nom: string
    client_nom: string
    client_adresse: string
    client_telephone: string | null
    type_installation: string
    puissance_kwc: number | null
    nb_panneaux: number
    statut: 'planifie' | 'en_attente' | 'en_cours' | 'termine' | 'bloque'
    date_prevue: string | null
    date_fin_prevue: string | null
  }
  etapes: { nom: string; statut: 'non_fait' | 'en_cours' | 'fait'; ordre: number }[]
  rapports: { message: string }[]
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const auth = await verifyAuth(req)
  if ('error' in auth) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })

  let files: ImportedFile[]
  try {
    const body = await req.json() as { files?: ImportedFile[] }
    files = body.files ?? []
  } catch {
    return new Response(JSON.stringify({ error: 'body invalide' }), { status: 400 })
  }

  if (!files.length) return new Response(JSON.stringify({ error: 'aucun fichier' }), { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: 'clé API manquante' }), { status: 500 })

  // Construit le contenu du message pour Claude
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlocks: any[] = []

  for (const file of files) {
    const isPdf   = file.mimeType === 'application/pdf'
    const isImage = file.mimeType.startsWith('image/')

    if ((isPdf || isImage) && file.data) {
      contentBlocks.push({
        type: isPdf ? 'document' : 'image',
        source: { type: 'base64', media_type: file.mimeType, data: file.data },
        ...(isPdf ? { title: file.name } : {}),
      })
    } else if (file.text) {
      // Excel, CSV, Word → texte brut
      const safe = file.text.length > 15_000 ? file.text.slice(0, 15_000) : file.text
      contentBlocks.push({ type: 'text', text: `Fichier : ${file.name}\n\n${safe}` })
    }
  }

  contentBlocks.push({
    type: 'text',
    text: `Tu es un expert en chantiers photovoltaïques. Analyse les documents ci-dessus (rapports, devis, suivi de chantier, photos…) et extrais les informations structurées.

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte (sans texte autour, sans bloc markdown) :
{
  "chantier": {
    "nom": "nom du chantier ou du client si pas de nom explicite",
    "client_nom": "prénom + nom du client",
    "client_adresse": "adresse complète du chantier",
    "client_telephone": "numéro ou null",
    "type_installation": "Toiture résidentielle | Toiture commerciale | Ombrière | Sol | Façade | Autre",
    "puissance_kwc": nombre décimal ou null,
    "nb_panneaux": nombre entier (0 si inconnu),
    "statut": "planifie | en_attente | en_cours | termine | bloque",
    "date_prevue": "YYYY-MM-DD ou null",
    "date_fin_prevue": "YYYY-MM-DD ou null"
  },
  "etapes": [
    { "nom": "nom étape", "statut": "non_fait | en_cours | fait", "ordre": 1 }
  ],
  "rapports": [
    { "message": "texte du rapport / compte-rendu détecté" }
  ]
}

Règles :
- Si une information n'est pas trouvée, mets null (pas de valeur inventée).
- Pour les étapes, liste les phases de travaux mentionnées dans l'ordre logique.
- Pour les rapports, inclus les comptes-rendus, observations ou journaux trouvés.
- Si aucune étape n'est détectée, retourne un tableau vide [].
- Si aucun rapport n'est détecté, retourne un tableau vide [].`,
  })

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: contentBlocks }],
    }),
  })

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text()
    return new Response(JSON.stringify({ error: 'Anthropic error', detail: err }), { status: 500 })
  }

  const data = await anthropicRes.json() as { content: { type: string; text: string }[] }
  const text = data.content?.[0]?.text ?? ''

  try {
    const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
    const result: ImportResult = JSON.parse(clean)
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ error: 'parse error', raw: text }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
