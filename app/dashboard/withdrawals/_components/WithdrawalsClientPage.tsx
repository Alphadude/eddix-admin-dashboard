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
import {
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
  where,
  getDoc,
} from "firebase/firestore"
import { toast, Toaster } from "react-hot-toast"
import { formatDistanceToNow } from "date-fns"
import { v4 as uuidv4 } from "uuid"
import {
  initiateSingleTransfer,
  getSingleTransferStatus,
  getWalletBalance,
  formatMonnifyError,
  isTransferSuccessful,
  MONNIFY_ACCOUNT_NUMBER,
  authorizeSingleTransfer,
  resendOTP
} from "@/lib/monnifyService"
import { Pagination, usePagination } from "@/components/ui/pagination"

interface WithdrawalRequest {
  id: string
  withdrawalRequestId: string
  breakingFeePercentage: number
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
  isInitialized?: boolean
  monnifyTransferReference?: string
  monnifyTransferStatus?: string
  transactionId?: string
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

interface Bank {
  id: string
  userId: string
  accountName: string
  accountNumber: string
  bankName: string
  bankCode: string
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export default function WithdrawalsClientPage() {
  // Fee percentages - fetched from Firebase (default values as fallback)
  const [completedPlanFeePercentage, setCompletedPlanFeePercentage] = useState(0.10)  // Default 10%
  const [brokenPlanFeePercentage, setBrokenPlanFeePercentage] = useState(0.20)        // Default 20%
  
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
  const [loadingBankDetails, setLoadingBankDetails] = useState(false)

  // Monnify transfer state
  const [processingTransfer, setProcessingTransfer] = useState(false)
  const [transferStatus, setTransferStatus] = useState<string>("")

  // OTP Authorization state
  const [showOTPDialog, setShowOTPDialog] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [withdrawalForAuth, setWithdrawalForAuth] = useState<WithdrawalRequest | null>(null)
  const [resendingOTP, setResendingOTP] = useState(false)

  // Reversal confirmation state
  const [showReverseDialog, setShowReverseDialog] = useState(false)
  const [withdrawalToReverse, setWithdrawalToReverse] = useState<WithdrawalRequest | null>(null)

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

  // Fetch withdrawal fee percentages from Firebase
  useEffect(() => {
    const fetchWithdrawalFees = async () => {
      try {
        if (!db) return

        const feeDocRef = doc(db, "feesManagement", "withdrawalFees")
        const feeDoc = await getDoc(feeDocRef)

        if (feeDoc.exists()) {
          const data = feeDoc.data()
          // Convert percentage to decimal (e.g., 10 -> 0.10)
          setCompletedPlanFeePercentage((data.completedPlanFeePercentage || 10) / 100)
          setBrokenPlanFeePercentage((data.brokenPlanFeePercentage || 20) / 100)
        }
      } catch (error) {
        console.error("Error fetching withdrawal fees:", error)
        // Keep default values if fetch fails
      }
    }

    fetchWithdrawalFees()
  }, [])

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
    const feePercentage = isCompleted ? completedPlanFeePercentage : brokenPlanFeePercentage
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

  // Reusable function to fetch withdrawal requests
  const fetchWithdrawalRequests = async () => {
    try {
      if (!db) {
        console.error("Firebase not initialized")
        return
      }

      const withdrawalsRef = collection(db, "withdrawalRequests")
      const withdrawalsQuery = query(withdrawalsRef, orderBy("createdAt", "desc"))
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery)

      const withdrawalsData = withdrawalsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WithdrawalRequest[]

      setWithdrawalRequests(withdrawalsData)
    } catch (error) {
      console.error("Error fetching withdrawal requests:", error)
      toast.error("Failed to load withdrawal requests")
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

  // Fetch and populate bank details when user is selected
  useEffect(() => {
    const fetchUserBankDetails = async () => {
      if (!newWithdrawal.userId || !db) return

      try {
        setLoadingBankDetails(true)

        // Query for active bank of the selected user
        const banksQuery = query(
          collection(db, "banks"),
          where("userId", "==", newWithdrawal.userId),
          where("isActive", "==", true)
        )

        const banksSnapshot = await getDocs(banksQuery)

        if (!banksSnapshot.empty) {
          const bankData = banksSnapshot.docs[0].data() as Bank

          // Auto-populate bank details
          setNewWithdrawal(prev => ({
            ...prev,
            destinationBankName: bankData.bankName,
            destinationBankAccountNumber: bankData.accountNumber,
            destinationBankCode: bankData.bankCode,
          }))

          toast.success("Bank details loaded successfully")
        } else {
          // Clear bank details if no active bank found
          setNewWithdrawal(prev => ({
            ...prev,
            destinationBankName: "",
            destinationBankAccountNumber: "",
            destinationBankCode: "",
          }))

          toast.error("No active bank account found for this user")
        }
      } catch (error) {
        console.error("Error fetching bank details:", error)
        toast.error("Failed to load bank details")
      } finally {
        setLoadingBankDetails(false)
      }
    }

    fetchUserBankDetails()
  }, [newWithdrawal.userId])

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
  const processedWithdrawals = withdrawalRequests.filter(w => w.status === "approved" || w.status === "declined" || w.status === "reversed")

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

  // Add pagination for pending withdrawals
  const {
    currentPage: pendingCurrentPage,
    totalPages: pendingTotalPages,
    paginatedItems: paginatedPendingWithdrawals,
    setCurrentPage: setPendingCurrentPage,
    totalItems: pendingTotalItems,
    itemsPerPage: pendingItemsPerPage,
  } = usePagination(pendingWithdrawals, 6)

  // Add pagination for processed withdrawals
  const {
    currentPage: processedCurrentPage,
    totalPages: processedTotalPages,
    paginatedItems: paginatedProcessedWithdrawals,
    setCurrentPage: setProcessedCurrentPage,
    totalItems: processedTotalItems,
    itemsPerPage: processedItemsPerPage,
  } = usePagination(processedWithdrawals, 6)

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
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200" variant="outline">{status}</Badge>
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

  // Handle OTP Authorization
  const handleAuthorizeWithdrawal = async () => {
    if (!withdrawalForAuth || !otpCode.trim()) {
      toast.error("Please enter the OTP code")
      return
    }

    try {
      setSubmitting(true)
      setTransferStatus("Authorizing transfer with OTP...")

      // Authorize the transfer with OTP
      const authResponse = await authorizeSingleTransfer(
        withdrawalForAuth.requestedTransferRef!,
        otpCode
      )
      if (authResponse.requestSuccessful === false) {
        toast.error(authResponse.responseMessage)
        return
      }
      console.log("Authorization response:", authResponse)

      // Update withdrawal status to approved
      const withdrawalRef = doc(db, "withdrawalRequests", withdrawalForAuth.id)
      await updateDoc(withdrawalRef, {
        status: "approved",
        monnifyTransferStatus: authResponse.responseBody.status,
        transferCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Update the linked transaction status from pending to completed
      if (withdrawalForAuth.transactionId) {
        const transactionsRef = collection(db, "transactions")
        const transactionQuery = query(transactionsRef, where("transactionId", "==", withdrawalForAuth.transactionId))
        const transactionSnapshot = await getDocs(transactionQuery)

        if (!transactionSnapshot.empty) {
          const transactionDoc = transactionSnapshot.docs[0]
          await updateDoc(doc(db, "transactions", transactionDoc.id), {
            status: "completed",
            monnifyReference: authResponse.responseBody.transactionReference || "",
            updatedAt: serverTimestamp(),
          })
        }
      }

      toast.success(`Withdrawal authorized successfully! ₦${withdrawalForAuth.totalTransferableAmount.toLocaleString()} transferred.`)

      setShowOTPDialog(false)
      setOtpCode("")
      setWithdrawalForAuth(null)
      await fetchWithdrawalRequests()
    } catch (error) {
      console.error("Error authorizing withdrawal:", error)
      toast.error(`Authorization failed: ${formatMonnifyError(error)}`)
    } finally {
      setSubmitting(false)
      setTransferStatus("")
    }
  }

  // Handle Resend OTP
  const handleResendOTP = async (withdrawal: WithdrawalRequest) => {
    if (!withdrawal.requestedTransferRef) {
      toast.error("No transfer reference found")
      return
    }

    try {
      setResendingOTP(true)
      const resendOTPResponse = await resendOTP(withdrawal.requestedTransferRef)
      if (resendOTPResponse.responseCode == "D01") {
        toast.error(resendOTPResponse.responseMessage)
        return
      }
      // console.log("Resend OTP response33:", resendOTPResponse)
      toast.success(resendOTPResponse.responseMessage)
    } catch (error) {
      console.error("Error resending OTP:", error)
      toast.error(`Failed to resend OTP: ${formatMonnifyError(error)}`)
    } finally {
      setResendingOTP(false)
    }
  }

  // Handle Manual Reversal - Opens confirmation dialog
  const handleReverseWithdrawal = (withdrawal: WithdrawalRequest) => {
    setWithdrawalToReverse(withdrawal)
    setShowReverseDialog(true)
  }

  // Confirm and execute the reversal
  const confirmReversal = async () => {
    if (!withdrawalToReverse) return

    try {
      setSubmitting(true)
      setTransferStatus("Reversing withdrawal...")

      // Reverse the money back to savings plan
      const savingsSnapshot = await getDocs(query(collection(db, "savings"), where("savingsId", "==", withdrawalToReverse.savingsId)))
      const savingsDoc = savingsSnapshot.docs[0]
      const savingsName = savingsDoc.data().savingsName
      if (!savingsSnapshot.empty) {
        const currentAmount = savingsDoc.data().actualAmount || 0

        await updateDoc(doc(db, "savings", savingsDoc.id), {
          actualAmount: currentAmount + withdrawalToReverse.totalDeductedAmount,
          updatedAt: serverTimestamp(),
        })
      }

      // Update the original transaction to failed
      if (withdrawalToReverse.transactionId) {
        const transactionsRef = collection(db, "transactions")
        const transactionQuery = query(transactionsRef, where("transactionId", "==", withdrawalToReverse.transactionId))
        const transactionSnapshot = await getDocs(transactionQuery)

        if (!transactionSnapshot.empty) {
          const transactionDoc = transactionSnapshot.docs[0]
          await updateDoc(doc(db, "transactions", transactionDoc.id), {
            status: "failed",
            updatedAt: serverTimestamp(),
          })
        }
      }



      // Create a reversal credit transaction
      await addDoc(collection(db, "transactions"), {
        transactionId: uuidv4(),
        userId: withdrawalToReverse.userId,
        type: "credit",
        amount: withdrawalToReverse.totalTransferableAmount,
        description: "Reversed: Manual reversal by admin",
        ref: `REV-${withdrawalToReverse.requestedTransferRef}`,
        status: "completed",
        savingsName: savingsName,
        savingsPlanId: withdrawalToReverse.savingsId,
        trxMethod: "bank",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Update withdrawal status to reversed
      const withdrawalRef = doc(db, "withdrawalRequests", withdrawalToReverse.id)
      await updateDoc(withdrawalRef, {
        status: "reversed",
        rejectedBy: "Admin - Manual Reversal",
        updatedAt: serverTimestamp(),
      })

      toast.success(`Withdrawal reversed successfully! ₦${withdrawalToReverse.totalTransferableAmount.toLocaleString()} returned to savings.`)
      await fetchWithdrawalRequests()

      // Close dialog and reset state
      setShowReverseDialog(false)
      setWithdrawalToReverse(null)
    } catch (error) {
      console.error("Error reversing withdrawal:", error)
      toast.error(`Failed to reverse withdrawal: ${formatMonnifyError(error)}`)
    } finally {
      setSubmitting(false)
      setTransferStatus("")
    }
  }

  const confirmAction = async () => {
    if (!selectedWithdrawal || !db) return

    try {
      setSubmitting(true)
      const withdrawalRef = doc(db, "withdrawalRequests", selectedWithdrawal.id)

      if (actionType === "approve") {
        // Step 1: Check Monnify wallet balance (optional - will warn but not block)
        setTransferStatus("Checking wallet balance...")
        try {
          const walletBalance = await getWalletBalance()
          const requiredAmount = selectedWithdrawal.totalTransferableAmount

          // Estimate Monnify fee (₦10 for < ₦10k, ₦20 for ₦10k-₦50k, ₦40 for ≥ ₦50k)
          const estimatedFee = requiredAmount < 10000 ? 10 : requiredAmount < 50000 ? 20 : 40
          const totalRequired = requiredAmount + estimatedFee

          if (walletBalance.availableBalance < totalRequired) {
            toast.error(
              `Warning: Insufficient Monnify wallet balance! Required: ₦${totalRequired.toLocaleString()} (₦${requiredAmount.toLocaleString()} + ₦${estimatedFee} fee), Available: ₦${walletBalance.availableBalance.toLocaleString()}. Transfer will be attempted anyway.`,
              { duration: 6000 }
            )
          } else {
            toast.success(`Wallet balance confirmed: ₦${walletBalance.availableBalance.toLocaleString()}`)
          }
        } catch (balanceError) {
          console.error("Error checking wallet balance:", balanceError)
          // Don't block the transfer - just warn the user
          toast.error(
            `Could not verify wallet balance: ${formatMonnifyError(balanceError)}. Proceeding with transfer anyway...`,
            { duration: 5000 }
          )
        }

        // Step 2: Initiate Monnify transfer
        setProcessingTransfer(true)
        setTransferStatus("Initiating transfer to user...")

        try {
          const transferResponse = await initiateSingleTransfer({
            amount: selectedWithdrawal.totalTransferableAmount,
            reference: selectedWithdrawal.requestedTransferRef!, // Always generate unique reference
            narration: selectedWithdrawal.narration || "Withdrawal payment",
            destinationBankCode: selectedWithdrawal.destinationBankCode,
            destinationAccountNumber: selectedWithdrawal.destinationBankAccountNumber,
            currency: "NGN",
            sourceAccountNumber: MONNIFY_ACCOUNT_NUMBER,
            async: false, // Synchronous transfer for immediate feedback
          })
          // console.log("Transfer response:", transferResponse)

          // Step 3: Check transfer status
          // Check if the API request itself was successful first
          if (!transferResponse.requestSuccessful) {
            toast.error(`Transfer failed: ${transferResponse.responseMessage}`)
            setSubmitting(false)
            setProcessingTransfer(false)
            setTransferStatus("")
            return
          }

          // const transferSuccessful = isTransferSuccessful(transferResponse.responseBody.status)

          // if (!transferSuccessful && transferResponse.responseBody.status !== "PENDING") {
          //   // Transfer failed immediately
          //   toast.error(`Transfer status: ${transferResponse.responseBody.status}`)
          //   setSubmitting(false)
          //   setProcessingTransfer(false)
          //   setTransferStatus("")
          //   return
          // }

          // Step 4: Update withdrawal request with transfer details
          setTransferStatus("Updating withdrawal status...")

          const isPendingAuth = transferResponse.responseBody.status === "PENDING_AUTHORIZATION"
          // console.log("Transfer response:", transferResponse)
          await updateDoc(withdrawalRef, {
            approvedBy: "Admin User", // TODO: Replace with actual admin user ID
            updatedAt: serverTimestamp(),
            monnifyTransferReference: transferResponse.responseBody.reference,
            monnifyTransferStatus: transferResponse.responseBody.status,
            isInitialized: isPendingAuth ? true : false,
            transferCompletedAt: isPendingAuth ? null : serverTimestamp(),
          })

          toast.success(isPendingAuth ?
            `Withdrawal of ₦${selectedWithdrawal.totalTransferableAmount.toLocaleString()} initialized successfully!`
            :
            `Withdrawal of ₦${selectedWithdrawal.totalTransferableAmount.toLocaleString()} approved successfully!`
          )

          setProcessingTransfer(false)
          setTransferStatus("")
        } catch (transferError) {
          console.error("Error processing transfer:", transferError)
          toast.error(`Transfer failed: ${formatMonnifyError(transferError)}`)
          setSubmitting(false)
          setProcessingTransfer(false)
          setTransferStatus("")
          return
        }
      } else if (actionType === "decline") {
        // Update withdrawal request status
        await updateDoc(withdrawalRef, {
          status: "declined",
          rejectedBy: "Admin User", // TODO: Replace with actual admin user ID
          updatedAt: serverTimestamp(),
          declineReason: declineReason,
        })

        // Reverse the deduction - add back the totalDeductedAmount to savings
        // Fetch current savings plan from Firebase (not from stale state)
        const savingsQuery = query(
          collection(db, "savings"),
          where("savingsId", "==", selectedWithdrawal.savingsId)
        )
        const savingsSnapshot = await getDocs(savingsQuery)

        if (!savingsSnapshot.empty) {
          const savingsPlanDoc = savingsSnapshot.docs[0]
          const currentSavingsPlan = savingsPlanDoc.data() as SavingsPlan

          // Restore the full deducted amount
          const restoredAmount = currentSavingsPlan.actualAmount + selectedWithdrawal.totalDeductedAmount

          await updateDoc(doc(db, "savings", savingsPlanDoc.id), {
            actualAmount: restoredAmount,
            updatedAt: serverTimestamp()
          })

          // Refresh savings plans
          const savingsRef = collection(db, "savings")
          const allSavingsSnapshot = await getDocs(savingsRef)
          const savingsData = allSavingsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as SavingsPlan[]
          setSavingsPlans(savingsData)
        }

        toast.success(`Withdrawal request declined and funds restored`)
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

      const requestedTransactionRef = `RQTXN-${Date.now()}`
      const bulkTransactionRef = `BKTXN-${Date.now()}`
      const breakTransactionRef = `BFTXN-${Date.now()}`
      // User receives the actual amount (may be less than requested in partial withdrawals)
      const totalTransferableAmount = withdrawalDetails.actualAmountReceived

      // Step 1: Create a pending debit transaction first
      const transactionId = uuidv4()
      const transactionData = {
        transactionId,
        userId: newWithdrawal.userId,
        type: "debit",
        amount: withdrawalDetails.actualAmountReceived,
        description: `Withdrawal: ${newWithdrawal.narration || "Withdrawal Request"}`,
        ref: requestedTransactionRef,
        status: "pending",
        savingsName: selectedPlan.savingsName,
        savingsPlanId: selectedPlan.savingsId,
        trxMethod: "bank",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await addDoc(collection(db, "transactions"), transactionData)

      // Step 2: Create withdrawal request with transaction ID
      const withdrawalData = {
        withdrawalRequestId: uuidv4(),
        userId: newWithdrawal.userId,
        savingsId: newWithdrawal.savingsId,
        requestAmount: parseFloat(newWithdrawal.requestAmount),
        totalDeductedAmount: withdrawalDetails.totalDeducted,
        totalTransferableAmount: withdrawalDetails.actualAmountReceived,
        destinationBankName: newWithdrawal.destinationBankName,
        destinationBankAccountNumber: newWithdrawal.destinationBankAccountNumber,
        destinationBankCode: newWithdrawal.destinationBankCode,
        narration: newWithdrawal.narration || "Withdrawal Request",
        status: "pending",
        approvedBy: null,
        rejectedBy: null,
        requestedTransferRef: requestedTransactionRef,
        bulkRef: bulkTransactionRef,
        breakingFeeRef: breakTransactionRef,
        breakingFeePercentage: withdrawalDetails.feePercentage,
        isPlanCompleted: withdrawalDetails.isCompleted,
        isPartialWithdrawal: withdrawalDetails.isPartialWithdrawal,
        isInitialized: false,
        transactionId, // Link to the transaction
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await addDoc(collection(db, "withdrawalRequests"), withdrawalData)

      // Deduct the total amount from savings plan's actualAmount
      const savingsDocRef = doc(db, "savings", selectedPlan.id)
      const newActualAmount = selectedPlan.actualAmount - withdrawalDetails.totalDeducted

      await updateDoc(savingsDocRef, {
        actualAmount: newActualAmount,
        updatedAt: serverTimestamp()
      })

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

      // Refresh savings plans to reflect updated balance
      const savingsRef = collection(db, "savings")
      const savingsSnapshot = await getDocs(savingsRef)
      const savingsData = savingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SavingsPlan[]
      setSavingsPlans(savingsData)

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
                      <TableHead>Fee</TableHead>
                      <TableHead>Charge</TableHead>
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
                      paginatedPendingWithdrawals.map((withdrawal) => {
                        const dateInfo = formatDate(withdrawal.createdAt)
                        return (
                          <TableRow key={withdrawal.id}>
                            <TableCell className="font-medium">{withdrawal.withdrawalRequestId.substring(0, 8).toUpperCase()}</TableCell>
                            <TableCell>{getUserName(withdrawal.userId)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(withdrawal.requestAmount)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(withdrawal.totalDeductedAmount - withdrawal.requestAmount)}</TableCell>
                            <TableCell className="font-semibold">{withdrawal.breakingFeePercentage * 100}%</TableCell>
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

                                {/* Show Authorize + Resend OTP buttons if initialized */}
                                {withdrawal.isInitialized && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => {
                                        setWithdrawalForAuth(withdrawal)
                                        setShowOTPDialog(true)
                                      }}
                                    >
                                      Authorize
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleResendOTP(withdrawal)}
                                      disabled={resendingOTP}
                                    >
                                      {resendingOTP ? "Sending..." : "Resend OTP"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleReverseWithdrawal(withdrawal)}
                                      disabled={submitting}
                                    >
                                      Reverse
                                    </Button>
                                  </>
                                )}
                                {!withdrawal.isInitialized && (
                                  <>
                                    <Button size="sm" onClick={() => handleApprove(withdrawal)}>
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDecline(withdrawal)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}

                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      }))
                    }
                  </TableBody>
                </Table>
                {pendingWithdrawals.length > 0 && (
                  <Pagination
                    currentPage={pendingCurrentPage}
                    totalPages={pendingTotalPages}
                    onPageChange={setPendingCurrentPage}
                    itemsPerPage={pendingItemsPerPage}
                    totalItems={pendingTotalItems}
                  />
                )}
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
                      paginatedProcessedWithdrawals.map((withdrawal) => {
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
                {processedWithdrawals.length > 0 && (
                  <Pagination
                    currentPage={processedCurrentPage}
                    totalPages={processedTotalPages}
                    onPageChange={setProcessedCurrentPage}
                    itemsPerPage={processedItemsPerPage}
                    totalItems={processedTotalItems}
                  />
                )}
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

            {/* Transfer Status Feedback */}
            {processingTransfer && transferStatus && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-blue-900">{transferStatus}</p>
                </div>
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
                disabled={submitting || processingTransfer}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmAction}
                variant={actionType === "approve" ? "default" : "destructive"}
                disabled={(actionType === "decline" && !declineReason.trim()) || submitting || processingTransfer}
              >
                {submitting || processingTransfer ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {processingTransfer ? "Processing Transfer..." : "Processing..."}
                  </>
                ) : (
                  actionType === "approve" ? "Approve" : "Decline"
                )}
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
                        <span>Available in Savings:</span>
                        <span className="font-medium">₦{selectedPlan.actualAmount.toLocaleString()}</span>
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
                    disabled={loadingBankDetails}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number *</Label>
                  <Input
                    id="accountNumber"
                    placeholder="0114672030"
                    value={newWithdrawal.destinationBankAccountNumber}
                    onChange={(e) => setNewWithdrawal({ ...newWithdrawal, destinationBankAccountNumber: e.target.value })}
                    disabled={loadingBankDetails}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankCode">Bank Code *</Label>
                  <Input
                    id="bankCode"
                    placeholder="044"
                    value={newWithdrawal.destinationBankCode}
                    onChange={(e) => setNewWithdrawal({ ...newWithdrawal, destinationBankCode: e.target.value })}
                    disabled={loadingBankDetails}
                  />
                </div>
              </div>
              {loadingBankDetails && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading bank details...</span>
                </div>
              )}
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

        {/* OTP Authorization Dialog */}
        <Dialog open={showOTPDialog} onOpenChange={setShowOTPDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Authorize Withdrawal</DialogTitle>
              <DialogDescription>
                Enter the OTP sent to your email to authorize this withdrawal
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mt-2" htmlFor="otp">OTP Code *</Label>
                <Input
                  id="otp"
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowOTPDialog(false)
                  setOtpCode("")
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAuthorizeWithdrawal}
                disabled={submitting || !otpCode.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  "Authorize"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reversal Confirmation Dialog */}
        <Dialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Withdrawal Reversal</DialogTitle>
              <DialogDescription>
                Are you sure you want to reverse this withdrawal? This action will return the funds to the user's savings plan.
              </DialogDescription>
            </DialogHeader>
            {withdrawalToReverse && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Amount:</span>
                    <span className="text-sm font-semibold">₦{withdrawalToReverse.totalTransferableAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">User:</span>
                    <span className="text-sm">{getUserName(withdrawalToReverse.userId)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Bank:</span>
                    <span className="text-sm">{withdrawalToReverse.destinationBankName}</span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowReverseDialog(false)
                  setWithdrawalToReverse(null)
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReversal}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reversing...
                  </>
                ) : (
                  "Confirm Reversal"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
