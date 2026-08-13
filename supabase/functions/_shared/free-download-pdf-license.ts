import { PDFDocument, type PDFFont, rgb, StandardFonts } from "npm:pdf-lib@1.17.1"

const FOOTER_MARGIN_X = 28

function normalizeFooterText(value: string, maximumLength: number) {
  const normalized = value.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim()
  return normalized.length > maximumLength ? `${normalized.slice(0, maximumLength - 1)}…` : normalized
}

function fitText(params: {
  text: string
  font: PDFFont
  size: number
  maxWidth: number
}) {
  if (params.font.widthOfTextAtSize(params.text, params.size) <= params.maxWidth) return params.text

  let text = params.text
  while (text.length > 1 && params.font.widthOfTextAtSize(`${text}…`, params.size) > params.maxWidth) {
    text = text.slice(0, -1)
  }
  return `${text}…`
}

export async function stampFreeDownloadPdf(params: {
  sourceBytes: Uint8Array
  leadName: string
  leadEmail: string
  licenseKeyHash: string
}) {
  const document = await PDFDocument.load(params.sourceBytes)
  const licenseFont = await document.embedFont(StandardFonts.Helvetica)
  const keyFont = await document.embedFont(StandardFonts.Courier)
  const name = normalizeFooterText(params.leadName, 120)
  const email = normalizeFooterText(params.leadEmail, 320)
  const key = normalizeFooterText(params.licenseKeyHash.toLowerCase(), 64)

  for (const page of document.getPages()) {
    const { width } = page.getSize()
    const availableWidth = Math.max(120, width - FOOTER_MARGIN_X * 2)
    const licenseText = fitText({
      text: `Licenciado para: ${name} (${email})`,
      font: licenseFont,
      size: 8,
      maxWidth: availableWidth,
    })
    const keyText = fitText({
      text: `Chave criptografica (SHA-256): ${key}`,
      font: keyFont,
      size: 5.5,
      maxWidth: availableWidth,
    })

    page.drawLine({
      start: { x: FOOTER_MARGIN_X, y: 28 },
      end: { x: width - FOOTER_MARGIN_X, y: 28 },
      thickness: 0.35,
      color: rgb(0.65, 0.69, 0.75),
      opacity: 0.7,
    })
    page.drawText(licenseText, {
      x: FOOTER_MARGIN_X,
      y: 17,
      size: 8,
      font: licenseFont,
      color: rgb(0.16, 0.2, 0.27),
      opacity: 0.82,
    })
    page.drawText(keyText, {
      x: FOOTER_MARGIN_X,
      y: 8,
      size: 5.5,
      font: keyFont,
      color: rgb(0.28, 0.33, 0.4),
      opacity: 0.78,
    })
  }

  return await document.save()
}
