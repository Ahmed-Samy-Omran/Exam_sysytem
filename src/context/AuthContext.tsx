import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getRepository } from '@/lib/repository/factory'
import { clearAuthStorage } from '@/lib/auth-storage'
import { AuthContext, type Role } from '@/context/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getRepository()
      .isAdmin()
      .then((admin) => {
        if (!cancelled) setRole(admin ? 'admin' : null)
      })
      .catch(() => {
        if (!cancelled) setRole(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    await getRepository().signInAdmin(username, password)
    setRole('admin')
  }, [])

  const logout = useCallback(async () => {
    await getRepository()
      .signOutAdmin()
      .catch(() => undefined)
    clearAuthStorage()
    setRole(null)
  }, [])

  const value = useMemo(
    () => ({ isAuthenticated: role !== null, role, loading, login, logout }),
    [role, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
