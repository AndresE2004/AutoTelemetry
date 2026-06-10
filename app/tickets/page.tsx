import { DashboardLayout } from "@/components/dashboard-layout"
import { TicketsPanel } from "@/components/tickets/tickets-panel"

export default function TicketsPage() {
  return (
    <DashboardLayout>
      <TicketsPanel />
    </DashboardLayout>
  )
}
