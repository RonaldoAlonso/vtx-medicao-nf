'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, Printer, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Contrato = { id: string; numero: string; obra: string; unidade_construtiva: string; contratantes: { codigo: string; nome: string; cnpj: string } }
type ItemMedicao = {
  id: string            // contrato_item_id
  referencia: string
  descricao: string
  unidade: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  acumulado_anterior: number
  valor_medido: string  // entrada do usuário (quantidade medida)
  observacao: string
}

const pct = (v: number, total: number) => total > 0 ? `${(v / total * 100).toFixed(1)}%` : '0%'
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function EditarBoletimPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [itens, setItens] = useState<ItemMedicao[]>([])
  const [form, setForm] = useState({
    numero_medicao: '',
    data_medicao: '',
    data_vencimento: '',
    status: 'rascunho',
    observacoes: '',
  })

  useEffect(() => {
    async function carregar() {
      // Boletim + contrato + contratante
      const { data: bm } = await supabase
        .from('boletins')
        .select('*, contratos(id, numero, obra, unidade_construtiva, contratantes(codigo, nome, cnpj))')
        .eq('id', id)
        .single()

      if (!bm) { setCarregando(false); return }

      setContrato(bm.contratos as unknown as Contrato)
      setForm({
        numero_medicao: String(bm.numero_medicao ?? ''),
        data_medicao: bm.data_medicao ?? '',
        data_vencimento: bm.data_vencimento ?? '',
        status: bm.status ?? 'rascunho',
        observacoes: bm.observacoes ?? '',
      })

      const contratoId = (bm.contratos as any)?.id

      // Itens do contrato
      const { data: its } = await supabase
        .from('contrato_itens')
        .select('*')
        .eq('contrato_id', contratoId)
        .order('ordem')
        .range(0, 999)

      // Itens já medidos NESTE boletim (para pré-preencher as quantidades)
      const { data: medidosNeste } = await supabase
        .from('boletim_itens')
        .select('*')
        .eq('boletim_id', id)

      const mapMedido = new Map<string, any>()
      ;(medidosNeste ?? []).forEach(m => { if (m.contrato_item_id) mapMedido.set(m.contrato_item_id, m) })

      const linhas: ItemMedicao[] = await Promise.all((its ?? []).map(async (it) => {
        // Acumulado anterior = soma das medições de OUTROS boletins (exclui o atual)
        const { data: outros } = await supabase
          .from('boletim_itens')
          .select('valor_medido, boletim_id')
          .eq('contrato_item_id', it.id)
          .neq('boletim_id', id)
        const acumulado = (outros ?? []).reduce((s: number, m: any) => s + (m.valor_medido ?? 0), 0)

        const salvo = mapMedido.get(it.id)
        const qtdMedida = salvo && it.preco_unitario
          ? (salvo.valor_medido ?? 0) / it.preco_unitario
          : 0

        return {
          id: it.id,
          referencia: it.referencia,
          descricao: it.descricao,
          unidade: it.unidade ?? '',
          quantidade: it.quantidade ?? 0,
          preco_unitario: it.preco_unitario ?? 0,
          subtotal: (it.quantidade ?? 0) * (it.preco_unitario ?? 0),
          acumulado_anterior: acumulado,
          valor_medido: qtdMedida ? String(qtdMedida) : '',
          observacao: salvo?.observacao ?? '',
        }
      }))

      setItens(linhas)
      setCarregando(false)
    }
    carregar()
  }, [id])

  function updateItem(idx: number, field: 'valor_medido' | 'observacao', value: string) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function calcItem(it: ItemMedicao) {
    const qtdMedida = parseFloat(it.valor_medido) || 0
    const valorMedido = qtdMedida * it.preco_unitario
    const saldo = it.subtotal - it.acumulado_anterior - valorMedido
    return { qtdMedida, valorMedido, saldo }
  }

  function totalMedicao() {
    return itens.reduce((s, it) => s + calcItem(it).valorMedido, 0)
  }

  async function salvar() {
    if (!form.numero_medicao || !form.data_medicao) {
      alert('Preencha o número e a data da medição.')
      return
    }
    setSalvando(true)
    const valorBruto = totalMedicao()

    await supabase.from('boletins').update({
      numero_medicao: parseInt(form.numero_medicao),
      data_medicao: form.data_medicao,
      data_vencimento: form.data_vencimento || null,
      status: form.status,
      observacoes: form.observacoes,
      valor_bruto: valorBruto,
      valor_retencao: 0,
      valor_liquido: valorBruto,
    }).eq('id', id)

    // Recria os itens medidos deste boletim
    await supabase.from('boletim_itens').delete().eq('boletim_id', id)
    const itensMedidos = itens.filter(it => parseFloat(it.valor_medido) > 0)
    if (itensMedidos.length > 0) {
      await supabase.from('boletim_itens').insert(
        itensMedidos.map(it => {
          const { valorMedido, saldo } = calcItem(it)
          return {
            boletim_id: id,
            contrato_item_id: it.id,
            referencia: it.referencia,
            descricao: it.descricao,
            unidade: it.unidade,
            quantidade_contratada: it.quantidade,
            preco_unitario: it.preco_unitario,
            subtotal: it.subtotal,
            acumulado_anterior: it.acumulado_anterior,
            perc_acumulado_anterior: it.subtotal > 0 ? it.acumulado_anterior / it.subtotal : 0,
            valor_medido: valorMedido,
            perc_atual: it.subtotal > 0 ? valorMedido / it.subtotal : 0,
            saldo,
            perc_saldo: it.subtotal > 0 ? saldo / it.subtotal : 0,
            observacao: it.observacao,
          }
        })
      )
    }
    setSalvando(false)
    router.push('/boletins')
  }

  function plotar() {
    window.print()
  }

  if (carregando) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...</div>
  }

  if (!contrato) {
    return (
      <div className="space-y-4">
        <Link href="/boletins"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button></Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Boletim não encontrado.
        </div>
      </div>
    )
  }

  const dataMedFmt = form.data_medicao ? new Date(form.data_medicao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  const totalContrato = itens.reduce((s, it) => s + it.subtotal, 0)
  const totalAcum = itens.reduce((s, it) => s + it.acumulado_anterior, 0)
  const totalSaldo = itens.reduce((s, it) => s + calcItem(it).saldo, 0)

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Estilo de impressão: na impressão mostra só a folha do BM */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #folha-bm, #folha-bm * { visibility: visible; }
          #folha-bm { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>

      {/* ===== Tela de edição (não aparece na impressão) ===== */}
      <div className="no-print space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/boletins"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Editar Boletim de Medição</h2>
              <p className="text-gray-500 mt-1">[{contrato.contratantes?.codigo}] {contrato.numero} — {contrato.obra}</p>
            </div>
          </div>
          <Button variant="outline" onClick={plotar}>
            <Printer className="w-4 h-4 mr-2" /> Plotar BM
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Boletim</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Nº da Medição *</Label>
                <Input value={form.numero_medicao} onChange={e => setForm(p => ({ ...p, numero_medicao: e.target.value }))} type="number" min={1} />
              </div>
              <div className="space-y-1">
                <Label>Data da Medição *</Label>
                <Input type="date" value={form.data_medicao} onChange={e => setForm(p => ({ ...p, data_medicao: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data de Vencimento</Label>
                <Input type="date" value={form.data_vencimento} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: String(v ?? 'rascunho') }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="nf_emitida">NF Emitida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
            </div>
          </CardContent>
        </Card>

        {itens.length > 0 ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Planilha de Medição — {itens.length} itens</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                      <th className="p-2 text-left font-semibold text-gray-600 w-20">Ref.</th>
                      <th className="p-2 text-left font-semibold text-gray-600">Descrição</th>
                      <th className="p-2 text-center font-semibold text-gray-600 w-10">Un.</th>
                      <th className="p-2 text-right font-semibold text-gray-600 w-20">Qtd. Contr.</th>
                      <th className="p-2 text-right font-semibold text-gray-600 w-24">Preço Unit.</th>
                      <th className="p-2 text-right font-semibold text-gray-600 w-28">Sub-Total</th>
                      <th className="p-2 text-right font-semibold text-gray-600 w-28">Acum. Ant. (R$)</th>
                      <th className="p-2 text-right font-semibold text-gray-600 w-16">% Acum.</th>
                      <th className="p-2 text-center font-semibold text-blue-700 w-24 bg-blue-50">Qtd. Medida</th>
                      <th className="p-2 text-right font-semibold text-blue-700 w-28 bg-blue-50">Valor Medido</th>
                      <th className="p-2 text-right font-semibold text-blue-700 w-16 bg-blue-50">% Atual</th>
                      <th className="p-2 text-right font-semibold text-gray-600 w-28">Saldo (R$)</th>
                      <th className="p-2 text-right font-semibold text-gray-600 w-16">% Saldo</th>
                      <th className="p-2 text-left font-semibold text-gray-600 w-28">Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itens.map((it, idx) => {
                      const { valorMedido, saldo } = calcItem(it)
                      return (
                        <tr key={it.id} className="hover:bg-gray-50">
                          <td className="p-2 text-gray-500">{it.referencia}</td>
                          <td className="p-2 font-medium">{it.descricao}</td>
                          <td className="p-2 text-center text-gray-500">{it.unidade}</td>
                          <td className="p-2 text-right text-gray-600">{it.quantidade}</td>
                          <td className="p-2 text-right text-gray-600">{moeda(it.preco_unitario)}</td>
                          <td className="p-2 text-right font-medium">{moeda(it.subtotal)}</td>
                          <td className="p-2 text-right text-gray-600">{moeda(it.acumulado_anterior)}</td>
                          <td className="p-2 text-right text-gray-500">{pct(it.acumulado_anterior, it.subtotal)}</td>
                          <td className="p-2 bg-blue-50">
                            <Input
                              value={it.valor_medido}
                              onChange={e => updateItem(idx, 'valor_medido', e.target.value)}
                              type="number" min={0} step="0.01"
                              className="h-7 text-xs text-right w-full" placeholder="0"
                            />
                          </td>
                          <td className="p-2 text-right font-semibold text-blue-700 bg-blue-50">{moeda(valorMedido)}</td>
                          <td className="p-2 text-right text-blue-600 bg-blue-50">{pct(valorMedido, it.subtotal)}</td>
                          <td className={`p-2 text-right font-medium ${saldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>{moeda(saldo)}</td>
                          <td className="p-2 text-right text-gray-500">{pct(saldo, it.subtotal)}</td>
                          <td className="p-2">
                            <Input value={it.observacao} onChange={e => updateItem(idx, 'observacao', e.target.value)} className="h-7 text-xs w-full" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <td colSpan={5} className="p-2 text-sm">TOTAL DA MEDIÇÃO</td>
                      <td className="p-2 text-right text-sm">{moeda(totalContrato)}</td>
                      <td className="p-2 text-right text-sm">{moeda(totalAcum)}</td>
                      <td></td>
                      <td className="p-2 bg-blue-50"></td>
                      <td className="p-2 text-right text-sm text-blue-700 bg-blue-50">{moeda(totalMedicao())}</td>
                      <td className="p-2 bg-blue-50"></td>
                      <td className="p-2 text-right text-sm">{moeda(totalSaldo)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Este contrato não tem itens cadastrados na planilha orçamentária.
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={plotar}>
            <Printer className="w-4 h-4 mr-2" /> Plotar BM
          </Button>
          <div className="flex gap-3">
            <Link href="/boletins"><Button variant="outline">Cancelar</Button></Link>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>

      {/* ===== Folha do BM para impressão / PDF ===== */}
      <div id="folha-bm" className="hidden print:block text-[10px] text-black">
        <div className="text-center mb-3">
          <h1 className="text-base font-bold">BOLETIM DE MEDIÇÃO Nº {form.numero_medicao}</h1>
          <p>{contrato.obra}</p>
        </div>
        <table className="w-full mb-3 border border-black border-collapse">
          <tbody>
            <tr>
              <td className="border border-black p-1"><strong>Contratante:</strong> [{contrato.contratantes?.codigo}] {contrato.contratantes?.nome}</td>
              <td className="border border-black p-1"><strong>CNPJ:</strong> {contrato.contratantes?.cnpj}</td>
            </tr>
            <tr>
              <td className="border border-black p-1"><strong>Contrato:</strong> {contrato.numero}</td>
              <td className="border border-black p-1"><strong>Data da Medição:</strong> {dataMedFmt}</td>
            </tr>
          </tbody>
        </table>
        <table className="w-full border border-black border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-1">Ref.</th>
              <th className="border border-black p-1 text-left">Descrição</th>
              <th className="border border-black p-1">Un.</th>
              <th className="border border-black p-1">Qtd. Contr.</th>
              <th className="border border-black p-1">Preço Unit.</th>
              <th className="border border-black p-1">Sub-Total</th>
              <th className="border border-black p-1">Acum. Ant.</th>
              <th className="border border-black p-1">Qtd. Medida</th>
              <th className="border border-black p-1">Valor Medido</th>
              <th className="border border-black p-1">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => {
              const { qtdMedida, valorMedido, saldo } = calcItem(it)
              return (
                <tr key={it.id}>
                  <td className="border border-black p-1">{it.referencia}</td>
                  <td className="border border-black p-1 text-left">{it.descricao}</td>
                  <td className="border border-black p-1 text-center">{it.unidade}</td>
                  <td className="border border-black p-1 text-right">{it.quantidade}</td>
                  <td className="border border-black p-1 text-right">{moeda(it.preco_unitario)}</td>
                  <td className="border border-black p-1 text-right">{moeda(it.subtotal)}</td>
                  <td className="border border-black p-1 text-right">{moeda(it.acumulado_anterior)}</td>
                  <td className="border border-black p-1 text-right">{qtdMedida}</td>
                  <td className="border border-black p-1 text-right">{moeda(valorMedido)}</td>
                  <td className="border border-black p-1 text-right">{moeda(saldo)}</td>
                </tr>
              )
            })}
            <tr className="font-bold bg-gray-100">
              <td className="border border-black p-1 text-right" colSpan={5}>TOTAL DA MEDIÇÃO</td>
              <td className="border border-black p-1 text-right">{moeda(totalContrato)}</td>
              <td className="border border-black p-1 text-right">{moeda(totalAcum)}</td>
              <td className="border border-black p-1"></td>
              <td className="border border-black p-1 text-right">{moeda(totalMedicao())}</td>
              <td className="border border-black p-1 text-right">{moeda(totalSaldo)}</td>
            </tr>
          </tbody>
        </table>
        {form.observacoes && (
          <p className="mt-3"><strong>Observações:</strong> {form.observacoes}</p>
        )}
        <div className="flex justify-around mt-12">
          <div className="text-center border-t border-black pt-1 w-60">Responsável Técnico</div>
          <div className="text-center border-t border-black pt-1 w-60">Contratante</div>
        </div>
      </div>
    </div>
  )
}
