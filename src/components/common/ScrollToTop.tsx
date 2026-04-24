import { useEffect, useLayoutEffect } from "react"
import { useLocation } from "react-router-dom"

export function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }
  }, [])

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    const frame = window.requestAnimationFrame(resetScroll)
    const timeout = window.setTimeout(resetScroll, 80)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [location.pathname, location.search, location.hash])

  return null
}
