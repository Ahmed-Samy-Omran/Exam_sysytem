import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HomePage } from './Home'

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage — واجهة منصة التوظيف', () => {
  it('يعرض وصف منصة التقييم للتوظيف', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'منصة التقييم للتوظيف' })).toBeInTheDocument()
    expect(screen.getByText(/منصة يقيم من خلالها أصحاب العمل/)).toBeInTheDocument()
  })

  it('لا يعرض زر امتحان شامل في الصفحة الرئيسية', () => {
    renderPage()
    expect(screen.queryByRole('link', { name: /امتحان شامل|اختبار تدريبي شامل/ })).not.toBeInTheDocument()
  })

  it('لا يعرض شارة منصة تدريب ومراجعة', () => {
    renderPage()
    expect(screen.queryByText('منصة تدريب ومراجعة')).not.toBeInTheDocument()
  })
})