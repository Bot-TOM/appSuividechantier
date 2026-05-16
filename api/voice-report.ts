export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Vérification JWT — seuls les utilisateurs connectés peuvent utiliser l'API
  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!openaiKey || !anthropicKey) {
    return new Response(JSON.stringify({ error: 'Clés API manquantes' }), { status: 500 })
  }

  // Récupération du fichier audio et du contexte depuis le form-data
  let audioFile: File | null = null
  let context = ''
  try {
    const formData = await req.formData()
    audioFile = formData.get('audio') as File | null
    context = (formData.get('context') as string | null) ?? ''
  } catch {
    return new Response(JSON.stringify({ error: 'Formulaire invalide' }), { status: 400 })
  }

  if (!audioFile) {
    return new Response(JSON.stringify({ error: 'Fichier audio manquant' }), { status: 400 })
  }

  // ── ÉTAPE 1 : Transcription avec Whisper ────────────────────────────────────
  // Le prompt aide Whisper à reconnaître le vocabulaire technique photovoltaïque
  const whisperPrompt = [
    'onduleur', 'micro-onduleur', 'optimiseur', 'panneau solaire', 'module photovoltaïque',
    'câble solaire', 'DC', 'AC', 'coffret DC', 'coffret AC', 'parafoudre', 'disjoncteur',
    'rail de fixation', 'lyre', 'presse-étoupe', 'connecteur MC4', 'tracker',
    'toiture', 'bac acier', 'tuiles', 'ardoise', 'charpente', 'liteaux', 'écran sous-toiture',
    'GTL', 'tableau général basse tension', 'TGBT', 'compteur Linky', 'injection', 'autoconsommation',
    'puissance crête', 'Wc', 'kWc', 'kWh', 'MPP', 'MPPT', 'string', 'calepinage',
    'pare-feu', 'ERP', 'mise à la terre', 'masse', 'chantier', 'consuel', 'Enedis',
  ].join(', ')

  const whisperForm = new FormData()
  whisperForm.append('file', audioFile, 'audio.webm')
  whisperForm.append('model', 'whisper-1')
  whisperForm.append('language', 'fr')
  whisperForm.append('prompt', whisperPrompt)

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: whisperForm,
  })

  if (!whisperRes.ok) {
    const err = await whisperRes.text()
    return new Response(JSON.stringify({ error: 'Erreur transcription', detail: err }), { status: 500 })
  }

  const whisperData = await whisperRes.json() as { text: string }
  const transcript = whisperData.text?.trim() ?? ''

  if (!transcript) {
    return new Response(JSON.stringify({ error: 'Transcription vide — réessayez en parlant plus fort' }), { status: 422 })
  }

  // ── ÉTAPE 2 : Génération du rapport avec Claude ─────────────────────────────
  const contextClause = context
    ? `Contexte du chantier : ${context.slice(0, 500)}\n\n`
    : ''

  const prompt = `${contextClause}Voici la transcription brute d'un message vocal d'un technicien photovoltaïque décrivant sa journée de travail :

"${transcript}"

Rédige un rapport d'avancement professionnel et structuré en français, à la troisième personne (ex: "Le technicien a..."), basé UNIQUEMENT sur ce que le technicien a dit.
Le rapport doit :
- Être clair, concis et professionnel (3 à 8 phrases)
- Mentionner les tâches réalisées, l'avancement, les observations importantes
- Signaler tout problème ou blocage évoqué
- Ne rien inventer — si une information n'est pas dans la transcription, ne l'inclus pas

Retourne UNIQUEMENT le texte du rapport, sans titre ni balises.`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!claudeRes.ok) {
    const err = await claudeRes.text()
    return new Response(JSON.stringify({ error: 'Erreur génération rapport', detail: err }), { status: 500 })
  }

  const claudeData = await claudeRes.json() as { content: { type: string; text: string }[] }
  const rapport = claudeData.content?.[0]?.text?.trim() ?? ''

  return new Response(JSON.stringify({ rapport, transcript }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
