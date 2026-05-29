export const config = { runtime: 'edge' }

// ─── Sécurité ─────────────────────────────────────────────────────────────────
function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile      { id: string; full_name: string; role: string; entreprise_id: string }
interface TimeEntry    { technicien_id: string; date: string }
interface PlanningEntry { technicien_id: string; date: string; type: string }

// ─── Types de planning qui exemptent du rappel ────────────────────────────────
const EXEMPT_TYPES = new Set(['absent', 'repos_conges', 'ferie'])

// ─── Utilitaires date ─────────────────────────────────────────────────────────
function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}

// Retourne les 5 jours ouvrés de la semaine en cours (lun → ven)
function thisWeekDays(): string[] {
  const now  = new Date()
  const day  = now.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  const mon  = new Date(now)
  mon.setUTCDate(now.getUTCDate() - diff)
  mon.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mon)
    d.setUTCDate(mon.getUTCDate() + i)
    return isoDate(d)
  })
}

// Calcul jours fériés français (algorithme de Meeus/Jones/Butcher)
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, n: number): string {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + n)
  return isoDate(d)
}

function getFeries(year: number): Set<string> {
  const e = easterSunday(year)
  return new Set([
    `${year}-01-01`, addDays(e, 1),   `${year}-05-01`, `${year}-05-08`,
    addDays(e, 39),  addDays(e, 50),  `${year}-07-14`,
    `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`,
  ])
}

// ─── Appel Supabase REST ──────────────────────────────────────────────────────
async function sb(url: string, key: string, path: string) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) return []
  return res.json()
}

// ─── Envoi push via la fonction existante send-push ───────────────────────────
async function sendPush(supabaseUrl: string, serviceKey: string, userIds: string[], title: string, body: string) {
  if (!userIds.length) return
  await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ table: 'weekly_recap', record: { title, body, userIds } }),
  }).catch(() => {})
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!verifyCron(req)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const supabaseUrl = process.env.SUPABASE_URL             ?? ''
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !serviceKey) return new Response(JSON.stringify({ error: 'Config manquante' }), { status: 500 })

  const days      = thisWeekDays()
  const weekStart = days[0]
  const weekEnd   = days[4]
  const year      = new Date(weekStart + 'T00:00:00Z').getUTCFullYear()
  const feries    = getFeries(year)

  // Tous les profils
  const allProfiles: Profile[] = await sb(supabaseUrl, serviceKey,
    `profiles?select=id,full_name,role,entreprise_id`)

  // Grouper par entreprise → { techs, managers }
  const entreprises = new Map<string, { techs: Profile[]; managers: Profile[] }>()
  for (const p of allProfiles) {
    if (!p.entreprise_id) continue
    if (!entreprises.has(p.entreprise_id)) entreprises.set(p.entreprise_id, { techs: [], managers: [] })
    const group = entreprises.get(p.entreprise_id)!
    if (p.role === 'technicien')                   group.techs.push(p)
    else if (p.role === 'manager' || p.role === 'admin') group.managers.push(p)
  }

  const results: string[] = []

  for (const [entrepriseId, { techs, managers }] of entreprises) {
    if (!techs.length) continue

    const techIds = techs.map(t => t.id).join(',')

    // Récupère les heures et le planning de la semaine en parallèle
    const [timeEntries, planningEntries] = await Promise.all([
      sb(supabaseUrl, serviceKey,
        `time_entries?technicien_id=in.(${techIds})&date=gte.${weekStart}&date=lte.${weekEnd}&select=technicien_id,date`),
      sb(supabaseUrl, serviceKey,
        `planning_entries?technicien_id=in.(${techIds})&date=gte.${weekStart}&date=lte.${weekEnd}&select=technicien_id,date,type`),
    ]) as [TimeEntry[], PlanningEntry[]]

    // Identifier les techs avec au moins un jour ouvré non rempli
    const techsWithMissing: Profile[] = []

    for (const tech of techs) {
      const hasMissingDay = days.some(date => {
        // Jour férié → exempt
        if (feries.has(date)) return false
        // Planning absent/congés/férié → exempt
        const planEntry = planningEntries.find(p => p.technicien_id === tech.id && p.date === date)
        if (planEntry && EXEMPT_TYPES.has(planEntry.type)) return false
        // Heures déjà renseignées → OK
        return !timeEntries.some(t => t.technicien_id === tech.id && t.date === date)
      })
      if (hasMissingDay) techsWithMissing.push(tech)
    }

    // ── Notif aux techniciens concernés ────────────────────────────────────
    for (const tech of techsWithMissing) {
      await sendPush(supabaseUrl, serviceKey, [tech.id],
        '⏰ Heures non renseignées',
        'Tu as des heures non saisies cette semaine. Pense à les compléter avant ce soir !',
      )
    }

    // ── Notif récap aux managers ────────────────────────────────────────────
    if (techsWithMissing.length > 0 && managers.length > 0) {
      const count = techsWithMissing.length
      const names = techsWithMissing.map(t => t.full_name.split(' ')[0]).join(', ')
      await sendPush(supabaseUrl, serviceKey, managers.map(m => m.id),
        '⏰ Heures manquantes',
        `${count} technicien${count > 1 ? 's' : ''} n'${count > 1 ? 'ont' : 'a'} pas rempli ses heures : ${names}`,
      )
    }

    results.push(
      `entreprise ${entrepriseId}: ${techsWithMissing.length}/${techs.length} techs avec jours manquants`
    )
  }

  return new Response(JSON.stringify({ ok: true, days, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
