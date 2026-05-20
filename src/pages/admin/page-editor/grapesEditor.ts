import { Editor as TiptapEditor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import type { Editor as GrapesEditor } from "grapesjs"

const DEFAULT_EMPTY_PAGE = "<section><div><p>Pagina vazia.</p></div></section>"
type SupportedDeviceId = "desktop" | "tablet" | "mobile"

interface AssetLike {
  getSrc: () => string
  get: (key: string) => unknown
}

interface ToolbarActionConfig {
  label: string
  title: string
  run: (editor: TiptapEditor) => void
  isActive?: (editor: TiptapEditor) => boolean
  isDisabled?: (editor: TiptapEditor) => boolean
  kind?: "primary" | "secondary"
}

interface ToolbarButtonRef {
  action: ToolbarActionConfig
  element: HTMLButtonElement
}

interface TiptapRteInstance {
  editor: TiptapEditor
  toolbarElement: HTMLDivElement
  buttons: ToolbarButtonRef[]
  refreshToolbar: () => void
  destroy: () => void
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function focusTiptapEditor(rte?: TiptapRteInstance | null) {
  rte?.editor.commands.focus()
  rte?.refreshToolbar()
}

function clearElement(element: HTMLElement | null) {
  if (!element) return
  element.innerHTML = ""
}

function getLayoutHtml(layoutJson: Record<string, unknown> | undefined) {
  if (!layoutJson || typeof layoutJson !== "object") return ""

  const htmlFromRoot = layoutJson.html
  if (typeof htmlFromRoot === "string" && htmlFromRoot.trim().length > 0) {
    return htmlFromRoot
  }

  const projectData =
    layoutJson.projectData && typeof layoutJson.projectData === "object"
      ? (layoutJson.projectData as Record<string, unknown>)
      : layoutJson

  const pages = Array.isArray(projectData.pages) ? projectData.pages : []
  const firstPage = pages[0]
  if (!firstPage || typeof firstPage !== "object") return ""

  const pageAsRecord = firstPage as Record<string, unknown>
  const component = pageAsRecord.component
  if (typeof component === "string" && component.trim().length > 0) {
    return component
  }

  return ""
}

export function extractStyleCss(styleJson: Record<string, unknown> | undefined) {
  if (!styleJson || typeof styleJson !== "object") return ""

  const css = styleJson.css
  if (typeof css === "string" && css.trim().length > 0) {
    return css
  }

  return ""
}

export function createCanvasStyleLinks() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.length > 0)
}

export function buildGrapesProjectData(input: {
  slug: string
  title: string
  html: string
  css?: string
}) {
  const html = input.html.trim().length > 0 ? input.html : DEFAULT_EMPTY_PAGE
  const css = input.css?.trim() ?? ""

  return {
    pages: [
      {
        id: input.slug,
        name: input.title,
        component: html,
        styles: css,
      },
    ],
  } satisfies Record<string, unknown>
}

export function extractProjectDataFromVersion(input: {
  slug: string
  title: string
  layoutJson?: Record<string, unknown>
  styleJson?: Record<string, unknown>
  fallbackHtml: string
}) {
  const html = getLayoutHtml(input.layoutJson) || input.fallbackHtml || DEFAULT_EMPTY_PAGE
  const css = extractStyleCss(input.styleJson)

  const directProjectData = input.layoutJson?.projectData
  if (
    directProjectData &&
    typeof directProjectData === "object" &&
    Array.isArray((directProjectData as { pages?: unknown }).pages)
  ) {
    return directProjectData as Record<string, unknown>
  }

  return buildGrapesProjectData({
    slug: input.slug,
    title: input.title,
    html,
    css,
  })
}

export function getGrapesSnapshot(editor: GrapesEditor) {
  return {
    projectData: editor.getProjectData() as Record<string, unknown>,
    html: editor.getHtml(),
    css: editor.getCss(),
  }
}

function createToolbarButton(action: ToolbarActionConfig, editor: TiptapEditor) {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = action.label
  button.title = action.title
  button.className = [
    "me-tiptap-toolbar__button",
    action.kind === "secondary" ? "me-tiptap-toolbar__button--secondary" : "",
  ]
    .filter(Boolean)
    .join(" ")
  button.addEventListener("mousedown", (event) => {
    event.preventDefault()
  })
  button.addEventListener("click", () => {
    action.run(editor)
  })

  return button
}

function setToolbarButtonState(buttonRef: ToolbarButtonRef, editor: TiptapEditor) {
  const isActive = buttonRef.action.isActive?.(editor) ?? false
  const isDisabled = buttonRef.action.isDisabled?.(editor) ?? false

  buttonRef.element.disabled = isDisabled
  buttonRef.element.classList.toggle("is-active", isActive)
}

function buildTiptapToolbar(rte: TiptapRteInstance) {
  const toolbar = document.createElement("div")
  toolbar.className = "me-tiptap-toolbar"

  const actions: ToolbarActionConfig[] = [
    {
      label: "P",
      title: "Paragrafo",
      run: (editor) => {
        editor.chain().focus().setParagraph().run()
      },
      isActive: (editor) => editor.isActive("paragraph"),
    },
    {
      label: "H1",
      title: "Titulo 1",
      run: (editor) => {
        editor.chain().focus().toggleHeading({ level: 1 }).run()
      },
      isActive: (editor) => editor.isActive("heading", { level: 1 }),
    },
    {
      label: "H2",
      title: "Titulo 2",
      run: (editor) => {
        editor.chain().focus().toggleHeading({ level: 2 }).run()
      },
      isActive: (editor) => editor.isActive("heading", { level: 2 }),
    },
    {
      label: "H3",
      title: "Titulo 3",
      run: (editor) => {
        editor.chain().focus().toggleHeading({ level: 3 }).run()
      },
      isActive: (editor) => editor.isActive("heading", { level: 3 }),
    },
    {
      label: "B",
      title: "Negrito",
      run: (editor) => {
        editor.chain().focus().toggleBold().run()
      },
      isActive: (editor) => editor.isActive("bold"),
    },
    {
      label: "I",
      title: "Italico",
      run: (editor) => {
        editor.chain().focus().toggleItalic().run()
      },
      isActive: (editor) => editor.isActive("italic"),
    },
    {
      label: "U",
      title: "Sublinhado",
      run: (editor) => {
        editor.chain().focus().toggleUnderline().run()
      },
      isActive: (editor) => editor.isActive("underline"),
    },
    {
      label: "Lista",
      title: "Lista com marcadores",
      run: (editor) => {
        editor.chain().focus().toggleBulletList().run()
      },
      isActive: (editor) => editor.isActive("bulletList"),
    },
    {
      label: "1.",
      title: "Lista numerada",
      run: (editor) => {
        editor.chain().focus().toggleOrderedList().run()
      },
      isActive: (editor) => editor.isActive("orderedList"),
    },
    {
      label: "Esq",
      title: "Alinhar a esquerda",
      run: (editor) => {
        editor.chain().focus().setTextAlign("left").run()
      },
      isActive: (editor) => editor.isActive({ textAlign: "left" }),
      kind: "secondary",
    },
    {
      label: "Centro",
      title: "Centralizar",
      run: (editor) => {
        editor.chain().focus().setTextAlign("center").run()
      },
      isActive: (editor) => editor.isActive({ textAlign: "center" }),
      kind: "secondary",
    },
    {
      label: "Dir",
      title: "Alinhar a direita",
      run: (editor) => {
        editor.chain().focus().setTextAlign("right").run()
      },
      isActive: (editor) => editor.isActive({ textAlign: "right" }),
      kind: "secondary",
    },
    {
      label: "Link",
      title: "Inserir ou remover link",
      run: (editor) => {
        const currentHref = String(editor.getAttributes("link").href ?? "").trim()
        const nextHref = window.prompt("URL do link", currentHref)

        if (nextHref === null) return
        const normalizedHref = nextHref.trim()

        if (!normalizedHref) {
          editor.chain().focus().extendMarkRange("link").unsetLink().run()
          return
        }

        editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedHref }).run()
      },
      isActive: (editor) => editor.isActive("link"),
      kind: "secondary",
    },
    {
      label: "Limpar",
      title: "Limpar formatacao",
      run: (editor) => {
        editor.chain().focus().clearNodes().unsetAllMarks().run()
      },
      kind: "secondary",
    },
    {
      label: "Desfazer",
      title: "Desfazer",
      run: (editor) => {
        editor.chain().focus().undo().run()
      },
      isDisabled: (editor) => !editor.can().chain().focus().undo().run(),
      kind: "secondary",
    },
    {
      label: "Refazer",
      title: "Refazer",
      run: (editor) => {
        editor.chain().focus().redo().run()
      },
      isDisabled: (editor) => !editor.can().chain().focus().redo().run(),
      kind: "secondary",
    },
  ]

  rte.buttons = actions.map((action) => {
    const element = createToolbarButton(action, rte.editor)
    toolbar.appendChild(element)
    return { action, element }
  })

  rte.toolbarElement = toolbar
}

export function registerTiptapRte(editor: GrapesEditor, toolbarContainer: HTMLElement | null) {
  const instances = new Set<TiptapRteInstance>()

  editor.setCustomRte({
    enable(el: HTMLElement, rte?: TiptapRteInstance) {
      if (rte) {
        rte.editor.setEditable(true)
        if (toolbarContainer) {
          toolbarContainer.innerHTML = ""
          toolbarContainer.appendChild(rte.toolbarElement)
        }
        focusTiptapEditor(rte)
        return rte
      }

      const tiptap = new TiptapEditor({
        element: el,
        content: el.innerHTML,
        extensions: [
          StarterKit.configure({
            heading: {
              levels: [1, 2, 3, 4],
            },
            link: {
              openOnClick: false,
            },
          }),
          TextAlign.configure({
            types: ["heading", "paragraph"],
          }),
        ],
        autofocus: "end",
        editorProps: {
          attributes: {
            class: "me-tiptap-content",
          },
        },
      })

      const nextRte = {
        editor: tiptap,
        toolbarElement: document.createElement("div"),
        buttons: [] as ToolbarButtonRef[],
        refreshToolbar: () => {
          nextRte.buttons.forEach((buttonRef) => {
            setToolbarButtonState(buttonRef, nextRte.editor)
          })
        },
        destroy: () => {
          nextRte.editor.destroy()
          if (toolbarContainer?.contains(nextRte.toolbarElement)) {
            toolbarContainer.innerHTML = ""
          }
        },
      } satisfies TiptapRteInstance

      buildTiptapToolbar(nextRte)
      nextRte.refreshToolbar()

      tiptap.on("selectionUpdate", nextRte.refreshToolbar)
      tiptap.on("transaction", nextRte.refreshToolbar)
      tiptap.on("focus", nextRte.refreshToolbar)

      if (toolbarContainer) {
        toolbarContainer.innerHTML = ""
        toolbarContainer.appendChild(nextRte.toolbarElement)
      }

      instances.add(nextRte)
      focusTiptapEditor(nextRte)
      return nextRte
    },

    disable(_el: HTMLElement, rte?: TiptapRteInstance) {
      rte?.editor.setEditable(false)
      if (toolbarContainer?.contains(rte?.toolbarElement ?? null)) {
        toolbarContainer.innerHTML = ""
      }
    },

    getContent(el: HTMLElement, rte?: TiptapRteInstance) {
      return rte?.editor.getHTML() ?? el.innerHTML
    },

    focus(_el: HTMLElement, rte?: TiptapRteInstance) {
      if (toolbarContainer && rte) {
        toolbarContainer.innerHTML = ""
        toolbarContainer.appendChild(rte.toolbarElement)
      }
      focusTiptapEditor(rte)
    },

    parseContent: true,
  })

  editor.on("destroy", () => {
    instances.forEach((instance) => {
      instance.destroy()
    })
    instances.clear()
  })
}

export function registerDefaultBlocks(editor: GrapesEditor) {
  const blockManager = editor.BlockManager

  blockManager.add("me-section", {
    label: "Secao",
    category: "Layout",
    content: `
      <section style="padding: 64px 24px; background: #f5fafc;">
        <div style="max-width: 1120px; margin: 0 auto;">
          <h2 style="margin: 0 0 16px; color: #0f122c; font-size: 40px; line-height: 1.1; font-weight: 700;">Novo bloco</h2>
          <p style="margin: 0; color: #3f4a5e; font-size: 18px; line-height: 1.7;">Edite este texto para descrever a secao.</p>
        </div>
      </section>
    `,
  })

  blockManager.add("me-text", {
    label: "Texto",
    category: "Conteudo",
    content: `
      <div style="max-width: 760px; margin: 0 auto; padding: 24px; color: #24324a; font-size: 18px; line-height: 1.8;">
        <p>Escreva aqui o conteudo desta area.</p>
      </div>
    `,
  })

  blockManager.add("me-image", {
    label: "Imagem",
    category: "Conteudo",
    activate: true,
    select: true,
    content: {
      type: "image",
      style: {
        display: "block",
        maxWidth: "100%",
        margin: "0 auto",
      },
    },
  })

  blockManager.add("me-button", {
    label: "Botao",
    category: "Conteudo",
    content: `
      <div style="padding: 24px; text-align: left;">
        <a href="#" style="display: inline-block; border-radius: 999px; background: #242742; padding: 16px 28px; color: #ffffff; font-size: 14px; font-weight: 700; letter-spacing: 0.12em; text-decoration: none; text-transform: uppercase;">Chamada principal</a>
      </div>
    `,
  })

  blockManager.add("me-columns", {
    label: "2 colunas",
    category: "Layout",
    content: `
      <section style="padding: 48px 24px;">
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; max-width: 1120px; margin: 0 auto;">
          <div style="padding: 32px; border: 1px solid rgba(71, 71, 77, 0.12); border-radius: 24px; background: #ffffff;">
            <h3 style="margin: 0 0 12px; color: #0f122c; font-size: 28px; line-height: 1.2;">Coluna esquerda</h3>
            <p style="margin: 0; color: #3f4a5e; font-size: 16px; line-height: 1.7;">Conteudo da primeira coluna.</p>
          </div>
          <div style="padding: 32px; border: 1px solid rgba(71, 71, 77, 0.12); border-radius: 24px; background: #ffffff;">
            <h3 style="margin: 0 0 12px; color: #0f122c; font-size: 28px; line-height: 1.2;">Coluna direita</h3>
            <p style="margin: 0; color: #3f4a5e; font-size: 16px; line-height: 1.7;">Conteudo da segunda coluna.</p>
          </div>
        </div>
      </section>
    `,
  })

  blockManager.add("me-divider", {
    label: "Divisor",
    category: "Estrutura",
    content:
      '<div style="max-width: 1120px; margin: 0 auto; padding: 12px 24px;"><hr style="border: 0; border-top: 1px solid rgba(36, 39, 66, 0.12);" /></div>',
  })

  blockManager.add("me-spacer", {
    label: "Espaco",
    category: "Estrutura",
    content: '<div style="height: 48px;"></div>',
  })

  blockManager.add("me-home-reviews", {
    label: "Widget Reviews",
    category: "Dinamico",
    content: `
      <section style="padding: 48px 24px; background: #f5fafc;">
        <div style="max-width: 1120px; margin: 0 auto; border: 1px dashed rgba(36, 39, 66, 0.24); border-radius: 24px; background: #ffffff; padding: 32px;">
          <div data-me-widget="home-reviews"></div>
        </div>
      </section>
    `,
  })

  blockManager.add("me-home-hero", {
    label: "Hero Mariana",
    category: "Favoritos",
    content: `
      <section style="padding: 96px 24px; background: linear-gradient(135deg, #dff2f8 0%, #f8fcfd 100%);">
        <div style="max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; align-items: center;">
          <div>
            <span style="display: inline-block; margin-bottom: 18px; border-radius: 999px; background: rgba(36, 39, 66, 0.08); padding: 10px 16px; color: #242742; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">Mariana Explica</span>
            <h1 style="margin: 0 0 16px; color: #0f122c; font-size: 56px; line-height: 1.05; font-weight: 700;">Uma hero section pronta para editar</h1>
            <p style="margin: 0 0 28px; color: #3f4a5e; font-size: 19px; line-height: 1.8;">Troque o titulo, ajuste o texto e mantenha a estrutura comercial da Home sem partir de um canvas vazio.</p>
            <a href="/materiais" style="display: inline-block; border-radius: 999px; background: #242742; padding: 18px 30px; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; text-transform: uppercase; letter-spacing: 0.12em;">Explorar materiais</a>
          </div>
          <div style="padding: 20px; border-radius: 32px; background: rgba(255, 255, 255, 0.88); box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);">
            <img src="/assets/home-hero-illustration.svg" alt="Ilustracao Mariana Explica" style="display: block; width: 100%; max-width: 100%;" />
          </div>
        </div>
      </section>
    `,
  })

  blockManager.add("me-benefit-grid", {
    label: "Beneficios 3 cards",
    category: "Favoritos",
    content: `
      <section style="padding: 64px 24px; background: #ffffff;">
        <div style="max-width: 1120px; margin: 0 auto;">
          <h2 style="margin: 0 0 16px; color: #0f122c; font-size: 42px; line-height: 1.1; font-weight: 700;">Beneficios em destaque</h2>
          <p style="margin: 0 0 28px; color: #475569; font-size: 18px; line-height: 1.8;">Use este bloco para apresentar provas de valor com leitura rapida.</p>
          <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px;">
            <div style="padding: 28px; border-radius: 24px; background: #f8fafc; border: 1px solid rgba(36, 39, 66, 0.08);">
              <h3 style="margin: 0 0 12px; color: #242742; font-size: 22px; font-weight: 700;">Clareza</h3>
              <p style="margin: 0; color: #475569; line-height: 1.8;">Explique aqui o primeiro beneficio principal.</p>
            </div>
            <div style="padding: 28px; border-radius: 24px; background: #f8fafc; border: 1px solid rgba(36, 39, 66, 0.08);">
              <h3 style="margin: 0 0 12px; color: #242742; font-size: 22px; font-weight: 700;">Metodo</h3>
              <p style="margin: 0; color: #475569; line-height: 1.8;">Explique aqui como a Mariana organiza o estudo.</p>
            </div>
            <div style="padding: 28px; border-radius: 24px; background: #f8fafc; border: 1px solid rgba(36, 39, 66, 0.08);">
              <h3 style="margin: 0 0 12px; color: #242742; font-size: 22px; font-weight: 700;">Resultado</h3>
              <p style="margin: 0; color: #475569; line-height: 1.8;">Feche com o ganho concreto para o aluno.</p>
            </div>
          </div>
        </div>
      </section>
    `,
  })

  blockManager.add("me-legal-header", {
    label: "Cabecalho legal",
    category: "Favoritos",
    content: `
      <section style="padding: 72px 24px 32px; background: linear-gradient(180deg, #f8fbfd 0%, #ffffff 100%);">
        <div style="max-width: 900px; margin: 0 auto;">
          <span style="display: inline-block; margin-bottom: 16px; border-radius: 999px; background: rgba(36, 39, 66, 0.08); padding: 10px 16px; color: #242742; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">Informacao oficial</span>
          <h1 style="margin: 0 0 12px; color: #0f122c; font-size: 48px; line-height: 1.08; font-weight: 700;">Titulo da pagina legal</h1>
          <p style="margin: 0; color: #475569; font-size: 18px; line-height: 1.8;">Use este cabecalho para contextualizar a politica, os termos ou a informacao institucional.</p>
        </div>
      </section>
    `,
  })

  blockManager.add("me-highlight-quote", {
    label: "Destaque editorial",
    category: "Favoritos",
    content: `
      <section style="padding: 40px 24px;">
        <div style="max-width: 860px; margin: 0 auto; border-left: 6px solid #242742; border-radius: 0 24px 24px 0; background: #f8fafc; padding: 28px 28px 28px 24px;">
          <p style="margin: 0; color: #0f122c; font-size: 28px; line-height: 1.5; font-weight: 700;">Uma cita, explicacao-chave ou mensagem da pagina para ganhar destaque visual.</p>
        </div>
      </section>
    `,
  })
}

export function renderBlocksSidebar(editor: GrapesEditor, container: HTMLElement | null) {
  if (!container) return

  const blocksEl = editor.Blocks.render(undefined, { external: true })
  clearElement(container)
  if (blocksEl instanceof HTMLElement) {
    container.appendChild(blocksEl)
  }
}

export function renderLayersSidebar(editor: GrapesEditor, container: HTMLElement | null) {
  if (!container) return

  const layersEl = editor.Layers.render()
  clearElement(container)
  if (layersEl instanceof HTMLElement) {
    container.appendChild(layersEl)
  }
}

export function renderTraitsSidebar(editor: GrapesEditor, categoriesContainer: HTMLElement | null, traitsContainer: HTMLElement | null) {
  const traitManager = editor.Traits as unknown as {
    render: () => void
    getCategoriesEl?: () => HTMLElement
    getTraitsEl?: () => HTMLElement
  }

  traitManager.render()

  if (categoriesContainer) {
    clearElement(categoriesContainer)
    const categoriesEl = traitManager.getCategoriesEl?.()
    if (categoriesEl) {
      categoriesContainer.appendChild(categoriesEl)
    }
  }

  if (traitsContainer) {
    clearElement(traitsContainer)
    const traitsEl = traitManager.getTraitsEl?.()
    if (traitsEl) {
      traitsContainer.appendChild(traitsEl)
    }
  }
}

export function renderStylesSidebar(editor: GrapesEditor, container: HTMLElement | null) {
  if (!container) return

  editor.StyleManager.render()
  const styleContainer = (editor.StyleManager as unknown as { __ctn?: HTMLElement }).__ctn
  clearElement(container)
  if (styleContainer) {
    container.appendChild(styleContainer)
  }
}

export function renderStudioSidebars(
  editor: GrapesEditor,
  slots: {
    blocks: HTMLElement | null
    layers: HTMLElement | null
    styles: HTMLElement | null
    traitCategories: HTMLElement | null
    traits: HTMLElement | null
  },
) {
  renderBlocksSidebar(editor, slots.blocks)
  renderLayersSidebar(editor, slots.layers)
  renderStylesSidebar(editor, slots.styles)
  renderTraitsSidebar(editor, slots.traitCategories, slots.traits)
}

export function syncEditorAssets(
  editor: GrapesEditor,
  assets: Array<{ public_url: string; file_name: string; mime_type: string | null }>,
) {
  const assetManager = editor.AssetManager
  const collection = assetManager.getAll() as unknown as { reset?: (items?: unknown[]) => void }
  const normalizedAssets = assets.map((asset) => ({
    type: "image",
    src: asset.public_url,
    name: asset.file_name,
    mimeType: asset.mime_type ?? undefined,
  }))

  if (typeof collection.reset === "function") {
    collection.reset(normalizedAssets)
    return
  }

  normalizedAssets.forEach((asset) => {
    assetManager.add(asset)
  })
}

export function appendImageSection(
  editor: GrapesEditor,
  asset: {
    publicUrl: string
    fileName: string
  },
) {
  const imageMarkup = `
    <section style="padding: 40px 24px;">
      <div style="max-width: 1120px; margin: 0 auto;">
        <img
          src="${escapeHtmlAttribute(asset.publicUrl)}"
          alt="${escapeHtmlAttribute(asset.fileName)}"
          style="display: block; max-width: 100%; width: 100%; border-radius: 24px;"
        />
      </div>
    </section>
  `

  editor.addComponents(imageMarkup)
}

export function setEditorDevice(editor: GrapesEditor, device: SupportedDeviceId) {
  editor.setDevice(
    device === "desktop" ? "Desktop" : device === "tablet" ? "Tablet" : "Mobile",
  )
}

export function openImageAssetPicker(editor: GrapesEditor) {
  const assetManager = editor.AssetManager

  assetManager.open({
    types: ["image"],
    select(asset: AssetLike, complete: boolean) {
      const selected = editor.getSelected()
      const src = asset.getSrc()
      const name = String(asset.get("name") ?? "").trim()

      if (selected?.is("image")) {
        selected.addAttributes({
          src,
          alt: name || "Imagem",
        })
      } else {
        appendImageSection(editor, {
          publicUrl: src,
          fileName: name || "Imagem",
        })
      }

      if (complete) {
        assetManager.close()
      }
    },
  })
}

export function resetEditorToProjectData(editor: GrapesEditor, projectData: Record<string, unknown>) {
  editor.loadProjectData(projectData)
  window.setTimeout(() => {
    editor.clearDirtyCount()
    editor.refresh({ tools: true })
  }, 0)
}
