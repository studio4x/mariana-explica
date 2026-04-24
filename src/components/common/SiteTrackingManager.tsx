import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation } from "react-router-dom"
import {
  COOKIE_CONSENT_EVENT,
  DEFAULT_COOKIE_CONSENT_PREFERENCES,
  readCookieConsent,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent"
import { fetchPublicTrackingConfig } from "@/services"
import type { AdminTrackingConfig } from "@/types/app.types"

const GTM_SCRIPT_ID = "mariana-explica-gtm-script"
const META_PIXEL_SCRIPT_ID = "mariana-explica-meta-pixel-script"
const CUSTOM_HEAD_CONTAINER_ID = "mariana-explica-custom-head"
const CUSTOM_BODY_CONTAINER_ID = "mariana-explica-custom-body"
const CUSTOM_FOOTER_CONTAINER_ID = "mariana-explica-custom-footer"
const GTM_NOSCRIPT_CONTAINER_ID = "mariana-explica-gtm-noscript"

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void
      push?: (...args: unknown[]) => void
      loaded?: boolean
      version?: string
      queue?: unknown[]
    }
    _fbq?: Window["fbq"]
  }
}

function readConsentPreferences(): CookieConsentPreferences {
  return readCookieConsent()?.preferences ?? DEFAULT_COOKIE_CONSENT_PREFERENCES
}

function removeNodeById(nodeId: string) {
  document.getElementById(nodeId)?.remove()
}

function mountHtmlSnippet(target: HTMLElement, containerId: string, html: string) {
  removeNodeById(containerId)

  if (!html.trim()) {
    return
  }

  const container = document.createElement("div")
  container.id = containerId
  container.setAttribute("data-managed-by", "mariana-explica-tracking")
  container.style.display = "contents"

  const template = document.createElement("template")
  template.innerHTML = html

  Array.from(template.content.childNodes).forEach((node) => {
    if (node.nodeName.toLowerCase() !== "script") {
      container.appendChild(node.cloneNode(true))
      return
    }

    const sourceScript = node as HTMLScriptElement
    const script = document.createElement("script")

    Array.from(sourceScript.attributes).forEach((attribute) => {
      script.setAttribute(attribute.name, attribute.value)
    })

    script.text = sourceScript.text
    container.appendChild(script)
  })

  target.appendChild(container)
}

function ensureGtm(gtmId: string) {
  removeNodeById(GTM_SCRIPT_ID)
  removeNodeById(GTM_NOSCRIPT_CONTAINER_ID)

  if (!gtmId.trim()) {
    return
  }

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({
    "gtm.start": Date.now(),
    event: "gtm.js",
  })

  const script = document.createElement("script")
  script.id = GTM_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`
  document.head.appendChild(script)

  const noscriptWrapper = document.createElement("div")
  noscriptWrapper.id = GTM_NOSCRIPT_CONTAINER_ID
  noscriptWrapper.setAttribute("data-managed-by", "mariana-explica-tracking")
  noscriptWrapper.innerHTML = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
  document.body.appendChild(noscriptWrapper)
}

function ensureMetaPixel(pixelId: string) {
  removeNodeById(META_PIXEL_SCRIPT_ID)

  if (!pixelId.trim()) {
    return
  }

  if (!window.fbq) {
    const fbqStub = function (...args: unknown[]) {
      if (window.fbq?.callMethod) {
        window.fbq.callMethod(...args)
      } else {
        window.fbq = window.fbq ?? fbqStub
        window.fbq.queue = window.fbq.queue ?? []
        window.fbq.queue.push(args)
      }
    } as NonNullable<Window["fbq"]>

    fbqStub.loaded = true
    fbqStub.version = "2.0"
    fbqStub.queue = []
    window.fbq = fbqStub
    window._fbq = fbqStub
  }

  window.fbq?.("init", pixelId)

  const script = document.createElement("script")
  script.id = META_PIXEL_SCRIPT_ID
  script.async = true
  script.src = "https://connect.facebook.net/en_US/fbevents.js"
  document.head.appendChild(script)
}

function cleanupTrackingScripts() {
  removeNodeById(GTM_SCRIPT_ID)
  removeNodeById(GTM_NOSCRIPT_CONTAINER_ID)
  removeNodeById(META_PIXEL_SCRIPT_ID)
}

function cleanupCustomCode() {
  removeNodeById(CUSTOM_HEAD_CONTAINER_ID)
  removeNodeById(CUSTOM_BODY_CONTAINER_ID)
  removeNodeById(CUSTOM_FOOTER_CONTAINER_ID)
}

function sanitizeTrackingConfig(config: AdminTrackingConfig | null) {
  return (
    config ?? {
      config_key: "site_tracking",
      config_value: {
        google_tag_manager_id: "",
        meta_pixel_id: "",
        custom_head_code: "",
        custom_body_code: "",
        custom_footer_code: "",
      },
      description: null,
      is_public: true,
      updated_at: null,
    }
  )
}

export function SiteTrackingManager() {
  const location = useLocation()
  const trackingConfigQuery = useQuery({
    queryKey: ["site", "tracking"],
    queryFn: fetchPublicTrackingConfig,
    staleTime: 60_000,
  })

  useEffect(() => {
    const syncTracking = () => {
      const consent = readConsentPreferences()
      const config = sanitizeTrackingConfig(trackingConfigQuery.data ?? null)

      cleanupTrackingScripts()
      cleanupCustomCode()

      mountHtmlSnippet(document.head, CUSTOM_HEAD_CONTAINER_ID, config.config_value.custom_head_code)
      mountHtmlSnippet(document.body, CUSTOM_BODY_CONTAINER_ID, config.config_value.custom_body_code)
      mountHtmlSnippet(document.body, CUSTOM_FOOTER_CONTAINER_ID, config.config_value.custom_footer_code)

      if (consent.analytics && config.config_value.google_tag_manager_id) {
        ensureGtm(config.config_value.google_tag_manager_id)
      }

      if (consent.marketing && config.config_value.meta_pixel_id) {
        ensureMetaPixel(config.config_value.meta_pixel_id)
      }

      if (consent.analytics && window.dataLayer) {
        window.dataLayer.push({
          event: "virtual_page_view",
          page_path: location.pathname,
          page_location: window.location.href,
          page_title: document.title,
        })
      }

      if (consent.marketing && window.fbq) {
        window.fbq("track", "PageView")
      }
    }

    syncTracking()
    window.addEventListener(COOKIE_CONSENT_EVENT, syncTracking)

    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, syncTracking)
    }
  }, [location.pathname, location.search, trackingConfigQuery.data])

  return null
}
