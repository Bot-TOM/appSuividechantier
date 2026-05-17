import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { PlanningEntry, PlanningType } from '@/types'

// ─── Helpers dates ────────────────────────────────────────────────────────────

/** Formate une Date en ISO local (évite le décalage UTC) */
function localISO(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export function getMondayOfWeek(d = new Date()): string {
  const date = new Date(d)
  const day  = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return localISO(date)
}

export function getWeekDays(weekStart: string): string[] {
  const [y, m, d] = weekStart.split('-').map(Number)
  return Array.from({ length: 7 }, (_, i) => localISO(new Date(y, m - 1, d + i)))
}

export function fmtDay(iso: string): { short: string; num: string } {
  const d     = new Date(iso + 'T00:00:00')
  const short = d.toLocaleDateString('fr-FR', { weekday: 'short' })
  return {
    short: short.charAt(0).toUpperCase() + short.slice(1, 3),
    num:   d.getDate().toString(),
  }
}

export function fmtWeekRange(days: string[]): string {
  const s = new Date(days[0] + 'T00:00:00')
  const e = new Date(days[6] + 'T00:00:00')
  return `${s.getDate()} — ${e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

export function prevMonday(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  return localISO(new Date(y, m - 1, d - 7))
}

export function nextMonday(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  return localISO(new Date(y, m - 1, d + 7))
}

// ─── Helpers mois ─────────────────────────────────────────────────────────────

export function getFirstOfMonth(d = new Date()): string {
  return localISO(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function getMonthDays(monthStart: string): string[] {
  const [y, m] = monthStart.split('-').map(Number)
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => localISO(new Date(y, m - 1, i + 1)))
}

export function prevMonth(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number)
  return localISO(new Date(y, m - 2, 1))
}

export function nextMonth(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number)
  return localISO(new Date(y, m, 1))
}

export function fmtMonth(monthStart: string): string {
  const d = new Date(monthStart + 'T00:00:00')
  const s = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Hook planning ────────────────────────────────────────────────────────────

export function usePlanning(startDate: string, endDate: string) {
  const [entries, setEntries] = useState<PlanningEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('planning_entries')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
      setEntries(data ?? [])
    } catch {
      // Silencieux — on garde les données précédentes en cas d'erreur réseau
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    refetch()

    // 1. Real-time Supabase
    const channel = supabase
      .channel(`planning_${startDate}_${endDate}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'planning_entries',
      }, () => refetch())
      .subscribe()

    // 2. Polling toutes les 20s (filet de sécurité si le WebSocket se coupe)
    const interval = setInterval(() => refetch(), 20_000)

    // 3. Refetch dès que l'onglet/app repasse au premier plan
    const onFocus = () => refetch()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refetch()
    })

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refetch, startDate, endDate])

  // Upsert une seule cellule
  const upsert = useCallback(async (
    technicienId: string,
    date: string,
    type: PlanningType,
    label: string,
    chantier_id?: string | null,
  ) => {
    // Optimistic update
    setEntries(prev => {
      const idx = prev.findIndex(e => e.technicien_id === technicienId && e.date === date)
      const updated: PlanningEntry = {
        id:            prev[idx]?.id ?? `tmp-${Date.now()}`,
        technicien_id: technicienId,
        date,
        type,
        label:      label || null,
        chantier_id: chantier_id ?? null,
        created_at: prev[idx]?.created_at ?? new Date().toISOString(),
      }
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
      return [...prev, updated]
    })
    const { error } = await supabase
      .from('planning_entries')
      .upsert(
        { technicien_id: technicienId, date, type, label: label || null, chantier_id: chantier_id ?? null },
        { onConflict: 'technicien_id,date' },
      )
    if (error) {
      console.error('[planning upsert]', error.message)
      // Revert l'optimistic update si la DB a rejeté
      refetch()
    }
  }, [refetch])

  // Upsert multiple cellules en même temps (sélection bulk)
  const upsertBulk = useCallback(async (
    cells: { techId: string; date: string }[],
    type: PlanningType,
    label?: string,
    chantier_id?: string | null,
  ) => {
    const rows = cells.map(c => ({
      technicien_id: c.techId,
      date:          c.date,
      type,
      label:         label || null,
      chantier_id:   chantier_id ?? null,
    }))
    setEntries(prev => {
      const next = [...prev]
      for (const r of rows) {
        const idx = next.findIndex(
          e => e.technicien_id === r.technicien_id && e.date === r.date,
        )
        if (idx >= 0) {
          next[idx] = { ...next[idx], type: r.type, label: r.label, chantier_id: r.chantier_id }
        } else {
          next.push({
            ...r,
            id:         `tmp-${Date.now()}-${r.date}`,
            created_at: new Date().toISOString(),
          })
        }
      }
      return next
    })
    const { error } = await supabase
      .from('planning_entries')
      .upsert(rows, { onConflict: 'technicien_id,date' })
    if (error) {
      console.error('[planning upsertBulk]', error.message)
      refetch()
    }
  }, [refetch])

  return { entries, loading, upsert, upsertBulk, refetch }
}
