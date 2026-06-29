import { VisualEditorProvider } from "@/features/site-editor/visual-editor"
import { PublicManagedPage } from "./PublicManagedPage"
import { SupportPageContent } from "./SupportFaqExperience"

export { SupportPageContent } from "./SupportFaqExperience"

function LegacySupport() {
  return (
    <VisualEditorProvider pageKey="support">
      <SupportPageContent />
    </VisualEditorProvider>
  )
}

export function Support() {
  return <PublicManagedPage slug="suporte" fallback={<LegacySupport />} />
}
