import { createContext, useContext } from 'react'

export type Role = 'admin' | 'user'

export interface AuthContextValue {
  isAuthenticated: boolean
  role: Role | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
