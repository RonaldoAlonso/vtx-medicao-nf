import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart2 } from 'lucide-react'

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Relatórios</h2>
        <p className="text-gray-500 mt-1">NFs emitidas por mês e previsão de recebimento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="text-base">NFs emitidas por mês</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8 text-gray-400 text-sm">
            Disponível após emissão das primeiras notas.
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="text-base">Previsão de recebimento</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8 text-gray-400 text-sm">
            Disponível após emissão das primeiras notas.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
