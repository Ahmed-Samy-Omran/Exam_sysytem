import type { ExamRepository } from '@/lib/repository'
import { isSupabaseConfigured, getSupabase } from '@/lib/supabaseClient'
import { SupabaseRepository } from '@/lib/repository/supabase'
import { MockRepository } from '@/lib/repository/mock'

let instance: ExamRepository | null = null
let mode: 'supabase' | 'mock' = 'mock'

export function getMode(): 'supabase' | 'mock' {
  return mode
}

export function getRepository(): ExamRepository {
  if (instance) return instance
  mode = isSupabaseConfigured() ? 'supabase' : 'mock'
  instance = mode === 'supabase' ? new SupabaseRepository(getSupabase()) : new MockRepository()
  return instance
}

/** إعادة ضبط (للاستخدام في الاختبارات) */
export function resetRepository(): void {
  instance = null
  mode = 'mock'
}