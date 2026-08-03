'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
// 'YYYY-MM' -> 'Agosto/2026'
function labelMes(ym: string) {
  const [ano, mes] = ym.split('-')
  return `${MESES[parseInt(mes, 10) - 1] ?? mes}/${ano}`
}

type Boletim = {
  id: string
  numero_medicao: number
  data_medicao: string
  data_vencimento: string
  status: string
  valor_liquido: number
  contratos: { numero: string; obra: string; contratantes: { codigo: string } }
}

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho:   { label: 'Rascunho',   cls: 'bg-gray-100 text-gray-600' },
  aprovado:   { label: 'Aprovado',   cls: 'bg-blue-100 text-blue-700' },
  nf_emitida: { label: 'NF Emitida', cls: 'bg-green-100 text-green-700' },
}

function moeda(v: number) {
  return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
}

export default function BoletinsPage() {
  const [boletins, setBoletins] = useState<Boletim[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mesFiltro, setMesFiltro] = useState('todos')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const supabase = createClient()

  async function carregar() {
    const { data } = await supabase
      .from('boletins')
      .select('*, contratos(numero, obra, contratantes(codigo))')
      .order('data_medicao', { ascending: false })
    setBoletins((data as Boletim[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function excluir(id: string, num: number) {
    if (!confirm(`Excluir o Boletim de Medição nº ${num}? Esta ação não pode ser desfeita.`)) return
    await supabase.from('boletim_itens').delete().eq('boletim_id', id)
    await supabase.from('boletins').delete().eq('id', id)
    carregar()
  }

  // Meses disponíveis (a partir da data de medição), mais recentes primeiro
  const mesesDisponiveis = Array.from(
    new Set(boletins.map(b => b.data_medicao?.slice(0, 7)).filter(Boolean) as string[])
  ).sort().reverse()

  const boletinsFiltrados = boletins.filter(b =>
    (mesFiltro === 'todos' || b.data_medicao?.startsWith(mesFiltro)) &&
    (statusFiltro === 'todos' || b.status === statusFiltro)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Boletins de Medição</h2>
          <p className="text-gray-500 mt-1">Controle de todas as medições por contrato</p>
        </div>
        <Link href="/boletins/novo">
          <Button><Plus className="w-4 h-4 mr-2" /> Novo Boletim</Button>
        </Link>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : boletins.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum boletim cadastrado ainda.</p>
          <Link href="/boletins/novo">
            <Button variant="outline" className="mt-4">Criar primeiro boletim</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-500">Filtrar por mês:</span>
            <Select value={mesFiltro} onValueChange={v => setMesFiltro(String(v ?? 'todos'))}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {mesesDisponiveis.map(m => (
                  <SelectItem key={m} value={m}>{labelMes(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">Situação:</span>
            <Select value={statusFiltro} onValueChange={v => setStatusFiltro(String(v ?? 'todos'))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="nf_emitida">NF Emitida</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-400">
              {boletinsFiltrados.length} boletim{boletinsFiltrados.length === 1 ? '' : 's'}
            </span>
          </div>

          {boletinsFiltrados.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">Nenhum boletim com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {boletinsFiltrados.map(b => {
                const st = STATUS[b.status] ?? STATUS.rascunho
            return (
              <Card key={b.id}>
                <CardContent className="flex items-start justify-between pt-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">BM {b.numero_medicao}</Badge>
                      <Badge variant="outline" className="text-xs">{b.contratos?.contratantes?.codigo}</Badge>
                      <Badge variant="outline" className="text-xs">{b.contratos?.numero}</Badge>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{b.contratos?.obra}</p>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>Medição: {new Date(b.data_medicao).toLocaleDateString('pt-BR')}</span>
                      {b.data_vencimento && <span>Vencimento: {new Date(b.data_vencimento).toLocaleDateString('pt-BR')}</span>}
                      <span>Valor: <strong className="text-gray-900">{moeda(b.valor_liquido)}</strong></span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/boletins/${b.id}`}>
                      <Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => excluir(b.id, b.numero_medicao)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
