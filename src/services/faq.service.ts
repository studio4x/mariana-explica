import { publicSupabase, supabase } from "@/integrations/supabase"
import { buildDefaultFaqCategories, buildDefaultFaqs } from "@/lib/faq-defaults"
import type { FaqCategorySummary, FaqSummary } from "@/types/faq.types"

const faqCategorySelect = `
  id,
  slug,
  title,
  description,
  sort_order,
  is_active,
  created_at,
  updated_at
`

const faqSelect = `
  id,
  category_id,
  question,
  answer,
  sort_order,
  is_active,
  created_at,
  updated_at
`

function isSchemaMismatch(error: unknown, ...hints: string[]) {
  if (!error || typeof error !== "object") return false
  const asRecord = error as Record<string, unknown>
  const fullText = `${asRecord.code ?? ""} ${asRecord.message ?? ""} ${asRecord.details ?? ""} ${asRecord.hint ?? ""}`.toLowerCase()

  if (fullText.includes("schema cache") || fullText.includes("does not exist") || fullText.includes("not found")) {
    return true
  }

  return hints.some((hint) => fullText.includes(hint.toLowerCase()))
}

export async function fetchPublishedFaqCategories() {
  const { data, error } = await publicSupabase
    .from("faq_categories")
    .select(faqCategorySelect)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error && isSchemaMismatch(error, "faq_categories")) {
    return buildDefaultFaqCategories()
  }

  if (error) throw error
  return (data ?? []) as FaqCategorySummary[]
}

export async function fetchPublishedFaqs() {
  const { data, error } = await publicSupabase
    .from("faqs")
    .select(faqSelect)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("question", { ascending: true })

  if (error && isSchemaMismatch(error, "faqs")) {
    return buildDefaultFaqs()
  }

  if (error) throw error
  return (data ?? []) as FaqSummary[]
}

export async function fetchAdminFaqCategories() {
  const { data, error } = await supabase
    .from("faq_categories")
    .select(faqCategorySelect)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error && isSchemaMismatch(error, "faq_categories")) {
    return buildDefaultFaqCategories()
  }

  if (error) throw error
  return (data ?? []) as FaqCategorySummary[]
}

export async function fetchAdminFaqs() {
  const { data, error } = await supabase
    .from("faqs")
    .select(faqSelect)
    .order("sort_order", { ascending: true })
    .order("question", { ascending: true })

  if (error && isSchemaMismatch(error, "faqs")) {
    return buildDefaultFaqs()
  }

  if (error) throw error
  return (data ?? []) as FaqSummary[]
}

export async function createAdminFaqCategory(input: {
  slug: string
  title: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}) {
  const { data, error } = await supabase
    .from("faq_categories")
    .insert({
      slug: input.slug.trim().toLowerCase(),
      title: input.title.trim(),
      description: input.description ?? null,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
    })
    .select(faqCategorySelect)
    .single()

  if (error) throw error
  return data as FaqCategorySummary
}

export async function updateAdminFaqCategory(input: {
  categoryId: string
  slug?: string
  title?: string
  description?: string | null
  sortOrder?: number
  isActive?: boolean
}) {
  const updates: Record<string, unknown> = {}

  if (input.slug !== undefined) updates.slug = input.slug.trim().toLowerCase()
  if (input.title !== undefined) updates.title = input.title.trim()
  if (input.description !== undefined) updates.description = input.description
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder
  if (input.isActive !== undefined) updates.is_active = input.isActive

  const { data, error } = await supabase
    .from("faq_categories")
    .update(updates)
    .eq("id", input.categoryId)
    .select(faqCategorySelect)
    .single()

  if (error) throw error
  return data as FaqCategorySummary
}

export async function deleteAdminFaqCategory(categoryId: string) {
  const { error } = await supabase.from("faq_categories").delete().eq("id", categoryId)
  if (error) throw error
  return { success: true as const }
}

export async function createAdminFaq(input: {
  categoryId: string
  question: string
  answer: string
  sortOrder?: number
  isActive?: boolean
}) {
  const { data, error } = await supabase
    .from("faqs")
    .insert({
      category_id: input.categoryId,
      question: input.question.trim(),
      answer: input.answer.trim(),
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
    })
    .select(faqSelect)
    .single()

  if (error) throw error
  return data as FaqSummary
}

export async function updateAdminFaq(input: {
  faqId: string
  categoryId?: string
  question?: string
  answer?: string
  sortOrder?: number
  isActive?: boolean
}) {
  const updates: Record<string, unknown> = {}

  if (input.categoryId !== undefined) updates.category_id = input.categoryId
  if (input.question !== undefined) updates.question = input.question.trim()
  if (input.answer !== undefined) updates.answer = input.answer.trim()
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder
  if (input.isActive !== undefined) updates.is_active = input.isActive

  const { data, error } = await supabase
    .from("faqs")
    .update(updates)
    .eq("id", input.faqId)
    .select(faqSelect)
    .single()

  if (error) throw error
  return data as FaqSummary
}

export async function deleteAdminFaq(faqId: string) {
  const { error } = await supabase.from("faqs").delete().eq("id", faqId)
  if (error) throw error
  return { success: true as const }
}
