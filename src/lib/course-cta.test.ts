import { describe, expect, it } from "vitest"
import { studentCoursePath } from "@/lib/routes"
import { getEnrolledCourseAction, getLearningActionLabel, getStudentProductAccessLabel } from "./course-cta"

describe("course-cta", () => {
  it("uses Aceder when the student has access but has not started yet", () => {
    expect(
      getLearningActionLabel({
        id: "course-1",
        completed_lessons: 0,
        progress_percent: 0,
      }),
    ).toBe("Aceder")
  })

  it("keeps the continue label after progress exists", () => {
    expect(
      getLearningActionLabel({
        id: "course-1",
        completed_lessons: 1,
        progress_percent: 20,
      }),
    ).toBe("Continuar aprendizado")
  })

  it("maps dashboard access labels by product type", () => {
    expect(getStudentProductAccessLabel("external_service")).toBe("Ver curso")
    expect(getStudentProductAccessLabel("paid")).toBe("Ver material")
    expect(getStudentProductAccessLabel("free")).toBe("Ver material")
    expect(getStudentProductAccessLabel("hybrid")).toBe("Ver material")
  })

  it("creates enrolled actions with the access label and student route", () => {
    const action = getEnrolledCourseAction({
      id: "course-1",
      completed_lessons: 0,
      progress_percent: 0,
    })

    expect(action).toEqual({
      label: "Aceder",
      to: studentCoursePath("course-1"),
    })
  })
})
