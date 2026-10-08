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
import { PublicLayout } from '@/components/PublicLayout'
import { ExamStartPage } from '@/pages/ExamStartPage'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'

const AboutPage = lazy(() => import('@/pages/About').then((m) => ({ default: m.AboutPage })))

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Suspense fallback={null}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/quiz/:attemptId/result" element={<QuizResultPage />} />
              <Route path="/exam/start" element={<ExamStartPage />} />
            </Route>
            <Route path="/quiz/:attemptId" element={<QuizRunnerPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
    </AuthProvider>
  )
}
