export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

export default async function handler(req: Request) {
  if (req.method !== 'DELETE') return new Response('Method Not Allowed', { status: 405 })

  const auth = await verifyAuth(req)
  if ('error' in auth) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })

  const userId     = auth.userId
  const supabaseUrl = process.env.SUPABASE_URL ?? ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

  if (!serviceKey) return new Response(JSON.stringify({ error: 'Config serveur manquante' }), { status: 500 })

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  }

  try {
    // 1. Supprimer les messages chantier
    await fetch(`${supabaseUrl}/rest/v1/messages?user_id=eq.${userId}`, { method: 'DELETE', headers })

    // 2. Supprimer les messages du chat global
    await fetch(`${supabaseUrl}/rest/v1/global_messages?user_id=eq.${userId}`, { method: 'DELETE', headers })

    // 3. Retirer des chantiers assignés
    await fetch(`${supabaseUrl}/rest/v1/chantier_techniciens?technicien_id=eq.${userId}`, { method: 'DELETE', headers })

    // 4. Supprimer les souscriptions push
    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}`, { method: 'DELETE', headers })

    // 5. Anonymiser les documents uploadés (garder le fichier, retirer la référence)
    await fetch(`${supabaseUrl}/rest/v1/documents?uploaded_by=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ uploaded_by: null }),
    })

    // 6. Récupérer le chemin de l'avatar pour le supprimer du Storage
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=avatar_url`,
      { headers }
    )
    const profiles = await profileRes.json() as { avatar_url: string | null }[]
    const avatarUrl = profiles?.[0]?.avatar_url
    if (avatarUrl) {
      const match = avatarUrl.match(/avatars\/([^?]+)/)
      if (match) {
        await fetch(`${supabaseUrl}/storage/v1/object/avatars/${match[1]}`, {
          method: 'DELETE',
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        })
      }
    }

    // 7. Supprimer le compte Auth (cascade : profiles, planning_entries, time_entries, notes, auto_controle, visites_techniques)
    const delRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })

    if (!delRes.ok) {
      const err = await delRes.text()
      return new Response(JSON.stringify({ error: 'Erreur suppression compte', detail: err }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erreur inconnue' }), { status: 500 })
  }
}
