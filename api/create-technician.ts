export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // 1. Vérifier JWT
  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? ''
  const anonKey     = process.env.SUPABASE_ANON_KEY ?? ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Config serveur manquante' }), { status: 500 })
  }

  // 2. Vérifier que l'appelant est manager ou admin
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${auth.userId}&select=role,entreprise_id`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const profiles = await profileRes.json() as { role: string; entreprise_id: string }[]
  const caller = profiles?.[0]

  if (!caller || (caller.role !== 'manager' && caller.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Accès refusé' }), { status: 403 })
  }

  // 3. Lire le body
  let body: { email?: string; password?: string; full_name?: string; poste?: string; entreprise_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body invalide' }), { status: 400 })
  }

  const { email, password, full_name, poste } = body

  if (!email || !password || !full_name) {
    return new Response(JSON.stringify({ error: 'email, password et full_name sont requis' }), { status: 400 })
  }
  if (password.length < 6) {
    return new Response(JSON.stringify({ error: 'Le mot de passe doit contenir au moins 6 caractères' }), { status: 400 })
  }

  // L'entreprise du technicien = celle du manager qui crée (sauf admin qui peut passer une autre)
  const entreprise_id = caller.role === 'admin' && body.entreprise_id
    ? body.entreprise_id
    : caller.entreprise_id

  // 4. Créer le compte via l'API Admin (email_confirm: true = pas besoin de confirmation)
  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,          // compte actif immédiatement, sans email de confirmation
      user_metadata: { full_name, role: 'technicien', entreprise_id },
    }),
  })

  const created = await createRes.json() as { id?: string; message?: string }

  if (!createRes.ok || !created.id) {
    const msg = created.message ?? 'Erreur création compte'
    // Message lisible pour l'email déjà utilisé
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('existe')) {
      return new Response(JSON.stringify({ error: 'Cet email est déjà utilisé' }), { status: 409 })
    }
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }

  // 5. Créer le profil dans la table profiles (upsert pour éviter les doublons)
  await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: created.id,
      email,
      full_name,
      role: 'technicien',
      poste: poste || 'Technicien',
      entreprise_id,
      welcome_email_sent: true,    // pas d'email de bienvenue pour les comptes créés par le manager
    }),
  })

  return new Response(JSON.stringify({ ok: true, userId: created.id }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
