import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

webpush.setVapidDetails(
  'mailto:admin@solartrack.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const payload = await req.json()

  // Payload from DB webhook: { type, table, record, schema }
  const { table, record } = payload

  let title = ''
  let body  = ''

  if (table === 'notes') {
    title = '📝 Nouveau message technicien'
    body  = record.contenu?.slice(0, 80) ?? 'Un technicien a publié un message'
  } else if (table === 'auto_controles') {
    title = '✅ Auto-contrôle soumis'
    body  = "Un technicien a soumis un rapport d'auto-contrôle"
  } else {
    return new Response(JSON.stringify({ ignored: true, table }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Step 1: get all manager user IDs
  const { data: managers } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'manager')

  if (!managers?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no managers' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const managerIds = managers.map((m) => m.id)

  // Step 2: get their push subscriptions
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', managerIds)

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0, error: error?.message, reason: 'no subscriptions' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const chantierId  = record?.chantier_id ?? ''
  const notifPayload = JSON.stringify({
    title,
    body,
    url: chantierId ? `/chantier/${chantierId}` : '/',
  })

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notifPayload,
      )
    ),
  )

  const sent   = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  // Clean up expired subscriptions (HTTP 410)
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

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
