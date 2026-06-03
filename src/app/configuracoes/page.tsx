'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle } from 'lucide-react'

export default function ConfiguracoesPage() {
  const [pfxCarregado, setPfxCarregado] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
        <p className="text-gray-500 mt-1">Dados da empresa e certificado digital</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Empresa Emissora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Razão Social</Label>
              <Input defaultValue="RONALDO LOPES ALONSO LTDA" />
            </div>
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input defaultValue="51.814.388/0001-03" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Inscrição Municipal (SP)</Label>
              <Input placeholder="0.000.000-0" />
            </div>
            <div className="space-y-1">
              <Label>Código do Serviço (NF)</Label>
              <Input defaultValue="07498" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Discriminação padrão de pagamento</Label>
            <Textarea
              rows={5}
              defaultValue={`Conta CNPJ\nBANCO INTER - 077\nRONALDO LOPES ALONSO LTDA\nCNPJ: 51.814.388/0001-03\nAgência: 0001\nConta: 30781639-7\nPIX: 51.814.388/0001-03`}
            />
          </div>
          <Button>Salvar Dados</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificado Digital (e-CNPJ A1)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
            {pfxCarregado ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Certificado carregado com sucesso</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Arraste o arquivo <strong>.pfx</strong> ou clique para selecionar</p>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  className="hidden"
                  id="pfx-upload"
                  onChange={() => setPfxCarregado(true)}
                />
                <label htmlFor="pfx-upload" className="cursor-pointer">
                  <Button variant="outline" className="mt-3" type="button" onClick={() => document.getElementById('pfx-upload')?.click()}>
                    Selecionar arquivo .pfx
                  </Button>
                </label>
              </>
            )}
          </div>
          <div className="space-y-1">
            <Label>Senha do certificado</Label>
            <Input type="password" placeholder="Senha do arquivo .pfx" />
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            O certificado é armazenado de forma criptografada e usado exclusivamente para assinar os XMLs das NFS-e enviados à Prefeitura de SP.
          </div>
          <Button>Salvar Certificado</Button>
        </CardContent>
      </Card>
    </div>
  )
}
