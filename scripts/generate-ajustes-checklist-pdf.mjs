import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

const sourcePath = path.join(root, "docs", "AJUSTES_A_REALIZAR.md")
const outputPath = path.join(root, "docs", "Caderno sem título-5.pdf")

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function parseChecklistMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/)
  let title = "Checklist"
  const intro = []
  const items = []
  const rule = []
  let section = "intro"

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (section === "intro" && intro.length > 0 && intro[intro.length - 1] !== "") {
        intro.push("")
      } else if (section === "rule" && rule.length > 0 && rule[rule.length - 1] !== "") {
        rule.push("")
      }
      continue
    }

    if (line.startsWith("# ")) {
      title = line.slice(2).trim()
      continue
    }

    if (line === "## Itens") {
      section = "items"
      continue
    }

    if (line === "## Regra") {
      section = "rule"
      continue
    }

    if (section === "intro") {
      intro.push(rawLine.trim())
      continue
    }

    if (section === "items") {
      const match = rawLine.match(/^- \[(.*?)\]\s+(T\d+)\s+-\s+(.*)$/)
      if (match) {
        items.push({
          status: match[1].trim().toUpperCase(),
          id: match[2].trim().toUpperCase(),
          text: match[3].trim(),
        })
      }
      continue
    }

    if (section === "rule") {
      rule.push(rawLine.trim())
    }
  }

  return { title, intro: intro.join(" ").replace(/\s+/g, " ").trim(), items, rule: rule.join(" ").trim() }
}

function buildHtml({ title, intro, items, rule }) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td class="status-cell">
            <span class="status-pill">${escapeHtml(item.status)}</span>
          </td>
          <td class="id-cell">${escapeHtml(item.id)}</td>
          <td class="text-cell">${escapeHtml(item.text)}</td>
        </tr>
      `,
    )
    .join("")

  return `<!doctype html>
  <html lang="pt">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #12263a;
          --muted: #5d7287;
          --line: #d8e6f0;
          --bg: #f6fafc;
          --card: #ffffff;
          --accent: #123f59;
          --accent-soft: #e7f3fb;
          --success: #0f7a55;
          --success-soft: #e6f7ef;
        }

        * { box-sizing: border-box; }

        html, body {
          margin: 0;
          padding: 0;
          background: var(--bg);
          color: var(--ink);
          font-family: Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          padding: 34px;
        }

        .page {
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: 0 16px 40px rgba(18, 63, 89, 0.08);
          padding: 32px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 20px;
        }

        h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .intro {
          margin: 14px 0 24px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.8;
          max-width: 920px;
        }

        .summary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          border-radius: 999px;
          background: #eef7fb;
          border: 1px solid var(--line);
          color: var(--accent);
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid var(--line);
          background: #fff;
        }

        thead th {
          background: #f2f8fc;
          color: var(--accent);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: left;
          padding: 14px 16px;
          border-bottom: 1px solid var(--line);
        }

        tbody td {
          vertical-align: top;
          padding: 16px;
          border-bottom: 1px solid var(--line);
          font-size: 13px;
          line-height: 1.7;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .status-cell { width: 120px; }
        .id-cell { width: 90px; font-weight: 700; color: var(--accent); }
        .text-cell { color: var(--ink); }

        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 68px;
          border-radius: 999px;
          padding: 6px 12px;
          background: var(--success-soft);
          color: var(--success);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .rule {
          margin-top: 22px;
          border-radius: 18px;
          border: 1px solid #b9d8ea;
          background: linear-gradient(180deg, #f4fbff 0%, #eef8fd 100%);
          padding: 18px 20px;
          color: #184663;
          font-size: 13px;
          line-height: 1.8;
        }

        .rule-title {
          margin: 0 0 6px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .footer {
          margin-top: 14px;
          color: var(--muted);
          font-size: 11px;
          text-align: right;
        }

        @page {
          size: A4;
          margin: 14mm;
        }
      </style>
    </head>
    <body>
      <main class="page">
        <div class="eyebrow">Checklist / validação</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="intro">${escapeHtml(intro)}</p>
        <div class="summary">${items.length} itens marcados como [OK]</div>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>ID</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <section class="rule">
          <p class="rule-title">Regra</p>
          <div>${escapeHtml(rule).replace(/\[OK\]/g, "<strong>[OK]</strong>")}</div>
        </section>
        <div class="footer">Fonte canônica: docs/AJUSTES_A_REALIZAR.md</div>
      </main>
    </body>
  </html>`
}

async function main() {
  const markdown = await fs.readFile(sourcePath, "utf8")
  const parsed = parseChecklistMarkdown(markdown)
  const html = buildHtml(parsed)

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } })
    await page.setContent(html, { waitUntil: "load" })
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })
  } finally {
    await browser.close()
  }

  const stats = await fs.stat(outputPath)
  console.log(`PDF gerado em ${outputPath} (${stats.size} bytes)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
