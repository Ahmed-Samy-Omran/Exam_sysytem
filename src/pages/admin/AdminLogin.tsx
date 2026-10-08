import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Field, PageHeader, Spinner } from '@/components/ui'
import { BrandLogo } from '@/components/BrandLogo'
import { getMode } from '@/lib/repository/factory'
import { useAuth } from '@/context/auth'

const MOCK_DEMO = { user: 'omar', pass: 'omar369@' }
const SUPABASE_DEMO = { user: 'omar@exam.com', pass: 'omar369@' }

export function AdminLoginPage() {
  const nav = useNavigate()
  const { login, loading } = useAuth()
  const isMock = getMode() === 'mock'
  const demo = isMock ? MOCK_DEMO : SUPABASE_DEMO
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
      nav('/admin', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تسجيل الدخول')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4 sm:px-6">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 flex justify-center">
          <BrandLogo variant="horizontal" height={40} />
        </div>
        <PageHeader title="لوحة الإدارة" subtitle="سجّل دخول المدير" />
        <div className="space-y-4">
          <Field label={isMock ? 'الاسم' : 'البريد الإلكتروني'}>
            <input
              className="input"
              type={isMock ? 'text' : 'email'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isMock ? 'omar' : 'omar@exam.com'}
            />
          </Field>
          <Field label="كلمة المرور">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error ? <p role="alert" className="text-sm font-bold text-destructive">{error}</p> : null}
          <Button onClick={submit} disabled={busy || !username || !password} className="w-full">
            {busy ? 'جارٍ الدخول…' : 'دخول'}
          </Button>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed">
            <p className="font-bold text-muted-foreground">بيانات التجربة</p>
            <p className="mt-1">
              <span className="font-bold text-foreground">{isMock ? 'الاسم' : 'البريد الإلكتروني'}:</span>{' '}
              <span dir="ltr" className="text-muted-foreground">{demo.user}</span>
            </p>
            <p className="mt-0.5">
              <span className="font-bold text-foreground">كلمة المرور:</span>{' '}
              <span dir="ltr" className="text-muted-foreground">{demo.pass}</span>
            </p>
          </div>
        </div>
      </Card>
    </main>
  )
}