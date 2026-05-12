/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, useEffect, type ReactNode } from "react"
import { Navigate, createBrowserRouter, useParams, useRouteError } from "react-router-dom"
import {
  PublicLayout,
  DashboardLayout,
  AdminLayout,
  AuthLayout,
} from "@/layouts"
import { ProtectedRoute, AdminRoute } from "@/components/common"
import { ErrorState } from "@/components/feedback/ErrorState"
import { BUILD_VERSION } from "@/lib/build"
import { ROUTES } from "@/lib/constants"
import { isDynamicImportError, reloadAfterRuntimeCleanup } from "@/lib/runtime-recovery"

const Home = lazy(() => import("@/pages/public").then((module) => ({ default: module.Home })))
const Products = lazy(() => import("@/pages/public").then((module) => ({ default: module.Products })))
const Product = lazy(() => import("@/pages/public").then((module) => ({ default: module.Product })))
const Support = lazy(() => import("@/pages/public").then((module) => ({ default: module.Support })))
const Explicacoes = lazy(() => import("@/pages/public").then((module) => ({ default: module.Explicacoes })))
const Checkout = lazy(() => import("@/pages/public").then((module) => ({ default: module.Checkout })))
const CheckoutSuccess = lazy(() => import("@/pages/public").then((module) => ({ default: module.CheckoutSuccess })))
const PrivacyPolicy = lazy(() =>
  import("@/pages/public").then((module) => ({ default: module.PrivacyPolicy })),
)
const CookiePolicy = lazy(() =>
  import("@/pages/public").then((module) => ({ default: module.CookiePolicy })),
)
const TermsOfUse = lazy(() =>
  import("@/pages/public").then((module) => ({ default: module.TermsOfUse })),
)
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
const DashboardPayments = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardPayments })),
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
const DashboardSupportTicketDetail = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.DashboardSupportTicketDetail })),
)
const Admin = lazy(() => import("@/pages/admin").then((module) => ({ default: module.Admin })))
const AdminAccount = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminAccount })),
)
const AdminAffiliates = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminAffiliates })),
)
const AdminCoupons = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminCoupons })))
const AdminFaq = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminFaq })))
const AdminNotifications = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminNotifications })),
)
const AdminPayments = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminPayments })),
)
const AdminReviews = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminReviews })),
)
const AdminSettings = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminSettings })),
)
const AdminProducts = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminProducts })),
)
const AdminCourseStudents = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminCourseStudents })),
)
const AdminCoursePreview = lazy(() =>
  import("@/pages/admin").then((module) => ({ default: module.AdminCoursePreview })),
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
const CoursePublicPagePanel = lazy(() =>
  import("@/pages/admin/builder/CoursePublicPagePanel").then((module) => ({
    default: module.CoursePublicPagePanel,
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
const CourseFinalAssessmentDetailPanel = lazy(() =>
  import("@/pages/admin/builder/CourseFinalAssessmentDetailPanel").then((module) => ({
    default: module.CourseFinalAssessmentDetailPanel,
  })),
)
const AdminSupport = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminSupport })))
const AdminSupportTicketDetail = lazy(() =>
  import("@/pages/dashboard").then((module) => ({ default: module.AdminSupportTicketDetail })),
)
const AdminUsers = lazy(() => import("@/pages/admin").then((module) => ({ default: module.AdminUsers })))

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<div className="p-8 text-center">A carregar...</div>}>
      {node}
    </Suspense>
  )
}

function RouteErrorBoundary() {
  const error = useRouteError()
  const isRuntimeChunkError = isDynamicImportError(error)

  useEffect(() => {
    if (!isRuntimeChunkError) {
      return
    }

    const retryKey = `mariana-explica:chunk-retry:${BUILD_VERSION}`
    if (window.sessionStorage.getItem(retryKey) === "done") {
      return
    }

    window.sessionStorage.setItem(retryKey, "done")
    void reloadAfterRuntimeCleanup()
  }, [isRuntimeChunkError])

  if (isRuntimeChunkError) {
    return (
      <ErrorState
        title="A atualizar a plataforma"
        message="A aplicacao recebeu uma nova versao. Vamos recarregar a pagina para abrir os ficheiros corretos."
        onRetry={() => void reloadAfterRuntimeCleanup()}
      />
    )
  }

  return (
    <ErrorState
      title="Nao foi possivel carregar esta pagina"
      message="Atualize a pagina e tente novamente. Se continuar, avise o suporte com o horario do erro."
      onRetry={() => window.location.reload()}
    />
  )
}

function LegacyPublicCourseRedirect() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={slug ? `${ROUTES.COURSES}/${slug}` : ROUTES.COURSES} replace />
}

function LegacyStudentCourseRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/aluno/cursos/${id}`} replace />
}

function NavigateToStudentSupportTicket() {
  const { ticketId } = useParams<{ ticketId: string }>()
  return <Navigate to={`/aluno/chamados/${ticketId}`} replace />
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
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          index: true,
          element: withSuspense(<Home />),
        },
        {
          path: "materiais",
          element: withSuspense(<Products />),
        },
        {
          path: "materiais/:slug",
          element: withSuspense(<Product />),
        },
        {
          path: "cursos",
          element: <Navigate to={ROUTES.COURSES} replace />,
        },
        {
          path: "cursos/:slug",
          element: <LegacyPublicCourseRedirect />,
        },
        {
          path: "checkout",
          element: withSuspense(<Checkout />),
        },
        {
          path: "checkout/confirmacao",
          element: withSuspense(<CheckoutSuccess />),
        },
        {
          path: "suporte",
          element: withSuspense(<Support />),
        },
        {
          path: "explicacoes",
          element: withSuspense(<Explicacoes />),
        },
        {
          path: "privacidade",
          element: withSuspense(<PrivacyPolicy />),
        },
        {
          path: "cookies",
          element: withSuspense(<CookiePolicy />),
        },
        {
          path: "termos-de-uso",
          element: withSuspense(<TermsOfUse />),
        },
        {
          path: "produtos",
          element: <Navigate to={ROUTES.COURSES} replace />,
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
      errorElement: <RouteErrorBoundary />,
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
      errorElement: <RouteErrorBoundary />,
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
          path: "downloads",
          element: withSuspense(<DashboardDownloads />),
        },
        {
          path: "pagamentos",
          element: withSuspense(<DashboardPayments />),
        },
        {
          path: "notificacoes",
          element: withSuspense(<DashboardNotifications />),
        },
        {
          path: "chamados",
          element: withSuspense(<DashboardSupport />),
        },
        {
          path: "suporte",
          element: <Navigate to="/aluno/chamados" replace />,
        },
        {
          path: "mensagens",
          element: <Navigate to="/aluno/chamados" replace />,
        },
        {
          path: "chamados/:ticketId",
          element: withSuspense(<DashboardSupportTicketDetail />),
        },
        {
          path: "suporte/:ticketId",
          element: <NavigateToStudentSupportTicket />,
        },
        {
          path: "mensagens/:ticketId",
          element: <NavigateToStudentSupportTicket />,
        },
        {
          path: "perfil",
          element: withSuspense(<DashboardProfile />),
        },
      ],
    },
    {
      path: "/aluno/cursos/:courseId/player",
      errorElement: <RouteErrorBoundary />,
      element: (
        <ProtectedRoute>
          {withSuspense(<StudentCoursePlayerLayout />)}
        </ProtectedRoute>
      ),
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
      path: "/dashboard/pagamentos",
      element: <Navigate to="/aluno/pagamentos" replace />,
    },
    {
      path: "/dashboard/notificacoes",
      element: <Navigate to="/aluno/notificacoes" replace />,
    },
    {
      path: "/dashboard/mensagens",
      element: <Navigate to="/aluno/chamados" replace />,
    },
    {
      path: "/dashboard/mensagens/:ticketId",
      element: <NavigateToStudentSupportTicket />,
    },
    {
      path: "/dashboard/suporte",
      element: <Navigate to="/aluno/chamados" replace />,
    },
    {
      path: "/dashboard/chamados",
      element: <Navigate to="/aluno/chamados" replace />,
    },
    {
      path: "/dashboard/chamados/:ticketId",
      element: <NavigateToStudentSupportTicket />,
    },
    {
      path: "/dashboard/suporte/:ticketId",
      element: <NavigateToStudentSupportTicket />,
    },
    {
      path: "/dashboard/perfil",
      element: <Navigate to="/aluno/perfil" replace />,
    },
    {
      path: "/admin",
      errorElement: <RouteErrorBoundary />,
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
          element: <Navigate to="/admin/configuracoes?tab=operacoes" replace />,
        },
        {
          path: "usuarios",
          element: withSuspense(<AdminUsers />),
        },
        {
          path: "minha-conta",
          element: withSuspense(<AdminAccount />),
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
          path: "cursos/:courseId/alunos",
          element: withSuspense(<AdminCourseStudents />),
        },
        {
          path: "cursos/:courseId/builder/preview",
          element: withSuspense(<AdminCoursePreview />),
        },
        {
          path: "pedidos",
          element: <Navigate to="/admin/pagamentos" replace />,
        },
        {
          path: "reviews",
          element: withSuspense(<AdminReviews />),
        },
        {
          path: "suporte",
          element: withSuspense(<AdminSupport />),
        },
        {
          path: "perguntas-frequentes",
          element: withSuspense(<AdminFaq />),
        },
        {
          path: "suporte/:ticketId",
          element: withSuspense(<AdminSupportTicketDetail />),
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
    {
      path: "/admin/cursos/:courseId/builder",
      errorElement: <RouteErrorBoundary />,
      element: (
        <AdminRoute>
          {withSuspense(<AdminCourseBuilderLayout />)}
        </AdminRoute>
      ),
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
          path: "pagina-publica",
          element: withSuspense(<CoursePublicPagePanel />),
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
          element: withSuspense(<CourseFinalAssessmentDetailPanel />),
        },
        {
          path: "modulos/:moduleId",
          element: withSuspense(<CourseModuleDetailPanel />),
        },
        {
          path: "modulos/:moduleId/aulas/:lessonId",
          element: withSuspense(<CourseLessonDetailPanel />),
        },
        {
          path: "modulos/:moduleId/aulas/:lessonId/materiais",
          element: withSuspense(<CourseLessonMaterialsPanel />),
        },
        {
          path: "modulos/:moduleId/avaliacoes/:assessmentId",
          element: withSuspense(<CourseModuleAssessmentDetailPanel />),
        },
      ],
    },
  ],
  {
    basename: import.meta.env.VITE_BASE_URL || "/",
  },
)
