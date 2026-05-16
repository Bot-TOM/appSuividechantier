export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Clé API manquante' }), { status: 500 })
  }

  let content: string
  let techniciens: string[]
  try {
    const body = await req.json() as { content?: string; techniciens?: string[] }
    content     = body.content     ?? ''
    techniciens = body.techniciens ?? []
  } catch {
    return new Response(JSON.stringify({ error: 'body invalide' }), { status: 400 })
  }

  if (!content) {
    return new Response(JSON.stringify({ error: 'Contenu manquant' }), { status: 400 })
  }

  // Tronquer si trop long
  const safeContent = content.length > 15_000 ? content.slice(0, 15_000) : content

  const techList = techniciens.length
    ? `Noms exacts des techniciens dans l'équipe :\n${techniciens.map(t => `- ${t}`).join('\n')}`
    : ''

  const prompt = `Tu es un assistant qui analyse des fichiers planning d'entreprise.

${techList}

Voici le contenu brut d'un fichier Excel de planning (converti en texte) :

${safeContent}

Analyse ce planning et extrait TOUTES les entrées qui correspondent à une activité planifiée (chantier, déplacement, congés, absence, etc.).

Pour chaque entrée retourne :
- date : au format YYYY-MM-DD (si l'année n'est pas précisée, utilise 2026)
- technicien : le nom du technicien tel qu'il apparaît dans le fichier (fais correspondre au mieux avec la liste fournie si possible)
- type : UN SEUL parmi ces valeurs exactes → chantier | grand_deplacement | depot | route | repos_conges | absent | ferie | libre
- note : information complémentaire (nom du chantier, ville, etc.) ou chaîne vide

Règles :
- N'invente rien, extrait uniquement ce qui est dans le fichier
- Ignore les cellules vides, les week-ends non travaillés et les jours "Libre" (sauf si explicitement noté)
- Si une cellule dit "Chantier Dupont" → type=chantier, note="Dupont"
- Si une cellule dit "CP" ou "Congés" ou "Vacances" → type=repos_conges
- Si une cellule dit "AT" ou "Arrêt" ou "Malade" → type=absent

Retourne UNIQUEMENT un tableau JSON valide, sans texte autour, sans balises :
[{"date":"2026-05-19","technicien":"Jean Dupont","type":"chantier","note":"Maison Martin"},...]`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.text()
    return new Response(JSON.stringify({ error: 'Erreur Claude', detail: err }), { status: 500 })
  }

  const data = await claudeRes.json() as { content: { type: string; text: string }[] }
  const text = data.content?.[0]?.text?.trim() ?? ''

  try {
    const clean   = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
    const entries = JSON.parse(clean)
    return new Response(JSON.stringify({ entries }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Parsing réponse IA échoué', raw: text.slice(0, 500) }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
