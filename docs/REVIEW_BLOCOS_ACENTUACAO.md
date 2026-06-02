# Revisão por Blocos - Acentuação e Codificação

Objetivo: facilitar a conferência do diff em grupos menores, sem misturar textos públicos, builders, áreas autenticadas e admin.

## Bloco 1 - Base técnica e utilitário de varredura

Foco: suporte à varredura, textos centrais e pontos transversais usados em múltiplas áreas.

Arquivos:
- `scripts/fix-ui-accents.mjs`
- `src/integrations/supabase.ts`
- `src/lib/auth-errors.ts`
- `src/lib/constants.ts`
- `src/lib/routes.ts`

## Bloco 2 - Área pública e navegação comercial

Foco: páginas públicas, navegação, rodapé, consentimento e textos institucionais visíveis ao visitante.

Arquivos:
- `src/components/common/CookieConsentBanner.tsx`
- `src/components/common/Footer.tsx`
- `src/components/common/Navbar.tsx`
- `src/layouts/AuthLayout.tsx`
- `src/pages/public/About.tsx`
- `src/pages/public/Checkout.tsx`
- `src/pages/public/CheckoutSuccess.tsx`
- `src/pages/public/CookiePolicy.tsx`
- `src/pages/public/Explicacoes.tsx`
- `src/pages/public/Home.tsx`
- `src/pages/public/LegalPageLayout.tsx`
- `src/pages/public/Maintenance.tsx`
- `src/pages/public/PrivacyPolicy.tsx`
- `src/pages/public/Product.tsx`
- `src/pages/public/Products.tsx`
- `src/pages/public/PublicManagedPage.tsx`
- `src/pages/public/Support.tsx`
- `src/pages/public/TermsOfUse.tsx`

## Bloco 3 - Builders, narrativas e conteúdo gerado

Foco: textos montados por helper, apresentação de produtos, páginas geradas e conteúdos-padrão do site.

Arquivos:
- `src/lib/course-helpers.ts`
- `src/lib/course-json-import-export.ts`
- `src/lib/course-public-page.ts`
- `src/lib/faq-defaults.ts`
- `src/lib/product-presentation.ts`
- `src/lib/site-page-builder.ts`
- `src/lib/support-sla.ts`

## Bloco 4 - Autenticação, dashboard e área do aluno

Foco: mensagens de login, recuperação, dashboard, downloads, suporte e experiência do aluno autenticado.

Arquivos:
- `src/components/common/InstallPrompt.tsx`
- `src/components/common/OperationFeedbackModal.tsx`
- `src/components/common/ProtectedRoute.test.tsx`
- `src/components/common/ProtectedRoute.tsx`
- `src/components/common/SiteMaintenanceGate.tsx`
- `src/components/notifications/FloatingNotifications.tsx`
- `src/layouts/DashboardLayout.tsx`
- `src/pages/auth/AuthCallback.tsx`
- `src/pages/auth/Login.tsx`
- `src/pages/auth/Register.tsx`
- `src/pages/auth/ResetPassword.tsx`
- `src/pages/dashboard/Dashboard.tsx`
- `src/pages/dashboard/DashboardDownloads.tsx`
- `src/pages/dashboard/DashboardNotifications.tsx`
- `src/pages/dashboard/DashboardPayments.tsx`
- `src/pages/dashboard/DashboardProductDetail.tsx`
- `src/pages/dashboard/DashboardProducts.tsx`
- `src/pages/dashboard/DashboardProfile.tsx`
- `src/pages/dashboard/DashboardSupport.tsx`
- `src/pages/dashboard/SupportTicketDetail.tsx`
- `src/pages/student/StudentAssessmentExecutionPage.tsx`
- `src/pages/student/StudentCourseDetailsPage.tsx`
- `src/pages/student/StudentCoursePlayerLayout.tsx`
- `src/pages/student/StudentLessonPage.tsx`
- `src/routes/index.tsx`
- `src/services/checkout.service.ts`
- `src/services/dashboard.service.ts`
- `src/services/support.service.ts`

## Bloco 5 - Reviews, widgets e componentes partilhados de conteúdo

Foco: componentes reutilizados em mais de uma área, sobretudo exibição de conteúdo, media e reviews.

Arquivos:
- `src/components/common/AdminSessionRecovery.tsx`
- `src/components/common/LessonContentBlocksEditor.tsx`
- `src/components/common/LessonPrimaryMedia.tsx`
- `src/components/reviews/CourseReviews.tsx`
- `src/components/reviews/HomeReviewsFeed.tsx`
- `src/lib/assessment-builder.ts`

## Bloco 6 - Painel administrativo e builder de curso

Foco: mensagens internas do admin, labels operacionais, builder de curso e gestão de conteúdos.

Arquivos:
- `src/layouts/AdminLayout.tsx`
- `src/pages/admin/Admin.tsx`
- `src/pages/admin/AdminAccount.tsx`
- `src/pages/admin/AdminAffiliates.tsx`
- `src/pages/admin/AdminCoupons.tsx`
- `src/pages/admin/AdminCoursePreview.tsx`
- `src/pages/admin/AdminCourseStudents.tsx`
- `src/pages/admin/AdminFaqManagementPanel.tsx`
- `src/pages/admin/AdminNotifications.tsx`
- `src/pages/admin/AdminOperations.tsx`
- `src/pages/admin/AdminOrders.tsx`
- `src/pages/admin/AdminPageEditor.tsx`
- `src/pages/admin/AdminPayments.tsx`
- `src/pages/admin/AdminProductCategoriesPanel.tsx`
- `src/pages/admin/AdminProductContent.tsx`
- `src/pages/admin/AdminProducts.tsx`
- `src/pages/admin/AdminPublicForms.tsx`
- `src/pages/admin/AdminReviews.tsx`
- `src/pages/admin/AdminSettings.tsx`
- `src/pages/admin/AdminSupport.tsx`
- `src/pages/admin/AdminUsers.tsx`
- `src/pages/admin/builder/AdminCourseBuilderLayout.tsx`
- `src/pages/admin/builder/AssessmentBuilderWorkspace.tsx`
- `src/pages/admin/builder/CourseAssessmentsPanel.tsx`
- `src/pages/admin/builder/CourseFinalAssessmentDetailPanel.tsx`
- `src/pages/admin/builder/CourseLessonDetailPanel.tsx`
- `src/pages/admin/builder/CourseLessonMaterialsPanel.tsx`
- `src/pages/admin/builder/CourseModuleAssessmentDetailPanel.tsx`
- `src/pages/admin/builder/CourseModuleDetailPanel.tsx`
- `src/pages/admin/builder/CourseOverviewPanel.tsx`
- `src/pages/admin/builder/CoursePublicPagePanel.tsx`
- `src/pages/admin/builder/CourseReleasesPanel.tsx`
- `src/pages/admin/builder/CourseSettingsPanel.tsx`
- `src/services/admin.service.ts`
- `src/services/public-form.service.ts`

## Ordem sugerida de conferência

1. Bloco 2, porque concentra o impacto visual mais imediato.
2. Bloco 3, porque replica texto em páginas geradas e páginas públicas dinâmicas.
3. Bloco 4, para validar experiência autenticada.
4. Bloco 6, para fechar o admin.
5. Bloco 1 e Bloco 5, como revisão transversal final.
