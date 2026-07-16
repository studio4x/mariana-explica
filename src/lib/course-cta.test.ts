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

  it("uses the short continue label after progress exists", () => {
    expect(
      getLearningActionLabel({
        id: "course-1",
        completed_lessons: 1,
        progress_percent: 20,
      }),
    ).toBe("Continuar")
  })

  it("maps dashboard access labels by product type", () => {
    expect(getStudentProductAccessLabel("external_service", "sebentas-individuais")).toBe("Ver curso")
    expect(getStudentProductAccessLabel("paid", "sebentas-individuais")).toBe("Ver material")
    expect(getStudentProductAccessLabel("free", "sebentas-individuais")).toBe("Ver material")
    expect(getStudentProductAccessLabel("hybrid", "sebentas-individuais")).toBe("Ver material")
    expect(getStudentProductAccessLabel("paid", "packs-poupanca")).toBe("Ver material")
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
