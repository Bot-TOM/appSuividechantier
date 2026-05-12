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

// ─── Hook planning ────────────────────────────────────────────────────────────

export function usePlanning(weekStart: string) {
  const [entries, setEntries] = useState<PlanningEntry[]>([])
  const [loading, setLoading] = useState(true)

  const weekEnd = getWeekDays(weekStart)[6]

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('planning_entries')
      .select('*')
      .gte('date', weekStart)
      .lte('date', weekEnd)
    setEntries(data ?? [])
    setLoading(false)
  }, [weekStart, weekEnd])

  useEffect(() => { refetch() }, [refetch])

  // Upsert une seule cellule
  const upsert = useCallback(async (
    technicienId: string,
    date: string,
    type: PlanningType,
    texte: string,
  ) => {
    // Optimistic update
    setEntries(prev => {
      const idx = prev.findIndex(e => e.technicien_id === technicienId && e.date === date)
      const updated: PlanningEntry = {
        id:            prev[idx]?.id ?? `tmp-${Date.now()}`,
        technicien_id: technicienId,
        date,
        type,
        texte:      texte || null,
        created_at: prev[idx]?.created_at ?? new Date().toISOString(),
      }
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
      return [...prev, updated]
    })
    await supabase
      .from('planning_entries')
      .upsert(
        { technicien_id: technicienId, date, type, texte: texte || null },
        { onConflict: 'technicien_id,date' },
      )
  }, [])

  // Upsert multiple cellules en même temps (sélection bulk)
  const upsertBulk = useCallback(async (
    cells: { techId: string; date: string }[],
    type: PlanningType,
    texte?: string,
  ) => {
    const rows = cells.map(c => ({
      technicien_id: c.techId,
      date:          c.date,
      type,
      texte:         texte || null,
    }))
    setEntries(prev => {
      const next = [...prev]
      for (const r of rows) {
        const idx = next.findIndex(
          e => e.technicien_id === r.technicien_id && e.date === r.date,
        )
        if (idx >= 0) {
          next[idx] = { ...next[idx], type: r.type, texte: r.texte }
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
    await supabase
      .from('planning_entries')
      .upsert(rows, { onConflict: 'technicien_id,date' })
  }, [])

  return { entries, loading, upsert, upsertBulk, refetch }
}
