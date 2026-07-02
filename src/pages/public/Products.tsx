import { useLocation } from "react-router-dom"
import { VisualEditorProvider } from "@/features/site-editor/visual-editor"
import { readSitePagePreviewFromSearch } from "@/lib/site-page-preview"
import { PublicManagedPage } from "./PublicManagedPage"
import { MaterialsPageContent } from "./MaterialsPageContent"

export function Products() {
  const location = useLocation()
  const previewPayload = readSitePagePreviewFromSearch("materiais", location.search)

  if (previewPayload) {
    return <PublicManagedPage slug="materiais" />
  }

  return (
    <VisualEditorProvider pageKey="materials">
      <MaterialsPageContent />
    </VisualEditorProvider>
  )
}
