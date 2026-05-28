import ProtectedRoute from "@/components/ProtectedRoute"
import { DashboardLayout } from "@/components/dashboard-layout"

export default function DashboardLayoutWrapper({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ProtectedRoute>
            <DashboardLayout>{children}</DashboardLayout>
        </ProtectedRoute>
    )
}
