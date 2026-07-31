'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Contratante } from './page'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (c: Contratante) => void
  inicial: Contratante | null
}

const VAZIO: Contratante = {
  codigo: '', nome: '', cnpj: '', endereco: '', cep: '',
  municipio: '', uf: 'SP', email: '', email_nf: '',
  inscricao_municipal: '', inscricao_estadual: '', discriminacao_adicional: '',
  rep_nome: '', rep_nacionalidade: '', rep_estado_civil: '', rep_profissao: '',
  rep_rg: '', rep_cpf: '', rep_cidade_uf: '',
}

export function ContratanteDialog({ open, onClose, onSave, inicial }: Props) {
  const { register, handleSubmit, reset } = useForm<Contratante>({ defaultValues: VAZIO })

  useEffect(() => {
    reset(inicial ?? VAZIO)
  }, [inicial, reset])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inicial ? 'Editar Contratante' : 'Novo Contratante'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Código *</Label>
              <Input {...register('codigo', { required: true })} placeholder="ex: 1A2, CATUI" />
            </div>
            <div className="space-y-1">
              <Label>CNPJ *</Label>
              <Input {...register('cnpj', { required: true })} placeholder="00.000.000/0000-00" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Razão Social *</Label>
            <Input {...register('nome', { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Endereço</Label>
            <Input {...register('endereco')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>CEP</Label>
              <Input {...register('cep')} />
            </div>
            <div className="space-y-1">
              <Label>Município</Label>
              <Input {...register('municipio')} />
            </div>
            <div className="space-y-1">
              <Label>UF</Label>
              <Input {...register('uf')} maxLength={2} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>E-mail principal</Label>
              <Input {...register('email')} type="email" />
            </div>
            <div className="space-y-1">
              <Label>E-mail p/ envio de NF</Label>
              <Input {...register('email_nf')} type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Inscrição Municipal</Label>
              <Input {...register('inscricao_municipal')} />
            </div>
            <div className="space-y-1">
              <Label>Inscrição Estadual</Label>
              <Input {...register('inscricao_estadual')} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Discriminação adicional (aparece na NF)</Label>
            <Textarea {...register('discriminacao_adicional')} rows={3} />
          </div>

          <div className="border-t pt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Representante Legal</h3>
              <p className="text-xs text-gray-400">Usado na geração do Contrato em Word (preâmbulo e assinatura).</p>
            </div>
            <div className="space-y-1">
              <Label>Nome do representante legal</Label>
              <Input {...register('rep_nome')} placeholder="ex: João da Silva" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Nacionalidade</Label>
                <Input {...register('rep_nacionalidade')} placeholder="ex: brasileiro(a)" />
              </div>
              <div className="space-y-1">
                <Label>Estado civil</Label>
                <Input {...register('rep_estado_civil')} placeholder="ex: casado(a)" />
              </div>
              <div className="space-y-1">
                <Label>Profissão</Label>
                <Input {...register('rep_profissao')} placeholder="ex: Engenheiro Civil" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>RG (nº e órgão emissor/UF)</Label>
                <Input {...register('rep_rg')} placeholder="ex: 12.345.678-9 SSP/SP" />
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input {...register('rep_cpf')} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1">
                <Label>Cidade/UF (domicílio)</Label>
                <Input {...register('rep_cidade_uf')} placeholder="ex: São Paulo/SP" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
