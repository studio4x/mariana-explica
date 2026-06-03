export const LESSON_PRIVATE_MEDIA_BUCKET = "course-assets-private"
export const LESSON_PUBLIC_IMAGE_BUCKET = "course-cover-public"

export function isRenderableLessonMediaUrl(value: string) {
  return /^(https?:|blob:|data:)/i.test(value.trim())
}

