import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const sourceRoot = path.join(root, "src")

const accentPairs = [
  ["acao", "a\u00e7\u00e3o"],
  ["acoes", "a\u00e7\u00f5es"],
  ["academica", "acad\u00e9mica"],
  ["academico", "acad\u00eamico"],
  ["acessivel", "acess\u00edvel"],
  ["acessiveis", "acess\u00edveis"],
  ["administracao", "administra\u00e7\u00e3o"],
  ["alteracao", "altera\u00e7\u00e3o"],
  ["alteracoes", "altera\u00e7\u00f5es"],
  ["analise", "an\u00e1lise"],
  ["anonimizacao", "anonimiza\u00e7\u00e3o"],
  ["anotacao", "anota\u00e7\u00e3o"],
  ["anotacoes", "anota\u00e7\u00f5es"],
  ["aplicacao", "aplica\u00e7\u00e3o"],
  ["aplicacoes", "aplica\u00e7\u00f5es"],
  ["aplicavel", "aplic\u00e1vel"],
  ["aplicaveis", "aplic\u00e1veis"],
  ["aproximacao", "aproxima\u00e7\u00e3o"],
  ["apos", "ap\u00f3s"],
  ["area", "\u00e1rea"],
  ["areas", "\u00e1reas"],
  ["arvore", "\u00e1rvore"],
  ["atraves", "atrav\u00e9s"],
  ["atencao", "aten\u00e7\u00e3o"],
  ["atualizacao", "atualiza\u00e7\u00e3o"],
  ["ativacao", "ativa\u00e7\u00e3o"],
  ["autenticacao", "autentica\u00e7\u00e3o"],
  ["automatica", "autom\u00e1tica"],
  ["automatico", "autom\u00e1tico"],
  ["avaliacao", "avalia\u00e7\u00e3o"],
  ["avaliacoes", "avalia\u00e7\u00f5es"],
  ["basica", "b\u00e1sica"],
  ["basico", "b\u00e1sico"],
  ["botao", "bot\u00e3o"],
  ["botoes", "bot\u00f5es"],
  ["catalogo", "cat\u00e1logo"],
  ["cerebro", "c\u00e9rebro"],
  ["classificacao", "classifica\u00e7\u00e3o"],
  ["codigo", "c\u00f3digo"],
  ["codigos", "c\u00f3digos"],
  ["comissao", "comiss\u00e3o"],
  ["comunicacao", "comunica\u00e7\u00e3o"],
  ["comunicacoes", "comunica\u00e7\u00f5es"],
  ["comeca", "come\u00e7a"],
  ["comecar", "come\u00e7ar"],
  ["compativel", "compat\u00edvel"],
  ["complicacoes", "complica\u00e7\u00f5es"],
  ["concluida", "conclu\u00edda"],
  ["concluidas", "conclu\u00eddas"],
  ["conclusao", "conclus\u00e3o"],
  ["condicoes", "condi\u00e7\u00f5es"],
  ["configuracao", "configura\u00e7\u00e3o"],
  ["configuracoes", "configura\u00e7\u00f5es"],
  ["confirmacao", "confirma\u00e7\u00e3o"],
  ["confirmacoes", "confirma\u00e7\u00f5es"],
  ["concessao", "concess\u00e3o"],
  ["conexoes", "conex\u00f5es"],
  ["confianca", "confian\u00e7a"],
  ["conteudo", "conte\u00fado"],
  ["conteudos", "conte\u00fados"],
  ["cobranca", "cobran\u00e7a"],
  ["critica", "cr\u00edtica"],
  ["criticas", "cr\u00edticas"],
  ["diferenca", "diferen\u00e7a"],
  ["definicoes", "defini\u00e7\u00f5es"],
  ["descricao", "descri\u00e7\u00e3o"],
  ["descricoes", "descri\u00e7\u00f5es"],
  ["demonstracao", "demonstra\u00e7\u00e3o"],
  ["destruicao", "destrui\u00e7\u00e3o"],
  ["descontraidas", "descontra\u00eddas"],
  ["disponivel", "dispon\u00edvel"],
  ["disponiveis", "dispon\u00edveis"],
  ["dispersao", "dispers\u00e3o"],
  ["duvida", "d\u00favida"],
  ["duvidas", "d\u00favidas"],
  ["edicao", "edi\u00e7\u00e3o"],
  ["eletronica", "eletr\u00f3nica"],
  ["eletronicas", "eletr\u00f3nicas"],
  ["endereco", "endere\u00e7o"],
  ["enderecos", "endere\u00e7os"],
  ["especifica", "espec\u00edfica"],
  ["especificas", "espec\u00edficas"],
  ["especifico", "espec\u00edfico"],
  ["especificos", "espec\u00edficos"],
  ["espaco", "espa\u00e7o"],
  ["estrategia", "estrat\u00e9gia"],
  ["estao", "est\u00e3o"],
  ["excluido", "exclu\u00eddo"],
  ["experiencia", "experi\u00eancia"],
  ["explicacao", "explica\u00e7\u00e3o"],
  ["explicacoes", "explica\u00e7\u00f5es"],
  ["execucao", "execu\u00e7\u00e3o"],
  ["exercicio", "exerc\u00edcio"],
  ["europeias", "europeias"],
  ["facil", "f\u00e1cil"],
  ["faco", "fa\u00e7o"],
  ["faturacao", "fatura\u00e7\u00e3o"],
  ["fisico", "f\u00edsico"],
  ["flexiveis", "flex\u00edveis"],
  ["formulario", "formul\u00e1rio"],
  ["formularios", "formul\u00e1rios"],
  ["funcao", "fun\u00e7\u00e3o"],
  ["funcoes", "fun\u00e7\u00f5es"],
  ["gestao", "gest\u00e3o"],
  ["ha", "h\u00e1"],
  ["hibrida", "h\u00edbrida"],
  ["hibrido", "h\u00edbrido"],
  ["historico", "hist\u00f3rico"],
  ["indispensaveis", "indispens\u00e1veis"],
  ["informacao", "informa\u00e7\u00e3o"],
  ["informacoes", "informa\u00e7\u00f5es"],
  ["inicio", "in\u00edcio"],
  ["inscricao", "inscri\u00e7\u00e3o"],
  ["inscricoes", "inscri\u00e7\u00f5es"],
  ["inteligencia", "intelig\u00eancia"],
  ["integracao", "integra\u00e7\u00e3o"],
  ["integracoes", "integra\u00e7\u00f5es"],
  ["interacoes", "intera\u00e7\u00f5es"],
  ["interpretacao", "interpreta\u00e7\u00e3o"],
  ["invalida", "inv\u00e1lida"],
  ["invalido", "inv\u00e1lido"],
  ["ja", "j\u00e1"],
  ["juridicas", "jur\u00eddicas"],
  ["identificacao", "identifica\u00e7\u00e3o"],
  ["legislacao", "legisla\u00e7\u00e3o"],
  ["legitimo", "leg\u00edtimo"],
  ["licita", "l\u00edcita"],
  ["liberacao", "libera\u00e7\u00e3o"],
  ["lingua", "l\u00edngua"],
  ["logica", "l\u00f3gica"],
  ["materia", "mat\u00e9ria"],
  ["maximo", "m\u00e1ximo"],
  ["metodo", "m\u00e9todo"],
  ["minimo", "m\u00ednimo"],
  ["missao", "miss\u00e3o"],
  ["modulo", "m\u00f3dulo"],
  ["modulos", "m\u00f3dulos"],
  ["nao", "n\u00e3o"],
  ["navegacao", "navega\u00e7\u00e3o"],
  ["necessaria", "necess\u00e1ria"],
  ["necessarias", "necess\u00e1rias"],
  ["necessario", "necess\u00e1rio"],
  ["necessarios", "necess\u00e1rios"],
  ["nivel", "n\u00edvel"],
  ["ola", "ol\u00e1"],
  ["notificacao", "notifica\u00e7\u00e3o"],
  ["notificacoes", "notifica\u00e7\u00f5es"],
  ["numero", "n\u00famero"],
  ["numeros", "n\u00fameros"],
  ["obrigacao", "obriga\u00e7\u00e3o"],
  ["obrigacoes", "obriga\u00e7\u00f5es"],
  ["obrigatoria", "obrigat\u00f3ria"],
  ["obrigatorio", "obrigat\u00f3rio"],
  ["opcao", "op\u00e7\u00e3o"],
  ["opcoes", "op\u00e7\u00f5es"],
  ["operacao", "opera\u00e7\u00e3o"],
  ["operacoes", "opera\u00e7\u00f5es"],
  ["organizacao", "organiza\u00e7\u00e3o"],
  ["pagina", "p\u00e1gina"],
  ["paginas", "p\u00e1ginas"],
  ["pais", "pa\u00eds"],
  ["periodo", "per\u00edodo"],
  ["politica", "pol\u00edtica"],
  ["politicas", "pol\u00edticas"],
  ["portugues", "portugu\u00eas"],
  ["possivel", "poss\u00edvel"],
  ["preco", "pre\u00e7o"],
  ["precos", "pre\u00e7os"],
  ["praticas", "pr\u00e1ticas"],
  ["preferencia", "prefer\u00eancia"],
  ["preferencias", "prefer\u00eancias"],
  ["prejuizo", "preju\u00edzo"],
  ["preparacao", "prepara\u00e7\u00e3o"],
  ["prestacao", "presta\u00e7\u00e3o"],
  ["pre-visualizacao", "pr\u00e9-visualiza\u00e7\u00e3o"],
  ["previa", "pr\u00e9via"],
  ["previo", "pr\u00e9vio"],
  ["previsivel", "previs\u00edvel"],
  ["principio", "princ\u00edpio"],
  ["principios", "princ\u00edpios"],
  ["pratico", "pr\u00e1tico"],
  ["praticos", "pr\u00e1ticos"],
  ["projecao", "proje\u00e7\u00e3o"],
  ["propria", "pr\u00f3pria"],
  ["proprias", "pr\u00f3prias"],
  ["proprio", "pr\u00f3prio"],
  ["proprios", "pr\u00f3prios"],
  ["protecao", "prote\u00e7\u00e3o"],
  ["proximo", "pr\u00f3ximo"],
  ["proximos", "pr\u00f3ximos"],
  ["publica", "p\u00fablica"],
  ["publicas", "p\u00fablicas"],
  ["publico", "p\u00fablico"],
  ["publicos", "p\u00fablicos"],
  ["rapida", "r\u00e1pida"],
  ["rapidas", "r\u00e1pidas"],
  ["rapido", "r\u00e1pido"],
  ["rapidos", "r\u00e1pidos"],
  ["raciocinio", "racioc\u00ednio"],
  ["recuperacao", "recupera\u00e7\u00e3o"],
  ["reclamacoes", "reclama\u00e7\u00f5es"],
  ["reconciliacao", "reconcilia\u00e7\u00e3o"],
  ["relacao", "rela\u00e7\u00e3o"],
  ["reune", "re\u00fane"],
  ["resolucao", "resolu\u00e7\u00e3o"],
  ["revisao", "revis\u00e3o"],
  ["revisoes", "revis\u00f5es"],
  ["responsavel", "respons\u00e1vel"],
  ["responsaveis", "respons\u00e1veis"],
  ["ruido", "ru\u00eddo"],
  ["sao", "s\u00e3o"],
  ["secao", "se\u00e7\u00e3o"],
  ["seguranca", "seguran\u00e7a"],
  ["selecao", "sele\u00e7\u00e3o"],
  ["sensivel", "sens\u00edvel"],
  ["sensiveis", "sens\u00edveis"],
  ["sera", "ser\u00e1"],
  ["servico", "servi\u00e7o"],
  ["servicos", "servi\u00e7os"],
  ["sessao", "sess\u00e3o"],
  ["sessoes", "sess\u00f5es"],
  ["simbolo", "s\u00edmbolo"],
  ["so", "s\u00f3"],
  ["solucao", "solu\u00e7\u00e3o"],
  ["tambem", "tamb\u00e9m"],
  ["tecnica", "t\u00e9cnica"],
  ["tecnicas", "t\u00e9cnicas"],
  ["tecnico", "t\u00e9cnico"],
  ["tecnicos", "t\u00e9cnicos"],
  ["titulo", "t\u00edtulo"],
  ["titulos", "t\u00edtulos"],
  ["transacao", "transa\u00e7\u00e3o"],
  ["transacoes", "transa\u00e7\u00f5es"],
  ["ultima", "\u00faltima"],
  ["ultimas", "\u00faltimas"],
  ["ultimo", "\u00faltimo"],
  ["ultimos", "\u00faltimos"],
  ["uniao", "uni\u00e3o"],
  ["unica", "\u00fanica"],
  ["unicas", "\u00fanicas"],
  ["unico", "\u00fanico"],
  ["unicos", "\u00fanicos"],
  ["util", "\u00fatil"],
  ["utilizacao", "utiliza\u00e7\u00e3o"],
  ["usuario", "usu\u00e1rio"],
  ["usuarios", "usu\u00e1rios"],
  ["autorizacao", "autoriza\u00e7\u00e3o"],
  ["validacao", "valida\u00e7\u00e3o"],
  ["afiliacao", "afilia\u00e7\u00e3o"],
  ["verificacoes", "verifica\u00e7\u00f5es"],
  ["versao", "vers\u00e3o"],
  ["versoes", "vers\u00f5es"],
  ["vinculo", "v\u00ednculo"],
  ["video", "v\u00eddeo"],
  ["videos", "v\u00eddeos"],
  ["visivel", "vis\u00edvel"],
  ["visualizacao", "visualiza\u00e7\u00e3o"],
  ["voce", "voc\u00ea"],
  ["portugues", "portugu\u00eas"],
]

function escapeForCharClass(value) {
  return value.replace(/[\\\]-]/g, "\\$&")
}

function buildVariantPattern(plain, accented) {
  if (plain.length !== accented.length) {
    const broken = accented.replace(/[^\x00-\x7f]/g, "?")
    const escapedPlain = plain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const escapedBroken = broken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return `(?:${escapedPlain}|${escapedBroken})`
  }

  return plain
    .split("")
    .map((char, index) => {
      const accentedChar = accented[index]
      const variants = new Set([char, accentedChar])

      if (char !== accentedChar) {
        variants.add("?")
      }

      if (variants.size === 1) {
        return [...variants][0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      }

      return `[${[...variants].map(escapeForCharClass).join("")}]`
    })
    .join("")
}

const replacementRules = accentPairs.map(([plain, accented]) => ({
  accented,
  regex: new RegExp(`(?<![A-Za-z0-9_])${buildVariantPattern(plain, accented)}(?![A-Za-z0-9_])`, "gi"),
}))

function toTitleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function applyCase(match, replacement) {
  if (match.toUpperCase() === match) return replacement.toUpperCase()
  if (match.charAt(0).toUpperCase() === match.charAt(0) && match.slice(1).toLowerCase() === match.slice(1)) {
    return toTitleCase(replacement)
  }
  return replacement
}

function applyAccentFixes(value) {
  let next = value

  for (const rule of replacementRules) {
    next = next.replace(rule.regex, (match) => applyCase(match, rule.accented))
  }

  return next
}

function isImportLike(node) {
  const parent = node.parent

  return (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent) ||
    ts.isImportTypeNode(parent)
  )
}

function looksTechnical(value) {
  if (!value) return true
  if (/^(@\/|https?:|mailto:|tel:|\/)/.test(value)) return true
  if (value.includes("/") && !value.includes(" ")) return true
  if (/^[a-z0-9_./:-]+$/i.test(value) && !/\s/.test(value) && !/[A-ZÀ-ÿ]/.test(value.charAt(0))) return true
  return false
}

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath))
      continue
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function pushEdit(edits, originalText, start, end, next) {
  if (originalText.slice(start, end) !== next) {
    edits.push({ start, end, next })
  }
}

function getTemplateHeadRange(raw, baseStart) {
  const open = raw.indexOf("`")
  const close = raw.lastIndexOf("${")

  if (open === -1 || close === -1 || close < open) return null

  return { start: baseStart + open + 1, end: baseStart + close }
}

function getTemplateLiteralRange(raw, baseStart) {
  const open = raw.indexOf("}")
  const closeExpr = raw.lastIndexOf("${")
  const closeTick = raw.lastIndexOf("`")
  const close = closeExpr > open ? closeExpr : closeTick > open ? closeTick : -1

  if (open === -1 || close === -1 || close < open) return null

  return { start: baseStart + open + 1, end: baseStart + close }
}

function processSourceFile(filePath) {
  const originalText = fs.readFileSync(filePath, "utf8")
  const scriptKind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, originalText, ts.ScriptTarget.Latest, true, scriptKind)
  const edits = []

  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = node.text

      if (!isImportLike(node) && !looksTechnical(value)) {
        const next = applyAccentFixes(value)

        if (next !== value) {
          pushEdit(edits, originalText, node.getStart(sourceFile) + 1, node.end - 1, next)
        }
      }
    }

    if (ts.isJsxText(node)) {
      const value = originalText.slice(node.pos, node.end)
      const next = applyAccentFixes(value)

      if (next !== value) {
        pushEdit(edits, originalText, node.pos, node.end, next)
      }
    }

    if (ts.isTemplateExpression(node)) {
      const headRaw = originalText.slice(node.head.pos, node.head.end)
      const headRange = getTemplateHeadRange(headRaw, node.head.pos)

      if (headRange) {
        const value = originalText.slice(headRange.start, headRange.end)

        if (!looksTechnical(value)) {
          const next = applyAccentFixes(value)

          if (next !== value) {
            pushEdit(edits, originalText, headRange.start, headRange.end, next)
          }
        }
      }

      for (const span of node.templateSpans) {
        const literalRaw = originalText.slice(span.literal.pos, span.literal.end)
        const literalRange = getTemplateLiteralRange(literalRaw, span.literal.pos)

        if (!literalRange) continue

        const value = originalText.slice(literalRange.start, literalRange.end)

        if (looksTechnical(value)) continue

        const next = applyAccentFixes(value)

        if (next !== value) {
          pushEdit(edits, originalText, literalRange.start, literalRange.end, next)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (edits.length === 0) return false

  edits.sort((left, right) => right.start - left.start)
  let nextText = originalText

  for (const edit of edits) {
    nextText = nextText.slice(0, edit.start) + edit.next + nextText.slice(edit.end)
  }

  fs.writeFileSync(filePath, nextText, "utf8")
  return true
}

const changedFiles = []

for (const filePath of listFiles(sourceRoot)) {
  if (processSourceFile(filePath)) {
    changedFiles.push(path.relative(root, filePath))
  }
}

console.log(`changed:${changedFiles.length}`)
for (const filePath of changedFiles) {
  console.log(filePath)
}
