import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Users, Clock, ArrowUpRight, ArrowDownRight, MoreHorizontal } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard Overview | Eddix Admin",
  description:
    "Monitor key financial metrics, track contributions and withdrawals, view recent activity, and manage your Eddix Savings platform from a centralized dashboard.",
}

const stats = [
  {
    title: "Total Contributions",
    value: "₦2,847,500",
    change: "+12.5%",
    changeType: "positive" as const,
    icon: TrendingUp,
  },
  {
    title: "Total Withdrawals",
    value: "₦1,234,800",
    change: "+8.2%",
    changeType: "positive" as const,
    icon: TrendingDown,
  },
  {
    title: "Pending Approvals",
    value: "23",
    change: "-5 from yesterday",
    changeType: "neutral" as const,
    icon: Clock,
  },
  {
    title: "Active Users",
    value: "1,847",
    change: "+47 this week",
    changeType: "positive" as const,
    icon: Users,
  },
]

const recentActivity = [
  {
    id: 1,
    type: "contribution",
    user: "John Doe",
    amount: "₦50,000",
    time: "2 minutes ago",
    status: "completed",
  },
  {
    id: 2,
    type: "withdrawal",
    user: "Sarah Johnson",
    amount: "₦25,000",
    time: "15 minutes ago",
    status: "pending",
  },
  {
    id: 3,
    type: "contribution",
    user: "Michael Brown",
    amount: "₦75,000",
    time: "1 hour ago",
    status: "completed",
  },
  {
    id: 4,
    type: "withdrawal",
    user: "Emily Davis",
    amount: "₦40,000",
    time: "2 hours ago",
    status: "approved",
  },
  {
    id: 5,
    type: "contribution",
    user: "David Wilson",
    amount: "₦30,000",
    time: "3 hours ago",
    status: "completed",
  },
]

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-balance">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-2">
            Monitor your financial platform's key metrics and recent activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  {stat.changeType === "positive" && <ArrowUpRight className="h-3 w-3 text-success" />}
                  {stat.changeType === "negative" && <ArrowDownRight className="h-3 w-3 text-destructive" />}
                  <span
                    className={
                      stat.changeType === "positive"
                        ? "text-success"
                        : stat.changeType === "negative"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {stat.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest contributions and withdrawal requests</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activity.type === "contribution" ? "bg-success" : "bg-warning"
                      }`}
                    />
                    <div>
                      <div className="font-medium">{activity.user}</div>
                      <div className="text-sm text-muted-foreground">
                        {activity.type === "contribution" ? "Made a contribution" : "Requested withdrawal"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium">{activity.amount}</div>
                      <div className="text-sm text-muted-foreground">{activity.time}</div>
                    </div>

                    <Badge
                      variant={
                        activity.status === "completed"
                          ? "default"
                          : activity.status === "approved"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {activity.status}
                    </Badge>

                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
