import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { requestAssetAccess } from "@/services"

interface ProtectedVideoPlayerProps {
  assetId: string
  title?: string
  className?: string
  style?: CSSProperties
}

type AccessRequestMode = "initial" | "refresh" | "recovery"

const DEFAULT_URL_TTL_SECONDS = 300
const URL_REFRESH_MARGIN_SECONDS = 60
const STALLED_RECOVERY_DELAY_MS = 8_000
const MAX_RECOVERY_ATTEMPTS = 3

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Não foi possível preparar o vídeo."
}

export function ProtectedVideoPlayer({
  assetId,
  title = "Vídeo da aula",
  className = "block aspect-video w-full bg-black object-contain",
  style,
}: ProtectedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const requestInFlightRef = useRef<Promise<void> | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  const stalledTimerRef = useRef<number | null>(null)
  const loadSignedUrlRef = useRef<((mode: AccessRequestMode) => Promise<void>) | null>(null)
  const disposedRef = useRef(false)
  const recoveryAttemptsRef = useRef(0)
  const pendingPlaybackRef = useRef<{ currentTime: number; shouldResume: boolean } | null>(null)
  const [assetUrl, setAssetUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRecovering, setIsRecovering] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const clearStalledTimer = useCallback(() => {
    if (stalledTimerRef.current !== null) {
      window.clearTimeout(stalledTimerRef.current)
      stalledTimerRef.current = null
    }
  }, [])

  const capturePlaybackState = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    pendingPlaybackRef.current = {
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      shouldResume: !video.paused && !video.ended,
    }
  }, [])

  const scheduleRefresh = useCallback(
    (expiresInSeconds: number) => {
      clearRefreshTimer()
      const refreshDelay = Math.max(
        30_000,
        (Math.max(expiresInSeconds, URL_REFRESH_MARGIN_SECONDS + 30) - URL_REFRESH_MARGIN_SECONDS) * 1_000,
      )

      refreshTimerRef.current = window.setTimeout(() => {
        capturePlaybackState()
        const refresh = loadSignedUrlRef.current
        if (refresh) void refresh("refresh")
      }, refreshDelay)
    },
    [capturePlaybackState, clearRefreshTimer],
  )

  const loadSignedUrl = useCallback(
    (mode: AccessRequestMode) => {
      if (requestInFlightRef.current) return requestInFlightRef.current

      if (mode !== "initial") {
        if (mode === "recovery") recoveryAttemptsRef.current += 1
        capturePlaybackState()
        setIsRecovering(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const request = requestAssetAccess(assetId)
        .then((result) => {
          if (disposedRef.current) return
          if (!result.url) throw new Error("O vídeo não recebeu uma URL de reprodução válida.")

          setAssetUrl(result.url)
          setIsLoading(false)
          setIsRecovering(false)
          setIsBuffering(false)
          scheduleRefresh(result.expires_in_seconds ?? DEFAULT_URL_TTL_SECONDS)
        })
        .catch((requestError: unknown) => {
          if (disposedRef.current) return
          setIsLoading(false)
          setIsRecovering(false)
          setError(getErrorMessage(requestError))
        })
        .finally(() => {
          requestInFlightRef.current = null
        })

      requestInFlightRef.current = request
      return request
    },
    [assetId, capturePlaybackState, scheduleRefresh],
  )

  useEffect(() => {
    loadSignedUrlRef.current = loadSignedUrl
    disposedRef.current = false
    recoveryAttemptsRef.current = 0
    pendingPlaybackRef.current = null
    clearRefreshTimer()
    clearStalledTimer()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets transient player state when the protected asset changes.
    setAssetUrl(null)
    setError(null)
    setIsLoading(true)
    setIsRecovering(false)
    setIsBuffering(false)
    void loadSignedUrl("initial")

    return () => {
      loadSignedUrlRef.current = null
      disposedRef.current = true
      clearRefreshTimer()
      clearStalledTimer()
    }
  }, [assetId, clearRefreshTimer, clearStalledTimer, loadSignedUrl])

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    const pendingPlayback = pendingPlaybackRef.current
    if (!video || !pendingPlayback) return

    if (pendingPlayback.currentTime > 0 && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(pendingPlayback.currentTime, Math.max(video.duration - 0.25, 0))
    }
    pendingPlaybackRef.current = null

    if (pendingPlayback.shouldResume) {
      void video.play().catch(() => undefined)
    }
  }

  const handleCanPlay = () => {
    recoveryAttemptsRef.current = 0
    setIsBuffering(false)
    clearStalledTimer()
  }

  const recoverFromMediaFailure = () => {
    if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
      setIsRecovering(false)
      setError("O vídeo perdeu a ligação. Tenta novamente para continuar a assistir.")
      return
    }
    void loadSignedUrl("recovery")
  }

  const handleWaiting = () => {
    setIsBuffering(true)
    clearStalledTimer()
    stalledTimerRef.current = window.setTimeout(() => {
      stalledTimerRef.current = null
      const video = videoRef.current
      if (video && !video.paused && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        recoverFromMediaFailure()
      }
    }, STALLED_RECOVERY_DELAY_MS)
  }

  const handleRetry = () => {
    recoveryAttemptsRef.current = 0
    void loadSignedUrl("recovery")
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        src={assetUrl ?? undefined}
        title={title}
        controls
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        disableRemotePlayback
        playsInline
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onPlaying={handleCanPlay}
        onWaiting={handleWaiting}
        onStalled={handleWaiting}
        onError={recoverFromMediaFailure}
        className={className}
        style={style}
      />

      {isLoading || isRecovering || isBuffering || error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 px-6 text-center text-sm font-semibold text-white">
          {error ? (
            <div className="pointer-events-auto space-y-3">
              <p>{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-full border border-white/50 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/15"
              >
                Tentar novamente
              </button>
            </div>
          ) : isRecovering ? (
            "A recuperar a ligação do vídeo..."
          ) : isBuffering ? (
            "A carregar o próximo trecho..."
          ) : (
            "A preparar o vídeo..."
          )}
        </div>
      ) : null}
    </div>
  )
}
