import { Outlet } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'

/**
 * هيكل صفحات المتقدم: الشريط العلوي + المحتوى.
 *
 * لا يلفّ صفحة الاختبار (`/quiz/:attemptId`) لأنها سياق مؤقّت ومركّز:
 * الشريط العلوي يستهلك ارتفاعًا ثمينًا على الجوال ويزيح تركيز المتقدم
 * عن السؤال أثناء العدّ التنازلي.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}