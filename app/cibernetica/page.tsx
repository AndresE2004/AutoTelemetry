import { CyberneticsLab } from "@/components/cybernetics/cybernetics-lab"
import { DashboardLayout } from "@/components/dashboard-layout"

export default function CiberneticaPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cibernética y control</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Modelo térmico de primer orden (función de transferencia), respuesta al escalón y SFG del pipeline Telema.
            Los cálculos viven en el backend (<span className="font-mono">/cybernetics</span>).
          </p>
        </div>
        <CyberneticsLab />
      </div>
    </DashboardLayout>
  )
}
