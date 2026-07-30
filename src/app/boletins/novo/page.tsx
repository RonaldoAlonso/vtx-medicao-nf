'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Contrato = { id: string; numero: string; obra: string; contratantes: { codigo: string } }
type ItemMedicao = {
  id: string
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

export default function NovoBoletimPage() {
  const router = useRouter()
  const supabase = createClient()

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [itens, setItens] = useState<ItemMedicao[]>([])
  const [carregandoItens, setCarregandoItens] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    contrato_id: '',
    numero_medicao: '',
    data_medicao: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    observacoes: '',
  })

  useEffect(() => {
    // range(0,999) garante que busca todos os contratos sem limite de paginação
    supabase
      .from('contratos')
      .select('id, numero, obra, contratantes(codigo)')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .range(0, 999)
      .then(({ data, error }) => {
        setContratos((data as unknown as Contrato[]) ?? [])
      })
  }, [])

  async function selecionarContrato(contrato_id: string) {
    setCarregandoItens(true)
    setItens([])

    // Próximo número de medição
    const { data: bms } = await supabase
      .from('boletins')
      .select('numero_medicao')
      .eq('contrato_id', contrato_id)
      .order('numero_medicao', { ascending: false })
      .limit(1)
    const proximo = bms && bms.length > 0 ? bms[0].numero_medicao + 1 : 1
    setForm(p => ({ ...p, contrato_id, numero_medicao: String(proximo) }))

    // Itens do contrato
    const { data: its } = await supabase
      .from('contrato_itens')
      .select('*')
      .eq('contrato_id', contrato_id)
      .order('ordem')
      .range(0, 999)

    if (!its || its.length === 0) { setCarregandoItens(false); return }

    // Acumulado anterior de cada item (soma dos boletins anteriores)
    const comAcumulado: ItemMedicao[] = await Promise.all(its.map(async (it) => {
      const { data: medidos } = await supabase
        .from('boletim_itens')
        .select('valor_medido')
        .eq('contrato_item_id', it.id)
      const acumulado = (medidos ?? []).reduce((s: number, m: any) => s + (m.valor_medido ?? 0), 0)
      return {
        id: it.id,
        referencia: it.referencia,
        descricao: it.descricao,
        unidade: it.unidade ?? '',
        quantidade: it.quantidade ?? 0,
        preco_unitario: it.preco_unitario ?? 0,
        subtotal: (it.quantidade ?? 0) * (it.preco_unitario ?? 0),
        acumulado_anterior: acumulado,
        valor_medido: '',
        observacao: '',
      }
    }))

    setItens(comAcumulado)
    setCarregandoItens(false)
  }

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
    if (!form.contrato_id || !form.numero_medicao || !form.data_medicao) {
      alert('Selecione o contrato e preencha a data de medição.')
      return
    }
    setSalvando(true)
    const valorBruto = totalMedicao()
    const { data: boletim, error } = await supabase.from('boletins').insert({
      contrato_id: form.contrato_id,
      numero_medicao: parseInt(form.numero_medicao),
      data_medicao: form.data_medicao,
      data_vencimento: form.data_vencimento || null,
      observacoes: form.observacoes,
      status: 'rascunho',
      valor_bruto: valorBruto,
      valor_retencao: 0,
      valor_liquido: valorBruto,
    }).select().single()

    if (error || !boletim) { alert('Erro ao salvar boletim: ' + error?.message); setSalvando(false); return }

    const itensMedidos = itens.filter(it => parseFloat(it.valor_medido) > 0)
    if (itensMedidos.length > 0) {
      await supabase.from('boletim_itens').insert(
        itensMedidos.map(it => {
          const { qtdMedida, valorMedido, saldo } = calcItem(it)
          return {
            boletim_id: boletim.id,
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
    router.push('/boletins')
  }

  const contrato = contratos.find(c => c.id === form.contrato_id)

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link href="/boletins"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Novo Boletim de Medição</h2>
          <p className="text-gray-500 mt-1">Registre as quantidades medidas no período</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados do Boletim</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Contrato *</Label>
            <Select onValueChange={(v) => selecionarContrato(String(v ?? ''))}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {contrato
                    ? `[${contrato.contratantes?.codigo}] ${contrato.numero} — ${contrato.obra}`
                    : contratos.length === 0 ? 'Carregando contratos...' : 'Selecione o contrato...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {contratos.map(c => (
                  <SelectItem key={c.id} value={c.id} className="whitespace-normal">
                    [{c.contratantes?.codigo}] {c.numero} — {c.obra}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
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
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
          </div>
        </CardContent>
      </Card>

      {carregandoItens && (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando itens do contrato...
        </div>
      )}

      {!carregandoItens && itens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Planilha de Medição — {itens.length} itens
            </CardTitle>
          </CardHeader>
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
                    <th className="p-2 text-center font-semibold text-blue-700 w-36 bg-blue-50">Qtd. Medida</th>
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
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-7 text-xs text-right w-full"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2 text-right font-semibold text-blue-700 bg-blue-50">{moeda(valorMedido)}</td>
                        <td className="p-2 text-right text-blue-600 bg-blue-50">{pct(valorMedido, it.subtotal)}</td>
                        <td className={`p-2 text-right font-medium ${saldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>{moeda(saldo)}</td>
                        <td className="p-2 text-right text-gray-500">{pct(saldo, it.subtotal)}</td>
                        <td className="p-2">
                          <Input
                            value={it.observacao}
                            onChange={e => updateItem(idx, 'observacao', e.target.value)}
                            className="h-7 text-xs w-full"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td colSpan={5} className="p-2 text-sm">TOTAL DA MEDIÇÃO</td>
                    <td className="p-2 text-right text-sm">
                      {moeda(itens.reduce((s, it) => s + it.subtotal, 0))}
                    </td>
                    <td className="p-2 text-right text-sm">
                      {moeda(itens.reduce((s, it) => s + it.acumulado_anterior, 0))}
                    </td>
                    <td></td>
                    <td className="p-2 bg-blue-50"></td>
                    <td className="p-2 text-right text-sm text-blue-700 bg-blue-50">
                      {moeda(totalMedicao())}
                    </td>
                    <td className="p-2 bg-blue-50"></td>
                    <td className="p-2 text-right text-sm">
                      {moeda(itens.reduce((s, it) => s + calcItem(it).saldo, 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!carregandoItens && form.contrato_id && itens.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Este contrato não tem itens cadastrados na planilha orçamentária.{' '}
          <Link href={`/contratos/${form.contrato_id}`} className="underline font-medium">
            Clique aqui para adicionar os itens.
          </Link>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link href="/boletins"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={salvar} disabled={salvando || !form.contrato_id}>
          {salvando ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : 'Salvar Boletim'}
        </Button>
      </div>
    </div>
  )
}
