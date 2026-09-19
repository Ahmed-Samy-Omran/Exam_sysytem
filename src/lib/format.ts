export function formatPercent(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2)}%`
}

export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return 'بدون مؤقت'
  return `${min} دقيقة`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
}

function categoryKey(value: string): string {
  const v = value.toLowerCase()
  if (v.includes('acc') || v.includes('محاسب')) return 'accounting'
  if (v === 'iq' || v.includes('ذكاء')) return 'iq'
  if (v.includes('excel') || v.includes('اكسل')) return 'excel'
  return v
}

export function categoryBadgeClass(value: string): string {
  const map: Record<string, string> = {
    accounting: 'badge-accounting',
    iq: 'badge-iq',
    excel: 'badge-excel',
  }
  return map[categoryKey(value)] ?? 'badge-muted'
}

export function categoryTextClass(value: string): string {
  const map: Record<string, string> = {
    accounting: 'text-[#15803d]',
    iq: 'text-[#6d28d9]',
    excel: 'text-[#c2410c]',
  }
  return map[categoryKey(value)] ?? 'text-muted-foreground'
}

export function categoryBorderClass(value: string): string {
  const map: Record<string, string> = {
    accounting: 'border-[#16A34A]/40',
    iq: 'border-[#7C3AED]/40',
    excel: 'border-[#EA580C]/40',
  }
  return map[categoryKey(value)] ?? 'border-border'
}

export function elapsedLabel(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}