import { VisualEditorProvider } from "@/features/site-editor/visual-editor"
import { PublicManagedPage } from "./PublicManagedPage"
import { MaterialsPageContent } from "./MaterialsPageContent"

function LegacyProducts() {
  return (
    <VisualEditorProvider pageKey="materials">
      <MaterialsPageContent />
    </VisualEditorProvider>
  )
}

export function Products() {
  return <PublicManagedPage slug="materiais" fallback={<LegacyProducts />} />
}
