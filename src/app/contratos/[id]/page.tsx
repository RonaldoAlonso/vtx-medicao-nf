'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Contratante = { id: string; codigo: string; nome: string }
type Item = { id?: string; referencia: string; descricao: string; unidade: string; quantidade: string; preco_unitario: string; ordem: number }

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function EditarContratoPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [contratantes, setContratantes] = useState<Contratante[]>([])
  const [form, setForm] = useState({
    numero: '', contratante_id: '', obra: '',
    unidade_construtiva: '', valor_total: '',
    data_inicio: '', data_fim: '', ativo: true,
  })
  const [itens, setItens] = useState<Item[]>([])

  useEffect(() => {
    async function carregar() {
      const [{ data: c }, { data: ctrs }, { data: its }] = await Promise.all([
        supabase.from('contratos').select('*').eq('id', id).single(),
        supabase.from('contratantes').select('id, codigo, nome').order('codigo'),
        supabase.from('contrato_itens').select('*').eq('contrato_id', id).order('ordem'),
      ])
      if (c) {
        setForm({
          numero: c.numero ?? '',
          contratante_id: c.contratante_id ?? '',
          obra: c.obra ?? '',
          unidade_construtiva: c.unidade_construtiva ?? '',
          valor_total: String(c.valor_total ?? ''),
          data_inicio: c.data_inicio ?? '',
          data_fim: c.data_fim ?? '',
          ativo: c.ativo ?? true,
        })
      }
      setContratantes(ctrs ?? [])
      setItens((its ?? []).map((it: any) => ({
        id: it.id,
        referencia: it.referencia,
        descricao: it.descricao,
        unidade: it.unidade ?? 'm',
        quantidade: String(it.quantidade ?? ''),
        preco_unitario: String(it.preco_unitario ?? ''),
        ordem: it.ordem,
      })))
      setCarregando(false)
    }
    carregar()
  }, [id])

  function addItem() {
    setItens(prev => [...prev, { referencia: '', descricao: '', unidade: 'm', quantidade: '', preco_unitario: '', ordem: prev.length + 1 }])
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof Item, value: string) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function subtotal(it: Item) {
    const q = parseFloat(it.quantidade) || 0
    const p = parseFloat(it.preco_unitario) || 0
    return moeda(q * p)
  }

  async function salvar() {
    if (!form.numero || !form.contratante_id || !form.obra || !form.valor_total) {
      alert('Preencha os campos obrigatórios.')
      return
    }
    setSalvando(true)
    await supabase.from('contratos').update({
      numero: form.numero,
      contratante_id: form.contratante_id,
      obra: form.obra,
      unidade_construtiva: form.unidade_construtiva,
      valor_total: parseFloat(form.valor_total.replace(',', '.')),
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      ativo: form.ativo,
    }).eq('id', id)

    // Recria os itens
    await supabase.from('contrato_itens').delete().eq('contrato_id', id)
    const itensFiltrados = itens.filter(it => it.referencia && it.descricao)
    if (itensFiltrados.length > 0) {
      await supabase.from('contrato_itens').insert(
        itensFiltrados.map((it, idx) => ({
          contrato_id: id,
          referencia: it.referencia,
          descricao: it.descricao,
          unidade: it.unidade,
          quantidade: parseFloat(it.quantidade) || 0,
          preco_unitario: parseFloat(it.preco_unitario.replace(',', '.')) || 0,
          ordem: idx + 1,
        }))
      )
    }
    router.push('/contratos')
  }

  async function excluir() {
    if (!confirm(`Excluir o contrato ${form.numero}?\n\nIsso também removerá todos os itens vinculados. Esta ação não pode ser desfeita.`)) return
    setExcluindo(true)
    await supabase.from('contrato_itens').delete().eq('contrato_id', id)
    await supabase.from('contratos').delete().eq('id', id)
    router.push('/contratos')
  }

  if (carregando) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...</div>
  }

  const contratanteSelecionado = contratantes.find(c => c.id === form.contratante_id)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/contratos">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Editar Contrato</h2>
          <p className="text-gray-500 mt-1">{form.numero} — {form.obra}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados do Contrato</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1 col-span-1">
              <Label>Número do Contrato *</Label>
              <Input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} />
            </div>
            <div className="space-y-1 col-span-3">
              <Label>Contratante *</Label>
              <Select value={form.contratante_id} onValueChange={(v) => setForm(p => ({ ...p, contratante_id: String(v ?? '') }))}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {contratanteSelecionado ? `[${contratanteSelecionado.codigo}] ${contratanteSelecionado.nome}` : 'Selecione...'}
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
            <Input value={form.obra} onChange={e => setForm(p => ({ ...p, obra: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Unidade Construtiva</Label>
              <Input value={form.unidade_construtiva} onChange={e => setForm(p => ({ ...p, unidade_construtiva: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Valor Total (R$) *</Label>
              <Input value={form.valor_total} onChange={e => setForm(p => ({ ...p, valor_total: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Data de Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Data de Fim</Label>
              <Input type="date" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.ativo ? 'ativo' : 'encerrado'} onValueChange={(v) => setForm(p => ({ ...p, ativo: v === 'ativo' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Planilha Orçamentária</CardTitle>
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
                    <td className="py-1 pr-2"><Input value={it.referencia} onChange={e => updateItem(idx, 'referencia', e.target.value)} className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)} className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={it.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} type="number" className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2"><Input value={it.preco_unitario} onChange={e => updateItem(idx, 'preco_unitario', e.target.value)} type="number" className="h-8 text-xs" /></td>
                    <td className="py-1 pr-2 text-gray-600 font-medium">{subtotal(it)}</td>
                    <td className="py-1">
                      <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 && (
                  <tr><td colSpan={7} className="py-4 text-center text-gray-400 text-xs">Nenhum item. Clique em "Adicionar Item".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="destructive" onClick={excluir} disabled={excluindo}>
          {excluindo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
          Excluir Contrato
        </Button>
        <div className="flex gap-3">
          <Link href="/contratos"><Button variant="outline">Cancelar</Button></Link>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>
    </div>
  )
}
