import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProtectedVideoPlayer } from "./ProtectedVideoPlayer"

const mockRequestAssetAccess = vi.fn()

vi.mock("@/services", () => ({
  requestAssetAccess: (...args: unknown[]) => mockRequestAssetAccess(...args),
}))

describe("ProtectedVideoPlayer", () => {
  beforeEach(() => {
    mockRequestAssetAccess.mockReset()
  })

  it("renews the signed URL after a media error", async () => {
    mockRequestAssetAccess
      .mockResolvedValueOnce({ success: true, mode: "signed_url", url: "https://cdn.test/video-1.mp4", expires_in_seconds: 3_600 })
      .mockResolvedValueOnce({ success: true, mode: "signed_url", url: "https://cdn.test/video-2.mp4", expires_in_seconds: 3_600 })

    render(<ProtectedVideoPlayer assetId="asset-1" title="Aula protegida" />)

    const video = await screen.findByTitle("Aula protegida")
    await waitFor(() => expect(video).toHaveAttribute("src", "https://cdn.test/video-1.mp4"))

    fireEvent.error(video)

    await waitFor(() => {
      expect(mockRequestAssetAccess).toHaveBeenCalledTimes(2)
      expect(video).toHaveAttribute("src", "https://cdn.test/video-2.mp4")
    })
    expect(mockRequestAssetAccess).toHaveBeenNthCalledWith(2, "asset-1")
  })
})
