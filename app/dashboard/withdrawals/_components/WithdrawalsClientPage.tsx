"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Search, Download, Check, X, Eye, Clock, ArrowDownToLine, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase_config"
import { collection, getDocs, query, orderBy, Timestamp, where, updateDoc, doc, serverTimestamp, addDoc } from "firebase/firestore"
import { toast, Toaster } from "react-hot-toast"
import { formatDistanceToNow } from "date-fns"
import { v4 as uuidv4 } from "uuid"

interface WithdrawalRequest {
  id: string
  withdrawalRequestId: string
  userId: string
  savingsId: string
  requestAmount: number
  totalDeductedAmount: number
  totalTransferableAmount: number
  destinationBankAccountNumber: string
  destinationBankName: string
  destinationBankCode: string
  narration: string
  status: string
  createdAt: Timestamp
  updatedAt: Timestamp
  approvedBy: string | null
  rejectedBy: string | null
  requestedTransferRef: string | null
  bulkRef: string | null
  breakingFeeRef: string | null
}

interface User {
  uid: string
  firstName: string
  lastName: string
  email: string
}

interface SavingsPlan {
  id: string
  savingsId: string
  userId: string
  savingsName: string
  targetAmount: number
  actualAmount: number
  status: string
  startDate: Timestamp
  duration: string
}

// Fee configuration (adjustable)
const COMPLETED_PLAN_FEE_PERCENTAGE = 0.10  // 10% if plan completed
const BROKEN_PLAN_FEE_PERCENTAGE = 0.20     // 20% if plan broken early

export default function WithdrawalsClientPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null)
  const [actionType, setActionType] = useState<"approve" | "decline" | null>(null)
  const [declineReason, setDeclineReason] = useState("")
  const [showInitiateWithdrawal, setShowInitiateWithdrawal] = useState(false)
  const [newWithdrawal, setNewWithdrawal] = useState({
    userId: "",
    savingsId: "",
    requestAmount: "",
    narration: "",
    destinationBankName: "",
    destinationBankAccountNumber: "",
    destinationBankCode: "",
  })

  // Firebase state
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([])
  const [users, setUsers] = useState<Record<string, User>>({})
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([])
  const [userSavingsPlans, setUserSavingsPlans] = useState<SavingsPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<SavingsPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Helper function to parse duration string
  const parseDuration = (duration: string): { value: number; unit: string } => {
    const match = duration.match(/(\d+)\s*(day|week|month|year)s?/i)
    if (!match) return { value: 0, unit: 'day' }
    return {
      value: parseInt(match[1]),
      unit: match[2].toLowerCase()
    }
  }

  // Helper function to calculate end date from start date and duration
  const calculateEndDate = (startDate: Timestamp, duration: string): Date => {
    const start = startDate.toDate()
    const { value, unit } = parseDuration(duration)

    const endDate = new Date(start)
    switch (unit) {
      case 'day':
        endDate.setDate(endDate.getDate() + value)
        break
      case 'week':
        endDate.setDate(endDate.getDate() + (value * 7))
        break
      case 'month':
        endDate.setMonth(endDate.getMonth() + value)
        break
      case 'year':
        endDate.setFullYear(endDate.getFullYear() + value)
        break
    }

    return endDate
  }

  // Helper function to check if plan is completed
  const isPlanCompleted = (plan: SavingsPlan): boolean => {
    const endDate = calculateEndDate(plan.startDate, plan.duration)
    const currentDate = new Date()
    return currentDate >= endDate
  }

  // Calculate withdrawal details
  const calculateWithdrawalDetails = (plan: SavingsPlan | null, requestAmount: number) => {
    if (!plan || !requestAmount || isNaN(requestAmount)) {
      return {
        isCompleted: false,
        feePercentage: 0,
        fee: 0,
        totalDeducted: 0,
        hasSufficientFunds: false,
        maxWithdrawable: 0,
        remainingBalance: 0,
        actualAmountReceived: 0,
        isPartialWithdrawal: false,
        endDate: null
      }
    }

    const isCompleted = isPlanCompleted(plan)
    const feePercentage = isCompleted ? COMPLETED_PLAN_FEE_PERCENTAGE : BROKEN_PLAN_FEE_PERCENTAGE
    const fee = requestAmount * feePercentage

    // Primary validation: Check if requested amount exceeds available balance
    const hasSufficientFunds = requestAmount <= plan.actualAmount

    // Fee is deducted from balance first
    const balanceAfterFee = plan.actualAmount - fee

    // User receives the minimum of: requested amount OR balance after fee
    const actualAmountReceived = hasSufficientFunds ? Math.min(requestAmount, balanceAfterFee) : 0

    // Total deducted from savings = fee + actual amount received
    const totalDeducted = fee + actualAmountReceived

    // Maximum amount user can withdraw is their actual balance
    const maxWithdrawable = plan.actualAmount

    // Remaining balance after withdrawal
    const remainingBalance = hasSufficientFunds ? plan.actualAmount - totalDeducted : plan.actualAmount

    // Partial withdrawal if user receives less than requested OR balance remains
    const isPartialWithdrawal = actualAmountReceived < requestAmount || remainingBalance > 0

    return {
      isCompleted,
      feePercentage,
      fee,
      totalDeducted,
      hasSufficientFunds,
      maxWithdrawable,
      remainingBalance,
      actualAmountReceived,
      isPartialWithdrawal,
      endDate: calculateEndDate(plan.startDate, plan.duration)
    }
  }

  // Fetch withdrawal requests and users
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
        const withdrawalsQuery = query(withdrawalsRef, orderBy("createdAt", "desc"))
        const withdrawalsSnapshot = await getDocs(withdrawalsQuery)

        const withdrawalsData = withdrawalsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WithdrawalRequest[]

        setWithdrawalRequests(withdrawalsData)

        // Fetch users
        const usersRef = collection(db, "users")
        const usersSnapshot = await getDocs(usersRef)

        const usersMap: Record<string, User> = {}
        const usersArray: User[] = []
        usersSnapshot.docs.forEach((doc) => {
          const userData = { uid: doc.id, ...doc.data() } as User
          usersMap[doc.id] = userData
          usersArray.push(userData)
        })

        setUsers(usersMap)
        setAllUsers(usersArray)

        // Fetch savings plans
        const savingsRef = collection(db, "savings")
        const savingsSnapshot = await getDocs(savingsRef)
        const savingsData = savingsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as SavingsPlan[]
        setSavingsPlans(savingsData)

        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast.error("Failed to load withdrawal requests")
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Update user savings plans when user is selected
  useEffect(() => {
    if (newWithdrawal.userId) {
      const userPlans = savingsPlans.filter(
        (plan) => plan.userId === newWithdrawal.userId && plan.status === "active"
      )
      setUserSavingsPlans(userPlans)
      // Reset savings selection when user changes
      setNewWithdrawal(prev => ({ ...prev, savingsId: "" }))
      setSelectedPlan(null)
    } else {
      setUserSavingsPlans([])
      setSelectedPlan(null)
    }
  }, [newWithdrawal.userId, savingsPlans])

  // Update selected plan when savings plan is selected
  useEffect(() => {
    if (newWithdrawal.savingsId) {
      const plan = savingsPlans.find(p => p.savingsId === newWithdrawal.savingsId)
      setSelectedPlan(plan || null)
    } else {
      setSelectedPlan(null)
    }
  }, [newWithdrawal.savingsId, savingsPlans])

  // Filter withdrawals
  const pendingWithdrawals = withdrawalRequests.filter(w => w.status === "pending")
  const processedWithdrawals = withdrawalRequests.filter(w => w.status === "approved" || w.status === "declined")

  // Calculate statistics
  const pendingCount = pendingWithdrawals.length
  const pendingTotal = pendingWithdrawals.reduce((sum, w) => sum + w.requestAmount, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const approvedToday = processedWithdrawals.filter(w => {
    const updatedDate = w.updatedAt.toDate()
    updatedDate.setHours(0, 0, 0, 0)
    return w.status === "approved" && updatedDate.getTime() === today.getTime()
  })
  const approvedTodayCount = approvedToday.length
  const approvedTodayTotal = approvedToday.reduce((sum, w) => sum + w.totalTransferableAmount, 0)

  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)
  const thisMonthWithdrawals = processedWithdrawals.filter(w => {
    return w.status === "approved" && w.updatedAt.toDate() >= thisMonth
  })
  const thisMonthTotal = thisMonthWithdrawals.reduce((sum, w) => sum + w.totalTransferableAmount, 0)
  const thisMonthCount = thisMonthWithdrawals.length

  // Helper function to get user name
  const getUserName = (userId: string) => {
    const user = users[userId]
    return user ? `${user.firstName} ${user.lastName}` : "Unknown User"
  }

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString()}`
  }

  // Helper function to format date
  const formatDate = (timestamp: Timestamp) => {
    try {
      const date = timestamp.toDate()
      return {
        date: date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        time: date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      }
    } catch {
      return { date: "N/A", time: "N/A" }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>
      case "approved":
        return <Badge className="bg-success/10 text-success border-success/20">Approved</Badge>
      case "declined":
        return <Badge variant="destructive">Declined</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleApprove = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal)
    setActionType("approve")
  }

  const handleDecline = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal)
    setActionType("decline")
  }

  const confirmAction = async () => {
    if (!selectedWithdrawal || !db) return

    try {
      setSubmitting(true)
      const withdrawalRef = doc(db, "withdrawalRequests", selectedWithdrawal.id)

      if (actionType === "approve") {
        await updateDoc(withdrawalRef, {
          status: "approved",
          approvedBy: "Admin User", // TODO: Replace with actual admin user ID
          updatedAt: serverTimestamp(),
        })
        toast.success(`Withdrawal request approved successfully!`)
      } else if (actionType === "decline") {
        await updateDoc(withdrawalRef, {
          status: "declined",
          rejectedBy: "Admin User", // TODO: Replace with actual admin user ID
          updatedAt: serverTimestamp(),
          declineReason: declineReason,
        })
        toast.success(`Withdrawal request declined`)
      }

      // Refresh data
      const withdrawalsRef = collection(db, "withdrawalRequests")
      const withdrawalsQuery = query(withdrawalsRef, orderBy("createdAt", "desc"))
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery)
      const withdrawalsData = withdrawalsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WithdrawalRequest[]
      setWithdrawalRequests(withdrawalsData)

      setSelectedWithdrawal(null)
      setActionType(null)
      setDeclineReason("")
      setSubmitting(false)
    } catch (error: any) {
      console.error(`Error ${actionType}ing withdrawal:`, error)
      toast.error(`Failed to ${actionType} withdrawal: ${error.message}`)
      setSubmitting(false)
    }
  }
  const generateTransactionRef = (prefix = "TXN") => {
    return `${prefix}-${uuidv4()}`;
  };
  const handleInitiateWithdrawal = async () => {
    // Validate required fields
    if (!newWithdrawal.userId || !newWithdrawal.savingsId || !newWithdrawal.requestAmount ||
      !newWithdrawal.narration || !newWithdrawal.destinationBankName ||
      !newWithdrawal.destinationBankAccountNumber || !newWithdrawal.destinationBankCode) {
      toast.error("Please fill in all required fields")
      return
    }

    // Get selected plan
    if (!selectedPlan) {
      toast.error("Selected savings plan not found")
      return
    }

    try {
      setSubmitting(true)

      if (!db) {
        throw new Error("Firebase not initialized")
      }

      const requestAmount = parseFloat(newWithdrawal.requestAmount)
      const withdrawalDetails = calculateWithdrawalDetails(selectedPlan, requestAmount)

      // Validate sufficient funds (check if requested amount exceeds balance)
      if (!withdrawalDetails.hasSufficientFunds) {
        toast.error(
          `Insufficient funds! You're requesting ₦${requestAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })} but only have ₦${selectedPlan.actualAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })} available.`
        )
        setSubmitting(false)
        return
      }

      const withdrawalRequestId = uuidv4()

      // Generate Unique Withdrawal Reference
      const bulkTransactionRef = generateTransactionRef("BKTXN");
      const requestedTransactionRef = generateTransactionRef("RQTXN");
      const breakTransactionRef = generateTransactionRef("BRTXN");

      // User receives the actual amount (may be less than requested in partial withdrawals)
      const totalTransferableAmount = withdrawalDetails.actualAmountReceived

      const withdrawalData = {
        withdrawalRequestId,
        userId: newWithdrawal.userId,
        savingsId: newWithdrawal.savingsId,
        requestAmount,
        totalDeductedAmount: withdrawalDetails.totalDeducted,
        totalTransferableAmount,
        destinationBankName: newWithdrawal.destinationBankName,
        destinationBankAccountNumber: newWithdrawal.destinationBankAccountNumber,
        destinationBankCode: newWithdrawal.destinationBankCode,
        narration: newWithdrawal.narration,
        status: "pending",
        approvedBy: null,
        rejectedBy: null,
        requestedTransferRef: requestedTransactionRef,
        bulkRef: bulkTransactionRef,
        breakingFeeRef: breakTransactionRef,
        breakingFeePercentage: withdrawalDetails.feePercentage,
        isPlanCompleted: withdrawalDetails.isCompleted,
        isPartialWithdrawal: withdrawalDetails.isPartialWithdrawal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await addDoc(collection(db, "withdrawalRequests"), withdrawalData)

      toast.success("Withdrawal request created successfully!")

      // Refresh withdrawal requests
      const withdrawalsRef = collection(db, "withdrawalRequests")
      const withdrawalsQuery = query(withdrawalsRef, orderBy("createdAt", "desc"))
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery)
      const withdrawalsData = withdrawalsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WithdrawalRequest[]
      setWithdrawalRequests(withdrawalsData)

      // Reset form
      setNewWithdrawal({
        userId: "",
        savingsId: "",
        requestAmount: "",
        narration: "",
        destinationBankName: "",
        destinationBankAccountNumber: "",
        destinationBankCode: "",
      })
      setSelectedPlan(null)
      setShowInitiateWithdrawal(false)
      setSubmitting(false)
    } catch (error: any) {
      console.error("Error creating withdrawal request:", error)
      toast.error(`Failed to create withdrawal request: ${error.message}`)
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-balance">Withdrawal Management</h1>
            <p className="text-muted-foreground mt-2">Review and process user withdrawal requests</p>
          </div>
          <Button onClick={() => setShowInitiateWithdrawal(true)}>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Initiate Withdrawal
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : pendingCount}</div>
              <div className="text-xs text-warning">{formatCurrency(pendingTotal)} total</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : approvedTodayCount}</div>
              <div className="text-xs text-success">{formatCurrency(approvedTodayTotal)} processed</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(thisMonthTotal)}</div>
              <div className="text-xs text-muted-foreground">{thisMonthCount} transactions</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2.4h</div>
              <div className="text-xs text-success">-30min from last month</div>
            </CardContent>
          </Card>
        </div>

        {/* Withdrawals Tabs */}
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Approvals
              <Badge variant="secondary" className="ml-1">
                {pendingWithdrawals.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="processed">Processed Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pending Withdrawal Requests</CardTitle>
                    <CardDescription>Review and approve or decline withdrawal requests</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search requests..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Account Details</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mt-2">Loading withdrawal requests...</p>
                        </TableCell>
                      </TableRow>
                    ) : pendingWithdrawals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <p className="text-sm text-muted-foreground">No pending withdrawal requests</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingWithdrawals.map((withdrawal) => {
                        const dateInfo = formatDate(withdrawal.createdAt)
                        return (
                          <TableRow key={withdrawal.id}>
                            <TableCell className="font-medium">{withdrawal.withdrawalRequestId.substring(0, 8).toUpperCase()}</TableCell>
                            <TableCell>{getUserName(withdrawal.userId)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(withdrawal.requestAmount)}</TableCell>
                            <TableCell className="max-w-32 truncate">{withdrawal.narration}</TableCell>
                            <TableCell className="text-sm">{withdrawal.destinationBankName} - {withdrawal.destinationBankAccountNumber}</TableCell>
                            <TableCell>
                              <div>
                                <div className="text-sm">{dateInfo.date}</div>
                                <div className="text-xs text-muted-foreground">{dateInfo.time}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Withdrawal Request Details</DialogTitle>
                                      <DialogDescription>
                                        Review the complete withdrawal request information
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                          <label className="text-sm font-medium">Request ID</label>
                                          <div className="text-sm">{withdrawal.withdrawalRequestId.substring(0, 12).toUpperCase()}</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">User</label>
                                          <div className="text-sm">{getUserName(withdrawal.userId)}</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Amount</label>
                                          <div className="text-lg font-semibold">{formatCurrency(withdrawal.requestAmount)}</div>
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium">Request Date</label>
                                          <div className="text-sm">
                                            {dateInfo.date} at {dateInfo.time}
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Reason for Withdrawal</label>
                                        <div className="text-sm mt-1">{withdrawal.narration}</div>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Account Details</label>
                                        <div className="text-sm mt-1">{withdrawal.destinationBankCode} - {withdrawal.destinationBankAccountNumber}</div>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => handleDecline(withdrawal)}>
                                        <X className="h-4 w-4 mr-2" />
                                        Decline
                                      </Button>
                                      <Button onClick={() => handleApprove(withdrawal)}>
                                        <Check className="h-4 w-4 mr-2" />
                                        Approve
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button size="sm" onClick={() => handleApprove(withdrawal)}>
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleDecline(withdrawal)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      }))
                    }
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processed">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Processed Withdrawal Requests</CardTitle>
                    <CardDescription>History of approved and declined withdrawal requests</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Processed By</TableHead>
                      <TableHead>Processed Date</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mt-2">Loading processed requests...</p>
                        </TableCell>
                      </TableRow>
                    ) : processedWithdrawals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <p className="text-sm text-muted-foreground">No processed withdrawal requests</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      processedWithdrawals.map((withdrawal) => {
                        const dateInfo = formatDate(withdrawal.updatedAt)
                        return (
                          <TableRow key={withdrawal.id}>
                            <TableCell className="font-medium">{withdrawal.withdrawalRequestId.substring(0, 8).toUpperCase()}</TableCell>
                            <TableCell>{getUserName(withdrawal.userId)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(withdrawal.totalTransferableAmount)}</TableCell>
                            <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                            <TableCell>{withdrawal.approvedBy || withdrawal.rejectedBy || "Admin User"}</TableCell>
                            <TableCell>{dateInfo.date}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {withdrawal.status === "declined" ? (withdrawal as any).declineReason || "Declined" : "Approved"}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Confirmation Dialog */}
        <Dialog
          open={!!actionType}
          onOpenChange={() => {
            setActionType(null)
            setSelectedWithdrawal(null)
            setDeclineReason("")
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionType === "approve" ? "Approve Withdrawal" : "Decline Withdrawal"}</DialogTitle>
              <DialogDescription>
                {actionType === "approve"
                  ? "Are you sure you want to approve this withdrawal request?"
                  : "Please provide a reason for declining this withdrawal request."}
              </DialogDescription>
            </DialogHeader>
            {selectedWithdrawal && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">User</label>
                      <div className="text-sm">{getUserName(selectedWithdrawal.userId)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Amount</label>
                      <div className="text-lg font-semibold">{formatCurrency(selectedWithdrawal.requestAmount)}</div>
                    </div>
                  </div>
                </div>
                {actionType === "decline" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reason for Decline</label>
                    <Textarea
                      placeholder="Enter reason for declining this withdrawal request..."
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setActionType(null)
                  setSelectedWithdrawal(null)
                  setDeclineReason("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmAction}
                variant={actionType === "approve" ? "default" : "destructive"}
                disabled={actionType === "decline" && !declineReason.trim()}
              >
                {actionType === "approve" ? "Approve" : "Decline"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Initiate Withdrawal Dialog */}
        <Dialog open={showInitiateWithdrawal} onOpenChange={setShowInitiateWithdrawal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Initiate Withdrawal</DialogTitle>
              <DialogDescription>Create a new withdrawal request for a user</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user">Select User *</Label>
                  <Select
                    value={newWithdrawal.userId}
                    onValueChange={(value) => setNewWithdrawal({ ...newWithdrawal, userId: value })}
                  >
                    <SelectTrigger id="user">
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map((user) => (
                        <SelectItem key={user.uid} value={user.uid}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="savings">Savings Plan *</Label>
                  <Select
                    value={newWithdrawal.savingsId}
                    onValueChange={(value) => setNewWithdrawal({ ...newWithdrawal, savingsId: value })}
                    disabled={!newWithdrawal.userId}
                  >
                    <SelectTrigger id="savings">
                      <SelectValue placeholder={newWithdrawal.userId ? "Choose savings plan..." : "Select user first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {userSavingsPlans.length === 0 ? (
                        <SelectItem value="none" disabled>No active savings plans</SelectItem>
                      ) : (
                        userSavingsPlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.savingsId}>
                            {plan.savingsName} - ₦{plan.actualAmount.toLocaleString()}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Request Amount (₦) *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter withdrawal amount"
                  value={newWithdrawal.requestAmount}
                  onChange={(e) => setNewWithdrawal({ ...newWithdrawal, requestAmount: e.target.value })}
                />
                {newWithdrawal.requestAmount && selectedPlan && (() => {
                  const requestAmount = parseFloat(newWithdrawal.requestAmount)
                  const details = calculateWithdrawalDetails(selectedPlan, requestAmount)

                  return (
                    <div className="space-y-2 mt-2 p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">Plan Status:</span>
                        <Badge className={details.isCompleted ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}>
                          {details.isCompleted ? "Completed" : "Broken Early"}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Request Amount:</span>
                        <span className="font-medium">₦{requestAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Breaking Fee ({(details.feePercentage * 100).toFixed(0)}%):</span>
                        <span className="font-medium text-warning">₦{details.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t pt-2">
                        <span className="font-medium">Total Deducted:</span>
                        <span className="font-semibold">₦{details.totalDeducted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Available in Savings:</span>
                        <span className="font-medium">₦{selectedPlan.actualAmount.toLocaleString()}</span>
                      </div>
                      {details.hasSufficientFunds && !details.isPartialWithdrawal && (
                        <div className="flex justify-between text-xs border-t pt-2">
                          <span className="text-muted-foreground">Remaining Balance:</span>
                          <span className="font-medium">₦{details.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {details.hasSufficientFunds && details.isPartialWithdrawal && details.actualAmountReceived < requestAmount && (
                        <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-warning font-medium">⚠ Partial Withdrawal</span>
                          </div>
                          <div className="mt-1 text-warning/80">
                            After deducting the {(details.feePercentage * 100).toFixed(0)}% fee (₦{details.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}), you'll receive ₦{details.actualAmountReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (not ₦{requestAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </div>
                          <div className="text-xs text-warning/70 mt-1">
                            Final savings balance: ₦{details.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}
                      {!details.hasSufficientFunds && (
                        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-destructive font-medium">⚠ Insufficient Funds!</span>
                          </div>
                          <div className="mt-1 text-destructive/80">
                            You're requesting ₦{requestAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} but only have ₦{selectedPlan.actualAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available.
                          </div>
                        </div>
                      )}
                      {details.hasSufficientFunds && (
                        <div className="flex justify-between text-xs border-t pt-2">
                          <span className="font-medium text-success">You'll Receive:</span>
                          <span className="font-semibold text-success">₦{details.actualAmountReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="narration">Narration/Reason *</Label>
                <Textarea
                  id="narration"
                  placeholder="e.g., Withdrawal from House Rent"
                  value={newWithdrawal.narration}
                  onChange={(e) => setNewWithdrawal({ ...newWithdrawal, narration: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name *</Label>
                  <Input
                    id="bankName"
                    placeholder="e.g., GTBank"
                    value={newWithdrawal.destinationBankName}
                    onChange={(e) => setNewWithdrawal({ ...newWithdrawal, destinationBankName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number *</Label>
                  <Input
                    id="accountNumber"
                    placeholder="0114672030"
                    value={newWithdrawal.destinationBankAccountNumber}
                    onChange={(e) => setNewWithdrawal({ ...newWithdrawal, destinationBankAccountNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankCode">Bank Code *</Label>
                  <Input
                    id="bankCode"
                    placeholder="044"
                    value={newWithdrawal.destinationBankCode}
                    onChange={(e) => setNewWithdrawal({ ...newWithdrawal, destinationBankCode: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => setShowInitiateWithdrawal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleInitiateWithdrawal}
                disabled={
                  submitting ||
                  !newWithdrawal.userId ||
                  !newWithdrawal.savingsId ||
                  !newWithdrawal.requestAmount ||
                  !newWithdrawal.narration ||
                  !newWithdrawal.destinationBankName ||
                  !newWithdrawal.destinationBankAccountNumber ||
                  !newWithdrawal.destinationBankCode ||
                  !!(selectedPlan && newWithdrawal.requestAmount && !calculateWithdrawalDetails(selectedPlan, parseFloat(newWithdrawal.requestAmount)).hasSufficientFunds)
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Withdrawal Request"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
