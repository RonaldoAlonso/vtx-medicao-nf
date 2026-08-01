'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, Receipt, DollarSign, AlertCircle, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const moeda = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const moedaCurta = (v: number) => 'R$ ' + (v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })

const STATUS_BM: Record<string, { label: string; cls: string }> = {
  rascunho:   { label: 'Rascunho',   cls: 'bg-gray-100 text-gray-600' },
  aprovado:   { label: 'Aprovado',   cls: 'bg-blue-100 text-blue-700' },
  nf_emitida: { label: 'NF Emitida', cls: 'bg-green-100 text-green-700' },
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
// 'YYYY-MM' -> 'Agosto/2026'
function labelMesBM(ym: string) {
  const [ano, mes] = ym.split('-')
  return `${MESES_FULL[parseInt(mes, 10) - 1] ?? mes}/${ano}`
}

type BoletimRec = {
  id: string; numero_medicao: number; data_medicao: string; status: string; valor_liquido: number
  contratos: { numero: string; obra: string; contratantes: { codigo: string } }
}
type NotaRec = { valor_servicos: number; status: string; data_vencimento: string | null; data_emissao: string | null }

export default function Dashboard() {
  const supabase = createClient()
  const [carregando, setCarregando] = useState(true)
  const [bmsAbertos, setBmsAbertos] = useState(0)
  const [nfsAguardando, setNfsAguardando] = useState(0)
  const [aReceberMes, setAReceberMes] = useState(0)
  const [nfsVencidas, setNfsVencidas] = useState(0)
  const [todosBoletins, setTodosBoletins] = useState<BoletimRec[]>([])
  const [mesBM, setMesBM] = useState('todos')
  const [grafico, setGrafico] = useState<{ mes: string; valor: number }[]>([])

  useEffect(() => {
    async function carregar() {
      const [{ data: bms }, { data: nfs }] = await Promise.all([
        supabase
          .from('boletins')
          .select('id, numero_medicao, data_medicao, status, valor_liquido, contratos(numero, obra, contratantes(codigo))')
          .order('data_medicao', { ascending: false })
          .range(0, 999),
        supabase
          .from('notas_fiscais')
          .select('valor_servicos, status, data_vencimento, data_emissao')
          .range(0, 999),
      ])

      const boletins = (bms as unknown as BoletimRec[]) ?? []
      const notas = (nfs as unknown as NotaRec[]) ?? []

      const hoje = new Date()
      const anoMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

      // KPIs
      setBmsAbertos(boletins.filter(b => b.status === 'rascunho' || b.status === 'aprovado').length)
      setNfsAguardando(boletins.filter(b => b.status === 'aprovado').length)
      setAReceberMes(
        notas
          .filter(n => n.status !== 'paga' && n.data_vencimento?.startsWith(anoMesAtual))
          .reduce((s, n) => s + (n.valor_servicos ?? 0), 0)
      )
      setNfsVencidas(
        notas.filter(n => n.status !== 'paga' && n.data_vencimento && new Date(n.data_vencimento + 'T23:59:59') < hoje).length
      )

      setTodosBoletins(boletins)

      // Gráfico: previsão de recebimento por mês (vencimento), NFs não pagas
      const porMes = new Map<string, number>()
      notas.forEach(n => {
        if (n.status === 'paga') return
        const ref = n.data_vencimento || n.data_emissao
        if (!ref) return
        const d = new Date(ref + 'T00:00:00')
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        porMes.set(chave, (porMes.get(chave) ?? 0) + (n.valor_servicos ?? 0))
      })
      const dados = Array.from(porMes.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chave, valor]) => {
          const [ano, mes] = chave.split('-')
          return { mes: `${MESES[parseInt(mes) - 1]}/${ano.slice(2)}`, valor }
        })
      setGrafico(dados)

      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando dashboard...</div>
  }

  // Meses disponíveis para filtro do card de boletins
  const mesesBM = Array.from(
    new Set(todosBoletins.map(b => b.data_medicao?.slice(0, 7)).filter(Boolean) as string[])
  ).sort().reverse()

  // 'todos' = os 5 mais recentes; mês específico = todos os boletins daquele mês
  const boletinsExibidos = mesBM === 'todos'
    ? todosBoletins.slice(0, 5)
    : todosBoletins.filter(b => b.data_medicao?.startsWith(mesBM))

  const kpis = [
    { titulo: 'BMs em aberto', valor: String(bmsAbertos), legenda: 'rascunho ou aprovado', Icon: ClipboardList, cor: 'text-blue-500' },
    { titulo: 'NFs aguardando emissão', valor: String(nfsAguardando), legenda: 'BMs aprovados sem NF', Icon: Receipt, cor: 'text-orange-500' },
    { titulo: 'A receber este mês', valor: moeda(aReceberMes), legenda: 'NFs a vencer no mês atual', Icon: DollarSign, cor: 'text-green-500' },
    { titulo: 'NFs vencidas', valor: String(nfsVencidas), legenda: 'não pagas após vencimento', Icon: AlertCircle, cor: 'text-red-500' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Visão geral das medições e notas fiscais</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map(({ titulo, valor, legenda, Icon, cor }) => (
          <Card key={titulo}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{titulo}</CardTitle>
              <Icon className={`w-4 h-4 ${cor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{valor}</div>
              <p className="text-xs text-gray-500 mt-1">{legenda}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">
              {mesBM === 'todos' ? 'Últimos Boletins de Medição' : 'Boletins de Medição'}
            </CardTitle>
            <Select value={mesBM} onValueChange={v => setMesBM(String(v ?? 'todos'))}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {mesesBM.map(m => (
                  <SelectItem key={m} value={m}>{labelMesBM(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {boletinsExibidos.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {mesBM === 'todos' ? (
                  <>Nenhum boletim cadastrado ainda.<br />
                  <Link href="/boletins/novo" className="text-blue-600 hover:underline mt-1 inline-block">Criar primeiro boletim</Link></>
                ) : (
                  <>Nenhum boletim neste mês.</>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {boletinsExibidos.map(b => {
                  const st = STATUS_BM[b.status] ?? STATUS_BM.rascunho
                  return (
                    <Link key={b.id} href={`/boletins/${b.id}`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">BM {b.numero_medicao}</Badge>
                          <span className="text-sm font-medium text-gray-800 truncate">{b.contratos?.obra}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {b.contratos?.contratantes?.codigo} · {new Date(b.data_medicao + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold text-gray-900">{moeda(b.valor_liquido)}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Previsão de Recebimento</CardTitle></CardHeader>
          <CardContent>
            {grafico.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Nenhuma nota fiscal a receber.</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={grafico} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => moedaCurta(Number(v))} width={70} />
                    <Tooltip formatter={(v) => moeda(Number(v))} labelClassName="text-xs" />
                    <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
