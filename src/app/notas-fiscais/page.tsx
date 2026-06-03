import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Receipt } from 'lucide-react'

export default function NotasFiscaisPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notas Fiscais</h2>
          <p className="text-gray-500 mt-1">Controle de emissão e pagamento das NFS-e</p>
        </div>
      </div>

      <div className="text-center py-16 text-gray-400">
        <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Nenhuma nota fiscal emitida ainda.</p>
        <p className="text-sm mt-2">As notas serão geradas a partir dos boletins aprovados.</p>
      </div>
    </div>
  )
}
