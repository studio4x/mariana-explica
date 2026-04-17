import { ROUTES } from "@/lib/constants"

export function adminProductContentPath(productId: string) {
  return `${ROUTES.ADMIN_PRODUCTS}/${productId}/conteudo`
}

