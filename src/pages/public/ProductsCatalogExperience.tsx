import { VisualEditorProvider } from "@/features/site-editor/visual-editor"
import { MaterialsPageContent } from "./MaterialsPageContent"

export function ProductsCatalogExperience() {
  return (
    <VisualEditorProvider pageKey="materials">
      <MaterialsPageContent />
    </VisualEditorProvider>
  )
}
