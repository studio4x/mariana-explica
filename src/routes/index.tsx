/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from "react"
import { Navigate, createBrowserRouter, useParams } from "react-router-dom"
import {
  PublicLayout,
  DashboardLayout,
  AdminLayout,
  AuthLayout,
} from "@/layouts"
import { ProtectedRoute, AdminRoute } from "@/components/common"

const Home = lazy(() => import("@/pages/public").then((module) => ({ default: module.Home })))
const Products = lazy(() => import("@/pages/public").then((module) => ({ default: module.Products })))
const Product = lazy(() => import("@/pages/public").then((module) => ({ default: module.Product })))
const Checkout = lazy(() => import("@/pages/public").then((module) => ({ default: module.Checkout })))
const Login = lazy(() => import("@/pages/auth").then((module) => ({ default: module.Login })))
const Register = lazy(() => import("@/pages/auth").then((module) => ({ default: module.Register })))
const AuthCallback = lazy(() => import("@/pages/auth").then((module) => ({ default: module.AuthCallback })))
const ResetPassword = lazy(() =>
  import("@/pages/auth").then((module) => ({ default: module.ResetPassword })),
)
const StudentDashboardPage = lazy(() =>
  import("@/pages/student").then((module) => ({ default: module.StudentDashboardPage })),
)
const DashboardDownloads = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardDownloads })),
)
const DashboardNotifications = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardNotifications })),
)
const StudentCoursesPage = lazy(() =>
  import("@/pages/student").then((module) => ({ default: module.StudentCoursesPage })),
)
const StudentCourseDetailsPage = lazy(() =>
  import("@/pages/student").then((module) => ({ default: module.StudentCourseDetailsPage })),
)
const StudentCoursePlayerLayout = lazy(() =>
  import("@/pages/student").then((module) => ({ default: module.StudentCoursePlayerLayout })),
)
const StudentLessonPage = lazy(() =>
  import("@/pages/student").then((module) => ({ default: module.StudentLessonPage })),
)
const StudentAssessmentExecutionPage = lazy(() =>
  import("@/pages/student").then((module) => ({ default: module.StudentAssessmentExecutionPage })),
)
const DashboardProfile = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardProfile })),
)
const DashboardSupport = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardSupport })),
)
const Admin = lazy(() => import("@/pages/admin").then((module) => ({ default: module.Admin })))
const AdminAffiliates = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminAffiliates })),
)
const AdminCoupons = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminCoupons })))
const AdminNotifications = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminNotifications })),
)
const AdminOperations = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminOperations })),
)
const AdminOrders = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminOrders })))
const AdminPayments = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminPayments })),
)
const AdminSettings = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminSettings })),
)
const AdminProducts = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminProducts })),
)
const AdminCourseBuilderLayout = lazy(() =>
  import("@/pages/admin/builder/AdminCourseBuilderLayout").then((module) => ({
    default: module.AdminCourseBuilderLayout,
  })),
)
const CourseOverviewPanel = lazy(() =>
  import("@/pages/admin/builder/CourseOverviewPanel").then((module) => ({
    default: module.CourseOverviewPanel,
  })),
)
const CourseSettingsPanel = lazy(() =>
  import("@/pages/admin/builder/CourseSettingsPanel").then((module) => ({
    default: module.CourseSettingsPanel,
  })),
)
const CourseReleasesPanel = lazy(() =>
  import("@/pages/admin/builder/CourseReleasesPanel").then((module) => ({
    default: module.CourseReleasesPanel,
  })),
)
const CourseAssessmentsPanel = lazy(() =>
  import("@/pages/admin/builder/CourseAssessmentsPanel").then((module) => ({
    default: module.CourseAssessmentsPanel,
  })),
)
const CourseModuleDetailPanel = lazy(() =>
  import("@/pages/admin/builder/CourseModuleDetailPanel").then((module) => ({
    default: module.CourseModuleDetailPanel,
  })),
)
const CourseLessonDetailPanel = lazy(() =>
  import("@/pages/admin/builder/CourseLessonDetailPanel").then((module) => ({
    default: module.CourseLessonDetailPanel,
  })),
)
const CourseLessonMaterialsPanel = lazy(() =>
  import("@/pages/admin/builder/CourseLessonMaterialsPanel").then((module) => ({
    default: module.CourseLessonMaterialsPanel,
  })),
)
const CourseModuleAssessmentDetailPanel = lazy(() =>
  import("@/pages/admin/builder/CourseModuleAssessmentDetailPanel").then((module) => ({
    default: module.CourseModuleAssessmentDetailPanel,
  })),
)
const AdminSupport = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminSupport })))
const AdminUsers = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminUsers })))

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<div className="p-8 text-center">A carregar...</div>}>
      {node}
    </Suspense>
  )
}

function LegacyPublicCourseRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={`/cursos/${slug}`} replace />
}

function LegacyStudentCourseRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/aluno/cursos/${id}`} replace />
}

function LegacyAdminBuilderRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/admin/cursos/${id}/builder`} replace />
}

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <PublicLayout />,
      children: [
        {
          index: true,
          element: withSuspense(<Home />),
        },
        {
          path: "cursos",
          element: withSuspense(<Products />),
        },
        {
          path: "cursos/:slug",
          element: withSuspense(<Product />),
        },
        {
          path: "checkout",
          element: withSuspense(<Checkout />),
        },
        {
          path: "produtos",
          element: <Navigate to="/cursos" replace />,
        },
        {
          path: "produto/:slug",
          element: <LegacyPublicCourseRedirect />,
        },
      ],
    },
    {
      path: "/",
      element: <AuthLayout />,
      children: [
        {
          path: "login",
          element: withSuspense(<Login />),
        },
        {
          path: "register",
          element: withSuspense(<Register />),
        },
        {
          path: "criar-conta",
          element: withSuspense(<Register />),
        },
        {
          path: "auth/callback",
          element: withSuspense(<AuthCallback />),
        },
        {
          path: "recuperar-senha",
          element: withSuspense(<Login />),
        },
        {
          path: "redefinir-senha",
          element: withSuspense(<ResetPassword />),
        },
      ],
    },
    {
      path: "/aluno",
      element: (
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          index: true,
          element: withSuspense(<StudentDashboardPage />),
        },
        {
          path: "dashboard",
          element: withSuspense(<StudentDashboardPage />),
        },
        {
          path: "cursos",
          element: withSuspense(<StudentCoursesPage />),
        },
        {
          path: "cursos/:courseId",
          element: withSuspense(<StudentCourseDetailsPage />),
        },
        {
          path: "cursos/:courseId/player",
          element: withSuspense(<StudentCoursePlayerLayout />),
          children: [
            {
              path: "aulas/:lessonId",
              element: withSuspense(<StudentLessonPage />),
            },
            {
              path: "avaliacoes/:assessmentId",
              element: withSuspense(<StudentAssessmentExecutionPage />),
            },
          ],
        },
        {
          path: "downloads",
          element: withSuspense(<DashboardDownloads />),
        },
        {
          path: "notificacoes",
          element: withSuspense(<DashboardNotifications />),
        },
        {
          path: "suporte",
          element: withSuspense(<DashboardSupport />),
        },
        {
          path: "perfil",
          element: withSuspense(<DashboardProfile />),
        },
      ],
    },
    {
      path: "/dashboard",
      element: <Navigate to="/aluno/dashboard" replace />,
    },
    {
      path: "/dashboard/produtos",
      element: <Navigate to="/aluno/cursos" replace />,
    },
    {
      path: "/dashboard/produto/:id",
      element: <LegacyStudentCourseRedirect />,
    },
    {
      path: "/dashboard/downloads",
      element: <Navigate to="/aluno/downloads" replace />,
    },
    {
      path: "/dashboard/notificacoes",
      element: <Navigate to="/aluno/notificacoes" replace />,
    },
    {
      path: "/dashboard/suporte",
      element: <Navigate to="/aluno/suporte" replace />,
    },
    {
      path: "/dashboard/perfil",
      element: <Navigate to="/aluno/perfil" replace />,
    },
    {
      path: "/admin",
      element: (
        <AdminRoute>
          <AdminLayout />
        </AdminRoute>
      ),
      children: [
        {
          index: true,
          element: withSuspense(<Admin />),
        },
        {
          path: "operacoes",
          element: withSuspense(<AdminOperations />),
        },
        {
          path: "usuarios",
          element: withSuspense(<AdminUsers />),
        },
        {
          path: "notificacoes",
          element: withSuspense(<AdminNotifications />),
        },
        {
          path: "cursos",
          element: withSuspense(<AdminProducts />),
        },
        {
          path: "cursos/:courseId/builder",
          element: withSuspense(<AdminCourseBuilderLayout />),
          children: [
            {
              index: true,
              element: withSuspense(<CourseOverviewPanel />),
            },
            {
              path: "settings",
              element: withSuspense(<CourseSettingsPanel />),
            },
            {
              path: "releases",
              element: withSuspense(<CourseReleasesPanel />),
            },
            {
              path: "assessments",
              element: withSuspense(<CourseAssessmentsPanel />),
            },
            {
              path: "assessments/final",
              element: withSuspense(<CourseAssessmentsPanel />),
            },
          ],
        },
        {
          path: "cursos/:courseId/builder/modulos/:moduleId",
          element: withSuspense(<AdminCourseBuilderLayout />),
          children: [
            {
              index: true,
              element: withSuspense(<CourseModuleDetailPanel />),
            },
          ],
        },
        {
          path: "cursos/:courseId/builder/modulos/:moduleId/aulas/:lessonId",
          element: withSuspense(<AdminCourseBuilderLayout />),
          children: [
            {
              index: true,
              element: withSuspense(<CourseLessonDetailPanel />),
            },
          ],
        },
        {
          path: "cursos/:courseId/builder/modulos/:moduleId/aulas/:lessonId/materiais",
          element: withSuspense(<AdminCourseBuilderLayout />),
          children: [
            {
              index: true,
              element: withSuspense(<CourseLessonMaterialsPanel />),
            },
          ],
        },
        {
          path: "cursos/:courseId/builder/modulos/:moduleId/avaliacoes/:assessmentId",
          element: withSuspense(<AdminCourseBuilderLayout />),
          children: [
            {
              index: true,
              element: withSuspense(<CourseModuleAssessmentDetailPanel />),
            },
          ],
        },
        {
          path: "pedidos",
          element: withSuspense(<AdminOrders />),
        },
        {
          path: "suporte",
          element: withSuspense(<AdminSupport />),
        },
        {
          path: "pagamentos",
          element: withSuspense(<AdminPayments />),
        },
        {
          path: "configuracoes",
          element: withSuspense(<AdminSettings />),
        },
        {
          path: "afiliados",
          element: withSuspense(<AdminAffiliates />),
        },
        {
          path: "cupons",
          element: withSuspense(<AdminCoupons />),
        },
        {
          path: "produtos",
          element: <Navigate to="/admin/cursos" replace />,
        },
        {
          path: "produtos/:id/conteudo",
          element: <LegacyAdminBuilderRedirect />,
        },
      ],
    },
  ],
  {
    basename: import.meta.env.VITE_BASE_URL || "/",
  },
)
