import { useCallback, useEffect, useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { Button, Card, PageHeader } from '@/components/ui'
import { getRepository } from '@/lib/repository/factory'

const ACCENTS = ['#0D9488', '#16A34A', '#7C3AED', '#EA580C', '#DC2626', '#0284C7']

interface Draft {
  id?: string
  name: string
  slug: string
  description: string
  accent_color: string
  is_active: boolean
}

function slugify(value: string): string {
  const s = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || `cat-${Date.now()}`
}

export function AdminCategoriesPage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [newDraft, setNewDraft] = useState<Draft>({ name: '', slug: '', description: '', accent_color: ACCENTS[0], is_active: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const cats = await getRepository().listCategoriesAdmin()
    setDrafts(
      cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? '',
        accent_color: c.accent_color,
        is_active: c.is_active,
      })),
    )
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'فشل التحميل'))
  }, [load])

  function patch(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  async function save(d: Draft) {
    setBusy(true)
    setError(null)
    try {
      await getRepository().saveCategory({
        id: d.id,
        name: d.name,
        slug: d.slug || slugify(d.name),
        description: d.description,
        accent_color: d.accent_color,
        is_active: d.is_active,
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل الحفظ')
    } finally {
      setBusy(false)
    }
  }

  async function add() {
    if (!newDraft.name.trim()) return
    await save({ ...newDraft, slug: newDraft.slug || slugify(newDraft.name) })
    setNewDraft({ name: '', slug: '', description: '', accent_color: ACCENTS[0], is_active: true })
  }

  return (
    <div>
      <PageHeader title="الأقسام" subtitle="إدارة الأقسام والتصنيفات" />

      {error ? <p className="mb-4 text-destructive">{error}</p> : null}

      <Card className="mb-6 space-y-4 p-5">
        <p className="font-bold">قسم جديد</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder="الاسم (مثال: محاسبة)" value={newDraft.name} onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })} />
          <input className="input" dir="ltr" placeholder="slug (مثال: accounting)" value={newDraft.slug} onChange={(e) => setNewDraft({ ...newDraft, slug: e.target.value })} />
          <input className="input sm:col-span-2" placeholder="وصف مختصر" value={newDraft.description} onChange={(e) => setNewDraft({ ...newDraft, description: e.target.value })} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`لون ${c}`}
                onClick={() => setNewDraft({ ...newDraft, accent_color: c })}
                className={`h-7 w-7 cursor-pointer rounded-full border-2 ${newDraft.accent_color === c ? 'border-foreground' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Button onClick={add} className="ms-auto" disabled={busy || !newDraft.name.trim()}>
            <Plus className="h-4 w-4" />
            إضافة
          </Button>
        </div>
      </Card>

      {drafts.length === 0 ? (
        <p className="text-muted-foreground">لا توجد أقسام بعد.</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="p-3 text-start font-bold">الاسم</th>
                <th className="p-3 text-start font-bold">slug</th>
                <th className="p-3 text-start font-bold">اللون</th>
                <th className="p-3 text-start font-bold">الحالة</th>
                <th className="p-3 text-start font-bold">حفظ</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 align-top">
                  <td className="p-3">
                    <input className="input mb-2" value={d.name} onChange={(e) => patch(d.id!, { name: e.target.value })} />
                    <input className="input" placeholder="وصف" value={d.description} onChange={(e) => patch(d.id!, { description: e.target.value })} />
                  </td>
                  <td className="p-3">
                    <input className="input" dir="ltr" value={d.slug} onChange={(e) => patch(d.id!, { slug: e.target.value })} />
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ACCENTS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`لون ${c}`}
                          onClick={() => patch(d.id!, { accent_color: c })}
                          className={`h-6 w-6 cursor-pointer rounded-full border-2 ${d.accent_color === c ? 'border-foreground' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => patch(d.id!, { is_active: !d.is_active })}
                      className={`badge cursor-pointer ${d.is_active ? 'badge-success' : 'badge-muted'}`}
                    >
                      {d.is_active ? 'نشط' : 'مخفي'}
                    </button>
                  </td>
                  <td className="p-3">
                    <Button variant="outline" onClick={() => save(d)} disabled={busy}>
                      <Save className="h-4 w-4" />
                      حفظ
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}