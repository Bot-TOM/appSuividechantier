export const config = { runtime: 'edge' }

// ─── Sécurité : vérifie que l'appel vient bien de Vercel Cron ─────────────────
function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // pas de secret configuré → on laisse passer (dev)
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
  id:            string
  full_name:     string
  email:         string
  role:          string
  entreprise_id: string
}
interface Chantier {
  id:      string
  nom:     string
  statut:  string
  client_nom: string
}
interface Anomalie {
  id:         string
  gravite:    string
  chantier_id: string
}
interface TimeEntry {
  duree_minutes: number
}
interface Note {
  created_at: string
  chantier_id: string
}
interface PushSub {
  endpoint: string
  p256dh:   string
  auth:     string
}

// ─── Semaine précédente ───────────────────────────────────────────────────────
function lastWeekRange(): { start: string; end: string; label: string } {
  const now   = new Date()
  const day   = now.getUTCDay()
  const diff  = day === 0 ? 6 : day - 1           // lundi = 0
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diff - 7)  // lundi semaine passée
  monday.setUTCHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)

  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  return {
    start: monday.toISOString().slice(0, 10),
    end:   sunday.toISOString().slice(0, 10),
    label: `${fmt(monday)} – ${fmt(sunday)}`,
  }
}

// ─── Appel Supabase REST ──────────────────────────────────────────────────────
async function sbFetch(supabaseUrl: string, serviceKey: string, path: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey:        serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept:        'application/json',
    },
  })
  if (!res.ok) return []
  return res.json()
}

// ─── Push notification ────────────────────────────────────────────────────────
async function sendPush(supabaseUrl: string, serviceKey: string, userIds: string[], title: string, body: string) {
  if (!userIds.length) return
  const subs: PushSub[] = await sbFetch(
    supabaseUrl, serviceKey,
    `push_subscriptions?user_id=in.(${userIds.join(',')})&select=endpoint,p256dh,auth`,
  )
  if (!subs.length) return

  // On appelle notre propre Edge Function send-push via le webhook
  // Mais ici on envoie directement via webpush n'est pas dispo en edge runtime
  // → on appelle l'API Supabase send-push
  await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      table:  'weekly_recap',  // table fictive pour le routing
      record: { title, body, userIds },
    }),
  }).catch(() => {/* non bloquant */})
}

// ─── Email via Resend ─────────────────────────────────────────────────────────
async function sendEmail(to: string, name: string, subject: string, html: string) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'PVPilot <recap@mypvpilot.fr>',
      to:      [to],
      subject,
      html,
    }),
  })
}

// ─── HTML de l'email ──────────────────────────────────────────────────────────
function buildEmailHTML(opts: {
  managerName:    string
  weekLabel:      string
  totalChantiers: number
  enCours:        Chantier[]
  bloques:        Chantier[]
  termines:       Chantier[]
  anomaliesHaute: number
  totalHeures:    number
  chantiersInactifs: Chantier[]
}): string {
  const { managerName, weekLabel, totalChantiers, enCours, bloques, termines, anomaliesHaute, totalHeures, chantiersInactifs } = opts

  const chantierRows = enCours.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${c.nom}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${c.client_nom}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">
        <span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:99px;font-size:12px;">En cours</span>
      </td>
    </tr>`).join('')

  const inactifsSection = chantiersInactifs.length ? `
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#92400e;">⚠️ ${chantiersInactifs.length} chantier${chantiersInactifs.length > 1 ? 's' : ''} sans activité depuis +7 jours</p>
      ${chantiersInactifs.map(c => `<p style="margin:4px 0;color:#92400e;font-size:14px;">• ${c.nom} (${c.client_nom})</p>`).join('')}
    </div>` : ''

  const bloquesSection = bloques.length ? `
    <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-weight:600;color:#991b1b;">🚨 ${bloques.length} chantier${bloques.length > 1 ? 's' : ''} bloqué${bloques.length > 1 ? 's' : ''}</p>
      ${bloques.map(c => `<p style="margin:4px 0;color:#991b1b;font-size:14px;">• ${c.nom}</p>`).join('')}
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#EA580C,#F97316);padding:32px 32px 24px;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;">PVPilot</p>
      <h1 style="margin:8px 0 4px;color:#fff;font-size:24px;font-weight:700;">Récap de la semaine</h1>
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">${weekLabel}</p>
    </div>

    <div style="padding:28px 32px;">

      <!-- Salutation -->
      <p style="margin:0 0 24px;color:#374151;">Bonjour ${managerName.split(' ')[0]},</p>

      <!-- KPIs -->
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#111827;">${totalChantiers}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">chantiers actifs</p>
        </div>
        <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#111827;">${Math.round(totalHeures / 60)}h</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">saisies la semaine</p>
        </div>
        <div style="flex:1;background:${anomaliesHaute > 0 ? '#fee2e2' : '#f9fafb'};border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:28px;font-weight:700;color:${anomaliesHaute > 0 ? '#dc2626' : '#111827'};">${anomaliesHaute}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">anomalies haute priorité</p>
        </div>
      </div>

      ${bloquesSection}
      ${inactifsSection}

      <!-- Chantiers en cours -->
      ${enCours.length ? `
      <h2 style="margin:0 0 12px;font-size:16px;color:#111827;">Chantiers en cours (${enCours.length})</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#6b7280;font-weight:500;">Chantier</th>
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#6b7280;font-weight:500;">Client</th>
            <th style="text-align:left;padding:8px 12px;font-size:12px;color:#6b7280;font-weight:500;">Statut</th>
          </tr>
        </thead>
        <tbody>${chantierRows}</tbody>
      </table>` : ''}

      ${termines.length ? `<p style="color:#6b7280;font-size:14px;">✅ ${termines.length} chantier${termines.length > 1 ? 's' : ''} terminé${termines.length > 1 ? 's' : ''} cette semaine : ${termines.map(c => c.nom).join(', ')}</p>` : ''}

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="https://www.mypvpilot.fr" style="display:inline-block;background:linear-gradient(135deg,#EA580C,#F97316);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;">
          Ouvrir le dashboard →
        </a>
      </div>

    </div>

    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">PVPilot · Récap automatique chaque lundi matin</p>
    </div>
  </div>
</body>
</html>`
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (!verifyCron(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabaseUrl = process.env.SUPABASE_URL      ?? ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Config manquante' }), { status: 500 })
  }

  const week = lastWeekRange()

  // 1. Tous les managers (tous entreprises)
  const profiles: Profile[] = await sbFetch(supabaseUrl, serviceKey,
    `profiles?role=eq.manager&select=id,full_name,email,role,entreprise_id`)

  // 2. Grouper par entreprise
  const entreprises = new Map<string, Profile[]>()
  for (const p of profiles) {
    if (!p.entreprise_id) continue
    if (!entreprises.has(p.entreprise_id)) entreprises.set(p.entreprise_id, [])
    entreprises.get(p.entreprise_id)!.push(p)
  }

  const results: string[] = []

  for (const [entrepriseId, managers] of entreprises) {
    // 3. Chantiers de l'entreprise
    const chantiers: Chantier[] = await sbFetch(supabaseUrl, serviceKey,
      `chantiers?entreprise_id=eq.${entrepriseId}&select=id,nom,statut,client_nom`)

    const enCours  = chantiers.filter(c => c.statut === 'en_cours')
    const bloques  = chantiers.filter(c => c.statut === 'bloque')
    const termines = chantiers.filter(c => c.statut === 'termine')

    // 4. Anomalies haute priorité non résolues
    const anomalies: Anomalie[] = await sbFetch(supabaseUrl, serviceKey,
      `anomalies?entreprise_id=eq.${entrepriseId}&gravite=eq.haute&resolu=eq.false&select=id,gravite,chantier_id`)

    // 5. Heures saisies la semaine passée
    const timeEntries: TimeEntry[] = await sbFetch(supabaseUrl, serviceKey,
      `time_entries?entreprise_id=eq.${entrepriseId}&date=gte.${week.start}&date=lte.${week.end}&select=duree_minutes`)
    const totalHeures = timeEntries.reduce((s, t) => s + (t.duree_minutes ?? 0), 0)

    // 6. Chantiers en cours sans rapport depuis 7 jours
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const isoMinus7 = sevenDaysAgo.toISOString().slice(0, 10)

    const recentNotes: Note[] = await sbFetch(supabaseUrl, serviceKey,
      `notes?entreprise_id=eq.${entrepriseId}&created_at=gte.${isoMinus7}T00:00:00&select=chantier_id,created_at`)
    const recentChantierIds = new Set(recentNotes.map(n => n.chantier_id))
    const chantiersInactifs = enCours.filter(c => !recentChantierIds.has(c.id))

    // 7. Contenu du récap
    const totalChantiers = enCours.length + bloques.length
    const pushTitle = `📊 Récap semaine ${week.label}`
    const pushBody  = [
      `${totalChantiers} chantier${totalChantiers > 1 ? 's' : ''} actif${totalChantiers > 1 ? 's' : ''}`,
      totalHeures > 0 ? `${Math.round(totalHeures / 60)}h saisies` : null,
      anomalies.length > 0 ? `🔴 ${anomalies.length} anomalie${anomalies.length > 1 ? 's' : ''} haute priorité` : null,
      chantiersInactifs.length > 0 ? `⚠️ ${chantiersInactifs.length} sans activité` : null,
    ].filter(Boolean).join(' · ')

    // 8. Envoi push + email à chaque manager
    const managerIds = managers.map(m => m.id)
    await sendPush(supabaseUrl, serviceKey, managerIds, pushTitle, pushBody)

    for (const manager of managers) {
      if (!manager.email) continue
      const html = buildEmailHTML({
        managerName: manager.full_name,
        weekLabel:   week.label,
        totalChantiers,
        enCours,
        bloques,
        termines,
        anomaliesHaute: anomalies.length,
        totalHeures,
        chantiersInactifs,
      })
      await sendEmail(
        manager.email,
        manager.full_name,
        `📊 Récap semaine ${week.label} — PVPilot`,
        html,
      )
    }

    results.push(`entreprise ${entrepriseId}: ${managers.length} managers, ${totalChantiers} chantiers, ${Math.round(totalHeures/60)}h`)
  }

  return new Response(JSON.stringify({ ok: true, week: week.label, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
