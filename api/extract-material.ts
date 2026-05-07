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
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Voici le contenu d'un fichier Excel de listing matériel de chantier photovoltaïque.
Extrais uniquement les éléments matériels : leur nom et leur quantité.
Ignore les lignes d'en-tête, les numéros de référence, les descriptions longues, les colonnes de statut ou d'observations.
Retourne UNIQUEMENT un tableau JSON valide, sans texte autour, sous cette forme exacte :
[{"nom":"Casque de sécurité","qte":"1 u"},{"nom":"Câble solaire","qte":"100 m"}]

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
