"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Download, TrendingUp, TrendingDown, Users, DollarSign, Loader2, ArrowDownToLine } from "lucide-react"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase_config"
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore"
import { toast, Toaster } from "react-hot-toast"
import { generatePDFReport } from "@/lib/pdfReportGenerator"


// Interfaces
interface WithdrawalRequest {
  id: string
  requestAmount: number
  totalDeductedAmount: number
  totalTransferableAmount: number
  status: string
  createdAt: Timestamp
}

interface User {
  uid: string
  accountActivated: boolean
  activationAmount: number
  createdAt: Timestamp
}

interface Transaction {
  id: string
  userId: string
  type: string
  status: string
  amount: number
  createdAt: Timestamp
}

interface ChartDataPoint {
  month: string
  amount: number
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function ReportsClientPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [loading, setLoading] = useState(true)

  // Metrics state
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [activeUsers, setActiveUsers] = useState(0)
  const [feesEarned, setFeesEarned] = useState(0)
  const [withdrawalRate, setWithdrawalRate] = useState(0)

  // Chart data state
  const [contributionGrowth, setContributionGrowth] = useState<ChartDataPoint[]>([])
  const [withdrawalFrequency, setWithdrawalFrequency] = useState<ChartDataPoint[]>([])
  const [userEngagement, setUserEngagement] = useState({ weekly: 0, biweekly: 0, monthly: 0 })
  const [feesEarnedByMonth, setFeesEarnedByMonth] = useState<ChartDataPoint[]>([])

  // Available years for filter
  const [availableYears, setAvailableYears] = useState<number[]>([])

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Helper function to group data by month
  const groupByMonth = (data: any[], year: number, amountField: string) => {
    const monthlyData: { [key: number]: number } = {}

    // Initialize all months with 0
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = 0
    }

    data.forEach(item => {
      const date = item.createdAt.toDate()
      if (date.getFullYear() === year) {
        const month = date.getMonth()
        monthlyData[month] += item[amountField] || 0
      }
    })

    return MONTH_NAMES.map((month, index) => ({
      month,
      amount: monthlyData[index]
    }))
  }

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!db) {
          console.error("Firebase not initialized")
          setLoading(false)
          return
        }

        // Fetch withdrawal requests
        const withdrawalsRef = collection(db, "withdrawalRequests")
        const withdrawalsSnapshot = await getDocs(withdrawalsRef)
        const withdrawals = withdrawalsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WithdrawalRequest[]

        // Fetch users
        const usersRef = collection(db, "users")
        const usersSnapshot = await getDocs(usersRef)
        const users = usersSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as User[]

        // Fetch transactions
        const transactionsRef = collection(db, "transactions")
        const transactionsSnapshot = await getDocs(transactionsRef)
        const transactions = transactionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[]

        // Calculate Total Revenue
        const approvedWithdrawals = withdrawals.filter(w => w.status === "approved")
        const withdrawalFees = approvedWithdrawals.reduce((sum, w) =>
          sum + (w.totalDeductedAmount - w.totalTransferableAmount), 0
        )
        const activatedUsers = users.filter(u => u.accountActivated === true)
        const activationFees = activatedUsers.reduce((sum, u) =>
          sum + (u.activationAmount || 0), 0
        )
        setTotalRevenue(withdrawalFees + activationFees)

        // Calculate Active Users
        setActiveUsers(activatedUsers.length)

        // Calculate Fees Earned
        setFeesEarned(withdrawalFees)

        // Calculate Withdrawal Rate (Approval Success Rate)
        const totalWithdrawals = withdrawals.length
        const approvedCount = approvedWithdrawals.length
        setWithdrawalRate(totalWithdrawals > 0 ? (approvedCount / totalWithdrawals) * 100 : 0)

        // Get available years from transactions
        const years = new Set<number>()
        transactions.forEach(t => {
          if (t.createdAt) {
            years.add(t.createdAt.toDate().getFullYear())
          }
        })
        withdrawals.forEach(w => {
          if (w.createdAt) {
            years.add(w.createdAt.toDate().getFullYear())
          }
        })
        const yearsArray = Array.from(years).sort((a, b) => b - a)
        setAvailableYears(yearsArray.length > 0 ? yearsArray : [currentYear])

        // Calculate Contribution Growth (by year)
        const creditTransactions = transactions.filter(t =>
          t.type === "credit" && t.status === "completed"
        )
        setContributionGrowth(groupByMonth(creditTransactions, selectedYear, "amount"))

        // Calculate Withdrawal Frequency (by year)
        const approvedWithdrawalsByYear = approvedWithdrawals.filter(w =>
          w.createdAt && w.createdAt.toDate().getFullYear() === selectedYear
        )
        setWithdrawalFrequency(groupByMonth(approvedWithdrawalsByYear, selectedYear, "totalTransferableAmount"))

        // Calculate User Engagement
        const now = new Date()
        const completedCredits = transactions.filter(t =>
          t.type === "credit" && t.status === "completed"
        )

        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const biweekAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const weeklyUsers = new Set(
          completedCredits
            .filter(t => t.createdAt.toDate() >= weekAgo)
            .map(t => t.userId)
        ).size

        const biweeklyUsers = new Set(
          completedCredits
            .filter(t => t.createdAt.toDate() >= biweekAgo)
            .map(t => t.userId)
        ).size

        const monthlyUsers = new Set(
          completedCredits
            .filter(t => t.createdAt.toDate() >= monthAgo)
            .map(t => t.userId)
        ).size

        setUserEngagement({ weekly: weeklyUsers, biweekly: biweeklyUsers, monthly: monthlyUsers })

        // Calculate Fees Earned by Month
        const feesData = approvedWithdrawalsByYear.map(w => ({
          ...w,
          feeAmount: w.totalDeductedAmount - w.totalTransferableAmount
        }))
        setFeesEarnedByMonth(groupByMonth(feesData, selectedYear, "feeAmount"))

        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast.error("Failed to load reports data")
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedYear, currentYear])

  // Prepare user engagement pie chart data
  const userEngagementData = [
    { name: "Weekly Contributors", value: userEngagement.weekly, color: "#3b82f6" },
    { name: "Bi-weekly Contributors", value: userEngagement.biweekly, color: "#f59e0b" },
    { name: "Monthly Contributors", value: userEngagement.monthly, color: "#10b981" },
  ]

  // Handle PDF Export
  const handleExportReport = async () => {
    try {
      toast.loading("Generating PDF report...")

      await generatePDFReport({
        year: selectedYear,
        totalRevenue,
        activeUsers,
        feesEarned,
        withdrawalRate,
        contributionGrowth,
        withdrawalFrequency,
        userEngagement,
        feesEarnedByMonth,
      })

      toast.dismiss()
      toast.success("Report downloaded successfully!")
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast.dismiss()
      toast.error("Failed to generate PDF report")
    }
  }

  return (
    <DashboardLayout>
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-balance">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive insights into platform performance and user behavior
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportReport} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                  <div className="text-xs text-muted-foreground">Withdrawal + Activation fees</div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{activeUsers.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Account activated</div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Fees Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(feesEarned)}</div>
                  <div className="text-xs text-muted-foreground">From withdrawals</div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                Withdrawal Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{withdrawalRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Approval success rate</div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Contribution Growth */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contribution Growth</CardTitle>
                  <CardDescription>Monthly contribution trends</CardDescription>
                </div>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={contributionGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [`₦${(value as number).toLocaleString()}`, "Amount"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Withdrawal Frequency */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Withdrawal Frequency</CardTitle>
                  <CardDescription>Monthly withdrawal amounts</CardDescription>
                </div>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={withdrawalFrequency}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [`₦${(value as number).toLocaleString()}`, "Amount"]}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* User Engagement */}
          <Card>
            <CardHeader>
              <CardTitle>User Engagement</CardTitle>
              <CardDescription>Active contributors by period</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={userEngagementData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                      label={(entry) => `${entry.value} users`}
                    >
                      {userEngagementData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [`${value} users`, "Count"]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Fees Earned */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fees Earned</CardTitle>
                  <CardDescription>Monthly platform fees</CardDescription>
                </div>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={feesEarnedByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [`₦${(value as number).toLocaleString()}`, "Fees"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--chart-3))", strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
