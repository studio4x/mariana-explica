import type { Editor as GrapesEditor } from "grapesjs"
import tinymce from "tinymce"
import "tinymce/icons/default"
import "tinymce/models/dom"
import "tinymce/themes/silver"
import "tinymce/plugins/advlist"
import "tinymce/plugins/autolink"
import "tinymce/plugins/autoresize"
import "tinymce/plugins/code"
import "tinymce/plugins/link"
import "tinymce/plugins/lists"
import "tinymce/plugins/table"

type TinyMceEditor = Awaited<ReturnType<typeof tinymce.init>>[number]

interface TinyMceRteInstance {
  editor: TinyMceEditor | null
  initializing: Promise<TinyMceEditor | null>
}

const DEFAULT_EMPTY_PAGE = "<section><div><p>Pagina vazia.</p></div></section>"
const DEVICE_IDS = ["desktop", "tablet", "mobile"] as const

type SupportedDeviceId = (typeof DEVICE_IDS)[number]

interface AssetLike {
  getSrc: () => string
  get: (key: string) => unknown
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function focusTinyMceEditor(el: HTMLElement, rte?: TinyMceRteInstance | null) {
  el.contentEditable = "true"

  if (rte?.editor) {
    rte.editor.focus()
    return
  }

  void rte?.initializing.then((editor) => {
    editor?.focus()
  })
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

export function registerTinyMceRte(editor: GrapesEditor, toolbarContainer: HTMLElement | null) {
  editor.setCustomRte({
    enable(el: HTMLElement, rte?: TinyMceRteInstance) {
      if (rte) {
        focusTinyMceEditor(el, rte)
        return rte
      }

      const nextRte: TinyMceRteInstance = {
        editor: null,
        initializing: Promise.resolve(null),
      }

      nextRte.initializing = tinymce
        .init({
          target: el,
          inline: true,
          menubar: false,
          branding: false,
          promotion: false,
          toolbar_persist: true,
          fixed_toolbar_container_target: toolbarContainer ?? undefined,
          plugins: ["autolink", "advlist", "lists", "link", "table", "code", "autoresize"],
          toolbar:
            "blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link table | removeformat code",
          block_formats: "Paragrafo=p; Titulo 1=h1; Titulo 2=h2; Titulo 3=h3; Titulo 4=h4",
          convert_urls: false,
          relative_urls: false,
          statusbar: false,
          content_style: "body { font-family: inherit; }",
          setup(instance) {
            instance.on("init", () => {
              nextRte.editor = instance
              focusTinyMceEditor(el, nextRte)
            })
          },
        })
        .then((editors) => {
          const [instance] = editors
          nextRte.editor = instance ?? null
          return nextRte.editor
        })

      return nextRte
    },

    disable(el: HTMLElement, rte?: TinyMceRteInstance) {
      el.contentEditable = "false"
      rte?.editor?.fire("blur")
    },

    getContent(el: HTMLElement, rte?: TinyMceRteInstance) {
      return rte?.editor?.getContent({ format: "html" }) ?? el.innerHTML
    },

    focus(el: HTMLElement, rte?: TinyMceRteInstance) {
      focusTinyMceEditor(el, rte)
    },

    parseContent: true,
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
