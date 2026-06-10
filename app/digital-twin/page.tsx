import { DigitalTwinViewer } from "@/components/digital-twin-viewer/DigitalTwinViewer"
import { DashboardLayout } from "@/components/dashboard-layout"

export default function DigitalTwinPage() {
  return (
    <DashboardLayout>
      <DigitalTwinViewer />
    </DashboardLayout>
  )
}
