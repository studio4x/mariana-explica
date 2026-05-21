import { Editor as TiptapEditor } from "@tiptap/core"
import Link from "@tiptap/extension-link"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import type { Editor as GrapesEditor } from "grapesjs"

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

function focusTiptapEditor(rte?: TiptapRteInstance | null) {
  rte?.editor.commands.focus()
  rte?.refreshToolbar()
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
          }),
          Link.configure({
            openOnClick: false,
          }),
          Underline,
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
