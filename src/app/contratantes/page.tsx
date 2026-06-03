'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { ContratanteDialog } from './contratante-dialog'
import { createClient } from '@/lib/supabase/client'

export type Contratante = {
  id?: string
  codigo: string
  nome: string
  cnpj: string
  endereco: string
  cep: string
  municipio: string
  uf: string
  email: string
  email_nf: string
  inscricao_municipal: string
  discriminacao_adicional: string
}

const INICIAIS: Omit<Contratante, 'id'>[] = [
  { codigo: '1A2', nome: 'B B L ENGENHARIA, CONSTRUCAO E COMERCIO LTDA', cnpj: '05.406.235/0001-00', endereco: 'R. MERGENTHALER, 81 - VILA LEOPOLDINA', cep: '05311-030', municipio: 'São Paulo', uf: 'SP', email: 'nf@miya-water.com.br', email_nf: '', inscricao_municipal: '3.186.288-8', discriminacao_adicional: '' },
  { codigo: '6A', nome: 'CONSORCIO DESENVOLVIMENTO SUSTENTAVEL INTEGRA', cnpj: '58.750.016/0001-00', endereco: 'R DAS ROSAS 74, CONJ A - MIRANDOPOLIS', cep: '04048-000', municipio: 'São Paulo', uf: 'SP', email: 'robson.rodriguez@enops.com.br', email_nf: 'rafael.silva@integra6a.com', inscricao_municipal: '1.716.721-3', discriminacao_adicional: 'Número de Inscrição da obra: SFOBRAS 2525/0006000-7\nCNO. 90.023.10232/76' },
  { codigo: 'CATUI', nome: 'CATUI ENGENHARIA LTDA', cnpj: '07.847.697/0001-80', endereco: 'AV MARCOS PENTEADO DE ULHOA RODRIGUES, 5100 - TAMBORE', cep: '06.543-001', municipio: 'Santana de Parnaíba', uf: 'SP', email: 'LUIZ@BRUKUS.COM.BR', email_nf: 'diogo@catuiengenharia.com.br', inscricao_municipal: '', discriminacao_adicional: 'Centro de Custo: 10148 - Sabesp - Integra Tietê - Pacote 16.' },
  { codigo: '10A', nome: 'GUARULHOS 10A DP SPE LTDA', cnpj: '58.478.387/0001-76', endereco: 'R BARTOLOME CARDUCHO 335 - JARDIM DAS VERTENTES', cep: '05541-130', municipio: 'São Paulo', uf: 'SP', email: 'erico.monteiro@dascoengenharia.com.br', email_nf: '', inscricao_municipal: '1.620.324-0', discriminacao_adicional: '' },
  { codigo: 'BBL', nome: 'B B L ENGENHARIA, CONSTRUCAO E COMERCIO LTDA', cnpj: '05.406.235/0001-00', endereco: 'R. MERGENTHALER, 81 - VILA LEOPOLDINA', cep: '05311-030', municipio: 'São Paulo', uf: 'SP', email: 'nf@miya-water.com.br', email_nf: '', inscricao_municipal: '3.186.288-8', discriminacao_adicional: 'Nome da Obra: Consórcio São Francisco e Bichinhos\nNúmero de Inscrição da Obra: 90.022.48190/78' },
]

export default function ContratantesPage() {
  const [contratantes, setContratantes] = useState<Contratante[]>([])
  const [carregando, setCarregando] = useState(true)
  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState<Contratante | null>(null)
  const supabase = createClient()

  async function carregar() {
    const { data } = await supabase.from('contratantes').select('*').order('codigo')
    if (data && data.length > 0) {
      setContratantes(data)
    } else if (data && data.length === 0) {
      // Primeira vez: importar dados iniciais da planilha
      await supabase.from('contratantes').insert(INICIAIS)
      const { data: recarregado } = await supabase.from('contratantes').select('*').order('codigo')
      setContratantes(recarregado ?? [])
    }
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar(c: Contratante) {
    if (c.id) {
      await supabase.from('contratantes').update(c).eq('id', c.id)
    } else {
      await supabase.from('contratantes').insert(c)
    }
    setOpen(false)
    setEditando(null)
    carregar()
  }

  async function excluir(id: string) {
    if (confirm('Excluir este contratante?')) {
      await supabase.from('contratantes').delete().eq('id', id)
      carregar()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contratantes</h2>
          <p className="text-gray-500 mt-1">Clientes e tomadores de serviço</p>
        </div>
        <Button onClick={() => { setEditando(null); setOpen(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Contratante
        </Button>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : (
        <div className="grid gap-4">
          {contratantes.map(c => (
            <Card key={c.id}>
              <CardContent className="flex items-start justify-between pt-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">{c.codigo}</Badge>
                    <span className="font-semibold text-gray-900">{c.nome}</span>
                  </div>
                  <p className="text-sm text-gray-500">CNPJ: {c.cnpj} · IM: {c.inscricao_municipal || '—'}</p>
                  <p className="text-sm text-gray-500">{c.endereco} — {c.municipio}/{c.uf}</p>
                  <p className="text-sm text-gray-400">{c.email}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditando(c); setOpen(true) }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => excluir(c.id!)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContratanteDialog
        open={open}
        onClose={() => { setOpen(false); setEditando(null) }}
        onSave={salvar}
        inicial={editando}
      />
    </div>
  )
}
