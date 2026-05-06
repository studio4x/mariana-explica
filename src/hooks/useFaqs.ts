import { useQuery } from "@tanstack/react-query"
import { fetchPublishedFaqCategories, fetchPublishedFaqs } from "@/services"

export function usePublishedFaqCategories() {
  return useQuery({
    queryKey: ["support", "faq-categories"],
    queryFn: fetchPublishedFaqCategories,
  })
}

export function usePublishedFaqs() {
  return useQuery({
    queryKey: ["support", "faqs"],
    queryFn: fetchPublishedFaqs,
  })
}
