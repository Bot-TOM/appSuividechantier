export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

export default async function handler(req: Request) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // 1. Vérifier que l'appelant est connecté
  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  // 2. Vérifier que l'appelant est bien manager
  const supabaseUrl  = process.env.SUPABASE_URL ?? ''
  const anonKey      = process.env.SUPABASE_ANON_KEY ?? ''
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Config serveur manquante' }), { status: 500 })
  }

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${auth.userId}&select=role`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const profiles = await profileRes.json() as { role: string }[]
  if (!profiles?.[0] || profiles[0].role !== 'manager') {
    return new Response(JSON.stringify({ error: 'Accès refusé' }), { status: 403 })
  }

  // 3. Lire le body
  let body: { userId?: string; email?: string; password?: string; full_name?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'body invalide' }), { status: 400 })
  }

  const { userId, email, password, full_name } = body
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId manquant' }), { status: 400 })
  }

  // 4. Suppression
  if (req.method === 'DELETE') {
    const delRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    if (!delRes.ok) {
      const err = await delRes.text()
      return new Response(JSON.stringify({ error: 'Erreur suppression', detail: err }), { status: 500 })
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  // 5. Modification (email / password)
  const authPayload: Record<string, string> = {}
  if (email)    authPayload.email    = email
  if (password) authPayload.password = password

  if (Object.keys(authPayload).length > 0) {
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authPayload),
    })
    if (!updateRes.ok) {
      const err = await updateRes.text()
      return new Response(JSON.stringify({ error: 'Erreur mise à jour auth', detail: err }), { status: 500 })
    }
  }

  // 6. Mise à jour du profil (nom + email dans la table profiles)
  const profilePayload: Record<string, string> = {}
  if (full_name) profilePayload.full_name = full_name
  if (email)     profilePayload.email     = email

  if (Object.keys(profilePayload).length > 0) {
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(profilePayload),
    })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}
