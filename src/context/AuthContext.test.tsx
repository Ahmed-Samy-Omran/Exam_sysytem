import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AuthProvider } from './AuthContext'
import { useAuth } from './auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { clearAuthStorage } from '@/lib/auth-storage'
import { getRepository } from '@/lib/repository/factory'
import { MockRepository } from '@/lib/repository/mock'

vi.mock('@/lib/repository/factory', () => ({
  getRepository: vi.fn(),
  getMode: vi.fn(() => 'mock'),
  resetRepository: vi.fn(),
}))

function SessionProbe() {
  const { isAuthenticated, role, loading } = useAuth()
  if (loading) return <p>جارٍ التحقق…</p>
  return <p>{isAuthenticated ? `role=${role}` : 'signed-out'}</p>
}

function LogoutButton() {
  const { logout } = useAuth()
  return (
    <button type="button" onClick={() => void logout()}>
      خروج
    </button>
  )
}

function renderApp(initial: string, guarded: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        <SessionProbe />
        <Routes>
          <Route path="/admin/login" element={<p>صفحة الدخول</p>} />
          <Route path="/" element={<p>الصفحة العامة</p>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                {guarded}
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/user-only"
            element={
              <ProtectedRoute role="user">
                {guarded}
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(getRepository).mockReturnValue(new MockRepository())
  sessionStorage.clear()
  localStorage.clear()
})

describe('ProtectedRoute — حماية مسارات الإدارة', () => {
  it('يحوّل الزائر فورًا إلى صفحة تسجيل الدخول', async () => {
    renderApp('/admin', <SessionProbe />)
    expect(await screen.findByText('صفحة الدخول')).toBeInTheDocument()
    expect(screen.getByText('signed-out')).toBeInTheDocument()
    expect(screen.queryByText(/^role=/)).not.toBeInTheDocument()
  })

  it('يسمح بالدخول للمدير بعد تسجيل الدخول', async () => {
    await getRepository().signInAdmin('omar', 'omar369@')
    renderApp('/admin', <p>لوحة الإدارة</p>)
    expect(await screen.findByText('لوحة الإدارة')).toBeInTheDocument()
    expect(screen.getByText('role=admin')).toBeInTheDocument()
  })

  it('يفحص الدور أيضًا: مصادق بدور غير مطابق يُحوّل للصفحة العامة', async () => {
    await getRepository().signInAdmin('omar', 'omar369@')
    renderApp('/admin/user-only', <p>محتوى مستخدم</p>)
    expect(await screen.findByText('الصفحة العامة')).toBeInTheDocument()
    expect(screen.queryByText('محتوى مستخدم')).not.toBeInTheDocument()
  })
})

describe('AuthContext — تسجيل الخروج الآمن', () => {
  it('يمسح الجلسة والرموز ويعيد التوجيه لصفحة الدخول', async () => {
    await getRepository().signInAdmin('omar', 'omar369@')
    sessionStorage.setItem('exam-attempt-x', '{"q":1}')
    localStorage.setItem('sb-demo-auth-token', 'secret')
    localStorage.setItem('keep-me', 'value')

    renderApp('/admin', <LogoutButton />)
    expect(await screen.findByText('role=admin')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'خروج' }))

    expect(await screen.findByText('صفحة الدخول')).toBeInTheDocument()
    expect(screen.getByText('signed-out')).toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.getItem('sb-demo-auth-token')).toBeNull()
    expect(localStorage.getItem('keep-me')).toBe('value')
    expect(await getRepository().isAdmin()).toBe(false)
  })

  it('يفشل تسجيل الدخول ببيانات خاطئة ويترك الزائر خارجًا', async () => {
    renderApp('/admin', <SessionProbe />)
    await expect(getRepository().signInAdmin('omar', 'wrong')).rejects.toThrow()
    expect(await screen.findByText('صفحة الدخول')).toBeInTheDocument()
  })
})

describe('clearAuthStorage', () => {
  it('يفرغ sessionStorage ويحذف مفاتيح الرموز فقط من localStorage', () => {
    sessionStorage.setItem('attempt', '1')
    localStorage.setItem('sb-project-auth-token', 'tok')
    localStorage.setItem('refresh-token', 'tok')
    localStorage.setItem('keep-me', 'value')

    clearAuthStorage()

    expect(sessionStorage.length).toBe(0)
    expect(localStorage.getItem('sb-project-auth-token')).toBeNull()
    expect(localStorage.getItem('refresh-token')).toBeNull()
    expect(localStorage.getItem('keep-me')).toBe('value')
  })
})
