"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
    Search, 
    Loader2, 
    UserPlus, 
    PiggyBank, 
    ArrowUpCircle, 
    ArrowDownCircle,
    Clock,
    Filter,
    Zap
} from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { db } from "@/lib/firebase_config"
import { collection, getDocs, query, orderBy, Timestamp, limit } from "firebase/firestore"
import { Toaster } from "react-hot-toast"
import { Pagination, usePagination } from "@/components/ui/pagination"

interface Notification {
    id: string
    type: 'registration' | 'savings_created' | 'top_up' | 'withdrawal_initiated' | 'activation' | 'refund'
    userId: string
    userName: string
    details: string
    amount?: number
    createdAt: Timestamp
    status?: string
}

export function NotificationsClientPage() {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchAllActivities = async () => {
            try {
                setLoading(true)
                if (!db) return

                // 1. Fetch Users (Registrations)
                const usersRef = collection(db, "users")
                const usersSnapshot = await getDocs(query(usersRef, orderBy("createdAt", "desc"), limit(50)))
                const usersData = usersSnapshot.docs.map(doc => {
                    const data = doc.data()
                    return {
                        id: doc.id,
                        type: 'registration' as const,
                        userId: doc.id,
                        userName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || "Unknown User",
                        details: `New user registered: ${data.email || ''}`,
                        createdAt: data.createdAt as Timestamp,
                    }
                })

                // 2. Fetch Savings (New Plans)
                const savingsRef = collection(db, "savings")
                const savingsSnapshot = await getDocs(query(savingsRef, orderBy("createdAt", "desc"), limit(50)))
                const usersMap: Record<string, string> = {}
                usersSnapshot.docs.forEach(doc => {
                    const data = doc.data()
                    usersMap[doc.id] = `${data.firstName || ''} ${data.lastName || ''}`.trim()
                })

                const savingsData = savingsSnapshot.docs.map(doc => {
                    const data = doc.data()
                    return {
                        id: doc.id,
                        type: 'savings_created' as const,
                        userId: data.userId,
                        userName: usersMap[data.userId] || "User",
                        details: `Created a new savings plan: "${data.savingsName}"`,
                        amount: data.targetAmount,
                        createdAt: data.createdAt as Timestamp,
                    }
                })

                // 3. Fetch Transactions (Top-ups)
                const transactionsRef = collection(db, "transactions")
                const transactionsSnapshot = await getDocs(query(transactionsRef, orderBy("createdAt", "desc"), limit(100)))
                const topUpsData = transactionsSnapshot.docs
                    .filter(doc => doc.data().type === 'credit')
                    .map(doc => {
                        const data = doc.data()
                        const isRefund = data.ref?.startsWith("REV-") || data.description?.toLowerCase().includes("reversed")
                        return {
                            id: doc.id,
                            type: (isRefund ? 'refund' : 'top_up') as any,
                            userId: data.userId,
                            userName: data.userName || "User", // Fallback if name not in transaction
                            details: isRefund ? `Refunded to savings: ${data.savingsName || 'Plan'}` : `Topped up savings: ${data.savingsName || 'Plan'}`,
                            amount: data.amount,
                            createdAt: data.createdAt as Timestamp,
                            status: data.status,
                        }
                    })

                // 4. Fetch Withdrawal Requests
                const withdrawalsRef = collection(db, "withdrawalRequests")
                const withdrawalsSnapshot = await getDocs(query(withdrawalsRef, orderBy("createdAt", "desc"), limit(50)))
                const withdrawalsData = withdrawalsSnapshot.docs.map(doc => {
                    const data = doc.data()
                    return {
                        id: doc.id,
                        type: 'withdrawal_initiated' as const,
                        userId: data.userId,
                        userName: data.userName || "User",
                        details: `Initiated a withdrawal request`,
                        amount: data.requestAmount,
                        createdAt: data.createdAt as Timestamp,
                        status: data.status,
                    }
                })

                // 5. Extract Activations from Users
                const activationsData = usersSnapshot.docs
                    .filter(doc => doc.data().accountActivated === true && doc.data().activationDate)
                    .map(doc => {
                        const data = doc.data()
                        return {
                            id: `${doc.id}_activation`,
                            type: 'activation' as const,
                            userId: doc.id,
                            userName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || "Unknown User",
                            details: `Activated account`,
                            amount: data.activationAmount || 500,
                            createdAt: data.activationDate as Timestamp,
                        }
                    })

                // Combine and sort
                const combined = [...usersData, ...savingsData, ...topUpsData, ...withdrawalsData, ...activationsData]
                    .filter(n => n.createdAt) // Ensure createdAt exists
                    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())

                // Enrich user names for those missing them (like savings and top-ups if not in data)
                // We'll use the users list we already have
                const finalNotifications = combined.map(n => {
                    if (n.userName === "User" || !n.userName) {
                        const userDoc = usersSnapshot.docs.find(d => d.id === n.userId)
                        if (userDoc) {
                            const d = userDoc.data()
                            n.userName = `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email || "Unknown User"
                        }
                    }
                    return n
                })

                setNotifications(finalNotifications)
                setLoading(false)
            } catch (error) {
                console.error("Error fetching notifications:", error)
                setLoading(false)
            }
        }

        fetchAllActivities()
    }, [])

    const filteredNotifications = notifications.filter(n => {
        const matchesSearch = n.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             n.details.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = typeFilter === "all" || n.type === typeFilter
        return matchesSearch && matchesType
    })

    const {
        currentPage,
        totalPages,
        paginatedItems: paginatedNotifications,
        setCurrentPage,
        totalItems,
        itemsPerPage,
    } = usePagination(filteredNotifications, 10)

    const getIcon = (type: string) => {
        switch (type) {
            case 'registration': return <UserPlus className="h-5 w-5 text-blue-500" />
            case 'savings_created': return <PiggyBank className="h-5 w-5 text-green-500" />
            case 'top_up': return <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
            case 'withdrawal_initiated': return <ArrowDownCircle className="h-5 w-5 text-orange-500" />
            case 'activation': return <Zap className="h-5 w-5 text-yellow-500" />
            case 'refund': return <ArrowUpCircle className="h-5 w-5 text-blue-500" />
            default: return <Clock className="h-5 w-5 text-gray-500" />
        }
    }

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'registration': return <Badge variant="outline" className="text-blue-600 bg-blue-50">Registration</Badge>
            case 'savings_created': return <Badge variant="outline" className="text-green-600 bg-green-50">Savings Created</Badge>
            case 'top_up': return <Badge variant="outline" className="text-emerald-600 bg-emerald-50">Top-up</Badge>
            case 'withdrawal_initiated': return <Badge variant="outline" className="text-orange-600 bg-orange-50">Withdrawal</Badge>
            case 'activation': return <Badge variant="outline" className="text-yellow-600 bg-yellow-50">Activation</Badge>
            case 'refund': return <Badge variant="outline" className="text-blue-600 bg-blue-50">Refund</Badge>
            default: return <Badge variant="outline">Action</Badge>
        }
    }

    const formatCurrency = (amount?: number) => {
        if (amount === undefined) return null
        return `₦${amount.toLocaleString()}`
    }

    const formatTimeAgo = (timestamp: Timestamp) => {
        if (!timestamp) return "N/A"
        const date = timestamp.toDate()
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
        
        if (seconds < 60) return "Just now"
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
        return date.toLocaleDateString()
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" />
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">System Notifications</h1>
                        <p className="text-muted-foreground mt-2">Track all user activities and platform actions in real-time</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle>Activity Feed</CardTitle>
                                <CardDescription>Real-time audit log of all system events</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                    <Input
                                        placeholder="Search activities..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 w-full md:w-64"
                                    />
                                </div>
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="w-40">
                                        <Filter className="w-4 h-4 mr-2" />
                                        <SelectValue placeholder="All Actions" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Actions</SelectItem>
                                        <SelectItem value="registration">Registrations</SelectItem>
                                        <SelectItem value="savings_created">Savings Plans</SelectItem>
                                        <SelectItem value="top_up">Top-ups</SelectItem>
                                        <SelectItem value="withdrawal_initiated">Withdrawals</SelectItem>
                                        <SelectItem value="activation">Activations</SelectItem>
                                        <SelectItem value="refund">Refunds</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                                <p className="text-muted-foreground font-medium">Gathering platform activities...</p>
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed rounded-xl">
                                <p className="text-muted-foreground">No activities found matching your criteria</p>
                                <Button 
                                    variant="link" 
                                    onClick={() => {setSearchTerm(""); setTypeFilter("all")}}
                                    className="mt-2"
                                >
                                    Clear all filters
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {paginatedNotifications.map((notification) => (
                                    <div 
                                        key={notification.id} 
                                        onClick={() => {
                                            switch (notification.type) {
                                                case 'registration':
                                                case 'activation':
                                                    router.push("/dashboard/users")
                                                    break
                                                case 'savings_created':
                                                    router.push("/dashboard/savings")
                                                    break
                                                case 'top_up':
                                                case 'refund':
                                                    router.push("/dashboard/contributions")
                                                    break
                                                case 'withdrawal_initiated':
                                                    router.push("/dashboard/withdrawals")
                                                    break
                                                default:
                                                    break
                                            }
                                        }}
                                        className="flex items-start gap-4 p-4 border rounded-xl hover:bg-accent/50 transition-all group cursor-pointer"
                                    >
                                        <div className="mt-1 p-2 bg-background rounded-lg border group-hover:border-primary/30 transition-colors">
                                            {getIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-foreground truncate">{notification.userName}</span>
                                                    {getTypeBadge(notification.type)}
                                                </div>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted px-2 py-1 rounded-full">
                                                    {formatTimeAgo(notification.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-1">{notification.details}</p>
                                            <div className="flex items-center gap-4 mt-2">
                                                {notification.amount !== undefined && (
                                                    <div className="text-xs font-medium text-foreground bg-primary/5 px-2 py-1 rounded">
                                                        Amount: <span className="text-primary">{formatCurrency(notification.amount)}</span>
                                                    </div>
                                                )}
                                                {notification.status && (
                                                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                                        Status: {notification.status}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                <div className="pt-4">
                                    <Pagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        onPageChange={setCurrentPage}
                                        itemsPerPage={itemsPerPage}
                                        totalItems={totalItems}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
