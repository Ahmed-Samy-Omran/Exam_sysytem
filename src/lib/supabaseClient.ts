import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient<Database> | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase غير مكوّن. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY داخل ملف .env',
    )
  }
  if (!client) {
    client = createClient<Database>(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return client
}