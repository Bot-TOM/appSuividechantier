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
  // Important : inclure des collocations complètes, pas seulement des mots isolés,
  // pour ancrer le contexte et éviter les substitutions phonétiques (ex: "structure" → "instruction")
  const whisperPrompt = [
    // Structures & fixation
    'pose de la structure', 'structure aluminium', 'structure de fixation', 'rails de fixation',
    'rail de fixation', 'liteaux', 'chevrons', 'fixation toiture', 'bac acier', 'écran sous-toiture',
    // Panneaux & câblage
    'pose des panneaux', 'module photovoltaïque', 'panneau solaire', 'câble solaire', 'câblage DC',
    'câblage AC', 'connecteur MC4', 'presse-étoupe', 'lyre', 'coffret DC', 'coffret AC',
    // Onduleurs & électricité
    'onduleur', 'micro-onduleur', 'optimiseur', 'mise en service', 'mise à la terre',
    'parafoudre', 'disjoncteur', 'GTL', 'TGBT', 'tableau général basse tension', 'compteur Linky',
    // Toiture & chantier
    'tuiles', 'ardoise', 'charpente', 'toiture', 'pan de toiture', 'arrivée sur site',
    'fin de journée', 'déchargement', 'livraison matériel', 'chantier', 'visite technique',
    // Mesures & normes
    'puissance crête', 'kWc', 'kWh', 'Wc', 'MPP', 'MPPT', 'string', 'calepinage',
    'injection', 'autoconsommation', 'consuel', 'Enedis', 'ERP', 'pare-feu', 'DC', 'AC',
  ].join(', ')

  const whisperForm = new FormData()
  whisperForm.append('file', audioFile, 'audio.webm')
  whisperForm.append('model', 'whisper-1')
  whisperForm.append('language', 'fr')
  whisperForm.append('prompt', whisperPrompt)
  whisperForm.append('temperature', '0.2')

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
    ? `Chantier : ${context.slice(0, 300)}\n`
    : ''

  const prompt = `${contextClause}Transcription du technicien : "${transcript}"

Réécris ça en 2 à 4 phrases courtes, dans le style d'une note de chantier rédigée directement par le technicien (ton direct, pas de mise en forme). Utilise "je" si le technicien parle seul, "on" ou "nous" s'il mentionne une équipe ou plusieurs personnes. Garde uniquement ce qui est dit, sans rien ajouter. Pas de titre, pas de liste, pas de formule de politesse.`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
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
