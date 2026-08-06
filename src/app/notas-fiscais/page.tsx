'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Receipt, Plus, FileText, Trash2, Loader2, Pencil } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Nota = {
  id: string
  boletim_id: string
  numero_nf: string
  discriminacao_servicos: string
  valor_servicos: number
  status: string
  data_emissao: string | null
  boletins: { numero_medicao: number; contratos: { numero: string; obra: string; contratantes: { codigo: string; nome: string } } }
}

type BoletimOpc = {
  id: string
  numero_medicao: number
  valor_liquido: number
  contratos: { numero: string; obra: string; contratantes: { codigo: string } }
}

const STATUS: Record<string, { label: string; cls: string }> = {
  aguardando: { label: 'Aguardando', cls: 'bg-amber-100 text-amber-700' },
  emitida:    { label: 'Emitida',    cls: 'bg-blue-100 text-blue-700' },
  recebida:   { label: 'Recebida',   cls: 'bg-teal-100 text-teal-700' },
  paga:       { label: 'Paga',       cls: 'bg-green-100 text-green-700' },
}

// Ordem dos status para o seletor de cada nota e para o filtro
const STATUS_ORDEM = ['aguardando', 'emitida', 'recebida', 'paga']

const moeda = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function NotasFiscaisPage() {
  const supabase = createClient()
  const [notas, setNotas] = useState<Nota[]>([])
  const [boletins, setBoletins] = useState<BoletimOpc[]>([])
  const [carregando, setCarregando] = useState(true)
  const [open, setOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [contratanteFiltro, setContratanteFiltro] = useState('todos')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState({ boletim_id: '', numero_nf: '', discriminacao_servicos: '', valor_servicos: '', data_emissao: new Date().toISOString().split('T')[0] })

  async function carregar() {
    const [{ data: nfs }, { data: bms }] = await Promise.all([
      supabase
        .from('notas_fiscais')
        .select('id, boletim_id, numero_nf, discriminacao_servicos, valor_servicos, status, data_emissao, boletins(numero_medicao, contratos(numero, obra, contratantes(codigo, nome)))')
        .order('data_emissao', { ascending: false }),
      supabase
        .from('boletins')
        .select('id, numero_medicao, valor_liquido, contratos(numero, obra, contratantes(codigo))')
        .order('data_medicao', { ascending: false })
        .range(0, 999),
    ])
    setNotas((nfs as unknown as Nota[]) ?? [])
    setBoletins((bms as unknown as BoletimOpc[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  function selecionarBoletim(boletim_id: string) {
    const b = boletins.find(x => x.id === boletim_id)
    if (!b) { setForm(p => ({ ...p, boletim_id })); return }
    const num = String(b.numero_medicao).padStart(2, '0')
    setForm(p => ({
      ...p,
      boletim_id,
      valor_servicos: String(b.valor_liquido ?? ''),
      discriminacao_servicos: p.discriminacao_servicos || `Referente ao BM ${num} - ${b.contratos?.obra ?? ''}`,
    }))
  }

  function resetForm() {
    setForm({ boletim_id: '', numero_nf: '', discriminacao_servicos: '', valor_servicos: '', data_emissao: new Date().toISOString().split('T')[0] })
  }

  function abrirNovo() {
    setEditandoId(null)
    resetForm()
    setOpen(true)
  }

  function abrirEdicao(n: Nota) {
    setEditandoId(n.id)
    setForm({
      boletim_id: n.boletim_id ?? '',
      numero_nf: n.numero_nf ?? '',
      discriminacao_servicos: n.discriminacao_servicos ?? '',
      valor_servicos: String(n.valor_servicos ?? ''),
      data_emissao: n.data_emissao ?? '',
    })
    setOpen(true)
  }

  async function salvar() {
    if (!form.boletim_id || !form.numero_nf) {
      alert('Selecione o boletim e informe o número da NF.')
      return
    }
    setSalvando(true)
    const dados = {
      boletim_id: form.boletim_id,
      numero_nf: form.numero_nf,
      discriminacao_servicos: form.discriminacao_servicos,
      valor_servicos: parseFloat(String(form.valor_servicos).replace(',', '.')) || 0,
      data_emissao: form.data_emissao || null,
    }
    if (editandoId) {
      const { error } = await supabase.from('notas_fiscais').update(dados).eq('id', editandoId)
      if (error) { alert('Erro ao salvar a nota fiscal.\n\n' + error.message); setSalvando(false); return }
    } else {
      const { error } = await supabase.from('notas_fiscais').insert({ ...dados, status: 'emitida' })
      if (error) { alert('Erro ao emitir a nota fiscal.\n\n' + error.message); setSalvando(false); return }
      // marca o boletim como NF emitida (só na emissão)
      await supabase.from('boletins').update({ status: 'nf_emitida' }).eq('id', form.boletim_id)
    }
    setSalvando(false)
    setOpen(false)
    setEditandoId(null)
    resetForm()
    carregar()
  }

  async function excluir(id: string, num: string) {
    if (!confirm(`Excluir a Nota Fiscal ${num}?`)) return
    await supabase.from('notas_fiscais').delete().eq('id', id)
    carregar()
  }

  async function atualizarStatus(id: string, novo: string) {
    // atualiza na tela imediatamente e grava no banco
    setNotas(prev => prev.map(n => n.id === id ? { ...n, status: novo } : n))
    const { error } = await supabase.from('notas_fiscais').update({ status: novo }).eq('id', id)
    if (error) { alert('Não foi possível salvar a situação da NF.\n\n' + error.message); carregar() }
  }

  // Número da NF como valor numérico (ex: "072" -> 72) para ordenar corretamente
  const numeroNf = (s: string) => {
    const n = parseInt(String(s ?? '').replace(/\D/g, ''), 10)
    return Number.isNaN(n) ? Infinity : n
  }

  // Contratantes que aparecem nas notas (código -> nome), ordenados por código
  const contratantesDisponiveis = Array.from(
    notas.reduce((mapa, n) => {
      const c = n.boletins?.contratos?.contratantes
      if (c?.codigo) mapa.set(c.codigo, c.nome ?? c.codigo)
      return mapa
    }, new Map<string, string>())
  ).sort(([a], [b]) => a.localeCompare(b))

  const notasFiltradas = notas
    .filter(n =>
      (statusFiltro === 'todos' || n.status === statusFiltro) &&
      (contratanteFiltro === 'todos' || n.boletins?.contratos?.contratantes?.codigo === contratanteFiltro)
    )
    .slice()
    .sort((a, b) => numeroNf(a.numero_nf) - numeroNf(b.numero_nf) || String(a.numero_nf).localeCompare(String(b.numero_nf)))

  const boletimSel = boletins.find(b => b.id === form.boletim_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notas Fiscais</h2>
          <p className="text-gray-500 mt-1">Emissão de NFS-e a partir dos boletins de medição</p>
        </div>
        <Button onClick={abrirNovo}><Plus className="w-4 h-4 mr-2" /> Emitir NF de um Boletim</Button>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...</div>
      ) : notas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhuma nota fiscal emitida ainda.</p>
          <p className="text-sm mt-2">Clique em "Emitir NF de um Boletim" para gerar a primeira.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-500">Situação:</span>
            <Select value={statusFiltro} onValueChange={v => setStatusFiltro(String(v ?? 'todos'))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {STATUS_ORDEM.map(s => (
                  <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">Cliente:</span>
            <Select value={contratanteFiltro} onValueChange={v => setContratanteFiltro(String(v ?? 'todos'))}>
              <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
              <SelectContent className="max-w-[24rem]">
                <SelectItem value="todos">Todos</SelectItem>
                {contratantesDisponiveis.map(([codigo, nome]) => (
                  <SelectItem key={codigo} value={codigo} className="whitespace-normal">[{codigo}] {nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-400">
              {notasFiltradas.length} nota{notasFiltradas.length === 1 ? '' : 's'}
            </span>
          </div>

          {notasFiltradas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">Nenhuma nota com essa situação.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {notasFiltradas.map(n => {
                const st = STATUS[n.status] ?? STATUS.aguardando
                return (
                  <Card key={n.id}>
                <CardContent className="flex items-start justify-between pt-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">NF {n.numero_nf}</Badge>
                      <Badge variant="outline" className="text-xs">{n.boletins?.contratos?.contratantes?.codigo}</Badge>
                      <Badge variant="outline" className="text-xs">BM {n.boletins?.numero_medicao}</Badge>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{n.boletins?.contratos?.obra}</p>
                    <p className="text-sm text-gray-500">{n.discriminacao_servicos}</p>
                    <p className="text-sm">Valor: <strong className="text-gray-900">{moeda(n.valor_servicos)}</strong></p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Select value={n.status} onValueChange={v => atualizarStatus(n.id, String(v ?? n.status))}>
                      <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDEM.map(s => (
                          <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(n)}>
                        <Pencil className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Link href={`/notas-fiscais/${n.id}`}>
                        <Button size="sm" variant="outline"><FileText className="w-4 h-4 mr-1" /> Plotar relatório</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => excluir(n.id, n.numero_nf)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Dialog: emitir NF a partir de um boletim */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditandoId(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editandoId ? 'Editar Nota Fiscal' : 'Emitir Nota Fiscal de um Boletim'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Boletim de Medição *</Label>
              <Select value={form.boletim_id} onValueChange={(v) => selecionarBoletim(String(v ?? ''))}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {boletimSel
                      ? `[${boletimSel.contratos?.contratantes?.codigo}] BM ${boletimSel.numero_medicao} — ${boletimSel.contratos?.obra}`
                      : boletins.length === 0 ? 'Nenhum boletim disponível' : 'Selecione o boletim...'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {boletins.map(b => (
                    <SelectItem key={b.id} value={b.id} className="whitespace-normal">
                      [{b.contratos?.contratantes?.codigo}] BM {b.numero_medicao} — {b.contratos?.obra} ({moeda(b.valor_liquido)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Nº da NF *</Label>
                <Input value={form.numero_nf} onChange={e => setForm(p => ({ ...p, numero_nf: e.target.value }))} placeholder="ex: 072" />
              </div>
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input value={form.valor_servicos} onChange={e => setForm(p => ({ ...p, valor_servicos: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data de Emissão</Label>
                <Input type="date" value={form.data_emissao} onChange={e => setForm(p => ({ ...p, data_emissao: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Discriminação dos Serviços</Label>
              <Textarea value={form.discriminacao_servicos} onChange={e => setForm(p => ({ ...p, discriminacao_servicos: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || !form.boletim_id}>
              {salvando
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</>
                : editandoId ? 'Salvar Alterações' : 'Emitir NF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
