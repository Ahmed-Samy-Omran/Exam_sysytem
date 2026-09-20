import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Copy, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { Button, Card, PageHeader, Spinner } from '@/components/ui'
import { getRepository } from '@/lib/repository/factory'
import type { Category } from '@/types'

// ---- Shared types ----

interface ExamRow {
  id: string
  title: string
  description: string | null
  instructions: string
  slug: string
  is_active: boolean
  passing_score: number
  time_limit_minutes: number | null
  allow_retakes: boolean
  created_at: string
}

interface ExamSection {
  id: string
  category_id: string
  question_count: number
}

interface ExamWithSections extends ExamRow {
  sections: { id: string; category_id: string; category_name: string; question_count: number }[]
}

// ---- Repository extensions ----

async function getExamsAdmin(repo: any): Promise<
  (ExamRow & { sections: ExamSection[] })[]
> {
  if (repo.sb) {
    const { data } = await repo.sb.from('exams').select('*').order('created_at', { ascending: false })
    if (!data) return []
    const rows = data as ExamRow[]
    const out: (ExamRow & { sections: ExamSection[] })[] = []
    for (const r of rows) {
      const { data: sec } = await repo.sb.from('exam_sections').select('id, category_id, question_count').eq('exam_id', r.id)
      out.push({ ...r, sections: (sec ?? []).map((s: any) => ({ id: s.id, category_id: s.category_id, question_count: s.question_count })) })
    }
    return out
  }
  return [...repo.exams.values()].map((e: any) => ({
    id: e.id, title: e.title, description: e.description, instructions: e.instructions,
    slug: e.slug, is_active: e.is_active, passing_score: e.passing_score,
    time_limit_minutes: e.time_limit_minutes, allow_retakes: e.allow_retakes, created_at: e.created_at,
    sections: e.sections.map((s: any) => ({ id: s.id, category_id: s.category_id, question_count: s.question_count })),
  }))
}

async function getExamByIdAdmin(repo: any, id: string): Promise<
  ExamRow & { sections: ExamSection[] }
> {
  if (repo.sb) {
    const { data, error } = await repo.sb.from('exams').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) throw new Error('الامتحان غير موجود')
    const { data: sec } = await repo.sb.from('exam_sections').select('id, category_id, question_count').eq('exam_id', id)
    return {
      ...data as ExamRow,
      sections: (sec ?? []).map((s: any) => ({ id: s.id, category_id: s.category_id, question_count: s.question_count })),
    }
  }
  const e = repo.examsById.get(id)
  if (!e) throw new Error('الامتحان غير موجود')
  return {
    id: e.id, title: e.title, description: e.description, instructions: e.instructions,
    slug: e.slug, is_active: e.is_active, passing_score: e.passing_score,
    time_limit_minutes: e.time_limit_minutes, allow_retakes: e.allow_retakes, created_at: e.created_at,
    sections: e.sections.map((s: any) => ({ id: s.id, category_id: s.category_id, question_count: s.question_count })),
  }
}

async function createExam(repo: any, data: {
  title: string; slug: string; description: string | null; instructions: string;
  passing_score: number; time_limit_minutes: number | null; allow_retakes: boolean;
  sections: { category_id: string; question_count: number }[]
}) {
  if (repo.sb) {
    const { data: exam, error: examErr } = await repo.sb
      .from('exams')
      .insert({ title: data.title, slug: data.slug, description: data.description, instructions: data.instructions, passing_score: data.passing_score, time_limit_minutes: data.time_limit_minutes, allow_retakes: data.allow_retakes, is_active: true })
      .select('*')
      .single()
    if (examErr) throw examErr
    if (data.sections.length) {
      const { error: secErr } = await repo.sb
        .from('exam_sections')
        .insert(data.sections.map((s) => ({ exam_id: exam.id, ...s })))
      if (secErr) throw secErr
    }
    return exam
  }
  if (repo.exams.has(data.slug)) throw new Error('يوجد امتحان بهذا الرابط بالفعل')
  const exam: any = {
    id: crypto.randomUUID(), title: data.title, description: data.description, instructions: data.instructions,
    slug: data.slug, is_active: true, passing_score: data.passing_score,
    time_limit_minutes: data.time_limit_minutes, allow_retakes: data.allow_retakes,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    sections: data.sections.map((s) => ({ ...s, id: crypto.randomUUID() })),
  }
  repo.exams.set(data.slug, exam)
  repo.examsById.set(exam.id, exam)
  return exam
}

async function updateExam(repo: any, id: string, data: any) {
  if (repo.sb) {
    await getExamByIdAdmin(repo, id)
    const fields: Record<string, unknown> = {}
    if (data.title !== undefined) fields.title = data.title
    if (data.description !== undefined) fields.description = data.description
    if (data.instructions !== undefined) fields.instructions = data.instructions
    if (data.passing_score !== undefined) fields.passing_score = data.passing_score
    if (data.time_limit_minutes !== undefined) fields.time_limit_minutes = data.time_limit_minutes
    if (data.allow_retakes !== undefined) fields.allow_retakes = data.allow_retakes
    if (data.is_active !== undefined) fields.is_active = data.is_active
    if (Object.keys(fields).length) {
      const { error } = await repo.sb.from('exams').update(fields).eq('id', id)
      if (error) throw error
    }
    if (data.sections !== undefined) {
      await repo.sb.from('exam_sections').delete().eq('exam_id', id)
      if (data.sections.length) {
        const { error } = await repo.sb.from('exam_sections').insert(data.sections.map((s: any) => ({ exam_id: id, ...s })))
        if (error) throw error
      }
    }
  } else {
    const exam = repo.examsById.get(id)
    if (!exam) throw new Error('الامتحان غير موجود')
    if (data.title !== undefined) exam.title = data.title
    if (data.slug !== undefined) {
      const old = exam.slug
      exam.slug = data.slug
      repo.exams.delete(old)
      repo.exams.set(exam.slug, exam)
    }
    if (data.description !== undefined) exam.description = data.description
    if (data.instructions !== undefined) exam.instructions = data.instructions
    if (data.passing_score !== undefined) exam.passing_score = data.passing_score
    if (data.time_limit_minutes !== undefined) exam.time_limit_minutes = data.time_limit_minutes
    if (data.allow_retakes !== undefined) exam.allow_retakes = data.allow_retakes
    if (data.is_active !== undefined) exam.is_active = data.is_active
    exam.updated_at = new Date().toISOString()
    if (data.sections !== undefined) exam.sections = data.sections.map((s: any) => ({ ...s, id: crypto.randomUUID() }))
  }
}

async function deleteExam(repo: any, id: string) {
  if (repo.sb) {
    const { error } = await repo.sb.from('exams').delete().eq('id', id)
    if (error) throw error
  } else {
    const exam = repo.examsById.get(id)
    if (!exam) throw new Error('الامتحان غير موجود')
    repo.exams.delete(exam.slug)
    repo.examsById.delete(id)
  }
}

// ---- Component ----

export function AdminExamsPage() {
  const [exams, setExams] = useState<ExamWithSections[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formInstructions, setFormInstructions] = useState('')
  const [formPassingScore, setFormPassingScore] = useState('70')
  const [formTimeLimit, setFormTimeLimit] = useState('')
  const [formAllowRetakes, setFormAllowRetakes] = useState(true)
  const [formSections, setFormSections] = useState<{ category_id: string; question_count: string }[]>([])

  const load = useCallback(async () => {
    try {
      const repo = getRepository() as any
      const cats = await repo.listCategoriesAdmin()
      setCategories(cats)
      const exms = await getExamsAdmin(repo)
      setExams(exms.map((e: any) => ({
        ...e,
        sections: e.sections.map((s: any) => ({
          ...s,
          category_name: cats.find((c: Category) => c.id === s.category_id)?.name ?? s.category_id,
        })),
      })))
    } catch (e: any) {
      setError(e.message ?? 'فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!showForm) return
    const run = async () => {
      if (editingId) {
        try {
          const repo = getRepository() as any
          const exam = await getExamByIdAdmin(repo, editingId)
          setFormTitle(exam.title)
          setFormSlug(exam.slug)
          setFormDescription(exam.description ?? '')
          setFormInstructions(exam.instructions)
          setFormPassingScore(String(exam.passing_score))
          setFormTimeLimit(exam.time_limit_minutes?.toString() ?? '')
          setFormAllowRetakes(exam.allow_retakes)
          setFormSections(
            exam.sections.length
              ? exam.sections.map((s: any) => ({ category_id: s.category_id, question_count: String(s.question_count) }))
              : [{ category_id: categories[0]?.id ?? '', question_count: '5' }],
          )
        } catch (e: any) {
          setError(e.message ?? 'فشل تحميل الامتحان')
          setShowForm(false)
        }
      } else {
        setFormTitle('')
        setFormSlug('')
        setFormDescription('')
        setFormInstructions('')
        setFormPassingScore('70')
        setFormTimeLimit('')
        setFormAllowRetakes(true)
        setFormSections([{ category_id: categories[0]?.id ?? '', question_count: '5' }])
        setSuccess(null)
        setError(null)
      }
    }
    void run()
  }, [showForm, editingId, categories])

  useEffect(() => {
    void load()
  }, [load])

  function addSection() {
    setFormSections((prev) => [...prev, { category_id: categories[0]?.id ?? '', question_count: '5' }])
  }

  function removeSection(i: number) {
    setFormSections((prev) => prev.filter((_: any, idx) => idx !== i))
  }

  function updateSection(i: number, field: 'category_id' | 'question_count', value: string) {
    setFormSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)))
  }

  function openNew() {
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(exam: ExamRow) {
    setEditingId(exam.id)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function saveExam() {
    setSaving(true)
    setError(null)
    try {
      const repo = getRepository() as any
      const examData = {
        title: formTitle.trim(),
        slug: formSlug.trim(),
        description: formDescription.trim() || null,
        instructions: formInstructions.trim(),
        passing_score: Math.min(100, Math.max(0, Number(formPassingScore) || 70)),
        time_limit_minutes: formTimeLimit.trim() === '' ? null : Math.max(1, Number(formTimeLimit) || 1),
        allow_retakes: formAllowRetakes,
        sections: formSections
          .filter((s) => s.category_id && Number(s.question_count) >= 1)
          .map((s) => ({ category_id: s.category_id, question_count: Number(s.question_count) })),
      }
      if (!examData.title) { setError('العنوان مطلوب'); setSaving(false); return }
      if (!examData.slug) { setError('الرابط مطلوب'); setSaving(false); return }
      if (!examData.sections.length) { setError('يجب إضافة قسم واحد على الأقل'); setSaving(false); return }

      if (editingId) {
        await updateExam(repo, editingId, examData)
        setSuccess('تم تحديث الامتحان')
      } else {
        await createExam(repo, examData)
        setSuccess('تم إنشاء الامتحان')
      }
      setShowForm(false)
      setEditingId(null)
      await load()
    } catch (e: any) {
      setError(e.message ?? 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(exam: ExamRow) {
    try {
      const repo = getRepository() as any
      await updateExam(repo, exam.id, { is_active: !exam.is_active })
      await load()
      setSuccess(!exam.is_active ? 'تم تفعيل الامتحان' : 'تم إيقاف الامتحان')
    } catch (e: any) {
      setError(e.message ?? 'فشل التحديث')
    }
  }

  async function copyLink(exam: ExamRow) {
    const url = `${window.location.origin}${window.location.pathname}#/exam/start?exam=${exam.slug}`
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      setSuccess('تم نسخ رابط الامتحان')
    }
  }

  async function confirmDelete(id: string) {
    setDeletingId(id)
    try {
      const repo = getRepository() as any
      await deleteExam(repo, id)
      await load()
      setSuccess('تم حذف الامتحان')
    } catch (e: any) {
      setError(e.message ?? 'فشل الحذف')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <Spinner />
  if (error && !exams.length && !showForm) return <p className="p-10 text-center text-destructive">{error}</p>

  const activeClass = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border border-success/40 bg-success/10 text-[#15803d]'
  const inactiveClass = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border border-border bg-muted text-muted-foreground'

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="إدارة الامتحانات"
        subtitle="أنشئ امتحانات، وَضّع الأقسام وعدد الأسئلة، ثم انشر الرابط للمتقدمين"
        actions={!showForm ? <Button onClick={openNew}><Plus className="h-4 w-4" /> امتحان جديد</Button> : null}
      />

      {error ? <p className="mb-4 text-destructive">{error}</p> : null}
      {success ? <p className="mb-4 text-success">{success}</p> : null}

      {showForm && (
        <Card className="p-5 mb-6 space-y-4">
          <h2 className="font-bold">{editingId ? 'تعديل الامتحان' : 'إنشاء امتحان جديد'}</h2>

          <div>
            <label className="label">العنوان *</label>
            <input className="input" value={formTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormTitle(e.target.value)} placeholder="مثال: اختبار المحاسبة للمبتدئين" />
          </div>

          <div>
            <label className="label">رابط المشاركة (slug) *</label>
            <div className="flex items-center gap-2">
              <input
                className="input"
                value={formSlug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="مثال: accounting-basics"
              />
              {formSlug && <code className="shrink-0 rounded border border-border bg-muted px-2 py-1 text-xs">#{formSlug}</code>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">استخدم أحرف صغيرة وأرقام وشرطات فقط</p>
          </div>

          <div>
            <label className="label">الوصف (اختياري)</label>
            <textarea className="input min-h-[60px]" value={formDescription} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormDescription(e.target.value)} placeholder="وصف مختصر للامتحان" />
          </div>

          <div>
            <label className="label">تعليمات للمتقدم (اختياري)</label>
            <textarea className="input min-h-[60px]" value={formInstructions} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormInstructions(e.target.value)} placeholder="مثال: أجب على جميع الأسئلة. لا يمكن التراجع بعد التسليم." />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">درجة النجاح %</label>
              <input type="number" min={0} max={100} className="input" value={formPassingScore} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormPassingScore(e.target.value)} />
            </div>
            <div>
              <label className="label">المؤقت (دقائق، فارغ = بلا حد)</label>
              <input type="number" min={1} max={180} className="input" value={formTimeLimit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormTimeLimit(e.target.value)} placeholder="مثال: 30" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="retakes" checked={formAllowRetakes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormAllowRetakes(e.target.checked)} className="h-4 w-4 accent-primary rounded border-border" />
              <label htmlFor="retakes" className="text-sm font-bold">السماح بإعادة الاختبار</label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label">الأقسام وعدد الأسئلة *</label>
              <Button variant="ghost" onClick={addSection}><Plus className="h-4 w-4" /> قسم إضافي</Button>
            </div>
            <div className="space-y-2">
              {formSections.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
                  <select className="input flex-1" value={s.category_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateSection(i, 'category_id', e.target.value)}>
                    {categories.map((c: Category) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input type="number" min={1} max={50} className="input w-20" value={s.question_count} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSection(i, 'question_count', e.target.value)} />
                  <span className="text-xs font-bold text-muted-foreground">سؤال</span>
                  <Button variant="ghost" onClick={() => removeSection(i)} disabled={formSections.length === 1}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={cancelForm}>إلغاء</Button>
            <Button onClick={saveExam} disabled={saving}>{saving ? 'جارٍ الحفظ…' : (editingId ? 'تحديث الامتحان' : 'إنشاء الامتحان')}</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-start text-muted-foreground">
              <th className="p-3 text-start font-bold">العنوان</th>
              <th className="p-3 text-start font-bold">الرابط</th>
              <th className="p-3 text-start font-bold">الأقسام</th>
              <th className="p-3 text-start font-bold">الحالة</th>
              <th className="p-3 text-start bold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {exams.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-muted-foreground">
                  لا توجد امتحانات بعد. أنشئ الامتحان الأول.
                </td>
              </tr>
            ) : (
              exams.map((exam) => (
                <tr key={exam.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-bold">{exam.title}</td>
                  <td className="p-3 text-xs font-mono text-muted-foreground">{exam.slug}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {exam.sections.map((s) => (
                        <span key={s.id} className="badge badge-muted">
                          {s.category_name} ({s.question_count})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(exam)}
                      className={exam.is_active ? activeClass : inactiveClass}
                    >
                      {exam.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {exam.is_active ? 'نشط' : 'غير نشط'}
                    </button>
                  </td>
                  <td className="p-3 space-x-1">
                    {exam.is_active && (
                      <Button variant="outline" onClick={() => copyLink(exam)} title="نسخ الرابط">
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {editingId !== exam.id && (
                      <Button variant="outline" onClick={() => openEdit(exam)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    {deletingId === exam.id ? (
                      <Button variant="danger" onClick={() => confirmDelete(exam.id)}>
                        <RotateCcw className="h-4 w-4" /> تأكيد الحذف
                      </Button>
                    ) : (
                      <Button variant="ghost" onClick={() => setDeletingId(exam.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6 p-5 text-sm text-muted-foreground border-border">
        <h3 className="font-bold text-foreground">كيف تربط متقدمًا بامتحان؟</h3>
        <p className="mt-2">
          انسخ رابط الامتحان المنشور وأرسله للمتقدم:
          <br />
          <code className="block mt-1 rounded bg-muted px-2 py-1 font-mono text-xs">
            #{window.location.pathname}#/exam/start?exam={exams[0]?.slug ?? 'exam-slug'}
          </code>
        </p>
        <p className="mt-2 text-xs">
          المتقدم يفتح الرابط، يُدخل اسمه، ثم يبدأ الاختبار تلقائيًا.
          لا يرى خيار عدد الأسئلة أو الأقسام — كل ذلك مُعيّن من قبل المدير.
        </p>
      </Card>
    </div>
  )
}
