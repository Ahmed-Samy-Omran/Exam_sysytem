import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type Role } from '@/context/auth'
import { Spinner } from '@/components/ui'

interface ProtectedRouteProps {
  children: ReactNode
  role?: Role
  redirectTo?: string
}

export function ProtectedRoute({ children, role = 'admin', redirectTo = '/admin/login' }: ProtectedRouteProps) {
  const { isAuthenticated, role: activeRole, loading } = useAuth()

  if (loading) return <Spinner />
  if (!isAuthenticated) return <Navigate to={redirectTo} replace />
  if (activeRole !== role) return <Navigate to="/" replace />
  return children
}
