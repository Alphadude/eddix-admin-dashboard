// app/dashboard/page.tsx
'use client';

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Users, Clock, MoreHorizontal } from "lucide-react"
import { useEffect, useState } from "react"
import { db } from "@/lib/firebase_config"
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from "firebase/firestore"

/* ===================== TYPES ===================== */

type ActivityItem = {
  id: string
  user: string
  type: "contribution" | "new_user"
  amount?: string
  time: string
  status?: string
}

type DashboardStats = {
  totalContributions: number
  totalWithdrawals: number
  pendingApprovals: number
  activeUsers: number
}

/* ===================== HELPERS ===================== */

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return "Just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`

  return date.toLocaleDateString()
}

/* ===================== PAGE COMPONENT ===================== */

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalContributions: 0,
    totalWithdrawals: 0,
    pendingApprovals: 0,
    activeUsers: 0
  })
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  /* ===================== FETCH FUNCTIONS ===================== */

  const fetchTotalContributions = async (): Promise<number> => {
    try {
      const snapshot = await getDocs(collection(db, "savings"))
      let total = 0
      snapshot.forEach((doc) => (total += doc.data().actualAmount || 0))
      return total
    } catch (error) {
      console.error("Error fetching contributions:", error)
      return 0
    }
  }

  const fetchTotalWithdrawals = async (): Promise<number> => {
    try {
      const q = query(
        collection(db, "withdrawalRequests"),
        where("status", "==", "approved")
      )
      const snapshot = await getDocs(q)
      let total = 0
      snapshot.forEach((doc) => {
        const data = doc.data()
        total += (data.totalDeductedAmount || 0) + (data.totalTransferableAmount || 0)
      })
      return total
    } catch (error) {
      console.error("Error fetching withdrawals:", error)
      return 0
    }
  }

  const fetchTotalPendingWithdrawals = async (): Promise<number> => {
    try {
      const q = query(
        collection(db, "withdrawalRequests"),
        where("status", "==", "pending")
      )
      const snapshot = await getDocs(q)
      return snapshot.size
    } catch (error) {
      console.error("Error fetching pending withdrawals:", error)
      return 0
    }
  }

  const fetchActiveUsersCount = async (): Promise<number> => {
    try {
      const q = query(
        collection(db, "users"),
        where("status", "==", "active")
      )
      const snapshot = await getDocs(q)
      return snapshot.size
    } catch (error) {
      console.error("Error fetching active users:", error)
      return 0
    }
  }

  const fetchAllStats = async (): Promise<DashboardStats> => {
    try {
      const [contributions, withdrawals, pending, users] = await Promise.all([
        fetchTotalContributions(),
        fetchTotalWithdrawals(),
        fetchTotalPendingWithdrawals(),
        fetchActiveUsersCount(),
      ])

      return {
        totalContributions: contributions,
        totalWithdrawals: withdrawals,
        pendingApprovals: pending,
        activeUsers: users
      }
    } catch (error) {
      console.error("Error fetching all stats:", error)
      return { totalContributions: 0, totalWithdrawals: 0, pendingApprovals: 0, activeUsers: 0 }
    }
  }

  /* ===================== REAL-TIME SETUP ===================== */

  // Setup polling for main stats every 15 seconds
  useEffect(() => {
    let isMounted = true

    const pollStats = async () => {
      try {
        const newStats = await fetchAllStats()
        if (isMounted) {
          setStats(newStats)
          if (isLoading) setIsLoading(false)
        }
      } catch (error) {
        console.error("Polling error:", error)
      }
    }

    // Initial fetch
    pollStats()

    // Set up polling interval (15 seconds)
    const intervalId = setInterval(pollStats, 15000)

    // Cleanup
    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [isLoading])

  // Setup real-time listeners for recent activities
  useEffect(() => {
    const TWENTY_THREE_HOURS_AGO = Timestamp.fromDate(new Date(Date.now() - 23 * 60 * 60 * 1000))

    // Real-time listener for recent transactions
    const transactionsQuery = query(
      collection(db, "transactions"),
      where("createdAt", ">=", TWENTY_THREE_HOURS_AGO),
      orderBy("createdAt", "desc")
    )

    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const newTransactions: ActivityItem[] = snapshot.docs.map((doc) => {
        const data = doc.data()
        const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date()

        return {
          id: doc.id,
          user: data.savingsName || "Unknown User",
          type: "contribution" as const,
          amount: `₦${(data.amount || 0).toLocaleString()}`,
          time: formatTimeAgo(date),
          status: data.status || "unknown",
        }
      })

      // Update recent activity with new transactions
      setRecentActivity(prev => {
        // Keep only new_user items from previous state
        const userActivities = prev.filter(a => a.type === 'new_user')
        // Combine and limit to 5 items
        const combined = [...newTransactions, ...userActivities]
          .sort((a, b) => {
            // Simple sorting by recency - you might want to implement proper date comparison
            if (a.time === "Just now" && b.time !== "Just now") return -1
            if (b.time === "Just now" && a.time !== "Just now") return 1
            return 0
          })
          .slice(0, 5)
        return combined
      })
    }, (error) => {
      console.error("Transactions listener error:", error)
    })

    // Real-time listener for new users
    const usersQuery = query(
      collection(db, "users"),
      where("createdAt", ">=", TWENTY_THREE_HOURS_AGO),
      orderBy("createdAt", "desc")
    )

    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const newUsers: ActivityItem[] = snapshot.docs.map((doc) => {
        const data = doc.data()
        const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date()

        return {
          id: doc.id,
          user: `${data.firstName || ''} ${data.lastName || ''}`.trim() || "New User",
          type: "new_user" as const,
          time: formatTimeAgo(date),
        }
      })

      // Update recent activity with new users
      setRecentActivity(prev => {
        // Keep only contribution items from previous state
        const transactionActivities = prev.filter(a => a.type === 'contribution')
        // Combine and limit to 5 items
        const combined = [...transactionActivities, ...newUsers]
          .sort((a, b) => {
            if (a.time === "Just now" && b.time !== "Just now") return -1
            if (b.time === "Just now" && a.time !== "Just now") return 1
            return 0
          })
          .slice(0, 5)
        return combined
      })
    }, (error) => {
      console.error("Users listener error:", error)
    })

    // Cleanup both listeners on unmount
    return () => {
      unsubscribeTransactions()
      unsubscribeUsers()
    }
  }, [])

  /* ===================== RENDER ===================== */

  const statCards = [
    {
      title: "Total Contributions",
      value: `₦${stats.totalContributions.toLocaleString()}`,
      icon: TrendingUp,
    },
    {
      title: "Total Withdrawals",
      value: `₦${stats.totalWithdrawals.toLocaleString()}`,
      icon: TrendingDown,
    },
    {
      title: "Pending Approvals",
      value: stats.pendingApprovals.toString(),
      icon: Clock,
    },
    {
      title: "Active Users",
      value: stats.activeUsers.toLocaleString(),
      icon: Users,
    },
  ]

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-2">
            Monitor your platform's key metrics and activity in real-time
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest contributions and new users (updates in real-time)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <div className="font-medium">{activity.user}</div>
                    <div className="text-sm text-muted-foreground">
                      {activity.type === "contribution"
                        ? "Made a contribution"
                        : "Joined the platform"}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {activity.amount && (
                        <div className="font-medium">{activity.amount}</div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {activity.time}
                      </div>
                    </div>

                    {activity.status && (
                      <Badge variant={
                        activity.status === "completed" ? "default" :
                          activity.status === "pending" ? "secondary" : "outline"
                      }>
                        {activity.status}
                      </Badge>
                    )}

                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity in the last 15 minutes
              </div>
            )}

            {/* Real-time indicator */}
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground pt-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Live updates active</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}