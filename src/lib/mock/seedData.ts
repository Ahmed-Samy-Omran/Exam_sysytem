import type { Category, Question, QuizSettings } from '@/types'

export const MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat-acc',
    name: 'Accounting',
    slug: 'accounting',
    description: 'أسئلة المبادئ المحاسبية والقوائم المالية',
    accent_color: '#16A34A',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat-iq',
    name: 'IQ',
    slug: 'iq',
    description: 'أسئلة الذكاء والتحليل المنطقي',
    accent_color: '#7C3AED',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cat-ex',
    name: 'Excel',
    slug: 'excel',
    description: 'دوال Excel والمعادلات وتنسيق الجداول',
    accent_color: '#EA580C',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

export const MOCK_SETTINGS: QuizSettings[] = [
  { id: 'set-acc', category_id: 'cat-acc', question_count_default: 6, time_limit_minutes: null, passing_score: 70, updated_at: '2026-01-01T00:00:00Z' },
  { id: 'set-iq', category_id: 'cat-iq', question_count_default: 6, time_limit_minutes: null, passing_score: 70, updated_at: '2026-01-01T00:00:00Z' },
  { id: 'set-ex', category_id: 'cat-ex', question_count_default: 6, time_limit_minutes: null, passing_score: 70, updated_at: '2026-01-01T00:00:00Z' },
]

type Opt = { text: string; correct?: boolean }

function q(id: string, categoryId: string, text: string, explanation: string, options: Opt[]): Question {
  return {
    id,
    category_id: categoryId,
    question_text: text,
    explanation,
    difficulty: 'medium',
    is_active: true,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    options: options.map((o, i) => ({
      id: `${id}-o${i}`,
      question_id: id,
      option_text: o.text,
      is_correct: Boolean(o.correct),
      sort_order: i,
    })),
  }
}

export const MOCK_QUESTIONS: Question[] = [
  // Accounting
  q('acc-1', 'cat-acc', 'ما المبدأ المحاسبي الذي يقضي بتسجيل العمليات وقت حدوثها وليس وقت السداد؟', 'مبدأ الاستحقاق يسجل الإيراد عند تحققّه والمصروف عند استحقاقه.', [
    { text: 'مبدأ الاستحقاق', correct: true },
    { text: 'الأساس النقدي' },
    { text: 'مبدأ الحيطة والحذر' },
    { text: 'مبدأ التكلفة التاريخية' },
  ]),
  q('acc-2', 'cat-acc', 'أي قائمة تعرض الأصول والمطلوبات وحقوق الملكية في لحظة معينة؟', 'الميزانية العمومية تمثل الوضع المالي في تاريخ محدد.', [
    { text: 'قائمة الدخل' },
    { text: 'قائمة التدفقات النقدية' },
    { text: 'الميزانية العمومية', correct: true },
    { text: 'قائمة حقوق الملكية' },
  ]),
  q('acc-3', 'cat-acc', 'ماذا تعني المعادلة المحاسبية الأساسية؟', 'المعادلة: الأصول = المطلوبات + حقوق الملكية.', [
    { text: 'الأصول = المطلوبات - حقوق الملكية' },
    { text: 'الأصول = المطلوبات + حقوق الملكية', correct: true },
    { text: 'المطلوبات = الأصول + حقوق الملكية' },
    { text: 'حقوق الملكية = الأصول + المطلوبات' },
  ]),
  q('acc-4', 'cat-acc', 'أي الأصول يُستهلك على مدى عمره الإنتاجي؟', 'الأصول الثابتة مثل المعدات تُستهلك، بينما الأرض لا.', [
    { text: 'الأرض' },
    { text: 'المخزون' },
    { text: 'المعدات الصناعية', correct: true },
    { text: 'الحسابات المدينة' },
  ]),
  q('acc-5', 'cat-acc', 'أي حساب يُصنف ضمن الأصول المتداولة؟', 'الحسابات المدينة أصل متداول يُتوقع تحصيله خلال الدورة التشغيلية.', [
    { text: 'الأصول الثابتة' },
    { text: 'قروض طويلة الأجل' },
    { text: 'الحسابات المدينة', correct: true },
    { text: 'رأس المال' },
  ]),
  q('acc-6', 'cat-acc', 'ما أثر عملية شراء بضاعة نقديًا؟', 'تزيد الأصول (المخزون) وتنخفض الأصول (النقد) بنفس المقدار، فلا يتغير الإجمالي.', [
    { text: 'زيادة المطلوبات' },
    { text: 'زيادة حقوق الملكية' },
    { text: 'لا تغير في إجمالي الأصول', correct: true },
    { text: 'نقص في إجمالي الأصول' },
  ]),
  q('acc-7', 'cat-acc', 'أي دفتر يسجل العمليات أولًا بأول حسب تاريخها؟', 'اليومية تسجل العمليات أولًا بأول ثم تُرحل إلى الأستاذ.', [
    { text: 'دفتر الأستاذ' },
    { text: 'ميزان المراجعة' },
    { text: 'اليومية العامة', correct: true },
    { text: 'دفتر المخزون' },
  ]),
  q('acc-8', 'cat-acc', 'ما المقصود بمصطلح الاستهلاك (Depreciation)؟', 'توزيع تكلفة الأصل الثابت على عمره الإنتاجي.', [
    { text: 'انخفاض قيمة المخزون' },
    { text: 'توزيع تكلفة الأصل على عمره الإنتاجي', correct: true },
    { text: 'زيادة قيمة الأصل' },
    { text: 'نفقات التمويل' },
  ]),

  // IQ
  q('iq-1', 'cat-iq', 'أكمل المتسلسلة: 2، 6، 12، 20، ؟', 'الفرق يزداد: +4، +6، +8، +10 أي 30.', [
    { text: '26' },
    { text: '28' },
    { text: '30', correct: true },
    { text: '32' },
  ]),
  q('iq-2', 'cat-iq', 'إذا كانت أم عمر أكبر منه بـ 25 سنة ومجموع عمريهما 45، فكم عمر عمر؟', '2ع + 25 = 45 ⇒ ع = 10.', [
    { text: '10', correct: true },
    { text: '15' },
    { text: '20' },
    { text: '12' },
  ]),
  q('iq-3', 'cat-iq', 'في صف من 10 طلاب، إذا كان سامي رابعًا من الأمام فما ترتيبه من الخلف؟', '10 - 4 + 1 = 7.', [
    { text: '6' },
    { text: '7', correct: true },
    { text: '5' },
    { text: '8' },
  ]),
  q('iq-4', 'cat-iq', 'ما الرقم المختلف؟ 4، 9، 16، 21، 25', '4، 9، 16، 25 مربعات كاملة، أما 21 فلا.', [
    { text: '4' },
    { text: '9' },
    { text: '16' },
    { text: '21', correct: true },
  ]),
  q('iq-5', 'cat-iq', 'علاقة "قلم: كتابة" مثل "ساعة: ؟"', 'القلم أداة للكتابة والساعة أداة لقياس الوقت.', [
    { text: 'يد' },
    { text: 'وقت', correct: true },
    { text: 'عقارب' },
    { text: 'معصم' },
  ]),
  q('iq-6', 'cat-iq', 'ما الرقم المفقود؟ 8 × 7 = 56، 7 × 8 = ؟', 'الضرب تبديلي، فالنتيجة 56.', [
    { text: '54' },
    { text: '56', correct: true },
    { text: '64' },
    { text: '48' },
  ]),
  q('iq-7', 'cat-iq', 'إذا كانت 3 أقلام بـ 9 ريال، فكم ثمن 5 أقلام؟', 'سعر القلم 3 ريال ⇒ 5 × 3 = 15.', [
    { text: '12' },
    { text: '15', correct: true },
    { text: '18' },
    { text: '10' },
  ]),
  q('iq-8', 'cat-iq', 'أي الأشكال يكمل النمط: مثلث، مربع، دائرة، مثلث، مربع، ؟', 'النمط يتكرر كل ثلاثة.', [
    { text: 'مربع' },
    { text: 'مثلث' },
    { text: 'دائرة', correct: true },
    { text: 'نجمة' },
  ]),

  // Excel
  q('ex-1', 'cat-ex', 'ما نتيجة الدالة =SUM(A1:A3) إذا كانت القيم 5، 10، 15؟', '5 + 10 + 15 = 30.', [
    { text: '15' },
    { text: '30', correct: true },
    { text: '25' },
    { text: '35' },
  ]),
  q('ex-2', 'cat-ex', 'أي دالة تعيد أكبر قيمة ضمن نطاق؟', 'MAX تعيد القيمة الأعلى.', [
    { text: '=AVERAGE' },
    { text: '=MAX', correct: true },
    { text: '=LARGE' },
    { text: '=RANK' },
  ]),
  q('ex-3', 'cat-ex', 'ما الصيغة الصحيحة للبحث عن قيمة وعرض نظيرتها من عمود آخر؟', 'VLOOKUP تبحث وترجع من عمود محدد.', [
    { text: '=INDEX' },
    { text: '=MATCH' },
    { text: '=VLOOKUP', correct: true },
    { text: '=IF' },
  ]),
  q('ex-4', 'cat-ex', 'ما أولوية العمليات الحسابية في Excel؟', 'الأقواس أولًا ثم الضرب والقسمة ثم الجمع والطرح.', [
    { text: 'الضرب قبل الأقواس' },
    { text: 'الأقواس أولًا', correct: true },
    { text: 'الجمع أولًا' },
    { text: 'القسمة بعد الجمع' },
  ]),
  q('ex-5', 'cat-ex', 'ما معنى الخطأ #DIV/0! ؟', 'محاولة القسمة على صفر.', [
    { text: 'قيمة خاطئة' },
    { text: 'القسمة على صفر', correct: true },
    { text: 'مرجع دائري' },
    { text: 'نص غير صالح' },
  ]),
  q('ex-6', 'cat-ex', 'كيف تجمع الخلايا التي تحقق شرطًا محددًا؟', 'SUMIF تجمع مطابقة الشرط.', [
    { text: '=SUMIF', correct: true },
    { text: '=SUM' },
    { text: '=IF' },
    { text: '=COUNTIF' },
  ]),
  q('ex-7', 'cat-ex', 'ما نوع المرجع في $A$1؟', 'مرجع مطلق يقفل العمود والصف.', [
    { text: 'مطلق', correct: true },
    { text: 'نسبي' },
    { text: 'مختلط' },
    { text: 'مسمى' },
  ]),
  q('ex-8', 'cat-ex', 'ما الدالة التي تحسب عدد الخلايا غير الفارغة؟', 'COUNTA تحسب غير الفارغة.', [
    { text: '=COUNT' },
    { text: '=COUNTA', correct: true },
    { text: '=IF' },
    { text: '=SUM' },
  ]),
  q('ex-9', 'cat-ex', 'ما الدالة التي ترجع تاريخ اليوم؟', 'TODAY ترجع تاريخ اليوم.', [
    { text: '=NOW()' },
    { text: '=DATE()' },
    { text: '=TODAY()', correct: true },
    { text: '=DAY()' },
  ]),
  q('ex-10', 'cat-ex', 'ما اختصار الطباعة السريع؟', 'Ctrl+P يفتح نافذة الطباعة.', [
    { text: 'Ctrl+S' },
    { text: 'Ctrl+P', correct: true },
    { text: 'Ctrl+F' },
    { text: 'Ctrl+N' },
  ]),
]