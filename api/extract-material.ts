export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Vérification JWT — seuls les utilisateurs connectés peuvent utiliser l'API Anthropic
  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  let content: string
  try {
    const body = await req.json() as { content?: string }
    content = body.content ?? ''
  } catch {
    return new Response(JSON.stringify({ error: 'body invalide' }), { status: 400 })
  }

  if (!content) {
    return new Response(JSON.stringify({ error: 'content manquant' }), { status: 400 })
  }

  // Garde-fou côté serveur — tronquer à 20 000 chars pour rester dans les limites
  const safeContent = content.length > 20_000 ? content.slice(0, 20_000) : content

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'clé API manquante' }), { status: 500 })
  }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Voici le contenu d'un fichier Excel de chantier photovoltaïque.
Extrais uniquement les articles physiques (matériel, fournitures, équipements) avec leur quantité.

N'inclus PAS : lignes de main d'œuvre (MO, pose, technicien, chef d'équipe, journées), frais (déplacement, communication, marge, budget), en-têtes de colonnes, totaux.

Exemples de ce qu'il FAUT inclure : "Panneau solaire 400Wc", "Onduleur 6kW", "Câble solaire 6mm²", "Rail de fixation", "Disjoncteur 32A", "Casque de sécurité".

Retourne UNIQUEMENT un tableau JSON, sans texte autour :
[{"nom":"Panneau solaire 400Wc","qte":"12 u"},{"nom":"Câble solaire 6mm²","qte":"50 m"}]

Contenu du fichier :
${safeContent}`,
        },
      ],
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
    const items = JSON.parse(clean)
    return new Response(JSON.stringify({ items }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'parse error', raw: text }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
