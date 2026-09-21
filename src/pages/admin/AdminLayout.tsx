import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Home as HomeIcon, ListChecks, Settings as SettingsIcon, Tags, LayoutDashboard, LogOut, HelpCircle, ClipboardList, Zap, Menu } from 'lucide-react'
import { Spinner } from '@/components/ui'
import { getRepository } from '@/lib/repository/factory'

const navItems = [
{ to: '/admin', label: 'الرئيسية', icon: LayoutDashboard, end: true },
{ to: '/admin/exams', label: 'الامتحانات', icon: ClipboardList },
{ to: '/admin/setup', label: 'اختبار سريع', icon: Zap },
{ to: '/admin/questions', label: 'بنك الأسئلة', icon: ListChecks },
{ to: '/admin/categories', label: 'الأقسام', icon: Tags },
{ to: '/admin/settings', label: 'الإعدادات', icon: SettingsIcon },
]

export function AdminLayout() {
  const nav = useNavigate()
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const ok = await getRepository().isAdmin()
        if (cancelled) return
        setAdmin(ok)
        if (!ok) nav('/admin/login', { replace: true })
      } catch {
        if (!cancelled) nav('/admin/login', { replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nav])

  if (admin === null) return <Spinner />
  if (!admin) return null

  async function logout() {
    await getRepository().signOutAdmin()
    nav('/')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-e border-border bg-card p-4 max-sm:hidden">
        <p className="mb-6 text-lg font-extrabold text-primary">لوحة الإدارة</p>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 font-bold transition-colors ${
                  isActive ? 'bg-primary text-on-primary' : 'hover:bg-muted'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          <NavLink to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 font-bold hover:bg-muted">
            <HomeIcon className="h-5 w-5" />
            عرض الموقع
          </NavLink>
          <NavLink to="/about" className="flex items-center gap-2 rounded-lg px-3 py-2 font-bold hover:bg-muted">
            <HelpCircle className="h-5 w-5" />
            عن المنصة
          </NavLink>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-bold text-destructive hover:bg-destructive/10">
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 max-sm:flex sm:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="القائمة"
              aria-expanded={menuOpen}
              className="cursor-pointer rounded-lg border border-border p-2 hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-extrabold text-primary">لوحة الإدارة</span>
          </div>
          <button type="button" onClick={logout} className="btn btn-ghost text-sm">خروج</button>
        </header>
        {menuOpen ? (
          <nav className="border-b border-border bg-card px-3 py-2 sm:hidden">
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 font-bold transition-colors ${
                      isActive ? 'bg-primary text-on-primary' : 'hover:bg-muted'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
              <div className="border-t border-border pt-1">
                <NavLink to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 font-bold hover:bg-muted">
                  <HomeIcon className="h-5 w-5" />
                  عرض الموقع
                </NavLink>
                <NavLink to="/about" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 font-bold hover:bg-muted">
                  <HelpCircle className="h-5 w-5" />
                  عن المنصة
                </NavLink>
              </div>
            </div>
          </nav>
        ) : null}
        <main className="p-3 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}