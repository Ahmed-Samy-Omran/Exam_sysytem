import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Field, PageHeader } from '@/components/ui'
import { getRepository } from '@/lib/repository/factory'

export function AdminLoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function login() {
    setBusy(true)
    setError(null)
    try {
      await getRepository().signInAdmin(email, password)
      nav('/admin')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تسجيل الدخول')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <PageHeader title="لوحة الإدارة" subtitle="سجّل دخول المدير" />
        <div className="space-y-4">
          <Field label="البريد الإلكتروني">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          </Field>
          <Field label="كلمة المرور">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error ? <p role="alert" className="text-sm font-bold text-destructive">{error}</p> : null}
          <Button onClick={login} disabled={busy || !email || !password} className="w-full">
            {busy ? 'جارٍ الدخول…' : 'دخول'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            للتجربة: admin@example.com / admin123
          </p>
        </div>
      </Card>
    </main>
  )
}