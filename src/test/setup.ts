import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetRepository } from '@/lib/repository/factory'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  // ألغِ تكوين Supabase في الاختبارات دائمًا حتى لا تُصاب ببيئة حقيقية
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
  resetRepository()
})