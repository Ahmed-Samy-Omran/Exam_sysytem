import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Search } from 'lucide-react'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { categoryBadgeClass } from '@/lib/format'
import { getRepository } from '@/lib/repository/factory'
import type { Category, Question } from '@/types'

const PAGE_SIZE = 10

export function AdminQuestionsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const repo = getRepository()
      const cats = await repo.listCategoriesAdmin()
      setCategories(cats)
      const res = await repo.listQuestions(
        {
          search: search.trim() || undefined,
          category: catFilter || undefined,
          status: (statusFilter as 'active' | 'archived' | undefined) || undefined,
        },
        page,
        PAGE_SIZE,
      )
      setRows(res.rows)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تحميل الأسئلة')
    } finally {
      setLoading(false)
    }
  }, [search, catFilter, statusFilter, page])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(id: string, active: boolean) {
    await getRepository().setQuestionActive(id, active)
    void load()
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader
        title="بنك الأسئلة"
        subtitle={`${total} سؤال`}
        actions={
          <Link to="/admin/questions/new" className="btn btn-primary">
            <Plus className="h-4 w-4" />
            سؤال جديد
          </Link>
        }
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-52 flex-1">
          <label className="label">بحث</label>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input ps-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="ابحث في نص السؤال…"
            />
          </div>
        </div>
        <div className="min-w-36">
          <label className="label">القسم</label>
          <select className="input cursor-pointer" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1) }}>
            <option value="">الكل</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-32">
          <label className="label">الحالة</label>
          <select className="input cursor-pointer" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">الكل</option>
            <option value="active">نشط</option>
            <option value="archived">مؤرشف</option>
          </select>
        </div>
      </Card>

      {error ? <p className="text-destructive">{error}</p> : null}

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد أسئلة مطابقة" hint="جرّب تغيير الفلاتر أو أضف سؤالًا جديدًا" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                  <th className="p-3 text-start font-bold">السؤال</th>
                  <th className="p-3 text-start font-bold">القسم</th>
                  <th className="p-3 text-start font-bold">الصعوبة</th>
                  <th className="p-3 text-start font-bold">الحالة</th>
                  <th className="p-3 text-start font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id} className={`border-b border-border last:border-0 ${q.is_active ? '' : 'opacity-60'}`}>
                    <td className="max-w-md p-3">
                      <p className="line-clamp-2 font-medium">{q.question_text}</p>
                    </td>
                    <td className="p-3">
                      <Badge className={categoryBadgeClass(q.category?.slug ?? q.category_id)}>
                        {q.category?.name ?? q.category_id}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{q.difficulty}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => toggle(q.id, !q.is_active)}
                        aria-label={q.is_active ? 'أرشفة السؤال' : 'تفعيل السؤال'}
                        className={`badge cursor-pointer ${q.is_active ? 'badge-success' : 'badge-muted'}`}
                      >
                        {q.is_active ? 'نشط' : 'مؤرشف'}
                      </button>
                    </td>
                    <td className="p-3">
                      <Link to={`/admin/questions/${q.id}/edit`} className="btn btn-outline px-3 py-1 text-sm">
                        <Pencil className="h-4 w-4" />
                        تعديل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border p-3 text-sm">
            <span className="text-muted-foreground">
              صفحة {page} من {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                السابق
              </Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                التالي
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}