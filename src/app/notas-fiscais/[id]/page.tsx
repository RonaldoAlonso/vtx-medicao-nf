'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Contratante = {
  codigo: string; nome: string; cnpj: string; endereco: string; cep: string
  municipio: string; uf: string; email: string; inscricao_municipal: string
  inscricao_estadual: string; discriminacao_adicional: string
}
type Nota = {
  numero_nf: string
  discriminacao_servicos: string
  valor_servicos: number
  data_emissao: string | null
  boletins: {
    numero_medicao: number
    contratos: { numero: string; obra: string; contratantes: Contratante }
  }
}

const moeda = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function FolhaNotaFiscalPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [nota, setNota] = useState<Nota | null>(null)
  const [pagamento, setPagamento] = useState('')

  useEffect(() => {
    async function carregar() {
      const [{ data: nf }, { data: cfg }] = await Promise.all([
        supabase
          .from('notas_fiscais')
          .select('numero_nf, discriminacao_servicos, valor_servicos, data_emissao, boletins(numero_medicao, contratos(numero, obra, contratantes(*)))')
          .eq('id', id)
          .single(),
        supabase.from('config_empresa').select('discriminacao_padrao_pagamento').limit(1).single(),
      ])
      setNota(nf as unknown as Nota)
      setPagamento(cfg?.discriminacao_padrao_pagamento ?? '')
      setCarregando(false)
    }
    carregar()
  }, [id])

  if (carregando) {
    return <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...</div>
  }

  if (!nota) {
    return (
      <div className="space-y-4">
        <Link href="/notas-fiscais"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button></Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Nota fiscal não encontrada.</div>
      </div>
    )
  }

  const c = nota.boletins?.contratos?.contratantes
  const linha = (label: string, valor?: string) => (
    <tr>
      <td className="border border-black p-2 font-bold bg-gray-100 w-72 align-top">{label}</td>
      <td className="border border-black p-2 whitespace-pre-wrap align-top">{valor || '—'}</td>
    </tr>
  )

  // Discriminação da Nota = serviços + adicional + pagamento (concatenados)
  const discriminacaoNota = [
    nota.discriminacao_servicos,
    c?.discriminacao_adicional,
    pagamento,
  ].filter(p => p && String(p).trim() !== '').join('\n\n')

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #folha-nf, #folha-nf * { visibility: visible; }
          #folha-nf { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>

      {/* Barra de ações (some na impressão) */}
      <div className="no-print flex items-center justify-between">
        <Link href="/notas-fiscais"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button></Link>
        <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Plotar / Salvar PDF</Button>
      </div>

      {/* ===== Folha da NF (formato TEMPLATE) ===== */}
      <div id="folha-nf" className="mx-auto max-w-3xl bg-white border border-gray-300 rounded-lg p-8 text-sm text-black">
        <h1 className="text-center text-lg font-bold mb-6">Nota Fiscal {nota.numero_nf || '—'}</h1>
        {/* Dados cadastrais do contratante */}
        <table className="w-full border-collapse border border-black">
          <tbody>
            {linha('CÓDIGO', c?.codigo)}
            {linha('NOME', c?.nome)}
            {linha('CNPJ', c?.cnpj)}
            {linha('ENDEREÇO', c?.endereco)}
            {linha('CEP', c?.cep)}
            {linha('MUNICÍPIO', c?.municipio)}
            {linha('UF', c?.uf)}
            {linha('E-MAIL', c?.email)}
            {linha('INSCRIÇÃO MUNICIPAL', c?.inscricao_municipal)}
            {linha('INSCRIÇÃO ESTADUAL', c?.inscricao_estadual)}
            {linha('CÓDIGO DO SERVIÇO', '1521 - ENGENHARIA E CONGÊNERES')}
          </tbody>
        </table>

        {/* quebra */}
        <div className="h-6" />

        {/* Discriminação da Nota (serviços + adicional + pagamento) */}
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold bg-gray-100 w-72 align-top">DISCRIMINAÇÃO DA NOTA</td>
              <td className="border border-black p-2 whitespace-pre-wrap align-top">{discriminacaoNota || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* quebra */}
        <div className="h-6" />

        {/* Valor */}
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold bg-gray-100 w-72 align-top">VALOR TOTAL DOS SERVIÇOS</td>
              <td className="border border-black p-2 font-bold text-base align-top">{moeda(nota.valor_servicos)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
