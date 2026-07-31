// Motor de geração do Contrato em Word (.docx).
// Substitui os tokens [ ... ] do modelo pelos dados informados, mantendo
// toda a formatação original (fontes, cláusulas, logo do cabeçalho).
// A lógica de substituição foi validada por prova de conceito antes de entrar aqui.

import JSZip from 'jszip'
import { CONTRATO_TEMPLATE_BASE64 } from './template-base64'

export type DadosContrato = {
  // CONTRATANTE (empresa)
  razaoSocial: string
  cidade: string
  uf: string
  endereco: string
  cep: string
  cnpj: string
  inscricaoEstadual: string
  // Representante legal da CONTRATANTE
  repNome: string
  repNacionalidade: string
  repEstadoCivil: string
  repProfissao: string
  repRg: string
  repCpf: string
  repCidadeUf: string
  // Objeto
  objetoResumido: string
  objetoMunicipioUf: string
  objetoVinculacao: string
  // Vigência
  dataInicioVig: string // dd/mm/aaaa — usado no preâmbulo e na Cláusula 2ª
  dataTerminoVig: string // dd/mm/aaaa — término no preâmbulo
  prazoExtenso: string
  // Assinatura
  local: string
  dia: string
  mes: string
  ano: string
  // Serviços (Cláusula 1ª) — lista flexível
  servicos: string[]
}

function escXml(s: unknown): string {
  return String(s == null ? '' : s)
    // Remove caracteres de controle invalidos em XML 1.0 (mantem \t \n \r).
    // Sem isso, texto colado de PDF/Word (form-feed, tab vertical) geraria um
    // document.xml malformado que o Word recusa abrir.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Normaliza um token para um identificador ASCII estável (sem acentos, maiúsculo)
function slug(s: string): string {
  return s
    .replace(/^\[|\]$/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

// Gera as letras dos itens de serviço: a, b, c, ... z, aa, ab, ...
function letra(i: number): string {
  let s = ''
  i++
  while (i > 0) {
    i--
    s = String.fromCharCode(97 + (i % 26)) + s
    i = Math.floor(i / 26)
  }
  return s
}

// Expande os 3 parágrafos de serviço do modelo em N parágrafos (um por serviço)
function expandirServicos(xml: string, servicos: string[]): string {
  const paraRe = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g
  const blocos: { raw: string; start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = paraRe.exec(xml)) !== null) {
    blocos.push({ raw: m[0], start: m.index, end: m.index + m[0].length })
  }
  const slugText = (p: string): string => {
    let t = ''
    let mm: RegExpExecArray | null
    const r = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g
    while ((mm = r.exec(p)) !== null) t += mm[1]
    return slug('[' + t + ']')
  }
  const idx1 = blocos.findIndex(b => slugText(b.raw).includes('DESCRICAO DO SERVICO 1'))
  const idx3 = blocos.findIndex(b => slugText(b.raw).includes('DESCRICAO DO SERVICO 3'))
  if (idx1 < 0 || idx3 < 0) return xml

  const tpl = blocos[idx1].raw
  // Sem serviços: remove os parágrafos-modelo (não emite item vazio "a) .")
  const lista = (servicos || []).filter(d => d != null && String(d).trim() !== '')
  const novos = lista
    .map((desc, k) => {
      let p = tpl
      p = p.replace(/<w:highlight w:val="yellow"\/>/g, '')
      p = p.replace('<w:t xml:space="preserve">a) </w:t>', '<w:t xml:space="preserve">' + letra(k) + ') </w:t>')
      p = p.replace(/<w:t>\[[^[\]]*\]<\/w:t>/, '<w:t>' + escXml(desc) + '</w:t>')
      if (k === lista.length - 1) p = p.replace('<w:t>;</w:t>', '<w:t>.</w:t>')
      return p
    })
    .join('')

  return xml.slice(0, blocos[idx1].start) + novos + xml.slice(blocos[idx3].end)
}

// Substitui as duas ocorrências de [DD/MM/AAAA] no preâmbulo (1ª = início, 2ª = término)
function substituirDatas(xml: string, dInicio: string, dTermino: string): string {
  let n = 0
  return xml.replace(/\[DD\/MM\/AAAA\]/g, () => escXml(n++ === 0 ? dInicio : dTermino))
}

// Substitui os demais tokens [ ... ] com base no mapa de slugs
function substituirGenerico(xml: string, slugMap: Record<string, string>): string {
  return xml.replace(/(<w:t\b[^>]*>)(\[[^[\]]+\])(<\/w:t>)/g, (full, open: string, tok: string, close: string) => {
    const s = slug(tok)
    if (Object.prototype.hasOwnProperty.call(slugMap, s)) return open + escXml(slugMap[s]) + close
    return full
  })
}

function preencherXml(xml: string, dados: DadosContrato): string {
  const slugMap: Record<string, string> = {
    'RAZAO SOCIAL DA CONTRATANTE': dados.razaoSocial,
    CIDADE: dados.cidade,
    UF: dados.uf,
    'ENDERECO COMPLETO LOGRADOURO N COMPLEMENTO E BAIRRO': dados.endereco,
    CEP: dados.cep,
    'CNPJ DA CONTRATANTE': dados.cnpj,
    'INSCRICAO ESTADUAL': dados.inscricaoEstadual,
    'NOME DO REPRESENTANTE LEGAL': dados.repNome,
    NACIONALIDADE: dados.repNacionalidade,
    'ESTADO CIVIL': dados.repEstadoCivil,
    PROFISSAO: dados.repProfissao,
    'RG N E ORGAO EMISSOR UF': dados.repRg,
    CPF: dados.repCpf,
    'CIDADE UF': dados.repCidadeUf,
    'DESCRICAO RESUMIDA DO OBJETO': dados.objetoResumido,
    'MUNICIPIO UF': dados.objetoMunicipioUf,
    'VINCULACAO A PROGRAMA EMPREENDIMENTO BACIA LOTE OU PACOTE SE APLICAVEL': dados.objetoVinculacao,
    'PRAZO DE VIGENCIA POR EXTENSO': dados.prazoExtenso,
    'DATA DE INICIO DA VIGENCIA': dados.dataInicioVig,
    LOCAL: dados.local,
    DIA: dados.dia,
    MES: dados.mes,
    ANO: dados.ano,
  }
  // Ordem importa: primeiro as datas e os tokens do modelo; só depois inserimos o
  // texto do usuário (serviços). Assim, se um serviço contiver um literal como
  // "[DD/MM/AAAA]" ou "[CIDADE]", ele NÃO é re-substituído por engano.
  let out = xml
  out = substituirDatas(out, dados.dataInicioVig, dados.dataTerminoVig)
  out = substituirGenerico(out, slugMap)
  out = expandirServicos(out, dados.servicos)
  out = out.replace(/<w:highlight w:val="yellow"\/>/g, '')
  return out
}

// Gera o arquivo .docx final (bytes) a partir do modelo + dados
export async function gerarContratoDocx(dados: DadosContrato): Promise<ArrayBuffer> {
  const buf = Buffer.from(CONTRATO_TEMPLATE_BASE64, 'base64')
  const zip = await JSZip.loadAsync(buf)
  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('Modelo de contrato inválido: word/document.xml não encontrado.')
  const xml = await docFile.async('string')
  zip.file('word/document.xml', preencherXml(xml, dados))
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}
