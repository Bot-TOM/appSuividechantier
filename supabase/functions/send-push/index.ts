import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

webpush.setVapidDetails(
  'mailto:contact@chantierpv.fr',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

// ─── Helper : insère une notification dans la table notifications ─────────────
async function insertNotif(
  supabaseUrl: string,
  serviceKey: string,
  type: string,
  message: string,
  chantierId: string | null,
) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        apikey:          serviceKey,
        Authorization:   `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
        Prefer:          'return=minimal',
      },
      body: JSON.stringify({ type, message, chantier_id: chantierId, lu: false }),
    })
  } catch {
    // Ne pas bloquer l'envoi push si l'insert échoue
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Vérification du secret webhook — protège contre les appels externes non autorisés
  // Configurez WEBHOOK_SECRET dans les variables d'environnement de la fonction Supabase
  // et ajoutez le même header dans la configuration du webhook Database → HTTP
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  if (webhookSecret) {
    const providedSecret = req.headers.get('x-webhook-secret')
    const authHeader     = req.headers.get('authorization') ?? ''
    // Accepte aussi les appels internes authentifiés avec la clé service Supabase
    const serviceKey     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const isInternalCall = authHeader === `Bearer ${serviceKey}`
    if (providedSecret !== webhookSecret && !isInternalCall) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const payload = await req.json()
  const { table, record } = payload
  console.log('[send-push] table:', table, 'record.id:', record?.id, 'chantier_id:', record?.chantier_id)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, serviceKey)

  let title = ''
  let body = ''
  let url = '/'
  let recipientIds: string[] = []
  let chatOnly = false
  let prefFilter: string | null = null  // colonne push_subscriptions à filtrer (true requis)
  let notifType:   string | null = null  // type pour la table notifications (null = pas d'insertion)
  let notifChantier: string | null = null

  // ─── Helper : récupère l'entreprise_id d'un chantier ─────────────────────────
  async function managersOf(chantierId: string | null, entrepriseIdDirect?: string | null) {
    let entrepriseId: string | null = entrepriseIdDirect ?? null
    if (!entrepriseId && chantierId) {
      const { data: ch } = await supabase.from('chantiers').select('entreprise_id').eq('id', chantierId).single()
      entrepriseId = ch?.entreprise_id ?? null
    }
    let q = supabase.from('profiles').select('id').in('role', ['manager', 'admin'])
    if (entrepriseId) q = (q as any).eq('entreprise_id', entrepriseId)
    const { data } = await q
    return (data ?? []) as { id: string }[]
  }

  if (table === 'notes') {
    title = '📝 Nouveau message technicien'
    body = record.contenu?.slice(0, 80) ?? 'Un technicien a publié un message'
    const managers = await managersOf(record.chantier_id ?? null)
    recipientIds = managers.map(m => m.id)
    prefFilter = 'rapport_notif_enabled'
    url = record.chantier_id ? `/chantier/${record.chantier_id}?tab=rapport&r=${record.id}` : '/'
    notifType = 'rapport'; notifChantier = record.chantier_id ?? null

  } else if (table === 'auto_controles') {
    title = '✅ Auto-contrôle soumis'
    body = "Un technicien a soumis un rapport d'auto-contrôle"
    const managers = await managersOf(record.chantier_id ?? null)
    recipientIds = managers.map(m => m.id)
    prefFilter = 'autocontrole_notif_enabled'
    url = record.chantier_id ? `/chantier/${record.chantier_id}?tab=autocontrole` : '/'
    notifType = 'autocontrole'; notifChantier = record.chantier_id ?? null

  } else if (table === 'group_messages') {
    // Chat de groupe custom — notif uniquement aux membres du groupe
    chatOnly = true
    const { data: sender } = await supabase
      .from('profiles').select('full_name').eq('id', record.user_id).single()
    const senderName = sender?.full_name ?? 'Quelqu\'un'

    // Nom du groupe
    const { data: grp } = await supabase
      .from('chat_groups').select('name').eq('id', record.group_id).single()
    const groupName = grp?.name ?? 'Groupe'

    title = `💬 ${groupName}`
    body  = `${senderName} : ${record.content?.slice(0, 60) ?? '📎 Fichier'}`

    // Membres du groupe (hors expéditeur)
    const { data: members } = await supabase
      .from('chat_group_members')
      .select('user_id, profiles(role)')
      .eq('group_id', record.group_id)
    const allMemberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
    recipientIds = allMemberIds.filter((id: string) => id !== record.user_id)

    // URLs adaptées par rôle
    const { data: recipientProfiles } = await supabase
      .from('profiles').select('id, role').in('id', recipientIds)
    const managerRecipientIds = (recipientProfiles ?? [])
      .filter((p: { role: string }) => ['manager', 'admin'].includes(p.role))
      .map((p: { id: string }) => p.id)
    const techRecipientIds = (recipientProfiles ?? [])
      .filter((p: { role: string }) => p.role === 'technicien')
      .map((p: { id: string }) => p.id)

    // Envoi séparé par rôle avec URL adaptée
    const sendGroupPush = async (ids: string[], targetUrl: string) => {
      if (!ids.length) return
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', ids)
        .eq('chat_notif_enabled', true)
      if (!subs?.length) return
      const pushPayload = JSON.stringify({ title, body, url: targetUrl })
      await Promise.allSettled(
        subs.map((s: { endpoint: string; p256dh: string; auth: string }) =>
          webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, pushPayload)
        )
      )
    }
    await Promise.all([
      sendGroupPush(managerRecipientIds, '/manager?tab=chat'),
      sendGroupPush(techRecipientIds,    '/technicien?tab=chat'),
    ])
    return new Response(JSON.stringify({ sent: recipientIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } else if (table === 'messages') {
    // Chat par chantier
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
    const managers = await managersOf(record.chantier_id ?? null)

    const allIds = [
      ...(techs?.map((t: { technicien_id: string }) => t.technicien_id) ?? []),
      ...managers.map(m => m.id),
    ]
    recipientIds = [...new Set(allIds)].filter(id => id !== record.user_id)
    url = record.chantier_id ? `/chantier/${record.chantier_id}?tab=chat` : '/'

  } else if (table === 'global_messages') {
    // Chat global — tous les membres de la même entreprise sauf l'expéditeur
    const { data: sender } = await supabase
      .from('profiles').select('full_name').eq('id', record.user_id).single()
    const senderName = sender?.full_name ?? 'Quelqu\'un'
    const notifTitle = '💬 Chat équipe'
    const notifBody  = `${senderName} : ${record.content?.slice(0, 60) ?? '📎 Fichier'}`

    const { data: members } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('entreprise_id', record.entreprise_id)
    const allMembers = (members ?? [] as { id: string; role: string }[]).filter((m: { id: string }) => m.id !== record.user_id)

    // Envoie des pushs séparés par rôle avec URL adaptée
    const sendGroup = async (ids: string[], targetUrl: string) => {
      if (!ids.length) return
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .in('user_id', ids)
        .eq('global_messages_notif_enabled', true)
      if (!subs?.length) return
      const payload = JSON.stringify({ title: notifTitle, body: notifBody, url: targetUrl })
      await Promise.allSettled(
        subs.map((s: { endpoint: string; p256dh: string; auth: string }) =>
          webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        )
      )
    }

    const managerIds = allMembers.filter((m: { role: string }) => ['manager','admin'].includes(m.role)).map((m: { id: string }) => m.id)
    const techIds    = allMembers.filter((m: { role: string }) => m.role === 'technicien').map((m: { id: string }) => m.id)
    await Promise.all([
      sendGroup(managerIds, '/manager?tab=chat'),
      sendGroup(techIds, '/technicien?tab=chat'),
    ])
    return new Response(JSON.stringify({ sent: managerIds.length + techIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } else if (table === 'anomalies') {
    const graviteEmoji = record.gravite === 'haute' ? '🔴' : record.gravite === 'moyenne' ? '🟡' : '🟢'
    title = `${graviteEmoji} Nouvelle anomalie`
    body = `${record.type ?? 'Anomalie'} — ${record.description?.slice(0, 60) ?? ''}`
    const managers = await managersOf(record.chantier_id ?? null)
    recipientIds = managers.map(m => m.id)
    prefFilter = 'anomalie_notif_enabled'
    url = record.chantier_id ? `/chantier/${record.chantier_id}/anomalies` : '/'
    notifType = 'anomalie'; notifChantier = record.chantier_id ?? null

  } else if (table === 'chantiers' && record.statut === 'bloque') {
    title = '🚨 Chantier bloqué'
    body = `${record.nom} est passé en statut Bloqué — action requise`
    const managers = await managersOf(null, record.entreprise_id ?? null)
    recipientIds = managers.map(m => m.id)
    prefFilter = 'chantier_notif_enabled'
    url = record.id ? `/chantier/${record.id}` : '/'
    notifType = 'bloque'; notifChantier = record.id ?? null

  } else if (table === 'chantiers' && record.statut === 'termine') {
    title = '✅ Chantier terminé'
    body = `${record.nom} vient d'être marqué comme terminé`
    const managers = await managersOf(null, record.entreprise_id ?? null)
    recipientIds = managers.map(m => m.id)
    prefFilter = 'chantier_notif_enabled'
    url = record.id ? `/chantier/${record.id}` : '/'
    notifType = 'termine'; notifChantier = record.id ?? null

  } else if (table === 'bug_reports') {
    const sevEmoji = record.severite === 'bloquant' ? '🔴' : '🟡'
    title = `${sevEmoji} Nouveau signalement`
    body = record.description?.slice(0, 80) ?? 'Un utilisateur a signalé un problème'
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    recipientIds = admins?.map((a: { id: string }) => a.id) ?? []
    url = '/'

  } else if (table === 'weekly_recap') {
    // Appelé depuis api/weekly-recap — title/body/userIds déjà calculés
    title = record.title ?? '📊 Récap hebdo'
    body  = record.body  ?? ''
    recipientIds = record.userIds ?? []
    // Les récaps hebdo concernent les heures des techniciens → onglet Mes heures
    url = '/technicien?tab=planning&subtab=heures'

  } else if (table === 'assignation_chantier') {
    // Appelé lors de l'assignation d'un technicien à un chantier
    title = '📋 Nouveau chantier assigné'
    body  = `Vous avez été assigné au chantier : ${record.chantierNom ?? 'Nouveau chantier'}`
    recipientIds = record.technicienIds ?? []
    url = record.chantierId ? `/chantier/${record.chantierId}` : '/'

  } else {
    return new Response(JSON.stringify({ ignored: true, table }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Insertion dans la table notifications (centre de notifs in-app)
  if (notifType && body) {
    await insertNotif(supabaseUrl, serviceKey, notifType, body, notifChantier)
  }

  console.log('[send-push] recipientIds:', recipientIds)

  if (!recipientIds.length) {
    console.log('[send-push] no recipients')
    return new Response(JSON.stringify({ sent: 0, reason: 'no recipients' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Récupère les abonnements push en respectant les préférences
  let query = supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', recipientIds)

  if (chatOnly) {
    query = (query as any).eq('chat_notif_enabled', true)
  } else if (prefFilter) {
    query = (query as any).eq(prefFilter, true)
  }

  const { data: subs, error } = await query
  console.log('[send-push] subs count:', subs?.length ?? 0, 'error:', error?.message)

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0, error: error?.message, reason: 'no subscriptions' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const notifPayload = JSON.stringify({ title, body, url })

  const results = await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notifPayload,
      )
    ),
  )

  const sent   = results.filter((r) => r.status === 'fulfilled').length
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
