export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  // Vérification JWT — seuls les utilisateurs connectés peuvent utiliser l'API Anthropic
  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  let imageBase64: string
  let mediaType: string
  try {
    const body = await req.json() as { imageBase64?: string; mediaType?: string }
    imageBase64 = body.imageBase64 ?? ''
    mediaType   = body.mediaType   ?? 'image/jpeg'
  } catch {
    return new Response(JSON.stringify({ error: 'body invalide' }), { status: 400 })
  }

  if (!imageBase64) return new Response(JSON.stringify({ error: 'image manquante' }), { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: 'clé API manquante' }), { status: 500 })

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `Cette image contient une liste de matériel pour une installation photovoltaïque (liste manuscrite ou imprimée).
Vocabulaire courant dans ce domaine : terre, câble, MC4, onduleur, disjoncteur, rail, panneau, fixation, goutte d'eau, presse-étoupe, bornier, interrupteur, coupe-circuit, agrafe, collier, foret, cheville, vis, équipotentielle, IR, DC, AC, IPE, IRVE.

RÈGLE ABSOLUE : transcris chaque nom EXACTEMENT comme il est écrit, lettre par lettre. Ne corrige pas, ne reformule pas, ne remplace pas un mot par un synonyme ou un mot qui ressemble. Si un mot est ambigu, garde ce qui est écrit.

Extrais uniquement les lignes de matériel avec leur quantité si présente. Ignore titres, numéros, statuts, commentaires.
Retourne UNIQUEMENT un tableau JSON valide sans texte autour :
[{"nom":"texte exact","qte":"quantité exacte"}]
Si pas de quantité lisible, omets le champ qte.`,
            },
          ],
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
    return new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ error: 'parse error', raw: text }), { headers: { 'Content-Type': 'application/json' } })
  }
}
