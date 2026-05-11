import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { TimeEntry } from '@/types'
import { getWeekDays } from './usePlanning'

export function calcDuree(
  arrivee: string | null,
  depart: string | null,
  pause: number | null,
): string {
  if (!arrivee || !depart) return '—'
  const [ah, am] = arrivee.split(':').map(Number)
  const [dh, dm] = depart.split(':').map(Number)
  const total = dh * 60 + dm - (ah * 60 + am) - (pause ?? 0)
  if (total <= 0) return '—'
  const h = Math.floor(total / 60)
  const m = total % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

// Hook technicien — ses propres entrées + upsert
export function useMyTimeEntries(weekStart: string) {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)

  const weekEnd = getWeekDays(weekStart)[6]

  useEffect(() => {
    if (!profile?.id) return
    setLoading(true)
    supabase
      .from('time_entries')
      .select('*')
      .eq('technicien_id', profile.id)
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .then(({ data }) => { setEntries(data ?? []); setLoading(false) })
  }, [profile?.id, weekStart, weekEnd])

  const upsert = useCallback(async (
    date: string,
    updates: { arrivee?: string | null; depart?: string | null; pause?: number | null },
  ) => {
    if (!profile?.id) return
    const existing = entries.find(e => e.date === date)
    const merged: TimeEntry = {
      id: existing?.id ?? `tmp-${Date.now()}`,
      technicien_id: profile.id,
      date,
      arrivee: updates.arrivee !== undefined ? updates.arrivee : (existing?.arrivee ?? null),
      depart:  updates.depart  !== undefined ? updates.depart  : (existing?.depart  ?? null),
      pause:   updates.pause   !== undefined ? updates.pause   : (existing?.pause   ?? null),
      created_at: existing?.created_at ?? new Date().toISOString(),
    }
    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === date)
      if (idx >= 0) { const n = [...prev]; n[idx] = merged; return n }
      return [...prev, merged]
    })
    await supabase.from('time_entries').upsert(
      {
        technicien_id: profile.id,
        date,
        arrivee: merged.arrivee,
        depart:  merged.depart,
        pause:   merged.pause ?? 0,
      },
      { onConflict: 'technicien_id,date' },
    )
  }, [profile?.id, entries])

  return { entries, loading, upsert }
}

// Hook manager — toutes les entrées de l'équipe (lecture seule)
export function useTeamTimeEntries(weekStart: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)

  const weekEnd = getWeekDays(weekStart)[6]

  useEffect(() => {
    setLoading(true)
    supabase
      .from('time_entries')
      .select('*')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .then(({ data }) => { setEntries(data ?? []); setLoading(false) })
  }, [weekStart, weekEnd])

  return { entries, loading }
}
