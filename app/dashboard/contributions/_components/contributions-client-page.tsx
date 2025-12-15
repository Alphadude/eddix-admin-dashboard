"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Download, Plus, Loader2, Check, ChevronsUpDown } from "lucide-react"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase_config"
import { collection, getDocs, query, orderBy, Timestamp, where, addDoc, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore"
import { startOfDay, startOfWeek, startOfMonth } from "date-fns"
import { v4 as uuidv4 } from "uuid"
import { cn } from "@/lib/utils"
import { toast, Toaster } from "react-hot-toast"

interface Transaction {
  transactionId: string
  userId: string
  amount: number
  createdAt: Timestamp
  updatedAt: Timestamp
  description: string
  ref: string
  savingsName?: string
  savingsPlanId?: string
  status: string
  type: string
  trxMethod?: string
}

interface UserData {
  uid: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  status: string
}

interface SavingsPlan {
  id: string
  userId: string
  savingsId: string
  savingsName: string
  targetAmount: number
  actualAmount: number
  frequency: string
  frequencyAmount: number
  duration: string
  status: string
  startDate: Timestamp
  endDate: Timestamp
  createdAt: Timestamp
}

export function ContributionsClientPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddContribution, setShowAddContribution] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [users, setUsers] = useState<Record<string, UserData>>({})
  const [allUsers, setAllUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [openUserSelect, setOpenUserSelect] = useState(false)
  const [openSavingsPlanSelect, setOpenSavingsPlanSelect] = useState(false)
  const [userSavingsPlans, setUserSavingsPlans] = useState<SavingsPlan[]>([])
  const [loadingSavingsPlans, setLoadingSavingsPlans] = useState(false)
  const [newContribution, setNewContribution] = useState({
    userId: "",
    amount: "",
    savingsPlanId: "",
    reference: "",
    trxMethod: "",
  })

  // Fetch transactions and users from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        if (!db) {
          console.error("Firebase not initialized")
          setLoading(false)
          return
        }

        // Fetch all transactions
        const transactionsRef = collection(db, "transactions")
        const q = query(transactionsRef, orderBy("createdAt", "desc"))
        const transactionsSnapshot = await getDocs(q)

        const transactionsData = transactionsSnapshot.docs.map((doc) => ({
          transactionId: doc.id,
          ...doc.data(),
        })) as Transaction[]

        setTransactions(transactionsData)

        // Fetch ALL users for both display and form dropdown
        const usersRef = collection(db, "users")
        const usersSnapshot = await getDocs(usersRef)

        const usersData: Record<string, UserData> = {}
        const allUsersArray: UserData[] = []

        usersSnapshot.docs.forEach((doc) => {
          const userData = { uid: doc.id, ...doc.data() } as UserData
          usersData[doc.id] = userData
          allUsersArray.push(userData)
        })

        setUsers(usersData)
        setAllUsers(allUsersArray)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Fetch user's savings plans when user is selected
  const fetchUserSavingsPlans = async (userId: string) => {
    try {
      setLoadingSavingsPlans(true)
      setUserSavingsPlans([])

      if (!db) {
        console.error("Firebase not initialized")
        setLoadingSavingsPlans(false)
        return
      }

      const savingsRef = collection(db, "savings")
      const q = query(savingsRef, where("userId", "==", userId), where("status", "==", "active"))
      const savingsSnapshot = await getDocs(q)

      const savingsData = savingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SavingsPlan[]

      setUserSavingsPlans(savingsData)
      setLoadingSavingsPlans(false)
    } catch (error) {
      console.error("Error fetching savings plans:", error)
      setLoadingSavingsPlans(false)
    }
  }


  // Calculate stats from real data
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  const totalToday = transactions
    .filter((t) => {
      const txDate = t.createdAt?.toDate()
      return txDate && txDate >= todayStart && t.status === "completed"
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const totalWeek = transactions
    .filter((t) => {
      const txDate = t.createdAt?.toDate()
      return txDate && txDate >= weekStart && t.status === "completed"
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const totalMonth = transactions
    .filter((t) => {
      const txDate = t.createdAt?.toDate()
      return txDate && txDate >= monthStart && t.status === "completed"
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const totalProcessing = transactions
    .filter((t) => t.status === "processing")
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const filteredContributions = transactions.filter((transaction) => {
    const user = users[transaction.userId]
    const userName = user ? `${user.firstName} ${user.lastName}` : "Unknown User"

    const matchesSearch =
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.ref.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || transaction.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>
      case "processing":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Processing</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleAddContribution = async () => {
    if (!newContribution.userId || !newContribution.amount || !newContribution.savingsPlanId || !newContribution.trxMethod) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      setSubmitting(true)

      if (!db) {
        throw new Error("Firebase not initialized")
      }

      // Find the selected savings plan
      const selectedPlan = userSavingsPlans.find(plan => plan.id === newContribution.savingsPlanId)
      if (!selectedPlan) {
        throw new Error("Selected savings plan not found")
      }

      // Generate unique IDs
      const transactionId = uuidv4()
      const ref = newContribution.reference || `REF${Date.now()}`

      // Create transaction document
      const transactionData = {
        amount: parseFloat(newContribution.amount),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        description: `Manual contribution: ${selectedPlan.savingsName}`,
        ref: ref,
        savingsName: selectedPlan.savingsName,
        savingsPlanId: selectedPlan.savingsId,
        status: "completed",
        transactionId: transactionId,
        type: "credit",
        userId: newContribution.userId,
        trxMethod: newContribution.trxMethod || "cash",
      }

      // Add transaction to Firebase
      await addDoc(collection(db, "transactions"), transactionData)

      // Update the savings plan's actualAmount
      const savingsPlanRef = doc(db, "savings", newContribution.savingsPlanId)
      await updateDoc(savingsPlanRef, {
        actualAmount: increment(parseFloat(newContribution.amount))
      })

      // Reset form
      setNewContribution({
        userId: "",
        amount: "",
        savingsPlanId: "",
        reference: "",
        trxMethod: "",
      })
      setUserSavingsPlans([])
      setShowAddContribution(false)

      // Refresh transactions list
      const transactionsRef = collection(db, "transactions")
      const q = query(transactionsRef, orderBy("createdAt", "desc"))
      const transactionsSnapshot = await getDocs(q)
      const transactionsData = transactionsSnapshot.docs.map((doc) => ({
        transactionId: doc.id,
        ...doc.data(),
      })) as Transaction[]
      setTransactions(transactionsData)

      toast.success(`Contribution of ₦${parseFloat(newContribution.amount).toLocaleString()} added successfully to ${selectedPlan.savingsName}!`)
    } catch (error: any) {
      console.error("Error adding contribution:", error)
      toast.error(`Failed to add contribution: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatDateTime = (timestamp: Timestamp) => {
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

  return (
    <DashboardLayout>
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contributions</h1>
          <p className="text-muted-foreground">Manage and track all contribution transactions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalToday)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalWeek)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalMonth)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalProcessing)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contributions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Contributions</CardTitle>
                <CardDescription>All contribution transactions with search and filter options</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search contributions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button size="sm" onClick={() => setShowAddContribution(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contribution
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Savings Plan</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">Loading contributions...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredContributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      <p className="text-sm text-muted-foreground">No contributions found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContributions.map((transaction) => {
                    const user = users[transaction.userId]
                    const userName = user ? `${user.firstName} ${user.lastName}` : "Unknown User"
                    const { date, time } = formatDateTime(transaction.createdAt)

                    return (
                      <TableRow key={transaction.transactionId}>
                        <TableCell className="font-medium">{transaction.transactionId.substring(0, 8)}...</TableCell>
                        <TableCell>{userName}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(transaction.amount)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">{date}</div>
                            <div className="text-xs text-muted-foreground">{time}</div>
                          </div>
                        </TableCell>
                        <TableCell>{transaction.savingsName || "N/A"}</TableCell>
                        <TableCell>
                          <span className="capitalize">{transaction.trxMethod || "N/A"}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{transaction.ref}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog for adding new contribution */}
        <Dialog open={showAddContribution} onOpenChange={setShowAddContribution}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Manual Contribution</DialogTitle>
              <DialogDescription>Record a contribution made directly to the admin</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user">Select User *</Label>
                <Select
                  value={newContribution.userId}
                  onValueChange={(value) => {
                    setNewContribution({ ...newContribution, userId: value, savingsPlanId: "" })
                    fetchUserSavingsPlans(value)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((user) => (
                      <SelectItem key={user.uid} value={user.uid}>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.firstName} {user.lastName}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₦) *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={newContribution.amount}
                  onChange={(e) => setNewContribution({ ...newContribution, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trxMethod">Payment Method *</Label>
                <Select
                  value={newContribution.trxMethod}
                  onValueChange={(value) => {
                    setNewContribution({ ...newContribution, trxMethod: value })
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="mobile">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="savingsPlan">Select Savings Plan *</Label>
                <Select
                  value={newContribution.savingsPlanId}
                  onValueChange={(value) => {
                    setNewContribution({ ...newContribution, savingsPlanId: value })
                  }}
                  disabled={!newContribution.userId || loadingSavingsPlans}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      loadingSavingsPlans
                        ? "Loading plans..."
                        : !newContribution.userId
                          ? "Select a user first"
                          : "Select savings plan..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {userSavingsPlans.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        {!newContribution.userId
                          ? "Please select a user first"
                          : "No active savings plans found for this user"}
                      </div>
                    ) : (
                      userSavingsPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{plan.savingsName}</span>
                            <span className="text-xs text-muted-foreground">
                              ₦{plan.actualAmount.toLocaleString()} / ₦{plan.targetAmount.toLocaleString()} • {plan.frequency}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!newContribution.userId && (
                  <p className="text-xs text-muted-foreground">Select a user to view their savings plans</p>
                )}
                {newContribution.userId && !loadingSavingsPlans && userSavingsPlans.length === 0 && (
                  <p className="text-xs text-destructive">This user has no active savings plans</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference Number (Optional)</Label>
                <Input
                  id="reference"
                  placeholder="Enter reference number"
                  value={newContribution.reference}
                  onChange={(e) => setNewContribution({ ...newContribution, reference: e.target.value })}
                />
              </div>

            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => setShowAddContribution(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddContribution}
                disabled={!newContribution.userId || !newContribution.amount || !newContribution.savingsPlanId || !newContribution.trxMethod || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Contribution"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
