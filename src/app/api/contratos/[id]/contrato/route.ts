import { createClient } from '@/lib/supabase/server'
import { gerarContratoDocx, type DadosContrato } from '@/lib/contrato/gerar'

export const dynamic = 'force-dynamic'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// 'YYYY-MM-DD' -> 'dd/mm/aaaa'
function dataBr(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()

  const { data: contrato, error } = await supabase
    .from('contratos')
    .select('*, contratantes(*)')
    .eq('id', id)
    .single()

  if (error || !contrato) {
    return new Response('Contrato não encontrado.', { status: 404 })
  }

  const { data: servicosRows } = await supabase
    .from('contrato_servicos')
    .select('descricao, ordem')
    .eq('contrato_id', id)
    .order('ordem')

  const c: Record<string, unknown> = (contrato.contratantes ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (v == null ? '' : String(v))

  // Assinatura: dia / mês por extenso / ano a partir de data_assinatura
  let dia = '', mes = '', ano = ''
  if (contrato.data_assinatura) {
    const [y, m, d] = String(contrato.data_assinatura).split('-')
    if (y && m && d) {
      dia = String(parseInt(d, 10))
      mes = MESES[parseInt(m, 10) - 1] ?? ''
      ano = y
    }
  }

  const localAssinatura =
    str(contrato.local_assinatura) ||
    [str(c.municipio), str(c.uf)].filter(Boolean).join('/')

  const dados: DadosContrato = {
    razaoSocial: str(c.nome),
    cidade: str(c.municipio),
    uf: str(c.uf),
    endereco: str(c.endereco),
    cep: str(c.cep),
    cnpj: str(c.cnpj),
    inscricaoEstadual: str(c.inscricao_estadual),
    repNome: str(c.rep_nome),
    repNacionalidade: str(c.rep_nacionalidade),
    repEstadoCivil: str(c.rep_estado_civil),
    repProfissao: str(c.rep_profissao),
    repRg: str(c.rep_rg),
    repCpf: str(c.rep_cpf),
    repCidadeUf: str(c.rep_cidade_uf),
    objetoResumido: str(contrato.objeto_resumido),
    objetoMunicipioUf: str(contrato.objeto_municipio_uf),
    objetoVinculacao: str(contrato.objeto_vinculacao),
    dataInicioVig: dataBr(contrato.data_inicio as string),
    dataTerminoVig: dataBr(contrato.data_fim as string),
    prazoExtenso: str(contrato.prazo_vigencia_extenso),
    local: localAssinatura,
    dia,
    mes,
    ano,
    servicos: (servicosRows ?? []).map(s => str(s.descricao)).filter(Boolean),
  }

  const bytes = await gerarContratoDocx(dados)

  const nomeArquivo = `Contrato_${str(contrato.numero).replace(/[^\w.-]+/g, '_') || 'sem_numero'}.docx`

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}
