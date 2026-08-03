import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { MediaLibraryModal } from '@/components/common'
import { ErrorState, LoadingState } from '@/components/feedback'
import {
  DEFAULT_SEO_CONFIG,
  SEO_PAGE_LABELS,
  SEO_PAGE_PATHS,
  normalizeSeoConfigValue,
  type SeoConfigValue,
  type SeoPageKey,
} from '@/lib/seo'
import {
  fetchAdminSeoConfig,
  uploadAdminBrandingAssetFile,
  updateAdminSeoConfig,
  type AdminR2ListedObject,
} from '@/services/admin.service'

const inputClass =
  'mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white'
const labelClass =
  'text-[11px] font-black uppercase tracking-[0.2em] text-slate-500'

function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  placeholder,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'url' | 'email' | 'number'
  hint?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      {hint ? (
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={inputClass}
      />
      {hint ? (
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function AdminSeoSettings() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<SeoConfigValue | null>(null)
  const [imageField, setImageField] = useState<
    'default_og_image_url' | 'organization_logo_url' | null
  >(null)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'danger'
    message: string
  } | null>(null)
  const seoQuery = useQuery({
    queryKey: ['admin', 'seo'],
    queryFn: fetchAdminSeoConfig,
    staleTime: 60_000,
  })
  const saveSeo = useMutation({
    mutationFn: updateAdminSeoConfig,
    onSuccess: async (saved) => {
      queryClient.setQueryData(['admin', 'seo'], saved)
      queryClient.setQueryData(['site', 'seo'], saved)
      await queryClient.invalidateQueries({ queryKey: ['site', 'seo'] })
    },
  })

  if (seoQuery.isLoading)
    return <LoadingState message="A carregar configuração SEO..." />

  if (seoQuery.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar o SEO"
        message={
          seoQuery.error instanceof Error
            ? seoQuery.error.message
            : 'Tenta novamente dentro de instantes.'
        }
        onRetry={() => void seoQuery.refetch()}
      />
    )
  }

  const persisted = normalizeSeoConfigValue(
    seoQuery.data?.config_value ?? DEFAULT_SEO_CONFIG
  )
  const state = draft ?? persisted
  const update = <Key extends keyof SeoConfigValue>(
    key: Key,
    value: SeoConfigValue[Key]
  ) => {
    setFeedback(null)
    setDraft({ ...state, [key]: value })
  }
  const updatePage = (
    key: SeoPageKey,
    value: Partial<SeoConfigValue['pages'][SeoPageKey]>
  ) => {
    update('pages', {
      ...state.pages,
      [key]: { ...state.pages[key], ...value },
    })
  }
  const baseUrl = state.canonical_base_url.replace(/\/+$/, '')
  const imageFieldLabel =
    imageField === 'organization_logo_url'
      ? 'logótipo da organização'
      : 'imagem social'
  const seoImageUrl = (storagePath: string) =>
    `${baseUrl}/api/public/site-asset?storage_path=${encodeURIComponent(storagePath)}`
  const uploadSeoImage = async (file: File) => {
    if (!imageField) return
    const upload = await uploadAdminBrandingAssetFile({ role: 'logo_light', file })
    update(imageField, upload.public_url || seoImageUrl(upload.path))
  }
  const selectSeoImage = async (object: AdminR2ListedObject) => {
    if (!imageField) return
    update(imageField, seoImageUrl(object.storage_path))
  }

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={[
            'rounded-2xl border px-4 py-3 text-sm font-medium',
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          ].join(' ')}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          <p className="mt-4 text-2xl font-bold text-emerald-950">
            Páginas públicas
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-900/80">
            Títulos, descrições, canonical e partilha social são aplicados por
            rota.
          </p>
        </article>
        <article className="border border-sky-200 bg-sky-50 p-5">
          <Search className="h-5 w-5 text-sky-700" />
          <p className="mt-4 text-2xl font-bold text-sky-950">
            Dados estruturados
          </p>
          <p className="mt-2 text-sm leading-6 text-sky-900/80">
            WebSite, organização, breadcrumbs, cursos e ofertas usam dados
            reais.
          </p>
        </article>
        <article className="border border-slate-200 bg-white p-5">
          <ShieldCheck className="h-5 w-5 text-slate-700" />
          <p className="mt-4 text-2xl font-bold text-slate-950">
            Áreas privadas
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Login, checkout, aluno e admin recebem noindex e não entram no
            sitemap.
          </p>
        </article>
      </div>

      <Section
        title="Arquivos de descoberta"
        description="Estes endereços são públicos e atualizados automaticamente com os materiais publicados."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'sitemap.xml', href: `${baseUrl}/sitemap.xml` },
            { label: 'robots.txt', href: `${baseUrl}/robots.txt` },
            { label: 'llms.txt', href: `${baseUrl}/llms.txt` },
          ].map((file) => (
            <a
              key={file.label}
              href={file.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-800 transition hover:border-sky-300 hover:bg-sky-50"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-700" />
                {file.label}
              </span>
              <ExternalLink className="h-4 w-4" />
            </a>
          ))}
        </div>
      </Section>

      <Section
        title="Identidade e domínio"
        description="Define a entidade, a URL canónica e os recursos usados pelo Google e pelas pré-visualizações sociais."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Nome do site"
            value={state.site_name}
            onChange={(value) => update('site_name', value)}
          />
          <Field
            label="Nome alternativo"
            value={state.alternate_site_name}
            onChange={(value) => update('alternate_site_name', value)}
          />
          <Field
            label="URL canónica do site"
            type="url"
            value={state.canonical_base_url}
            onChange={(value) => update('canonical_base_url', value)}
            hint="Usa HTTPS e não termina com barra."
          />
          <Field
            label="Idioma"
            value={state.language}
            onChange={(value) => update('language', value)}
            hint="Código BCP 47, por exemplo pt-PT."
          />
          <Field
            label="Locale Open Graph"
            value={state.locale}
            onChange={(value) => update('locale', value)}
            hint="Formato idioma_PAÍS, por exemplo pt_PT."
          />
          <Field
            label="Autora"
            value={state.author_name}
            onChange={(value) => update('author_name', value)}
          />
          <Field
            label="Organização"
            value={state.organization_name}
            onChange={(value) => update('organization_name', value)}
          />
          <Field
            label="Email público"
            type="email"
            value={state.contact_email}
            onChange={(value) => update('contact_email', value)}
          />
          <div>
            <Field
              label="Imagem social padrão"
              type="url"
              value={state.default_og_image_url}
              onChange={(value) => update('default_og_image_url', value)}
            />
            <button
              type="button"
              onClick={() => setImageField('default_og_image_url')}
              className="mt-3 rounded-full border border-sky-200 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50"
            >
              Escolher na biblioteca de mídia
            </button>
          </div>
          <div>
            <Field
              label="Logótipo da organização"
              type="url"
              value={state.organization_logo_url}
              onChange={(value) => update('organization_logo_url', value)}
            />
            <button
              type="button"
              onClick={() => setImageField('organization_logo_url')}
              className="mt-3 rounded-full border border-sky-200 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50"
            >
              Escolher na biblioteca de mídia
            </button>
          </div>
          <Field
            label="Perfil X/Twitter"
            value={state.twitter_site}
            onChange={(value) => update('twitter_site', value)}
            placeholder="@utilizador (opcional)"
          />
          <TextAreaField
            label="Perfis sociais oficiais"
            value={state.social_profiles.join('\n')}
            onChange={(value) =>
              update(
                'social_profiles',
                value
                  .split(/\r?\n/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
            hint="Um URL por linha. Estes perfis alimentam o sameAs da organização."
          />
        </div>
      </Section>

      <Section
        title="Padrões globais"
        description="São usados como fallback e nas páginas dinâmicas quando não existe uma descrição mais específica."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Título padrão"
            value={state.default_title}
            onChange={(value) => update('default_title', value)}
          />
          <Field
            label="Modelo de título"
            value={state.title_template}
            onChange={(value) => update('title_template', value)}
            hint="Mantém %s no local onde entra o título da página."
          />
          <div className="md:col-span-2">
            <TextAreaField
              label="Descrição padrão"
              value={state.default_description}
              onChange={(value) => update('default_description', value)}
            />
          </div>
          <Field
            label="Modelo de título de material"
            value={state.course_title_template}
            onChange={(value) => update('course_title_template', value)}
            hint="O nome real do material substitui %s."
          />
          <TextAreaField
            label="Descrição alternativa de material"
            value={state.course_description_template}
            onChange={(value) => update('course_description_template', value)}
            hint="Só é usada quando o material não tem descrição própria."
          />
          <Field
            label="Palavra-chave principal"
            value={state.primary_keyword}
            onChange={(value) => update('primary_keyword', value)}
            hint="A expressão principal que resume o posicionamento do site."
          />
          <TextAreaField
            label="Palavras-chave secundárias"
            value={state.secondary_keywords.join('\n')}
            onChange={(value) =>
              update(
                'secondary_keywords',
                value
                  .split(/\r?\n|,/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
            hint="Uma expressão por linha. Usa-as como orientação editorial, não como substituto de conteúdo útil."
            rows={5}
          />
        </div>
      </Section>

      <Section
        title="Páginas públicas"
        description="Cada URL tem um título e uma descrição únicos. O texto deve resumir com precisão o conteúdo visível."
      >
        <div className="space-y-5">
          {(Object.keys(SEO_PAGE_LABELS) as SeoPageKey[]).map((key) => {
            const page = state.pages[key]
            return (
              <article
                key={key}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">
                      {SEO_PAGE_LABELS[key]}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {SEO_PAGE_PATHS[key]}
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={page.index}
                      onChange={(event) =>
                        updatePage(key, { index: event.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-sky-700"
                    />
                    Permitir indexação
                  </label>
                </div>
                <div className="mt-5 grid gap-4">
                  <Field
                    label="Título"
                    value={page.title}
                    onChange={(value) => updatePage(key, { title: value })}
                  />
                  <TextAreaField
                    label="Meta description"
                    value={page.description}
                    onChange={(value) =>
                      updatePage(key, { description: value })
                    }
                    rows={3}
                  />
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-emerald-700">
                      {baseUrl}
                      {SEO_PAGE_PATHS[key]}
                    </p>
                    <p className="mt-1 text-lg font-medium text-blue-800">
                      {page.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {page.description}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </Section>

      <Section
        title="Indexação e verificações"
        description="As diretivas permitem snippets completos. Os códigos de verificação ficam vazios até serem emitidos pelas ferramentas oficiais."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Google Search Console"
            value={state.google_site_verification}
            onChange={(value) => update('google_site_verification', value)}
            placeholder="Código de verificação (opcional)"
          />
          <Field
            label="Bing Webmaster Tools"
            value={state.bing_site_verification}
            onChange={(value) => update('bing_site_verification', value)}
            placeholder="Código de verificação (opcional)"
          />
          <Field
            label="Máximo do snippet"
            type="number"
            value={state.robots_max_snippet}
            onChange={(value) => update('robots_max_snippet', Number(value))}
            hint="-1 permite ao motor escolher o tamanho adequado."
          />
          <Field
            label="Máximo da prévia de vídeo"
            type="number"
            value={state.robots_max_video_preview}
            onChange={(value) =>
              update('robots_max_video_preview', Number(value))
            }
            hint="-1 permite prévias sem limite explícito."
          />
          <label className="block">
            <span className={labelClass}>Prévia de imagem</span>
            <select
              value={state.robots_max_image_preview}
              onChange={(event) =>
                update(
                  'robots_max_image_preview',
                  event.target
                    .value as SeoConfigValue['robots_max_image_preview']
                )
              }
              className={inputClass}
            >
              <option value="large">Grande</option>
              <option value="standard">Padrão</option>
              <option value="none">Sem prévia</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-5 pt-7">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={state.robots_index}
                onChange={(event) =>
                  update('robots_index', event.target.checked)
                }
                className="h-4 w-4"
              />
              Indexar por padrão
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={state.robots_follow}
                onChange={(event) =>
                  update('robots_follow', event.target.checked)
                }
                className="h-4 w-4"
              />
              Seguir links
            </label>
          </div>
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
        <p className="text-sm text-slate-600">
          Última atualização:{' '}
          {seoQuery.data?.updated_at
            ? new Date(seoQuery.data.updated_at).toLocaleString('pt-PT')
            : 'configuração inicial'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setDraft(null)
              setFeedback(null)
            }}
            className="h-11 rounded-full border border-slate-200 px-5 text-sm font-bold text-slate-700"
          >
            Repor alterações
          </button>
          <button
            type="button"
            disabled={saveSeo.isPending}
            onClick={async () => {
              setFeedback(null)
              try {
                const saved = await saveSeo.mutateAsync(state)
                setDraft(saved.config_value)
                setFeedback({
                  tone: 'success',
                  message: 'Configuração SEO guardada e publicada.',
                })
              } catch (error) {
                setFeedback({
                  tone: 'danger',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Não foi possível guardar o SEO.',
                })
              }
            }}
            className="h-11 rounded-full bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saveSeo.isPending ? 'A guardar...' : 'Guardar e publicar SEO'}
          </button>
        </div>
      </div>
      <MediaLibraryModal
        open={Boolean(imageField)}
        title={`Selecionar ${imageFieldLabel}`}
        uploadTabLabel="Enviar imagem"
        libraryTabLabel="Biblioteca de mídia"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        fileType="image"
        prefix="site-branding-public/"
        onClose={() => setImageField(null)}
        onUpload={uploadSeoImage}
        onSelect={selectSeoImage}
      />
    </div>
  )
}
