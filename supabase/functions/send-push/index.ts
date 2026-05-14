import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

webpush.setVapidDetails(
  'mailto:contact@mypvpilot.fr',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const payload = await req.json()
  const { table, record } = payload
  console.log('[send-push] table:', table, 'record.id:', record?.id, 'chantier_id:', record?.chantier_id)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let title = ''
  let body = ''
  let recipientIds: string[] = []
  let chatOnly = false

  if (table === 'notes') {
    title = '📝 Nouveau message technicien'
    body = record.contenu?.slice(0, 80) ?? 'Un technicien a publié un message'
    const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'manager')
    recipientIds = managers?.map((m: { id: string }) => m.id) ?? []

  } else if (table === 'auto_controles') {
    title = '✅ Auto-contrôle soumis'
    body = "Un technicien a soumis un rapport d'auto-contrôle"
    const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'manager')
    recipientIds = managers?.map((m: { id: string }) => m.id) ?? []

  } else if (table === 'messages') {
    chatOnly = true
    const { data: sender } = await supabase
      .from('profiles').select('full_name').eq('id', record.user_id).single()
    const senderName = sender?.full_name ?? 'Quelqu\'un'
    title = '💬 Nouveau message'
    body = `${senderName} : ${record.content?.slice(0, 60) ?? '📎 Fichier'}`

    const { data: techs } = await supabase
      .from('chantier_techniciens')
      .select('technicien_id')
      .eq('chantier_id', record.chantier_id)
    const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'manager')

    const allIds = [
      ...(techs?.map((t: { technicien_id: string }) => t.technicien_id) ?? []),
      ...(managers?.map((m: { id: string }) => m.id) ?? []),
    ]
    recipientIds = [...new Set(allIds)].filter(id => id !== record.user_id)

  } else if (table === 'anomalies') {
    const graviteEmoji = record.gravite === 'haute' ? '🔴' : record.gravite === 'moyenne' ? '🟡' : '🟢'
    title = `${graviteEmoji} Nouvelle anomalie`
    body = `${record.type ?? 'Anomalie'} — ${record.description?.slice(0, 60) ?? ''}`
    const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'manager')
    recipientIds = managers?.map((m: { id: string }) => m.id) ?? []

  } else if (table === 'chantiers' && record.statut === 'bloque') {
    title = '🚨 Chantier bloqué'
    body = `${record.nom} est passé en statut Bloqué — action requise`
    const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'manager')
    recipientIds = managers?.map((m: { id: string }) => m.id) ?? []

  } else if (table === 'chantiers' && record.statut === 'termine') {
    title = '✅ Chantier terminé'
    body = `${record.nom} vient d'être marqué comme terminé`
    const { data: managers } = await supabase.from('profiles').select('id').eq('role', 'manager')
    recipientIds = managers?.map((m: { id: string }) => m.id) ?? []

  } else if (table === 'bug_reports') {
    const sevEmoji = record.severite === 'bloquant' ? '🔴' : '🟡'
    title = `${sevEmoji} Nouveau signalement`
    body = record.description?.slice(0, 80) ?? 'Un utilisateur a signalé un problème'
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    recipientIds = admins?.map((a: { id: string }) => a.id) ?? []

  } else {
    return new Response(JSON.stringify({ ignored: true, table }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('[send-push] recipientIds:', recipientIds)

  if (!recipientIds.length) {
    console.log('[send-push] no recipients')
    return new Response(JSON.stringify({ sent: 0, reason: 'no recipients' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Récupère les abonnements push (filtre notif chat si désactivées)
  let query = supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', recipientIds)

  if (chatOnly) {
    query = (query as any).eq('chat_notif_enabled', true)
  }

  const { data: subs, error } = await query
  console.log('[send-push] subs count:', subs?.length ?? 0, 'error:', error?.message)

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0, error: error?.message, reason: 'no subscriptions' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Pour la table chantiers, l'id du chantier est record.id directement
  const chantierId = table === 'chantiers' ? (record?.id ?? '') : (record?.chantier_id ?? '')
  const url = chantierId
    ? (chatOnly ? `/chantier/${chantierId}?tab=chat` : `/chantier/${chantierId}`)
    : '/'
  const notifPayload = JSON.stringify({
    title,
    body,
    url,
  })

  const results = await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notifPayload,
      )
    ),
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  // Nettoie les abonnements expirés (HTTP 410)
  const expiredEndpoints: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as { statusCode?: number }
      if (err?.statusCode === 410) expiredEndpoints.push(subs[i].endpoint)
    }
  })
  if (expiredEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }

  console.log('[send-push] result — sent:', sent, 'failed:', failed)
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.log('[send-push] failed sub', i, ':', (r.reason as any)?.statusCode, (r.reason as any)?.body)
  })

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
