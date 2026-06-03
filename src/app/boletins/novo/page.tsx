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
type ContratoItem = { id: string; referencia: string; descricao: string; unidade: string; quantidade: number; preco_unitario: number; subtotal: number }
type ItemMedicao = ContratoItem & { acumulado_anterior: string; valor_medido: string; observacao: string }

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function NovoBoletimPage() {
  const router = useRouter()
  const supabase = createClient()

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [itensContrato, setItensContrato] = useState<ItemMedicao[]>([])
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    contrato_id: '',
    numero_medicao: '',
    data_medicao: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    observacoes: '',
  })

  useEffect(() => {
    supabase.from('contratos').select('id, numero, obra, contratantes(codigo)').order('created_at', { ascending: false })
      .then(({ data }) => setContratos((data as unknown as Contrato[]) ?? []))
  }, [])

  async function selecionarContrato(contrato_id: string) {
    setForm(p => ({ ...p, contrato_id }))
    // Busca o próximo número de medição
    const { data: bms } = await supabase.from('boletins').select('numero_medicao').eq('contrato_id', contrato_id).order('numero_medicao', { ascending: false }).limit(1)
    const proximo = bms && bms.length > 0 ? bms[0].numero_medicao + 1 : 1
    setForm(p => ({ ...p, contrato_id, numero_medicao: String(proximo) }))
    // Carrega os itens do contrato com acumulado anterior
    const { data: its } = await supabase.from('contrato_itens').select('*').eq('contrato_id', contrato_id).order('ordem')
    if (!its) return
    // Para cada item, busca o acumulado anterior
    const itemsComAcumulado: ItemMedicao[] = await Promise.all(its.map(async (it) => {
      const { data: medidos } = await supabase.from('boletim_itens').select('valor_medido, boletins!inner(contrato_id)').eq('contrato_item_id', it.id)
      const acumulado = (medidos ?? []).reduce((s: number, m: any) => s + (m.valor_medido ?? 0), 0)
      return { ...it, acumulado_anterior: String(acumulado), valor_medido: '0', observacao: '' }
    }))
    setItensContrato(itemsComAcumulado)
  }

  function updateItem(idx: number, field: 'valor_medido' | 'observacao', value: string) {
    setItensContrato(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function totalMedicao() {
    return itensContrato.reduce((s, it) => s + (parseFloat(it.valor_medido) || 0) * it.preco_unitario, 0)
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

    if (error || !boletim) { alert('Erro ao salvar boletim.'); setSalvando(false); return }

    const itensFiltrados = itensContrato.filter(it => parseFloat(it.valor_medido) > 0)
    if (itensFiltrados.length > 0) {
      const acumAnteriorTotal = itensContrato.reduce((s, it) => s + parseFloat(it.acumulado_anterior || '0'), 0)
      await supabase.from('boletim_itens').insert(itensFiltrados.map(it => {
        const qtdMedida = parseFloat(it.valor_medido) || 0
        const valorMedido = qtdMedida * it.preco_unitario
        const acumAnt = parseFloat(it.acumulado_anterior) || 0
        const saldo = it.subtotal - acumAnt - valorMedido
        return {
          boletim_id: boletim.id,
          contrato_item_id: it.id,
          referencia: it.referencia,
          descricao: it.descricao,
          unidade: it.unidade,
          quantidade_contratada: it.quantidade,
          preco_unitario: it.preco_unitario,
          subtotal: it.subtotal,
          acumulado_anterior: acumAnt,
          perc_acumulado_anterior: it.subtotal > 0 ? acumAnt / it.subtotal : 0,
          valor_medido: valorMedido,
          perc_atual: it.subtotal > 0 ? valorMedido / it.subtotal : 0,
          saldo,
          perc_saldo: it.subtotal > 0 ? saldo / it.subtotal : 0,
          observacao: it.observacao,
        }
      }))
    }
    router.push('/boletins')
  }

  const contrato = contratos.find(c => c.id === form.contrato_id)

  return (
    <div className="space-y-6 max-w-5xl">
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
                  {contrato ? `[${contrato.contratantes?.codigo}] ${contrato.numero} — ${contrato.obra}` : 'Selecione o contrato...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
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

      {itensContrato.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Quantidades Medidas</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-left text-xs">
                    <th className="pb-2 pr-2">Ref.</th>
                    <th className="pb-2 pr-2">Descrição</th>
                    <th className="pb-2 pr-2 w-12">Un.</th>
                    <th className="pb-2 pr-2 w-24 text-right">Contratado</th>
                    <th className="pb-2 pr-2 w-28 text-right">Acum. Ant.</th>
                    <th className="pb-2 pr-2 w-28">Qtd. Medida</th>
                    <th className="pb-2 pr-2 w-28 text-right">Valor Medido</th>
                    <th className="pb-2 w-32">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itensContrato.map((it, idx) => {
                    const qtd = parseFloat(it.valor_medido) || 0
                    const valorMedido = qtd * it.preco_unitario
                    return (
                      <tr key={it.id}>
                        <td className="py-1 pr-2 text-xs text-gray-500">{it.referencia}</td>
                        <td className="py-1 pr-2 text-xs">{it.descricao}</td>
                        <td className="py-1 pr-2 text-xs text-gray-500">{it.unidade}</td>
                        <td className="py-1 pr-2 text-xs text-right text-gray-500">{it.quantidade}</td>
                        <td className="py-1 pr-2 text-xs text-right text-gray-500">{moeda(parseFloat(it.acumulado_anterior) || 0)}</td>
                        <td className="py-1 pr-2">
                          <Input value={it.valor_medido} onChange={e => updateItem(idx, 'valor_medido', e.target.value)} type="number" min={0} className="h-7 text-xs w-24" />
                        </td>
                        <td className="py-1 pr-2 text-xs text-right font-medium">{moeda(valorMedido)}</td>
                        <td className="py-1">
                          <Input value={it.observacao} onChange={e => updateItem(idx, 'observacao', e.target.value)} className="h-7 text-xs" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={6} className="pt-2 text-sm">Total da Medição</td>
                    <td className="pt-2 text-sm text-right">{moeda(totalMedicao())}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {form.contrato_id && itensContrato.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Este contrato não tem itens cadastrados na planilha orçamentária. Edite o contrato e adicione os itens primeiro.
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
