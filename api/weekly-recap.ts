export const config = { runtime: 'edge' }

// ─── Sécurité ─────────────────────────────────────────────────────────────────
function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile       { id: string; full_name: string; email: string; role: string; entreprise_id: string }
interface Chantier      { id: string; nom: string; statut: string; client_nom: string }
interface Etape         { chantier_id: string; statut: string }
interface ChantierTech  { chantier_id: string; technicien_id: string }
interface TimeEntryTech { technicien_id: string; duree_minutes: number }
interface PlanningEntry { technicien_id: string; date: string; type: string; label: string | null }
interface Note          { chantier_id: string; created_at: string }

// ─── Plages de dates ──────────────────────────────────────────────────────────
function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}

function lastWeekRange() {
  const now  = new Date()
  const day  = now.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  const mon  = new Date(now); mon.setUTCDate(now.getUTCDate() - diff - 7); mon.setUTCHours(0,0,0,0)
  const sun  = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6)
  const fmt  = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return { start: isoDate(mon), end: isoDate(sun), label: `${fmt(mon)} – ${fmt(sun)}` }
}

function thisWeekRange() {
  const now  = new Date()
  const day  = now.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  const mon  = new Date(now); mon.setUTCDate(now.getUTCDate() - diff); mon.setUTCHours(0,0,0,0)
  const fri  = new Date(mon); fri.setUTCDate(mon.getUTCDate() + 4)
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mon); d.setUTCDate(mon.getUTCDate() + i)
    return isoDate(d)
  })
  return { start: isoDate(mon), end: isoDate(fri), days }
}

// ─── Appel Supabase REST ──────────────────────────────────────────────────────
async function sb(url: string, key: string, path: string) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) return []
  return res.json()
}

// ─── Push ─────────────────────────────────────────────────────────────────────
async function sendPush(supabaseUrl: string, serviceKey: string, userIds: string[], title: string, body: string) {
  if (!userIds.length) return
  await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'weekly_recap', record: { title, body, userIds } }),
  }).catch(() => {})
}

// ─── Email ────────────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'ChantierPV <recap@mypvpilot.fr>', to: [to], subject, html }),
  })
}

// ─── Jours FR ─────────────────────────────────────────────────────────────────
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

// ─── HTML email ───────────────────────────────────────────────────────────────
function buildHTML(opts: {
  managerName:      string
  weekLabel:        string
  enCours:          Chantier[]
  bloques:          Chantier[]
  termines:         Chantier[]
  chantiersInactifs: Chantier[]
  anomaliesHaute:   number
  totalHeures:      number
  progressMap:      Record<string, { total: number; done: number }>
  techsMap:         Record<string, string[]>
  heuresParTech:    { name: string; minutes: number }[]
  planning:         { date: string; techName: string; label: string; type: string }[]
  planningDays:     string[]
  allTechNames:     string[]
}): string {
  const {
    managerName, weekLabel, enCours, bloques, termines, chantiersInactifs,
    anomaliesHaute, totalHeures, progressMap, techsMap,
    heuresParTech, planning, planningDays, allTechNames,
  } = opts

  const totalActifs = enCours.length + bloques.length

  // ── Chantiers en cours ─────────────────────────────────────────────────────
  const chantierRows = enCours.map(c => {
    const prog  = progressMap[c.id]
    const pct   = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0
    const techs = (techsMap[c.id] ?? []).join(', ') || '—'
    return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top;">
        <div style="font-weight:600;color:#111827;font-size:13px;">${c.nom}</div>
        <div style="color:#9ca3af;font-size:11px;margin-top:2px;">${c.client_nom}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;vertical-align:middle;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${pct}%</div>
        <div style="background:#f3f4f6;border-radius:99px;height:6px;width:100px;">
          <div style="background:${pct === 100 ? '#22c55e' : '#f97316'};width:${pct}%;height:6px;border-radius:99px;"></div>
        </div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top;font-size:12px;color:#6b7280;">${techs}</td>
    </tr>`
  }).join('')

  // ── Planning semaine ───────────────────────────────────────────────────────
  const TYPE_COLOR: Record<string, string> = {
    chantier:          '#dbeafe',
    grand_deplacement: '#fef3c7',
    depot:             '#f3f4f6',
    route:             '#fef9c3',
    repos_conges:      '#ede9fe',
    absent:            '#fee2e2',
    ferie:             '#ede9fe',
    libre:             '#f9fafb',
  }
  const TYPE_TEXT: Record<string, string> = {
    chantier: '#1d4ed8', grand_deplacement: '#92400e', depot: '#6b7280',
    route: '#854d0e', repos_conges: '#6d28d9', absent: '#dc2626',
    ferie: '#6d28d9', libre: '#9ca3af',
  }

  const dayHeaders = planningDays.map(d => {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay()
    const num = new Date(d + 'T00:00:00Z').getUTCDate()
    return `<th style="padding:6px 8px;text-align:center;font-size:11px;color:#9ca3af;font-weight:500;white-space:nowrap;">${JOURS_COURTS[dow]}<br><span style="color:#111827;font-weight:600;">${num}</span></th>`
  }).join('')

  const planningRows = allTechNames.map(techName => {
    const cells = planningDays.map(date => {
      const entry = planning.find(p => p.techName === techName && p.date === date)
      if (!entry || entry.type === 'libre') {
        return `<td style="padding:4px 6px;text-align:center;"></td>`
      }
      const bg   = TYPE_COLOR[entry.type] ?? '#f3f4f6'
      const col  = TYPE_TEXT[entry.type]  ?? '#6b7280'
      const text = entry.label ? entry.label.slice(0, 14) : entry.type === 'repos_conges' ? 'Congés' : entry.type === 'absent' ? 'Absent' : entry.type === 'ferie' ? 'Férié' : entry.type
      return `<td style="padding:4px 6px;text-align:center;"><span style="background:${bg};color:${col};padding:2px 6px;border-radius:6px;font-size:10px;white-space:nowrap;">${text}</span></td>`
    }).join('')
    const firstName = techName.split(' ')[0]
    return `<tr><td style="padding:4px 8px;font-size:12px;color:#374151;white-space:nowrap;font-weight:500;">${firstName}</td>${cells}</tr>`
  }).join('')

  const planningSection = allTechNames.length > 0 ? `
    <h2 style="margin:28px 0 12px;font-size:15px;color:#111827;">Planning cette semaine</h2>
    <div style="overflow-x:auto;">
    <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:12px;overflow:hidden;">
      <thead><tr><th style="padding:6px 8px;text-align:left;font-size:11px;color:#9ca3af;font-weight:500;">Technicien</th>${dayHeaders}</tr></thead>
      <tbody style="background:#fff;">${planningRows}</tbody>
    </table>
    </div>` : ''

  // ── Heures par technicien ──────────────────────────────────────────────────
  const heuresSection = heuresParTech.length > 0 ? `
    <h2 style="margin:28px 0 12px;font-size:15px;color:#111827;">Heures semaine passée</h2>
    <div style="display:flex;flex-wrap:wrap;gap:10px;">
      ${heuresParTech.map(t => `
        <div style="background:#f9fafb;border-radius:10px;padding:10px 16px;text-align:center;min-width:80px;">
          <div style="font-size:18px;font-weight:700;color:#111827;">${Math.round(t.minutes / 60)}h</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${t.name.split(' ')[0]}</div>
        </div>`).join('')}
    </div>` : ''

  // ── Alertes ────────────────────────────────────────────────────────────────
  const bloquesSection = bloques.length ? `
    <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 6px;font-weight:700;color:#991b1b;font-size:14px;">🚨 ${bloques.length} chantier${bloques.length > 1 ? 's' : ''} bloqué${bloques.length > 1 ? 's' : ''}</p>
      ${bloques.map(c => `<p style="margin:2px 0;color:#b91c1c;font-size:13px;">• ${c.nom} — ${c.client_nom}</p>`).join('')}
    </div>` : ''

  const inactifsSection = chantiersInactifs.length ? `
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 6px;font-weight:700;color:#92400e;font-size:14px;">⚠️ ${chantiersInactifs.length} chantier${chantiersInactifs.length > 1 ? 's' : ''} sans activité depuis +7 jours</p>
      ${chantiersInactifs.map(c => `<p style="margin:2px 0;color:#92400e;font-size:13px;">• ${c.nom} — ${c.client_nom}</p>`).join('')}
    </div>` : ''

  const terminesSection = termines.length ? `
    <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
      ✅ ${termines.length} chantier${termines.length > 1 ? 's' : ''} terminé${termines.length > 1 ? 's' : ''} cette semaine : <strong>${termines.map(c => c.nom).join(', ')}</strong>
    </p>` : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Récap ChantierPV</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;">
<div style="max-width:620px;margin:32px auto 64px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#EA580C 0%,#F97316 100%);padding:36px 36px 28px;">
    <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:0.05em;text-transform:uppercase;">ChantierPV</p>
    <h1 style="margin:0 0 6px;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.02em;">Récap de la semaine</h1>
    <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">${weekLabel}</p>
  </div>

  <div style="padding:28px 36px 36px;">
    <p style="margin:0 0 24px;color:#374151;font-size:15px;">Bonjour <strong>${managerName.split(' ')[0]}</strong> 👋</p>

    <!-- KPIs -->
    <div style="display:flex;gap:12px;margin-bottom:8px;">
      <div style="flex:1;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:800;color:#ea580c;">${totalActifs}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#c2410c;">chantiers actifs</p>
      </div>
      <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:800;color:#16a34a;">${Math.round(totalHeures / 60)}h</p>
        <p style="margin:4px 0 0;font-size:12px;color:#15803d;">saisies la semaine</p>
      </div>
      <div style="flex:1;background:${anomaliesHaute > 0 ? '#fef2f2' : '#f9fafb'};border:1px solid ${anomaliesHaute > 0 ? '#fecaca' : '#e5e7eb'};border-radius:14px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:32px;font-weight:800;color:${anomaliesHaute > 0 ? '#dc2626' : '#9ca3af'};">${anomaliesHaute}</p>
        <p style="margin:4px 0 0;font-size:12px;color:${anomaliesHaute > 0 ? '#b91c1c' : '#9ca3af'};">anomalies 🔴</p>
      </div>
    </div>

    ${bloquesSection}
    ${inactifsSection}
    ${terminesSection}

    <!-- Chantiers en cours -->
    ${enCours.length ? `
    <h2 style="margin:28px 0 12px;font-size:15px;color:#111827;">Chantiers en cours (${enCours.length})</h2>
    <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #f3f4f6;">
      <thead style="background:#f9fafb;">
        <tr>
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:#9ca3af;font-weight:500;">Chantier</th>
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:#9ca3af;font-weight:500;">Avancement</th>
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:#9ca3af;font-weight:500;">Équipe</th>
        </tr>
      </thead>
      <tbody>${chantierRows}</tbody>
    </table>` : ''}

    ${planningSection}
    ${heuresSection}

    <!-- CTA -->
    <div style="text-align:center;margin:36px 0 8px;">
      <a href="https://www.mypvpilot.fr" style="display:inline-block;background:linear-gradient(135deg,#EA580C,#F97316);color:#fff;text-decoration:none;padding:16px 40px;border-radius:14px;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
        Ouvrir le dashboard →
      </a>
    </div>
  </div>

  <div style="padding:16px 36px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="margin:0;font-size:11px;color:#d1d5db;">ChantierPV · Récap automatique chaque lundi matin · <a href="https://www.mypvpilot.fr" style="color:#f97316;text-decoration:none;">mypvpilot.fr</a></p>
  </div>
</div>
</body>
</html>`
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!verifyCron(req)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const supabaseUrl = process.env.SUPABASE_URL             ?? ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return new Response(JSON.stringify({ error: 'Config manquante' }), { status: 500 })

  const lastWeek = lastWeekRange()
  const thisWeek = thisWeekRange()
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Managers + admins
  const profiles: Profile[] = await sb(supabaseUrl, serviceKey, `profiles?role=in.(manager,admin)&select=id,full_name,email,role,entreprise_id`)

  // Admins globaux (sans entreprise_id) → reçoivent le récap de toutes les entreprises
  const globalAdmins = profiles.filter(p => p.role === 'admin' && !p.entreprise_id)

  // Grouper par entreprise
  const entreprises = new Map<string, Profile[]>()
  for (const p of profiles) {
    if (!p.entreprise_id) continue
    if (!entreprises.has(p.entreprise_id)) entreprises.set(p.entreprise_id, [])
    entreprises.get(p.entreprise_id)!.push(p)
  }
  // Ajouter les admins globaux à chaque entreprise
  for (const [, members] of entreprises) {
    for (const admin of globalAdmins) {
      if (!members.find(m => m.id === admin.id)) members.push(admin)
    }
  }

  const results: string[] = []

  for (const [entrepriseId, managers] of entreprises) {

    // ── Données par entreprise ──────────────────────────────────────────────
    const [chantiers, etapes, chantierTechs, allTechProfiles, timeEntriesLast, timeEntriesAll, notesRecent, planningThisWeek] = await Promise.all([
      sb(supabaseUrl, serviceKey, `chantiers?entreprise_id=eq.${entrepriseId}&select=id,nom,statut,client_nom`),
      sb(supabaseUrl, serviceKey, `etapes?entreprise_id=eq.${entrepriseId}&select=chantier_id,statut`),
      sb(supabaseUrl, serviceKey, `chantier_techniciens?entreprise_id=eq.${entrepriseId}&select=chantier_id,technicien_id`),
      sb(supabaseUrl, serviceKey, `profiles?entreprise_id=eq.${entrepriseId}&role=eq.technicien&select=id,full_name`),
      sb(supabaseUrl, serviceKey, `time_entries?entreprise_id=eq.${entrepriseId}&date=gte.${lastWeek.start}&date=lte.${lastWeek.end}&select=technicien_id,duree_minutes`),
      sb(supabaseUrl, serviceKey, `time_entries?entreprise_id=eq.${entrepriseId}&date=gte.${lastWeek.start}&date=lte.${lastWeek.end}&select=duree_minutes`),
      sb(supabaseUrl, serviceKey, `notes?entreprise_id=eq.${entrepriseId}&created_at=gte.${isoDate(sevenDaysAgo)}T00:00:00&select=chantier_id,created_at`),
      sb(supabaseUrl, serviceKey, `planning_entries?entreprise_id=eq.${entrepriseId}&date=gte.${thisWeek.start}&date=lte.${thisWeek.end}&select=technicien_id,date,type,label`),
    ]) as [Chantier[], Etape[], ChantierTech[], Profile[], TimeEntryTech[], {duree_minutes:number}[], Note[], PlanningEntry[]]

    const enCours  = chantiers.filter(c => c.statut === 'en_cours')
    const bloques  = chantiers.filter(c => c.statut === 'bloque')
    const termines = chantiers.filter(c => c.statut === 'termine')

    // Anomalies haute priorité
    const anomalies: {id:string}[] = await sb(supabaseUrl, serviceKey,
      `anomalies?entreprise_id=eq.${entrepriseId}&gravite=eq.haute&resolu=eq.false&select=id`)

    // Progression étapes par chantier
    const progressMap: Record<string, { total: number; done: number }> = {}
    for (const e of etapes as Etape[]) {
      if (!progressMap[e.chantier_id]) progressMap[e.chantier_id] = { total: 0, done: 0 }
      progressMap[e.chantier_id].total++
      if (e.statut === 'valide' || e.statut === 'termine') progressMap[e.chantier_id].done++
    }

    // Techniciens par chantier
    const techProfileMap: Record<string, string> = {}
    for (const p of allTechProfiles as Profile[]) techProfileMap[p.id] = p.full_name
    const techsMap: Record<string, string[]> = {}
    for (const ct of chantierTechs as ChantierTech[]) {
      if (!techsMap[ct.chantier_id]) techsMap[ct.chantier_id] = []
      const name = techProfileMap[ct.technicien_id]
      if (name) techsMap[ct.chantier_id].push(name.split(' ')[0]) // prénom seulement
    }

    // Heures par technicien (semaine passée)
    const heuresById: Record<string, number> = {}
    for (const te of timeEntriesLast as TimeEntryTech[]) {
      heuresById[te.technicien_id] = (heuresById[te.technicien_id] ?? 0) + (te.duree_minutes ?? 0)
    }
    const heuresParTech = (allTechProfiles as Profile[])
      .map(p => ({ name: p.full_name, minutes: heuresById[p.id] ?? 0 }))
      .filter(t => t.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)

    // Total heures
    const totalHeures = (timeEntriesAll as {duree_minutes:number}[]).reduce((s, t) => s + (t.duree_minutes ?? 0), 0)

    // Chantiers sans activité depuis 7j
    const recentIds = new Set((notesRecent as Note[]).map(n => n.chantier_id))
    const chantiersInactifs = enCours.filter(c => !recentIds.has(c.id))

    // Planning cette semaine (avec noms)
    const planning = (planningThisWeek as PlanningEntry[]).map(p => ({
      date:     p.date,
      techName: techProfileMap[p.technicien_id] ?? '',
      label:    p.label ?? '',
      type:     p.type,
    })).filter(p => p.techName)

    // Liste des techs qui ont du planning cette semaine
    const allTechNames = [...new Set(planning.map(p => p.techName))].sort()

    // ── Envoi ───────────────────────────────────────────────────────────────
    const pushTitle = `📊 Récap semaine ${lastWeek.label}`
    const pushBody  = [
      `${enCours.length + bloques.length} chantier${enCours.length + bloques.length > 1 ? 's' : ''} actif${enCours.length + bloques.length > 1 ? 's' : ''}`,
      totalHeures > 0 ? `${Math.round(totalHeures / 60)}h saisies` : null,
      anomalies.length > 0 ? `🔴 ${anomalies.length} anomalie${anomalies.length > 1 ? 's' : ''}` : null,
      chantiersInactifs.length > 0 ? `⚠️ ${chantiersInactifs.length} inactif${chantiersInactifs.length > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' · ')

    await sendPush(supabaseUrl, serviceKey, managers.map(m => m.id), pushTitle, pushBody)

    for (const manager of managers) {
      if (!manager.email) continue
      const html = buildHTML({
        managerName: manager.full_name,
        weekLabel:   lastWeek.label,
        enCours, bloques, termines, chantiersInactifs,
        anomaliesHaute: anomalies.length,
        totalHeures, progressMap, techsMap,
        heuresParTech, planning, planningDays: thisWeek.days, allTechNames,
      })
      await sendEmail(manager.email, `📊 Récap semaine ${lastWeek.label} — ChantierPV`, html)
    }

    results.push(`entreprise ${entrepriseId}: ${managers.length} managers, ${enCours.length} chantiers, ${Math.round(totalHeures/60)}h`)
  }

  return new Response(JSON.stringify({ ok: true, week: lastWeek.label, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
