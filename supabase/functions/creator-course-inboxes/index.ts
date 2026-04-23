import { badRequest } from "../_shared/errors.ts"
import { corsResponse, errorResponse, getRequestId, jsonResponse } from "../_shared/http.ts"
import { logError } from "../_shared/logger.ts"
import { requireActiveUser } from "../_shared/mod.ts"

type ProductRow = {
  id: string
  title: string
  slug: string
  status: string
  cover_image_url: string | null
}

type TicketRow = {
  id: string
  product_id: string | null
  user_id: string
  subject: string
  status: string
  priority: string
  category: string
  last_reply_at: string | null
  updated_at: string
  created_at: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req)

  if (req.method === "OPTIONS") {
    return corsResponse()
  }

  try {
    if (req.method !== "POST") {
      throw badRequest("Metodo nao suportado")
    }

    const context = await requireActiveUser(req)

    const { data: products, error: productsError } = await context.serviceClient
      .from("products")
      .select("id,title,slug,status,cover_image_url")
      .eq("creator_id", context.user.id)
      .order("title", { ascending: true })

    if (productsError) throw productsError

    const creatorProducts = (products ?? []) as ProductRow[]
    const productIds = creatorProducts.map((product) => product.id)

    if (productIds.length === 0) {
      return jsonResponse({ success: true, request_id: requestId, inboxes: [] })
    }

    const { data: tickets, error: ticketsError } = await context.serviceClient
      .from("support_tickets")
      .select("id,product_id,user_id,subject,status,priority,category,last_reply_at,updated_at,created_at")
      .in("product_id", productIds)
      .order("updated_at", { ascending: false })

    if (ticketsError) throw ticketsError

    const ticketRows = (tickets ?? []) as TicketRow[]
    const profileIds = [...new Set(ticketRows.map((ticket) => ticket.user_id))]
    const profiles = new Map<string, ProfileRow>()

    if (profileIds.length > 0) {
      const { data: profileRows, error: profilesError } = await context.serviceClient
        .from("profiles")
        .select("id,full_name,email,avatar_url")
        .in("id", profileIds)

      if (profilesError) throw profilesError

      for (const profile of (profileRows ?? []) as ProfileRow[]) {
        profiles.set(profile.id, profile)
      }
    }

    const inboxes = creatorProducts.map((product) => {
      const productTickets = ticketRows.filter((ticket) => ticket.product_id === product.id)
      const openTickets = productTickets.filter((ticket) => ticket.status !== "closed")
      const lastTicket = productTickets[0] ?? null

      return {
        product,
        total_tickets: productTickets.length,
        open_tickets: openTickets.length,
        last_message_at: lastTicket?.updated_at ?? null,
        tickets: productTickets.slice(0, 8).map((ticket) => ({
          ...ticket,
          student: profiles.get(ticket.user_id) ?? null,
        })),
      }
    })

    return jsonResponse({ success: true, request_id: requestId, inboxes })
  } catch (error) {
    logError("Creator course inboxes failed", { request_id: requestId, error: String(error) })
    return errorResponse(error, requestId)
  }
})
