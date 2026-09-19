-- Seed: الأقسام + الإعدادات + بنك أسئلة تجريبي
-- يشغَّل من supabase SQL editor بعد تطبيق الـ migrations.
-- بعد التشغيل يُحذف حساب المدير الأول يدويًا عبر Auth (انظر آخر الملف).

create or replace function public.seed_question(cat uuid, q text, expl text, opts text[], correct_idx int)
returns void language plpgsql as $$
declare
  qid uuid;
  i int;
begin
  insert into public.questions (category_id, question_text, explanation, difficulty)
  values (cat, q, expl, 'medium') returning id into qid;
  for i in 1..array_length(opts, 1) loop
    insert into public.question_options (question_id, option_text, is_correct, sort_order)
    values (qid, opts[i], (i - 1 = correct_idx), i - 1);
  end loop;
end;
$$;

do $$
declare
  cat_acc uuid;
  cat_iq  uuid;
  cat_ex  uuid;
begin
  insert into public.categories (name, slug, description, accent_color)
  values ('Accounting', 'accounting', 'أسئلة المبادئ المحاسبية والقوائم المالية', '#16A34A')
  returning id into cat_acc;

  insert into public.categories (name, slug, description, accent_color)
  values ('IQ', 'iq', 'أسئلة الذكاء والتحليل المنطقي', '#7C3AED')
  returning id into cat_iq;

  insert into public.categories (name, slug, description, accent_color)
  values ('Excel', 'excel', 'دوال Excel والمعادلات وتنسيق الجداول', '#EA580C')
  returning id into cat_ex;

  insert into public.quiz_settings (category_id, question_count_default, time_limit_minutes, passing_score)
  values (cat_acc, 10, null, 70), (cat_iq, 10, null, 70), (cat_ex, 10, null, 70);

  -- Accounting
  perform public.seed_question(cat_acc, 'ما المبدأ المحاسبي الذي يقضي بتسجيل العمليات وقت حدوثها وليس وقت السداد؟', 'مبدأ الاستحقاق (Accrual) يسجل الإيراد عند تحققّه والمصروف عند استحقاقه.', array['مبدأ الاستحقاق', 'الأساس النقدي', 'مبدأ الحيطة والحذر', 'مبدأ التكلفة التاريخية'], 0);
  perform public.seed_question(cat_acc, 'ما القيد الذي يساوي فيه إجمالي الجانب المدين إجمالي الجانب الدائن؟', 'القيد المزدوج يقتضي تسجيل كل عملية بقيد مدين ودائن متساويين.', array['قيد شراء نقدي فقط', 'قيد مزدوج', 'قيد المقاصة', 'قيود الافتتاح فقط'], 1);
  perform public.seed_question(cat_acc, 'أي قائمة تعرض الأصول والمطلوبات وحقوق الملكية في لحظة معينة؟', 'الميزانية العمومية (Balance Sheet) تمثل الوضع المالي في تاريخ محدد.', array['قائمة الدخل', 'قائمة التدفقات النقدية', 'الميزانية العمومية', 'قائمة التغير في حقوق الملكية'], 2);
  perform public.seed_question(cat_acc, 'أي الأصول يُستهلك على مدى عمره الإنتاجي؟', 'الأصول الثابتة الملموسة مثل المعدات تُستهلك، بينما الأراضي لا تُستهلك.', array['الأرض', 'المخزون', 'المعدات الصناعية', 'الحسابات المدينة'], 2);
  perform public.seed_question(cat_acc, 'ماذا تعني المعادلة المحاسبية الأساسية؟', 'المعادلة: الأصول = المطلوبات + حقوق الملكية.', array['الأصول = المطلوبات - حقوق الملكية', 'الأصول = المطلوبات + حقوق الملكية', 'المطلوبات = الأصول + حقوق الملكية', 'حقوق الملكية = الأصول + المطلوبات'], 1);
  perform public.seed_question(cat_acc, 'أي حساب يُصنَّف ضمن الأصول المتداولة؟', 'الحسابات المدينة أصل متداول يُتوقع تحصيله خلال الدورة التشغيلية.', array['الأصول الثابتة', 'قروض طويلة الأجل', 'الحسابات المدينة', 'رأس المال'], 2);
  perform public.seed_question(cat_acc, 'ما أثر عملية شراء بضاعة نقديًا؟', 'تزيد الأصول (المخزون) وتنخفض الأصول (النقد) بنفس المقدار.', array['زيادة المطلوبات', 'زيادة حقوق الملكية', 'لا تغير في إجمالي الأصول', 'نقص في إجمالي الأصول'], 2);
  perform public.seed_question(cat_acc, 'أي دفتر يسجل العمليات أولًا بأول حسب تاريخها؟', 'اليومية (Journal) تسجل العمليات أولًا بأول ثم تُرحّل إلى الأستاذ.', array['دفتر الأستاذ', 'ميزان المراجعة', 'اليومية العامة', 'دفتر المخزون'], 2);
  perform public.seed_question(cat_acc, 'ما النتيجة عند انخفاض رصيد الصندوق المكتشف بالجرد؟', 'عجز الصندوق يُحمّل على حساب الفروق أو الصندوق حسب السياسة.', array['يُعد إيرادًا', 'يُعالج كعجز ويُحمّل على المسؤول', 'يُضاف لحقوق الملكية', 'يُسجل كمطلوب'], 1);
  perform public.seed_question(cat_acc, 'ما المقصود بمصطلح الاستهلاك (Depreciation)؟', 'توزيع تكلفة الأصل الثابت على عمره الإنتاجي.', array['انخفاض قيمة المخزون', 'توزيع تكلفة الأصل على عمره الإنتاجي', 'زيادة قيمة الأصل', 'نفقات التمويل'], 1);

  -- IQ
  perform public.seed_question(cat_iq, 'أكمل المتسلسلة: 2، 6، 12، 20، ؟', 'الفرق يزداد: +4، +6، +8، +10 ⇒ 20 + 10 = 30.', array['26', '28', '30', '32'], 2);
  perform public.seed_question(cat_iq, 'إذا كان كل الأزرار بيضاء، وبعض الأزرار دائرية، إذن؟', 'لا يمكن الجزم بأن أي زر أبيض دائري أو العكس — الاستنتاج الصحيح "لاشيء مما سبق".', array['كل الأزرار الدائرية بيضاء', 'بعض الأزرار البيضاء ليست دائرية', 'كل الأزرار البيضاء دائرية', 'لا يمكن استنتاج شيء مؤكد'], 3);
  perform public.seed_question(cat_iq, 'علاقة كلمة "قلم: كتابة" مثل "ساعة: ؟"', 'القلم أداة للكتابة، والساعة أداة لقياس الوقت.', array['يد', 'وقت', 'عقارب', 'معصم'], 1);
  perform public.seed_question(cat_iq, 'ما الرقم المختلف؟ 4، 9، 16، 21، 25', 'الأعداد 4، 9، 16، 25 مربعات كاملة، أما 21 فليس مربعًا كاملًا.', array['4', '9', '16', '21'], 3);
  perform public.seed_question(cat_iq, 'إذا كانت أم عمر أكبر من عمره بـ 25 سنة، ومجموع عمريهما 45، فكم عمر عمر؟', '2ع + 25 = 45 ⇒ ع = 10.', array['10', '15', '20', '12'], 0);
  perform public.seed_question(cat_iq, 'في صفّ من 10 طلاب، إذا كان سامي في الترتيب 4 من الأمام، فما ترتيبه من الخلف؟', '10 - 4 + 1 = 7.', array['6', '7', '5', '8'], 1);
  perform public.seed_question(cat_iq, 'أي الأشكال يكمل الأنماط: مثلث، مربع، دائرة، مثلث، مربع، ؟', 'النمط يتكرر كل ثلاثة: مثلث، مربع، دائرة.', array['مربع', 'مثلث', 'دائرة', 'نجمة'], 2);
  perform public.seed_question(cat_iq, 'ما هو الرقم المفقود؟ 8 × 7 = 56، 6 × 9 = 54، 7 × 8 = ؟', '7 × 8 = 56 (نفس عملية الضرب الأولى لأن الضرب تبديلي).', array['54', '56', '64', '48'], 1);
  perform public.seed_question(cat_iq, 'إذا كانت 3 أقلام = 9 ريال، فكم ثمن 5 أقلام؟', 'سعر القلم = 3 ريال ⇒ 5 × 3 = 15.', array['12', '15', '18', '10'], 1);
  perform public.seed_question(cat_iq, 'أي الكلمات لا تنتمي للمجموعة؟ موز، برتقال، خيار، تفاح', 'الخيار خضار وليس فاكهة.', array['موز', 'برتقال', 'خيار', 'تفاح'], 2);

  -- Excel
  perform public.seed_question(cat_ex, 'ما نتيجة الدالة =SUM(A1:A3) إذا كانت القيم 5، 10، 15؟', '5 + 10 + 15 = 30.', array['15', '30', '25', '35'], 1);
  perform public.seed_question(cat_ex, 'أي دالة تعيد أكبر قيمة ضمن نطاق؟', '=MAX تنفّذ أعلى قيمة.', array['=AVERAGE', '=MAX', '=LARGE', '=RANK'], 1);
  perform public.seed_question(cat_ex, 'ما الصيغة الصحيحة للبحث عن قيمة في عمود وإرجاع نظيرتها من عمود آخر؟', 'VLOOKUP تبحث عن القيمة وترجع من عمود محدد.', array['=INDEX', '=MATCH', '=VLOOKUP', '=IF'], 2);
  perform public.seed_question(cat_ex, 'ما رمز لصق القيمة التي يتم حسابها بالترتيب الهرمي؟', 'الأقواس أولًا ثم الضرب والقسمة ثم الجمع والطرح.', array['الضرب قبل الأقواس', 'الأقواس أولًا', 'الجمع أولًا', 'القسمة بعد الجمع'], 1);
  perform public.seed_question(cat_ex, 'ما اختصار الطباعة السريع في Excel؟', 'Ctrl+P هو اختصار الطباعة.', array['Ctrl+S', 'Ctrl+P', 'Ctrl+F', 'Ctrl+N'], 1);
  perform public.seed_question(cat_ex, 'ما الدالة التي ترجع اليوم؟', '=TODAY() ترجع تاريخ اليوم.', array['=NOW()', '=DATE()', '=TODAY()', '=DAY()'], 2);
  perform public.seed_question(cat_ex, 'ما معنى الخطأ #DIV/0! ؟', 'محاولة القسمة على صفر.', array['قيمة خاطئة', 'القسمة على صفر', 'مرجع دائري', 'نص غير صالح'], 1);
  perform public.seed_question(cat_ex, 'كيف تجمع فقط خلايا تحقق شرطًا محددًا؟', 'SUMIF تجمع الخلايا المطابقة لشرط.', array['=SUMIF', '=SUM', '=IF', '=COUNTIF'], 0);
  perform public.seed_question(cat_ex, 'ما نوع المرجع في $A$1؟', 'مرجع مطلق يقفل العمود والصف عند النسخ.', array['مطلق', 'نسبي', 'مختلط', 'مسمّى'], 0);
  perform public.seed_question(cat_ex, 'ما الدالة التي تحسب عدد الخلايا غير الفارغة؟', 'COUNTA تحسب الخلايا غير الفارغة.', array['=COUNT', '=COUNTA', '=IF', '=SUM'], 1);
end $$;

drop function public.seed_question(uuid, text, text, text[], int);

-- ---------- إضافة أول مدير (يدوي) ----------
-- بعد تفعيل Auth وفتح حساب للمدير، نفّذ في SQL editor:
--
-- insert into public.admin_users (user_id, email)
-- values (auth.uid(), 'admin@yourdomain.com')
-- on conflict do nothing;
--
-- وليكن الحساب مشار إليه عبر "User > Admin in Studio > authentication" أولًا.