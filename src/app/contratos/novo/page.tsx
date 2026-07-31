'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Contratante = { id: string; codigo: string; nome: string }
type Item = { referencia: string; descricao: string; unidade: string; quantidade: string; preco_unitario: string; ordem: number }
type Servico = { descricao: string }

export default function NovoContratoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [contratantes, setContratantes] = useState<Contratante[]>([])
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    numero: '',
    contratante_id: '',
    obra: '',
    unidade_construtiva: '',
    valor_total: '',
    data_inicio: '',
    data_fim: '',
    objeto_resumido: '',
    objeto_municipio_uf: '',
    objeto_vinculacao: '',
    prazo_vigencia_extenso: '',
    local_assinatura: '',
    data_assinatura: '',
  })

  const [itens, setItens] = useState<Item[]>([
    { referencia: '', descricao: '', unidade: 'm', quantidade: '', preco_unitario: '', ordem: 1 }
  ])
  const [servicos, setServicos] = useState<Servico[]>([])

  useEffect(() => {
    supabase.from('contratantes').select('id, codigo, nome').order('codigo')
      .then(({ data }) => setContratantes(data ?? []))
  }, [])

  function addItem() {
    setItens(prev => [...prev, { referencia: '', descricao: '', unidade: 'm', quantidade: '', preco_unitario: '', ordem: prev.length + 1 }])
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof Item, value: string) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function addServico() {
    setServicos(prev => [...prev, { descricao: '' }])
  }
  function removeServico(idx: number) {
    setServicos(prev => prev.filter((_, i) => i !== idx))
  }
  function updateServico(idx: number, value: string) {
    setServicos(prev => prev.map((s, i) => i === idx ? { descricao: value } : s))
  }

  function moeda(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function subtotalNum(it: Item) {
    const q = parseFloat(it.quantidade) || 0
    const p = parseFloat(it.preco_unitario) || 0
    return q * p
  }

  function subtotal(it: Item) {
    return moeda(subtotalNum(it))
  }

  // Valor Total = soma apenas dos itens que serão realmente gravados
  // (com referência e descrição), para bater com o total salvo em contrato_itens.
  const valorTotal = itens
    .filter(it => it.referencia && it.descricao)
    .reduce((acc, it) => acc + subtotalNum(it), 0)

  async function salvar() {
    if (!form.numero || !form.contratante_id || !form.obra) {
      alert('Preencha os campos obrigatórios: Número, Contratante e Obra.')
      return
    }
    if (valorTotal <= 0) {
      alert('Adicione ao menos um item com quantidade e preço na planilha orçamentária.')
      return
    }
    setSalvando(true)
    const { data: contrato, error } = await supabase.from('contratos').insert({
      numero: form.numero,
      contratante_id: form.contratante_id,
      obra: form.obra,
      unidade_construtiva: form.unidade_construtiva,
      valor_total: valorTotal,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      objeto_resumido: form.objeto_resumido || null,
      objeto_municipio_uf: form.objeto_municipio_uf || null,
      objeto_vinculacao: form.objeto_vinculacao || null,
      prazo_vigencia_extenso: form.prazo_vigencia_extenso || null,
      local_assinatura: form.local_assinatura || null,
      data_assinatura: form.data_assinatura || null,
    }).select().single()

    if (error || !contrato) { alert('Erro ao salvar contrato.' + (error?.message ? '\n\n' + error.message : '')); setSalvando(false); return }

    const itensFiltrados = itens.filter(it => it.referencia && it.descricao)
    if (itensFiltrados.length > 0) {
      const { error: eItens } = await supabase.from('contrato_itens').insert(
        itensFiltrados.map(it => ({
          contrato_id: contrato.id,
          referencia: it.referencia,
          descricao: it.descricao,
          unidade: it.unidade,
          quantidade: parseFloat(it.quantidade) || 0,
          preco_unitario: parseFloat(it.preco_unitario.replace(',', '.')) || 0,
          ordem: it.ordem,
        }))
      )
      if (eItens) {
        alert('Contrato criado, mas houve um erro ao salvar os itens da planilha. Abra o contrato para revisar.\n\n' + eItens.message)
        router.push(`/contratos/${contrato.id}`)
        return
      }
    }

    const servicosFiltrados = servicos.filter(s => s.descricao.trim())
    if (servicosFiltrados.length > 0) {
      const { error: eServ } = await supabase.from('contrato_servicos').insert(
        servicosFiltrados.map((s, idx) => ({
          contrato_id: contrato.id,
          descricao: s.descricao.trim(),
          ordem: idx + 1,
        }))
      )
      if (eServ) {
        alert('Contrato criado, mas houve um erro ao salvar os serviços. Abra o contrato para revisar.\n\n' + eServ.message)
        router.push(`/contratos/${contrato.id}`)
        return
      }
    }
    router.push('/contratos')
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/contratos">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Novo Contrato</h2>
          <p className="text-gray-500 mt-1">Cadastre o contrato e a planilha orçamentária</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados do Contrato</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1 col-span-1">
              <Label>Número do Contrato *</Label>
              <Input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} placeholder="ex: 293/26" />
            </div>
            <div className="space-y-1 col-span-3">
              <Label>Contratante *</Label>
              <Select onValueChange={(v) => setForm(p => ({ ...p, contratante_id: String(v ?? '') }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o contratante...">
                    {form.contratante_id
                      ? (() => { const c = contratantes.find(c => c.id === form.contratante_id); return c ? `[${c.codigo}] ${c.nome}` : '' })()
                      : 'Selecione o contratante...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-[--radix-select-trigger-width] max-w-2xl">
                  {contratantes.map(c => (
                    <SelectItem key={c.id} value={c.id} className="whitespace-normal">[{c.codigo}] {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Nome da Obra *</Label>
            <Input value={form.obra} onChange={e => setForm(p => ({ ...p, obra: e.target.value }))} placeholder="ex: PACOTE 1A2 INTEGRA TIETÊ - 00.918/24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Unidade Construtiva</Label>
              <Input value={form.unidade_construtiva} onChange={e => setForm(p => ({ ...p, unidade_construtiva: e.target.value }))} placeholder="ex: REDES - 1A2" />
            </div>
            <div className="space-y-1">
              <Label>Valor Total do Contrato (R$)</Label>
              <Input value={moeda(valorTotal)} readOnly tabIndex={-1} className="bg-gray-50 font-semibold text-gray-900 cursor-default" />
              <p className="text-xs text-gray-400">Somatório automático dos itens da planilha orçamentária.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Data de Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Data de Fim</Label>
              <Input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Planilha Orçamentária (Itens do Contrato)</CardTitle>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-left">
                  <th className="pb-2 pr-2 w-24">Referência</th>
                  <th className="pb-2 pr-2">Descrição</th>
                  <th className="pb-2 pr-2 w-16">Un.</th>
                  <th className="pb-2 pr-2 w-24">Qtd.</th>
                  <th className="pb-2 pr-2 w-28">Preço Unit.</th>
                  <th className="pb-2 pr-2 w-28">Subtotal</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itens.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-1 pr-2"><Input value={it.referencia} onChange={e => updateItem(idx, 'referencia', e.target.value)} placeholder="1000001" className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} placeholder="RCE OLARIA" className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)} className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={it.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} type="number" className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={it.preco_unitario} onChange={e => updateItem(idx, 'preco_unitario', e.target.value)} type="number" className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2 text-gray-600 font-medium">{subtotal(it)}</td>
                    <td className="py-1">
                      <Button size="sm" variant="ghost" onClick={() => removeItem(idx)} disabled={itens.length === 1}>
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                  <td colSpan={5} className="py-2 pr-2 text-right">VALOR TOTAL</td>
                  <td className="py-2 pr-2">{moeda(valorTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados para o Contrato (Word)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Objeto — descrição resumida</Label>
            <Textarea value={form.objeto_resumido} onChange={e => setForm(p => ({ ...p, objeto_resumido: e.target.value }))} rows={2} placeholder="ex: serviços de engenharia consultiva para..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Município/UF da obra</Label>
              <Input value={form.objeto_municipio_uf} onChange={e => setForm(p => ({ ...p, objeto_municipio_uf: e.target.value }))} placeholder="ex: Campinas/SP" />
            </div>
            <div className="space-y-1">
              <Label>Prazo de vigência (por extenso)</Label>
              <Input value={form.prazo_vigencia_extenso} onChange={e => setForm(p => ({ ...p, prazo_vigencia_extenso: e.target.value }))} placeholder="ex: 12 (doze) meses" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Vinculação (programa, empreendimento, lote — se aplicável)</Label>
            <Textarea value={form.objeto_vinculacao} onChange={e => setForm(p => ({ ...p, objeto_vinculacao: e.target.value }))} rows={2} placeholder="ex: Programa Integra Tietê, Lote 1A2" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Local da assinatura</Label>
              <Input value={form.local_assinatura} onChange={e => setForm(p => ({ ...p, local_assinatura: e.target.value }))} placeholder="padrão: cidade/UF da contratante" />
            </div>
            <div className="space-y-1">
              <Label>Data da assinatura</Label>
              <Input type="date" value={form.data_assinatura} onChange={e => setForm(p => ({ ...p, data_assinatura: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            As datas de vigência usam "Data de Início" e "Data de Fim" acima. Os dados da empresa e do representante legal vêm do cadastro do <strong>Contratante</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Serviços (Cláusula 1ª do Contrato)</CardTitle>
            <p className="text-xs text-gray-400 mt-1">Aparecem como a), b), c)... no contrato gerado.</p>
          </div>
          <Button size="sm" variant="outline" onClick={addServico}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Serviço
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {servicos.map((s, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="mt-2 text-sm font-semibold text-gray-500 w-6 flex-shrink-0">{String.fromCharCode(97 + idx)})</span>
              <Textarea value={s.descricao} onChange={e => updateServico(idx, e.target.value)} rows={2} className="flex-1" placeholder="Descrição do serviço — escopo e quantitativos" />
              <Button size="sm" variant="ghost" onClick={() => removeServico(idx)} className="flex-shrink-0">
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          ))}
          {servicos.length === 0 && (
            <p className="py-4 text-center text-gray-400 text-xs">Nenhum serviço. Clique em "Adicionar Serviço".</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/contratos"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar Contrato'}
        </Button>
      </div>
    </div>
  )
}
