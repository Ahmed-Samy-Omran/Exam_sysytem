# Page Overrides — Quiz Runner

Overrides MASTER.tsx for the in-quiz screens. The runner is the highest-stress screen: single question, clear progress, calm state, no surprises.

## Deviations from Master
- **Max width:** `max-w-2xl` content column instead of full layout — one question at a time.
- **Progress:** fixed top strip: question `n / total` + progress bar + optional timer chip.
- **Options:** radio-style cards with:
  - default: white card, `border border-border`
  - selected: `border-primary bg-primary/5 ring-primary`
  - hover: background shift only
  - focus-visible ring for keyboard
- **Nav:** ثابت أسفل الشاشة: سابق / مؤشر سؤال حالي / قائمة أرقام (شبكة) / تسليم.
- **Unanswered:** الرقم في القائمة يعرض نقطة رمادية تمييزًا، بدون إزعاج.
- **Submit:** confirm modal before final submit; button disabled while submitting.
- **Timer:** chip top; last 60s → `bg-amber-50 text-amber-700 border-amber-300`; on 0 → auto-submit after confirm.

## Concerns handled
- Refresh during quiz → restore from `localStorage` key `attempt:{id}`.
- No question overflow on 375px (options wrap, long text reflows).