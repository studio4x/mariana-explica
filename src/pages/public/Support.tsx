import { useLocation } from "react-router-dom"
import { VisualEditorProvider } from "@/features/site-editor/visual-editor"
import { readSitePagePreviewFromSearch } from "@/lib/site-page-preview"
import { PublicManagedPage } from "./PublicManagedPage"
import { SupportPageContent } from "./SupportFaqExperience"

export { SupportPageContent } from "./SupportFaqExperience"

export function Support() {
  const location = useLocation()
  const previewPayload = readSitePagePreviewFromSearch("suporte", location.search)

  if (previewPayload) {
    return <PublicManagedPage slug="suporte" />
  }

  return (
    <VisualEditorProvider pageKey="support">
      <SupportPageContent />
    </VisualEditorProvider>
  )
}
