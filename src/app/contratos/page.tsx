'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Contrato = {
  id: string
  numero: string
  obra: string
  unidade_construtiva: string
  valor_total: number
  data_inicio: string
  data_fim: string
  ativo: boolean
  contratantes: { codigo: string; nome: string }
}

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'ativos' | 'encerrados'>('ativos')
  const supabase = createClient()

  async function carregar() {
    const { data } = await supabase
      .from('contratos')
      .select('*, contratantes(codigo, nome)')
      .order('created_at', { ascending: false })
    setContratos((data as Contrato[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function excluir(id: string, numero: string) {
    if (!confirm(`Excluir o contrato ${numero}?\n\nIsso também removerá todos os itens vinculados. Esta ação não pode ser desfeita.`)) return
    await supabase.from('contrato_itens').delete().eq('contrato_id', id)
    await supabase.from('contratos').delete().eq('id', id)
    carregar()
  }

  const ativos = contratos.filter(c => c.ativo)
  const encerrados = contratos.filter(c => !c.ativo)
  const lista = aba === 'ativos' ? ativos : encerrados

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contratos</h2>
          <p className="text-gray-500 mt-1">Contratos de prestação de serviço</p>
        </div>
        <Link href="/contratos/novo">
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Novo Contrato
          </Button>
        </Link>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : contratos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Nenhum contrato cadastrado ainda.</p>
          <Link href="/contratos/novo">
            <Button variant="outline" className="mt-4">Cadastrar primeiro contrato</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setAba('ativos')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                aba === 'ativos'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Ativos ({ativos.length})
            </button>
            <button
              onClick={() => setAba('encerrados')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                aba === 'encerrados'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Encerrados ({encerrados.length})
            </button>
          </div>

          {lista.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">
                {aba === 'ativos' ? 'Nenhum contrato ativo.' : 'Nenhum contrato encerrado.'}
              </p>
            </div>
          ) : (
        <div className="grid gap-4">
          {lista.map(c => (
            <Card key={c.id}>
              <CardContent className="flex items-start justify-between pt-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-xs">{c.numero}</Badge>
                    <Badge variant="outline" className="text-xs">{c.contratantes?.codigo}</Badge>
                    <Badge className={c.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {c.ativo ? 'Ativo' : 'Encerrado'}
                    </Badge>
                  </div>
                  <p className="font-semibold text-gray-900">{c.obra}</p>
                  <p className="text-sm text-gray-500">{c.contratantes?.nome}</p>
                  <div className="flex gap-4 text-sm text-gray-500">
                    <span>Valor: <strong className="text-gray-900">{moeda(c.valor_total)}</strong></span>
                    {c.data_inicio && <span>Início: {new Date(c.data_inicio).toLocaleDateString('pt-BR')}</span>}
                    {c.data_fim && <span>Fim: {new Date(c.data_fim).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link href={`/contratos/${c.id}`}>
                    <Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => excluir(c.id, c.numero)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
          )}
        </>
      )}
    </div>
  )
}
