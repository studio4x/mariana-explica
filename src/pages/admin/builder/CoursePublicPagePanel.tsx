import { ExternalLink, Plus, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useState, type FormEvent, type ReactNode } from "react"
import { PageHeader, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui"
import { buildCoursePublicPageView, sanitizeCoursePublicPageContent, type CoursePublicPageView } from "@/lib/course-public-page"
import { publicCoursePath } from "@/lib/routes"
import { useUpdateAdminProduct } from "@/hooks/useAdmin"
import { useAdminCourseBuilderContext } from "./AdminCourseBuilderContext"

function Field({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: ReactNode
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {helper ? <p className="text-sm leading-6 text-slate-500">{helper}</p> : null}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border bg-slate-50 px-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
    />
  )
}

function TextArea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-slate-400 focus:bg-white"
    />
  )
}

function CoursePublicPageForm() {
  const { product, modules, lessonsByModule } = useAdminCourseBuilderContext()
  const updateProduct = useUpdateAdminProduct()
  const [form, setForm] = useState<CoursePublicPageView>(() =>
    buildCoursePublicPageView(product, modules, lessonsByModule),
  )
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const updateListItem = <T,>(items: T[], index: number, updater: (item: T) => T) =>
    items.map((item, currentIndex) => (currentIndex === index ? updater(item) : item))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    try {
      await updateProduct.mutateAsync({
        productId: product.id,
        publicPageContent: sanitizeCoursePublicPageContent(form),
      })
      setSuccessMessage("Pagina publica guardada com sucesso.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel guardar a pagina publica.")
    }
  }

  return (
    <section className="rounded-[1.75rem] border bg-white p-6 shadow-sm">
      <PageHeader
        title="Pagina publica do curso"
        description="Conteudo comercial exibido ao visitante antes da compra, com base no layout de referencia."
        actions={
          <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            <Link to={publicCoursePath(product.slug, product.id)} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Visualizar pagina
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Hero</p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">Chamada principal</h2>
            </div>
            <StatusBadge label="Publico" tone="info" />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Etiqueta superior">
              <TextInput
                value={form.eyebrow}
                onChange={(eyebrow) => setForm((prev) => ({ ...prev, eyebrow }))}
              />
            </Field>
            <Field label="Titulo principal">
              <TextInput
                value={form.headline}
                onChange={(headline) => setForm((prev) => ({ ...prev, headline }))}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Texto de abertura">
                <TextArea
                  value={form.intro}
                  onChange={(intro) => setForm((prev) => ({ ...prev, intro }))}
                  rows={3}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-950">Sobre o curso</h2>
          <div className="mt-5 space-y-4">
            <Field label="Titulo da secao">
              <TextInput
                value={form.aboutTitle}
                onChange={(aboutTitle) => setForm((prev) => ({ ...prev, aboutTitle }))}
              />
            </Field>
            {form.aboutParagraphs.map((paragraph, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <Field label={`Paragrafo ${index + 1}`}>
                  <TextArea
                    value={paragraph}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        aboutParagraphs: updateListItem(prev.aboutParagraphs, index, () => value),
                      }))
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="mt-8 rounded-xl"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      aboutParagraphs: prev.aboutParagraphs.filter((_, currentIndex) => currentIndex !== index),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  aboutParagraphs: [...prev.aboutParagraphs, ""],
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar paragrafo
            </Button>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-950">O que o aluno vai aprender</h2>
          <div className="mt-5 space-y-4">
            <Field label="Titulo da secao">
              <TextInput
                value={form.learnTitle}
                onChange={(learnTitle) => setForm((prev) => ({ ...prev, learnTitle }))}
              />
            </Field>
            {form.learnItems.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,0.45fr)_minmax(0,1fr)_auto]">
                  <Field label={`Titulo ${index + 1}`}>
                    <TextInput
                      value={item.title}
                      onChange={(title) =>
                        setForm((prev) => ({
                          ...prev,
                          learnItems: updateListItem(prev.learnItems, index, (current) => ({ ...current, title })),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Descricao">
                    <TextArea
                      value={item.description}
                      onChange={(description) =>
                        setForm((prev) => ({
                          ...prev,
                          learnItems: updateListItem(prev.learnItems, index, (current) => ({ ...current, description })),
                        }))
                      }
                      rows={2}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-8 rounded-xl"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        learnItems: prev.learnItems.filter((_, currentIndex) => currentIndex !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  learnItems: [...prev.learnItems, { title: "", description: "" }],
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar bloco
            </Button>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-950">Conteudo do curso</h2>
          <div className="mt-5 space-y-4">
            <Field label="Titulo da secao">
              <TextInput
                value={form.curriculumTitle}
                onChange={(curriculumTitle) => setForm((prev) => ({ ...prev, curriculumTitle }))}
              />
            </Field>
            {form.curriculumItems.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Rotulo">
                    <TextInput
                      value={item.label}
                      onChange={(label) =>
                        setForm((prev) => ({
                          ...prev,
                          curriculumItems: updateListItem(prev.curriculumItems, index, (current) => ({ ...current, label })),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Titulo">
                    <TextInput
                      value={item.title}
                      onChange={(title) =>
                        setForm((prev) => ({
                          ...prev,
                          curriculumItems: updateListItem(prev.curriculumItems, index, (current) => ({ ...current, title })),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Quantidade">
                    <TextInput
                      value={item.lessons}
                      onChange={(lessons) =>
                        setForm((prev) => ({
                          ...prev,
                          curriculumItems: updateListItem(prev.curriculumItems, index, (current) => ({ ...current, lessons })),
                        }))
                      }
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-8 rounded-xl"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        curriculumItems: prev.curriculumItems.filter((_, currentIndex) => currentIndex !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4">
                  <Field label="Descricao">
                    <TextArea
                      value={item.description}
                      onChange={(description) =>
                        setForm((prev) => ({
                          ...prev,
                          curriculumItems: updateListItem(prev.curriculumItems, index, (current) => ({
                            ...current,
                            description,
                          })),
                        }))
                      }
                      rows={3}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  curriculumItems: [...prev.curriculumItems, { label: "", title: "", lessons: "", description: "" }],
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar modulo publico
            </Button>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-950">Card lateral</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nome do instrutor">
              <TextInput
                value={form.instructorName}
                onChange={(instructorName) => setForm((prev) => ({ ...prev, instructorName }))}
              />
            </Field>
            <Field label="Cargo/especialidade">
              <TextInput
                value={form.instructorRole}
                onChange={(instructorRole) => setForm((prev) => ({ ...prev, instructorRole }))}
              />
            </Field>
            <Field label="Iniciais">
              <TextInput
                value={form.instructorInitials}
                onChange={(instructorInitials) => setForm((prev) => ({ ...prev, instructorInitials }))}
              />
            </Field>
            <Field label="Texto do preco">
              <TextInput
                value={form.priceNote}
                onChange={(priceNote) => setForm((prev) => ({ ...prev, priceNote }))}
              />
            </Field>
            <Field label="Botao principal">
              <TextInput
                value={form.ctaLabel}
                onChange={(ctaLabel) => setForm((prev) => ({ ...prev, ctaLabel }))}
              />
            </Field>
            <Field label="Titulo do bloco incluso">
              <TextInput
                value={form.previewTitle}
                onChange={(previewTitle) => setForm((prev) => ({ ...prev, previewTitle }))}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Texto do bloco incluso">
                <TextArea
                  value={form.previewText}
                  onChange={(previewText) => setForm((prev) => ({ ...prev, previewText }))}
                  rows={3}
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Beneficios laterais</p>
            {form.sidebarFeatures.map((feature, index) => (
              <div key={index} className="flex gap-2">
                <TextInput
                  value={feature}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      sidebarFeatures: updateListItem(prev.sidebarFeatures, index, () => value),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="rounded-xl"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      sidebarFeatures: prev.sidebarFeatures.filter((_, currentIndex) => currentIndex !== index),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  sidebarFeatures: [...prev.sidebarFeatures, ""],
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar beneficio
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="rounded-full" disabled={updateProduct.isPending}>
            {updateProduct.isPending ? "A guardar..." : "Guardar pagina publica"}
          </Button>
          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </div>
      </form>
    </section>
  )
}

export function CoursePublicPagePanel() {
  const { product } = useAdminCourseBuilderContext()
  const contentVersion = JSON.stringify(product.public_page_content ?? {})

  return <CoursePublicPageForm key={`${product.id}:${contentVersion}`} />
}
