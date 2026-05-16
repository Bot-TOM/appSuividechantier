import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export type Plan = 'starter' | 'pro'

export interface PlanLimits {
  maxChantiers: number   // 3 pour starter, Infinity pour pro
  maxUsers: number       // 3 pour starter, Infinity pour pro
  voiceReport: boolean   // false pour starter
  excelImport: boolean   // false pour starter
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  starter: { maxChantiers: 3, maxUsers: 3, voiceReport: false, excelImport: false },
  pro:     { maxChantiers: Infinity, maxUsers: Infinity, voiceReport: true, excelImport: true },
}

export function usePlan() {
  const { profile } = useAuth()
  const [plan, setPlan] = useState<Plan>('starter')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.entreprise_id) { setLoading(false); return }
    supabase
      .from('entreprises')
      .select('plan')
      .eq('id', profile.entreprise_id)
      .single()
      .then(({ data }) => {
        if (data?.plan === 'pro') setPlan('pro')
        setLoading(false)
      })
  }, [profile?.entreprise_id])

  return { plan, limits: PLAN_LIMITS[plan], isPro: plan === 'pro', loading }
}
