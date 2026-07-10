import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PageHeader, RichTextEditor, StatusBadge } from "@/components/common"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui"
import {
  useAdminNotificationCampaigns,
  useAdminOperations,
  useAdminProductCategories,
  usePreviewAdminNotificationEmail,
  useAdminProducts,
  useAdminUsers,
  usePreviewAdminNotificationCampaign,
  useRetryAdminEmailDelivery,
  useSendAdminNotificationTestEmail,
  useSendAdminNotificationCampaign,
} from "@/hooks/useAdmin"
import { isRichTextEmpty, sanitizeRichTextHtml } from "@/lib/rich-text"
import type {
  AdminEmailDeliverySummary,
  AdminNotificationCampaignInput,
  AdminNotificationCampaignPreview,
  AdminNotificationEmailPreview,
  AdminNotificationCampaignSummary,
  AdminNotificationCampaignTagOption,
  AdminUserSummary,
} from "@/types/app.types"
import type { ProductCategorySummary, ProductSummary } from "@/types/product.types"
import { formatDateTime } from "@/utils/date"

type Audience = AdminNotificationCampaignInput["audience"]
type NotificationType = AdminNotificationCampaignInput["type"]
type TagTarget = "title" | "emailSubject" | "messageHtml" | "ctaLabel" | "ctaUrl"
type NotificationsPageTab = "campaigns" | "queue"
type MessageEditorTab = "visual" | "html"

const BASE_TAG_OPTIONS: AdminNotificationCampaignTagOption[] = [
  {
    key: "greeting_name",
    token: "{{greeting_name}}",
    description: "Saudacao curta para o aluno.",
    category: "identity",
  },
  {
    key: "full_name",
    token: "{{full_name}}",
    description: "Nome completo do destinatario.",
    category: "identity",
  },
  {
    key: "first_name",
    token: "{{first_name}}",
    description: "Primeiro nome do destinatario.",
    category: "identity",
  },
  {
    key: "dashboard_url",
    token: "{{dashboard_url}}",
    description: "Link para a area do aluno.",
    category: "navigation",
  },
  {
    key: "notifications_url",
    token: "{{notifications_url}}",
    description: "Link direto para as notificacoes.",
    category: "navigation",
  },
]

function AdminNotificationsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificacoes"
        description="Composer administrativo para campanhas segmentadas na plataforma e por email."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-10 w-20 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="h-4 w-44 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-slate-100" />
            ))}
            <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
          </div>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function appendTokenToValue(value: string, token: string) {
  if (!value.trim()) {
    return token
  }

  const needsSpace = !value.endsWith(" ") && !value.endsWith(">") && !value.endsWith("/")
  return `${value}${needsSpace ? " " : ""}${token}`
}

function appendTokenToHtml(value: string, token: string) {
  const normalized = sanitizeRichTextHtml(value)
  if (!normalized) {
    return `<p>${token}</p>`
  }

  if (/<\/p>\s*$/i.test(normalized)) {
    return normalized.replace(/<\/p>\s*$/i, ` ${token}</p>`)
  }

  return `${normalized}<p>${token}</p>`
}

function getToneForType(type: NotificationType) {
  switch (type) {
    case "marketing":
      return "warning"
    case "support":
      return "info"
    case "transactional":
      return "success"
    default:
      return "neutral"
  }
}

function getEmailTone(status: AdminEmailDeliverySummary["status"]) {
  if (status === "sent" || status === "delivered") {
    return "success"
  }

  if (status === "failed" || status === "bounced") {
    return "danger"
  }

  return "warning"
}

function getAudienceLabel(campaign: AdminNotificationCampaignSummary) {
  if (campaign.audience === "single") {
    return "Utilizador especifico"
  }

  if (campaign.audience === "segment") {
    return "Segmento"
  }

  return "Todos"
}

function buildTagOptions(
  selectedProduct: ProductSummary | null,
  selectedCategory: ProductCategorySummary | null,
): AdminNotificationCampaignTagOption[] {
  const options = [...BASE_TAG_OPTIONS]

  if (selectedProduct) {
    options.push({
      key: "product_title",
      token: "{{product_title}}",
      description: "Titulo do material selecionado.",
      category: "product",
    })
  }

  if (selectedCategory) {
    options.push({
      key: "category_title",
      token: "{{category_title}}",
      description: "Titulo da categoria selecionada.",
      category: "product",
    })
  }

  return options
}

function buildCampaignPayload(input: {
  audience: Audience
  userId: string
  role: AdminUserSummary["role"] | ""
  status: AdminUserSummary["status"] | ""
  productCategoryId: string
  productId: string
  type: NotificationType
  title: string
  emailSubject: string
  messageHtml: string
  ctaLabel: string
  ctaUrl: string
  sentViaEmail: boolean
  sentViaInApp: boolean
}): Omit<AdminNotificationCampaignInput, "action"> {
  return {
    audience: input.audience,
    userId: input.audience === "single" ? input.userId || undefined : undefined,
    role: input.audience === "segment" && input.role ? input.role : undefined,
    status: input.audience === "segment" && input.status ? input.status : undefined,
    productCategoryId: input.audience === "segment" ? input.productCategoryId || null : null,
    productId: input.audience === "segment" ? input.productId || null : null,
    purchaseBasis: "active_grants",
    type: input.type,
    title: input.title.trim(),
    emailSubject: input.emailSubject.trim() || null,
    messageHtml: sanitizeRichTextHtml(input.messageHtml),
    ctaLabel: input.ctaLabel.trim() || null,
    ctaUrl: input.ctaUrl.trim() || null,
    sentViaEmail: input.sentViaEmail,
    sentViaInApp: input.sentViaInApp,
  }
}

function validateCampaignPayload(payload: Omit<AdminNotificationCampaignInput, "action">) {
  if (payload.audience === "single" && !payload.userId) {
    return "Seleciona o utilizador que vai receber a campanha."
  }

  if (!payload.title.trim()) {
    return "O titulo da campanha e obrigatorio."
  }

  if (isRichTextEmpty(payload.messageHtml)) {
    return "A mensagem da campanha nao pode ficar vazia."
  }

  if (!payload.sentViaEmail && !payload.sentViaInApp) {
    return "Ativa pelo menos um canal de entrega."
  }

  return null
}

function getReusablePayload(campaign: AdminNotificationCampaignSummary): Omit<AdminNotificationCampaignInput, "action"> | null {
  if (!campaign.can_reuse || !campaign.message_html) {
    return null
  }

  return {
    audience: campaign.audience,
    userId: campaign.audience === "single" ? campaign.user_id ?? undefined : undefined,
    role: campaign.audience === "segment" ? campaign.role ?? undefined : undefined,
    status: campaign.audience === "segment" ? campaign.status ?? undefined : undefined,
    productCategoryId: campaign.audience === "segment" ? campaign.product_category_id ?? null : null,
    productId: campaign.audience === "segment" ? campaign.product_id ?? null : null,
    purchaseBasis: campaign.purchase_basis,
    type: campaign.type,
    title: campaign.title,
    emailSubject: campaign.email_subject ?? null,
    messageHtml: campaign.message_html,
    ctaLabel: campaign.cta_label ?? null,
    ctaUrl: campaign.cta_url ?? null,
    sentViaEmail: campaign.sent_via_email,
    sentViaInApp: campaign.sent_via_in_app,
  }
}

export function AdminNotifications() {
  const formRef = useRef<HTMLFormElement | null>(null)
  const livePreviewRequestRef = useRef(0)
  const { profile } = useAuth()
  const [audience, setAudience] = useState<Audience>("all")
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState<AdminUserSummary["role"] | "">("")
  const [status, setStatus] = useState<AdminUserSummary["status"] | "">("")
  const [productCategoryId, setProductCategoryId] = useState("")
  const [productId, setProductId] = useState("")
  const [type, setType] = useState<NotificationType>("informational")
  const [title, setTitle] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [messageHtml, setMessageHtml] = useState("")
  const [ctaLabel, setCtaLabel] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [sentViaEmail, setSentViaEmail] = useState(true)
  const [sentViaInApp, setSentViaInApp] = useState(true)
  const [tagTarget, setTagTarget] = useState<TagTarget>("messageHtml")
  const [activeTab, setActiveTab] = useState<NotificationsPageTab>("campaigns")
  const [messageEditorTab, setMessageEditorTab] = useState<MessageEditorTab>("visual")
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null)
  const [preview, setPreview] = useState<AdminNotificationCampaignPreview | null>(null)
  const [emailPreview, setEmailPreview] = useState<AdminNotificationEmailPreview | null>(null)
  const [emailPreviewState, setEmailPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [emailPreviewError, setEmailPreviewError] = useState<string | null>(null)
  const shouldLoadUserDirectory = audience === "single"
  const shouldLoadSegmentFilters = audience === "segment"
  const shouldLoadQueue = activeTab === "queue"

  const campaignsQuery = useAdminNotificationCampaigns()
  const operationsQuery = useAdminOperations(shouldLoadQueue)
  const usersQuery = useAdminUsers(shouldLoadUserDirectory)
  const productsQuery = useAdminProducts(shouldLoadSegmentFilters)
  const categoriesQuery = useAdminProductCategories(shouldLoadSegmentFilters)
  const previewMutation = usePreviewAdminNotificationCampaign()
  const emailPreviewMutation = usePreviewAdminNotificationEmail()
  const retryEmailMutation = useRetryAdminEmailDelivery()
  const sendTestEmailMutation = useSendAdminNotificationTestEmail()
  const sendMutation = useSendAdminNotificationCampaign()
  const emailPreviewMutateAsyncRef = useRef(emailPreviewMutation.mutateAsync)

  const isLoading = campaignsQuery.isLoading
  const isError = campaignsQuery.isError

  const users = usersQuery.data ?? []
  const products = productsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const campaigns = campaignsQuery.data ?? []
  const emailDeliveries = operationsQuery.data?.emailDeliveries ?? []

  const emailQueueSummary = useMemo(
    () => ({
      queued: emailDeliveries.filter((delivery) => delivery.status === "queued").length,
      failed: emailDeliveries.filter((delivery) => delivery.status === "failed" || delivery.status === "bounced").length,
      sent: emailDeliveries.filter((delivery) => delivery.status === "sent" || delivery.status === "delivered").length,
    }),
    [emailDeliveries],
  )

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === productCategoryId) ?? null,
    [categories, productCategoryId],
  )
  const filteredProducts = useMemo(
    () => (productCategoryId ? products.filter((product) => product.category_id === productCategoryId) : products),
    [productCategoryId, products],
  )
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [productId, products],
  )
  const tagOptions = useMemo(
    () => buildTagOptions(selectedProduct, selectedCategory),
    [selectedCategory, selectedProduct],
  )
  const canRenderEmailPreview = Boolean(title.trim()) && !isRichTextEmpty(messageHtml)

  const totals = useMemo(
    () => ({
      campaigns: campaigns.length,
      emailEnabled: campaigns.filter((campaign) => campaign.sent_via_email).length,
      inAppEnabled: campaigns.filter((campaign) => campaign.sent_via_in_app).length,
    }),
    [campaigns],
  )

  useEffect(() => {
    setPreview(null)
    setFeedback(null)
  }, [
    audience,
    userId,
    role,
    status,
    productCategoryId,
    productId,
    type,
    title,
    emailSubject,
    messageHtml,
    ctaLabel,
    ctaUrl,
    sentViaEmail,
    sentViaInApp,
  ])

  useEffect(() => {
    if (!productCategoryId) {
      return
    }

    const stillValid = filteredProducts.some((product) => product.id === productId)
    if (!stillValid) {
      setProductId("")
    }
  }, [filteredProducts, productCategoryId, productId])

  useEffect(() => {
    emailPreviewMutateAsyncRef.current = emailPreviewMutation.mutateAsync
  }, [emailPreviewMutation.mutateAsync])

  useEffect(() => {
    if (activeTab !== "campaigns") {
      return
    }

    if (!canRenderEmailPreview) {
      setEmailPreview(null)
      setEmailPreviewState("idle")
      setEmailPreviewError(null)
      return
    }

    const requestId = livePreviewRequestRef.current + 1
    livePreviewRequestRef.current = requestId
    setEmailPreviewState("loading")
    setEmailPreviewError(null)

    const timeoutId = window.setTimeout(() => {
      void emailPreviewMutateAsyncRef
        .current(buildPayload())
        .then((response) => {
          if (livePreviewRequestRef.current !== requestId) {
            return
          }

          setEmailPreview(response)
          setEmailPreviewState("ready")
          setEmailPreviewError(null)
        })
        .catch((error) => {
          if (livePreviewRequestRef.current !== requestId) {
            return
          }

          setEmailPreviewState("error")
          setEmailPreviewError(error instanceof Error ? error.message : "Nao foi possivel atualizar o preview do email.")
        })
    }, 450)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    activeTab,
    audience,
    userId,
    role,
    status,
    productCategoryId,
    productId,
    type,
    title,
    emailSubject,
    messageHtml,
    ctaLabel,
    ctaUrl,
    sentViaEmail,
    sentViaInApp,
    canRenderEmailPreview,
  ])

  const insertTag = (token: string) => {
    setFeedback(null)

    switch (tagTarget) {
      case "title":
        setTitle((current) => appendTokenToValue(current, token))
        return
      case "emailSubject":
        setEmailSubject((current) => appendTokenToValue(current, token))
        return
      case "ctaLabel":
        setCtaLabel((current) => appendTokenToValue(current, token))
        return
      case "ctaUrl":
        setCtaUrl((current) => appendTokenToValue(current, token))
        return
      default:
        setMessageHtml((current) => appendTokenToHtml(current, token))
    }
  }

  const buildPayload = () =>
    buildCampaignPayload({
      audience,
      userId,
      role,
      status,
      productCategoryId,
      productId,
      type,
      title,
      emailSubject,
      messageHtml,
      ctaLabel,
      ctaUrl,
      sentViaEmail,
      sentViaInApp,
    })

  const applyPayloadToComposer = (payload: Omit<AdminNotificationCampaignInput, "action">) => {
    setAudience(payload.audience)
    setUserId(payload.userId ?? "")
    setRole(payload.role ?? "")
    setStatus(payload.status ?? "")
    setProductCategoryId(payload.productCategoryId ?? "")
    setProductId(payload.productId ?? "")
    setType(payload.type)
    setTitle(payload.title)
    setEmailSubject(payload.emailSubject ?? "")
    setMessageHtml(payload.messageHtml)
    setCtaLabel(payload.ctaLabel ?? "")
    setCtaUrl(payload.ctaUrl ?? "")
    setSentViaEmail(payload.sentViaEmail)
    setSentViaInApp(payload.sentViaInApp)
    setPreview(null)
  }

  const handleReuseCampaign = (campaign: AdminNotificationCampaignSummary) => {
    const payload = getReusablePayload(campaign)

    if (!payload) {
      setFeedback({
        tone: "danger",
        message: "Esta campanha nao tem payload completo guardado para reaproveitamento.",
      })
      return
    }

    applyPayloadToComposer(payload)
    setFeedback({
      tone: "success",
      message: "Campanha carregada no composer. Podes ajustar o conteudo antes de enviar.",
    })
    if (typeof formRef.current?.scrollIntoView === "function") {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const handleResendCampaign = async (campaign: AdminNotificationCampaignSummary) => {
    const payload = getReusablePayload(campaign)

    if (!payload) {
      setFeedback({
        tone: "danger",
        message: "Esta campanha nao tem payload completo guardado para reenvio direto.",
      })
      return
    }

    const validationError = validateCampaignPayload(payload)
    if (validationError) {
      setFeedback({ tone: "danger", message: validationError })
      return
    }

    try {
      const result = await sendMutation.mutateAsync(payload)
      setFeedback({
        tone: "success",
        message: `Campanha reenviada para ${result.inserted_count} destinatarios. In-app: ${result.notification_count}. Email: ${result.email_recipient_count}.`,
      })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel reenviar a campanha.",
      })
    }
  }

  const handleRetryEmailDelivery = async (deliveryId: string) => {
    try {
      await retryEmailMutation.mutateAsync(deliveryId)
      setFeedback({
        tone: "success",
        message: "Email reenfileirado com sucesso para nova tentativa de envio.",
      })
      setActiveTab("queue")
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel reenfileirar este email.",
      })
    }
  }

  const handlePreview = async () => {
    const payload = buildPayload()
    const validationError = validateCampaignPayload(payload)

    if (validationError) {
      setFeedback({ tone: "danger", message: validationError })
      return
    }

    try {
      const response = await previewMutation.mutateAsync(payload)
      setPreview(response)
      setFeedback(null)
    } catch (error) {
      setPreview(null)
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel gerar a preview da campanha.",
      })
    }
  }

  const handleSendTestEmail = async () => {
    const payload = buildPayload()

    if (!payload.title.trim()) {
      setFeedback({ tone: "danger", message: "Preenche o titulo antes de enviares um email de teste." })
      return
    }

    if (isRichTextEmpty(payload.messageHtml)) {
      setFeedback({ tone: "danger", message: "Preenche a mensagem antes de enviares um email de teste." })
      return
    }

    try {
      const result = await sendTestEmailMutation.mutateAsync(payload)
      setFeedback({
        tone: "success",
        message: result.processedNow
          ? `Email de teste enviado para ${result.emailTo}.`
          : `Email de teste enfileirado para ${result.emailTo}.`,
      })
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel enviar o email de teste.",
      })
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = buildPayload()
    const validationError = validateCampaignPayload(payload)

    if (validationError) {
      setFeedback({ tone: "danger", message: validationError })
      return
    }

    try {
      const result = await sendMutation.mutateAsync(payload)
      setFeedback({
        tone: "success",
        message: `Campanha enviada para ${result.inserted_count} destinatarios. In-app: ${result.notification_count}. Email: ${result.email_recipient_count}.`,
      })
      setPreview(null)
    } catch (error) {
      setFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : "Nao foi possivel enviar a campanha.",
      })
    }
  }

  if (isLoading) {
    return <AdminNotificationsSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        title="Nao foi possivel carregar a central de campanhas"
        message="Tenta novamente dentro de instantes."
        onRetry={() => {
          void campaignsQuery.refetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificacoes"
        description="Cria campanhas administrativas com notificacao in-app, email ou ambos, sempre com segmentacao resolvida no backend."
        actions={
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("campaigns")}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                activeTab === "campaigns" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950",
              ].join(" ")}
            >
              Campanhas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("queue")}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                activeTab === "queue" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950",
              ].join(" ")}
            >
              Fila de envio
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Campanhas auditadas</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{totals.campaigns}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Com email ativo</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{totals.emailEnabled}</p>
        </div>
        <div className="rounded-[1.75rem] border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Com in-app ativo</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{totals.inAppEnabled}</p>
        </div>
      </div>

      {activeTab === "campaigns" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
          <form ref={formRef} onSubmit={handleSubmit} className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Composer de campanhas</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-950">Criar campanha administrativa</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            A composicao e feita uma vez e o backend trata a derivacao para notificacao em texto e email com HTML sanitizado.
          </p>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Audiencia
                </span>
                <select
                  value={audience}
                  onChange={(event) => setAudience(event.target.value as Audience)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                >
                  <option value="all">Todos os utilizadores elegiveis</option>
                  <option value="segment">Segmento com filtros</option>
                  <option value="single">Utilizador especifico</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Tipo
                </span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as NotificationType)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                >
                  <option value="informational">Informativa</option>
                  <option value="transactional">Transacional</option>
                  <option value="support">Suporte</option>
                  <option value="marketing">Marketing</option>
                </select>
              </label>
            </div>

            {audience === "single" ? (
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Destinatario
                </span>
                <select
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  disabled={usersQuery.isLoading || usersQuery.isError}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                >
                  <option value="">
                    {usersQuery.isError
                      ? "Nao foi possivel carregar utilizadores"
                      : usersQuery.isLoading
                        ? "A carregar utilizadores..."
                        : "Seleciona um utilizador"}
                  </option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} - {user.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {audience === "segment" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                    Papel
                  </span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as AdminUserSummary["role"] | "")}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                  >
                    <option value="">Todos os papeis</option>
                    <option value="student">Alunos</option>
                    <option value="affiliate">Afiliados</option>
                    <option value="admin">Admins</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                    Estado
                  </span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as AdminUserSummary["status"] | "")}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                  >
                    <option value="">Todos os estados</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                    <option value="blocked">Bloqueados</option>
                    <option value="pending_review">Em revisao</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                    Categoria comprada
                  </span>
                  <select
                    value={productCategoryId}
                    onChange={(event) => setProductCategoryId(event.target.value)}
                    disabled={categoriesQuery.isLoading || categoriesQuery.isError}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                  >
                    <option value="">
                      {categoriesQuery.isError
                        ? "Nao foi possivel carregar categorias"
                        : categoriesQuery.isLoading
                          ? "A carregar categorias..."
                          : "Todas as categorias"}
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                    Material comprado
                  </span>
                  <select
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                    disabled={productsQuery.isLoading || productsQuery.isError}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                  >
                    <option value="">
                      {productsQuery.isError
                        ? "Nao foi possivel carregar materiais"
                        : productsQuery.isLoading
                          ? "A carregar materiais..."
                          : "Todos os materiais"}
                    </option>
                    {filteredProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Titulo
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ex.: Sessao extra disponivel"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Assunto do email
                </span>
                <input
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  placeholder="Opcional. Se vazio, o backend usa o titulo."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Tags dinamicas</p>
                  <p className="mt-1 text-sm text-slate-600">
                    As tags abaixo podem ser usadas no titulo, assunto, mensagem e CTA.
                  </p>
                </div>
                <label className="flex min-w-[210px] items-center gap-3 text-sm text-slate-600">
                  <span>Inserir em</span>
                  <select
                    value={tagTarget}
                    onChange={(event) => setTagTarget(event.target.value as TagTarget)}
                    className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400"
                  >
                    <option value="messageHtml">Mensagem</option>
                    <option value="title">Titulo</option>
                    <option value="emailSubject">Assunto do email</option>
                    <option value="ctaLabel">Label do CTA</option>
                    <option value="ctaUrl">URL do CTA</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {tagOptions.map((tag) => (
                  <button
                    key={tag.key}
                    type="button"
                    onClick={() => insertTag(tag.token)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                    title={tag.description}
                  >
                    {tag.token}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <span className="block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Mensagem da campanha
                </span>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMessageEditorTab("visual")}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      messageEditorTab === "visual"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:text-slate-950",
                    ].join(" ")}
                  >
                    Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageEditorTab("html")}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      messageEditorTab === "html"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:text-slate-950",
                    ].join(" ")}
                  >
                    HTML
                  </button>
                </div>
              </div>

              <p className="mb-3 text-sm text-slate-600">
                A edicao visual e a edicao HTML usam o mesmo conteudo e ficam sincronizadas quando alternas entre abas.
              </p>

              {messageEditorTab === "visual" ? (
                <RichTextEditor
                  value={messageHtml}
                  onChange={setMessageHtml}
                  placeholder="Escreve aqui o conteudo principal da campanha..."
                  toolbarVariant="compact"
                  minHeightPx={240}
                />
              ) : (
                <label className="block">
                  <span className="sr-only">Mensagem da campanha HTML</span>
                  <textarea
                    aria-label="Mensagem da campanha HTML"
                    value={messageHtml}
                    onChange={(event) => setMessageHtml(event.target.value)}
                    placeholder="<p>Escreve aqui o HTML da campanha...</p>"
                    spellCheck={false}
                    className="min-h-[294px] w-full rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-sm leading-7 text-slate-100 outline-none transition focus:border-sky-400"
                  />
                </label>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  Label do CTA
                </span>
                <input
                  value={ctaLabel}
                  onChange={(event) => setCtaLabel(event.target.value)}
                  placeholder="Ex.: Ver material"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  URL do CTA
                </span>
                <input
                  value={ctaUrl}
                  onChange={(event) => setCtaUrl(event.target.value)}
                  placeholder="/aluno/notificacoes"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={sentViaInApp}
                  onChange={(event) => setSentViaInApp(event.target.checked)}
                />
                Criar notificacao in-app
              </label>
              <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={sentViaEmail}
                  onChange={(event) => setSentViaEmail(event.target.checked)}
                />
                Enfileirar email
              </label>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Base de compra</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Compradores sao resolvidos por grants ativos, que sao a fonte canonica de acesso real.
                  </p>
                </div>
                <StatusBadge label="active_grants" tone="info" />
              </div>

              {preview ? (
                <div className="mt-4 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Preview de destinatarios pronta</p>
                      <p className="mt-1 text-sm text-emerald-800">
                        {preview.totalRecipients} destinatarios encontrados para esta campanha.
                      </p>
                    </div>
                    <StatusBadge label={`${preview.totalRecipients} destinatarios`} tone="success" />
                  </div>

                  {preview.sampleRecipients.length > 0 ? (
                    <div className="mt-4 grid gap-3">
                      {preview.sampleRecipients.map((recipient) => (
                        <div key={recipient.id} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm">
                          <p className="font-medium text-slate-950">{recipient.full_name ?? "Utilizador"}</p>
                          <p className="text-slate-600">{recipient.email ?? recipient.id}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Usa a preview para confirmar o tamanho da audiencia antes do envio.
                </p>
              )}
            </div>
          </div>

          {feedback ? (
            <div
              className={[
                "mt-5 rounded-2xl border px-4 py-3 text-sm font-medium",
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900",
              ].join(" ")}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void handlePreview()}
              disabled={previewMutation.isPending || sendMutation.isPending || sendTestEmailMutation.isPending}
            >
              {previewMutation.isPending ? "A calcular..." : "Preview de destinatarios"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void handleSendTestEmail()}
              disabled={sendMutation.isPending || previewMutation.isPending || sendTestEmailMutation.isPending || !profile?.email}
            >
              {sendTestEmailMutation.isPending ? "A enviar teste..." : "Enviar email de teste"}
            </Button>
            <Button
              type="submit"
              className="rounded-full"
              disabled={sendMutation.isPending || previewMutation.isPending || sendTestEmailMutation.isPending}
            >
              {sendMutation.isPending ? "A enviar..." : "Enviar campanha"}
            </Button>
          </div>
          </form>

          <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-950">Historico de campanhas</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Listagem agregada a partir dos registos de auditoria do backend.
                </p>
              </div>
              <StatusBadge label={`${campaigns.length} disparos`} tone="neutral" />
            </div>

            {campaigns.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title="Sem campanhas"
                  message="Quando o admin enviar comunicacoes por esta area, o historico agregado vai aparecer aqui."
                />
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{campaign.title}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {campaign.actor_name ?? "Admin"}{campaign.actor_email ? ` - ${campaign.actor_email}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge label={campaign.type} tone={getToneForType(campaign.type)} />
                        <StatusBadge label={getAudienceLabel(campaign)} tone="neutral" />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {campaign.sent_via_in_app ? <StatusBadge label="In-app" tone="info" /> : null}
                      {campaign.sent_via_email ? <StatusBadge label="Email" tone="success" /> : null}
                      {campaign.product_category_title ? (
                        <StatusBadge label={campaign.product_category_title} tone="neutral" />
                      ) : null}
                      {campaign.product_title ? <StatusBadge label={campaign.product_title} tone="neutral" /> : null}
                    </div>

                    {campaign.message_excerpt ? (
                      <p className="mt-3 text-sm leading-6 text-slate-700">{campaign.message_excerpt}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => handleReuseCampaign(campaign)}
                        disabled={!campaign.can_reuse || sendMutation.isPending}
                      >
                        Reaproveitar
                      </Button>
                      <Button
                        type="button"
                        className="rounded-full"
                        onClick={() => void handleResendCampaign(campaign)}
                        disabled={!campaign.can_reuse || sendMutation.isPending}
                      >
                        {sendMutation.isPending ? "A reenviar..." : "Reenviar"}
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs uppercase tracking-[0.16em] text-slate-500 sm:grid-cols-2">
                      <p>{formatDateTime(campaign.created_at)}</p>
                      <p className="sm:text-right">
                        {campaign.recipient_count} destinatarios
                        {campaign.sent_via_email ? ` - ${campaign.email_recipient_count} email` : ""}
                        {campaign.sent_via_in_app ? ` - ${campaign.notification_count} in-app` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          </div>

          <aside className="self-start xl:sticky xl:top-24">
            <section className="rounded-[1.75rem] border bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-950">Preview do email</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Este card atualiza automaticamente enquanto preenches o composer.
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    Preview com o admin logado{profile?.email ? ` - ${profile.email}` : ""}
                  </p>
                </div>
                <StatusBadge
                  label={
                    emailPreviewState === "loading"
                      ? "A atualizar"
                      : emailPreviewState === "ready"
                        ? "Pronto"
                        : emailPreviewState === "error"
                          ? "Erro"
                          : "Em espera"
                  }
                  tone={
                    emailPreviewState === "ready"
                      ? "success"
                      : emailPreviewState === "error"
                        ? "danger"
                        : "warning"
                  }
                />
              </div>

              {canRenderEmailPreview ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Assunto</p>
                    <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                      {emailPreview?.subject ?? (emailSubject.trim() || title.trim() || "Sem assunto")}
                    </p>
                  </div>

                  {emailPreviewError ? (
                    <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                      {emailPreviewError}
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
                    {emailPreview ? (
                      <iframe
                        title="preview-email-notification-live"
                        srcDoc={emailPreview.html}
                        className="h-[620px] w-full bg-white"
                      />
                    ) : (
                      <div className="flex h-[320px] items-center justify-center px-6 text-sm text-slate-500">
                        {emailPreviewState === "loading"
                          ? "A gerar o preview do email..."
                          : "O preview do email vai aparecer aqui automaticamente."}
                      </div>
                    )}
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Texto puro</p>
                    <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                      {emailPreview?.text ?? "O fallback em texto puro vai aparecer aqui."}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm leading-7 text-slate-600">
                  Preenche pelo menos o titulo e a mensagem para veres aqui, em tempo real, como o email final vai ficar.
                </div>
              )}
            </section>
          </aside>
        </div>
      ) : (
        <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-950">Fila de envio</h2>
              <p className="mt-1 text-sm text-slate-600">
                Acompanha aqui o estado dos emails enfileirados e entregues pela camada operacional.
              </p>
            </div>
            <StatusBadge label={`${emailDeliveries.length} emails`} tone="neutral" />
          </div>

          {operationsQuery.isLoading ? (
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : operationsQuery.isError ? (
            <div className="mt-6">
              <ErrorState
                title="Nao foi possivel carregar a fila de envio"
                message={operationsQuery.error instanceof Error ? operationsQuery.error.message : "Tenta novamente dentro de instantes."}
                onRetry={() => void operationsQuery.refetch()}
              />
            </div>
          ) : emailDeliveries.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Sem emails na fila"
                message="Quando as campanhas criarem envios por email, os estados vao aparecer aqui."
              />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Em fila</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{emailQueueSummary.queued}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Entregues</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{emailQueueSummary.sent}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Falhas</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{emailQueueSummary.failed}</p>
                </div>
              </div>

              {emailDeliveries.slice(0, 10).map((delivery) => (
                <div key={delivery.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{delivery.subject ?? "Email sem assunto"}</p>
                      <p className="mt-1 text-sm text-slate-600">{delivery.email_to}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={delivery.status} tone={getEmailTone(delivery.status)} />
                      <StatusBadge label={delivery.template_key} tone="neutral" />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-800">Criado:</span> {formatDateTime(delivery.created_at)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Enviado:</span>{" "}
                      {delivery.sent_at ? formatDateTime(delivery.sent_at) : "Ainda pendente"}
                    </p>
                    {delivery.provider ? (
                      <p>
                        <span className="font-semibold text-slate-800">Provider:</span> {delivery.provider}
                      </p>
                    ) : null}
                    {delivery.error_message ? (
                      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                        {delivery.error_message}
                      </p>
                    ) : null}
                  </div>

                  {delivery.status === "failed" || delivery.status === "bounced" ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => void handleRetryEmailDelivery(delivery.id)}
                        disabled={retryEmailMutation.isPending}
                      >
                        {retryEmailMutation.isPending ? "A reenfileirar..." : "Reenfileirar email"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
