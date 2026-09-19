import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Button, Card, Field, PageHeader, Spinner } from '@/components/ui'
import { validateQuestion } from '@/lib/quiz-engine'
import { getRepository } from '@/lib/repository/factory'
import type { Category } from '@/types'

interface OptionDraft {
  text: string
  correct: boolean
}

export function AdminQuestionFormPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const isEdit = Boolean(id)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [text, setText] = useState('')
  const [explanation, setExplanation] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [options, setOptions] = useState<OptionDraft[]>([
    { text: '', correct: false },
    { text: '', correct: false },
    { text: '', correct: false },
    { text: '', correct: false },
  ])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const repo = getRepository()
        const cats = await repo.listCategoriesAdmin()
        setCategories(cats)
        if (cats[0]) setCategoryId(cats[0].id)
        if (id) {
          const { rows } = await repo.listQuestions({}, 1, 1000)
          const target = rows.find((q) => q.id === id)
          if (!target) {
            setLoadError('السؤال غير موجود')
          } else {
            setCategoryId(target.category_id)
            setText(target.question_text)
            setExplanation(target.explanation ?? '')
            setDifficulty(target.difficulty)
            setOptions(
              (target.options ?? []).map((o) => ({ text: o.option_text, correct: o.is_correct })),
            )
          }
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'فشل التحميل')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  function setOption(index: number, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  function addOption() {
    if (options.length >= 5) return
    setOptions((prev) => [...prev, { text: '', correct: prev.length === 0 ? true : false }])
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    const draft = {
      category_id: categoryId,
      question_text: text,
      explanation,
      difficulty,
      options: options.map((o) => ({ option_text: o.text, is_correct: o.correct })),
    }
    const errs = validateQuestion(draft)
    setErrors(errs)
    if (errs.length) return
    setBusy(true)
    try {
      await getRepository().saveQuestion(draft, id)
      nav('/admin/questions')
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'فشل الحفظ'])
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (loadError) return <p className="text-destructive">{loadError}</p>

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? 'تعديل السؤال' : 'سؤال جديد'}
        actions={
          <Link to="/admin/questions" className="btn btn-ghost">
            عودة للبنك
          </Link>
        }
      />

      <Card className="space-y-5 p-5">
        <Field label="القسم">
          <select className="input cursor-pointer" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="نص السؤال">
          <textarea className="input min-h-24 resize-y" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        </Field>

        <Field label="التصحيح / الشرح">
          <textarea className="input min-h-20 resize-y" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} />
        </Field>

        <Field label="الصعوبة">
          <select className="input cursor-pointer" value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}>
            <option value="easy">سهل</option>
            <option value="medium">متوسط</option>
            <option value="hard">صعب</option>
          </select>
        </Field>

        <div>
          <label className="label">الاختيارات (اختر إجابة صحيحة واحدة)</label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  aria-label={`اختيار ${i + 1} كالإجابة الصحيحة`}
                  checked={o.correct}
                  onChange={() => setOptions((prev) => prev.map((p, j) => ({ ...p, correct: j === i })))}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <input
                  className="input flex-1"
                  value={o.text}
                  onChange={(e) => setOption(i, { text: e.target.value })}
                  placeholder={`الاختيار ${i + 1}`}
                />
                <button
                  type="button"
                  aria-label={`حذف الاختيار ${i + 1}`}
                  disabled={options.length <= 2}
                  onClick={() => removeOption(i)}
                  className="cursor-pointer rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost mt-2" onClick={addOption} disabled={options.length >= 5}>
            + إضافة اختيار
          </button>
        </div>

        {errors.length > 0 ? (
          <ul role="alert" className="space-y-1 text-sm font-bold text-destructive">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Link to="/admin/questions" className="btn btn-outline">
            إلغاء
          </Link>
          <Button onClick={save} disabled={busy}>
            {busy ? 'جارٍ الحفظ…' : isEdit ? 'حفظ التعديلات' : 'إضافة السؤال'}
          </Button>
        </div>
      </Card>
    </div>
  )
}