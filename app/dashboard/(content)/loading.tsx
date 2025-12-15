export default function DashboardLoading() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="h-8 w-1/3 bg-muted rounded" />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-muted rounded-lg" />
                ))}
            </div>

            <div className="h-96 bg-muted rounded-lg" />
        </div>
    )
}
