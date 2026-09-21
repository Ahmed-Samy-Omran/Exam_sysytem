import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { HomePage } from '@/pages/Home'
import { QuizSetupPage } from '@/pages/QuizSetup'
import { QuizRunnerPage } from '@/pages/QuizRunner'
import { QuizResultPage } from '@/pages/QuizResult'
import { AdminLoginPage } from '@/pages/admin/AdminLogin'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboard'
import { AdminQuestionsPage } from '@/pages/admin/AdminQuestions'
import { AdminQuestionFormPage } from '@/pages/admin/AdminQuestionForm'
import { AdminCategoriesPage } from '@/pages/admin/AdminCategories'
import { AdminSettingsPage } from '@/pages/admin/AdminSettings'
import { AdminExamsPage } from '@/pages/admin/AdminExams'
import { AdminAttemptDetailsPage } from '@/pages/admin/AdminAttemptDetails'
import { AdminExamAttemptsPage } from '@/pages/admin/AdminExamAttempts'
import { NotFoundPage } from '@/pages/NotFound'
import { ModeBanner } from '@/components/ModeBanner'
import { ExamStartPage } from '@/pages/ExamStartPage'

const AboutPage = lazy(() => import('@/pages/About').then((m) => ({ default: m.AboutPage })))

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ModeBanner />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/quiz/:attemptId" element={<QuizRunnerPage />} />
          <Route path="/quiz/:attemptId/result" element={<QuizResultPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="setup" element={<QuizSetupPage />} />
            <Route path="questions" element={<AdminQuestionsPage />} />
            <Route path="questions/new" element={<AdminQuestionFormPage />} />
            <Route path="questions/:id/edit" element={<AdminQuestionFormPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="exams" element={<AdminExamsPage />} />
            <Route path="exams/:examId/attempts" element={<AdminExamAttemptsPage />} />
            <Route path="attempts/:attemptId" element={<AdminAttemptDetailsPage />} />
          </Route>
          <Route path="/exam/start" element={<ExamStartPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}
