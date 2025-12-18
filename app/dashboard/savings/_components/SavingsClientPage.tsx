"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Search, Plus, Loader2, MoreVertical, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase_config"
import { collection, getDocs, query, orderBy, Timestamp, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore"
import { toast, Toaster } from "react-hot-toast"
import { v4 as uuidv4 } from "uuid"
import { Pagination, usePagination } from "@/components/ui/pagination"

interface SavingsPlan {
    id: string
    savingsId: string
    userId: string
    savingsName: string
    targetAmount: number
    actualAmount: number
    frequency: string
    frequencyAmount: number
    duration: string
    startDate: Timestamp
    endDate: Timestamp
    status: string
    createdAt: Timestamp
}

interface User {
    uid: string
    firstName: string
    lastName: string
    email: string
    initialBalance: number
    phoneNumber: string
    status: string
    isVerified: boolean
    createdAt: Timestamp
    updatedAt: Timestamp
    verificationCode?: string
    verificationCodeExpiry?: Timestamp
}

export function SavingsClientPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([])
    const [users, setUsers] = useState<Record<string, User>>({})
    const [allUsers, setAllUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [planToDelete, setPlanToDelete] = useState<SavingsPlan | null>(null)

    const [newSavings, setNewSavings] = useState({
        userId: "",
        savingsName: "",
        targetAmount: "",
        frequency: "",
        frequencyAmount: "",
        duration: "",
        startDate: new Date().toISOString().split('T')[0],
    })

    // Fetch savings plans and users
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!db) {
                    console.error("Firebase not initialized")
                    setLoading(false)
                    return
                }

                // Fetch savings plans
                const savingsRef = collection(db, "savings")
                const savingsQuery = query(savingsRef, orderBy("createdAt", "desc"))
                const savingsSnapshot = await getDocs(savingsQuery)

                const savingsData = savingsSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as SavingsPlan[]

                setSavingsPlans(savingsData)

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
                setLoading(false)
            } catch (error) {
                console.error("Error fetching data:", error)
                toast.error("Failed to load savings plans")
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    // Calculate statistics
    const totalPlans = savingsPlans.length
    const activePlans = savingsPlans.filter(p => p.status === "active").length
    const totalTargetAmount = savingsPlans.reduce((sum, p) => sum + p.targetAmount, 0)
    const totalActualAmount = savingsPlans.reduce((sum, p) => sum + p.actualAmount, 0)

    // Filter savings plans
    const filteredPlans = savingsPlans.filter(plan => {
        const matchesSearch = plan.savingsName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            getUserName(plan.userId).toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === "all" || plan.status === statusFilter
        return matchesSearch && matchesStatus
    })

    // Add pagination
    const {
        currentPage,
        totalPages,
        paginatedItems: paginatedPlans,
        setCurrentPage,
        totalItems,
        itemsPerPage,
    } = usePagination(filteredPlans, 6)

    // Helper functions
    const getUserName = (userId: string) => {
        const user = users[userId]
        return user ? `${user.firstName} ${user.lastName}` : "Unknown User"
    }

    const formatCurrency = (amount: number) => {
        return `₦${amount.toLocaleString()}`
    }

    const calculateProgress = (actual: number, target: number) => {
        return Math.min((actual / target) * 100, 100)
    }

    const calculateEndDate = (startDate: string, duration: string) => {
        const start = new Date(startDate)
        const durationMatch = duration.match(/(\d+)\s*(day|week|month|year)s?/i)

        if (!durationMatch) return start

        const value = parseInt(durationMatch[1])
        const unit = durationMatch[2].toLowerCase()

        switch (unit) {
            case "day":
                start.setDate(start.getDate() + value)
                break
            case "week":
                start.setDate(start.getDate() + (value * 7))
                break
            case "month":
                start.setMonth(start.getMonth() + value)
                break
            case "year":
                start.setFullYear(start.getFullYear() + value)
                break
        }

        return start
    }

    const handleCreateSavings = async () => {
        if (!newSavings.userId || !newSavings.savingsName || !newSavings.targetAmount ||
            !newSavings.frequency || !newSavings.frequencyAmount || !newSavings.duration) {
            toast.error("Please fill in all required fields")
            return
        }

        try {
            setSubmitting(true)

            if (!db) {
                throw new Error("Firebase not initialized")
            }

            const savingsId = uuidv4()
            const startDate = Timestamp.fromDate(new Date(newSavings.startDate))
            const endDate = Timestamp.fromDate(calculateEndDate(newSavings.startDate, newSavings.duration))

            const savingsData = {
                savingsId,
                userId: newSavings.userId,
                savingsName: newSavings.savingsName,
                targetAmount: parseFloat(newSavings.targetAmount),
                actualAmount: 0,
                frequency: newSavings.frequency,
                frequencyAmount: parseFloat(newSavings.frequencyAmount),
                duration: newSavings.duration,
                startDate,
                endDate,
                status: "active",
                createdAt: serverTimestamp(),
            }

            await addDoc(collection(db, "savings"), savingsData)

            // Refresh data
            const savingsRef = collection(db, "savings")
            const savingsQuery = query(savingsRef, orderBy("createdAt", "desc"))
            const savingsSnapshot = await getDocs(savingsQuery)
            const savingsDataRefresh = savingsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as SavingsPlan[]
            setSavingsPlans(savingsDataRefresh)

            // Reset form
            setNewSavings({
                userId: "",
                savingsName: "",
                targetAmount: "",
                frequency: "",
                frequencyAmount: "",
                duration: "",
                startDate: new Date().toISOString().split('T')[0],
            })
            setShowCreateDialog(false)
            toast.success(`Savings plan "${newSavings.savingsName}" created successfully!`)
            setSubmitting(false)
        } catch (error: any) {
            console.error("Error creating savings plan:", error)
            toast.error(`Failed to create savings plan: ${error.message}`)
            setSubmitting(false)
        }
    }

    const handleDeleteSavings = async () => {
        if (!planToDelete || !db) return

        try {
            await deleteDoc(doc(db, "savings", planToDelete.id))

            toast.success(`Savings plan "${planToDelete.savingsName}" deleted successfully!`)

            // Refresh savings plans
            const savingsRef = collection(db, "savings")
            const savingsQuery = query(savingsRef, orderBy("createdAt", "desc"))
            const savingsSnapshot = await getDocs(savingsQuery)
            const savingsData = savingsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as SavingsPlan[]
            setSavingsPlans(savingsData)

            setPlanToDelete(null)
        } catch (error: any) {
            console.error("Error deleting savings plan:", error)
            toast.error(`Failed to delete savings plan: ${error.message}`)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "active":
                return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
            case "completed":
                return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Completed</Badge>
            case "paused":
                return <Badge className="bg-warning/10 text-warning border-warning/20">Paused</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" />
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold text-balance">Savings Management</h1>
                        <p className="text-muted-foreground mt-2">Manage user savings plans and track progress</p>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Savings Plan
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-6 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Savings Plans</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalPlans}</div>
                            <div className="text-xs text-muted-foreground">{activePlans} active</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Plans</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : activePlans}</div>
                            <div className="text-xs text-success">Currently saving</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Target</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalTargetAmount)}</div>
                            <div className="text-xs text-muted-foreground">Combined goals</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Saved</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalActualAmount)}</div>
                            <div className="text-xs text-success">{totalTargetAmount > 0 ? `${((totalActualAmount / totalTargetAmount) * 100).toFixed(1)}%` : "0%"} of target</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Savings Plans Table */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>All Savings Plans</CardTitle>
                                <CardDescription>View and manage all user savings plans</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                    <Input
                                        placeholder="Search savings..."
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
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="paused">Paused</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Savings Name</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Target Amount</TableHead>
                                    <TableHead>Current Amount</TableHead>
                                    <TableHead>Progress</TableHead>
                                    <TableHead>Frequency</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-10">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground mt-2">Loading savings plans...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredPlans.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-10">
                                            <p className="text-sm text-muted-foreground">No savings plans found</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedPlans.map((plan) => {
                                        const progress = calculateProgress(plan.actualAmount, plan.targetAmount)
                                        return (
                                            <TableRow key={plan.id}>
                                                <TableCell className="font-medium">{plan.savingsName}</TableCell>
                                                <TableCell>{getUserName(plan.userId)}</TableCell>
                                                <TableCell className="font-semibold">{formatCurrency(plan.targetAmount)}</TableCell>
                                                <TableCell>{formatCurrency(plan.actualAmount)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={progress} className="w-24" />
                                                        <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="text-sm">{plan.frequency}</div>
                                                        <div className="text-xs text-muted-foreground">{formatCurrency(plan.frequencyAmount)}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{plan.duration}</TableCell>
                                                <TableCell>{getStatusBadge(plan.status)}</TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => setPlanToDelete(plan)}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                        {!loading && filteredPlans.length > 0 && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                                itemsPerPage={itemsPerPage}
                                totalItems={totalItems}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Create Savings Dialog */}
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create New Savings Plan</DialogTitle>
                            <DialogDescription>Set up a new savings plan for a user</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="user">Select User *</Label>
                                    <Select
                                        value={newSavings.userId}
                                        onValueChange={(value) => setNewSavings({ ...newSavings, userId: value })}
                                    >
                                        <SelectTrigger>
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
                                    <Label htmlFor="savingsName">Savings Name *</Label>
                                    <Input
                                        id="savingsName"
                                        placeholder="e.g., Birthday Groove"
                                        value={newSavings.savingsName}
                                        onChange={(e) => setNewSavings({ ...newSavings, savingsName: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="targetAmount">Target Amount (₦) *</Label>
                                    <Input
                                        id="targetAmount"
                                        type="number"
                                        placeholder="500000"
                                        value={newSavings.targetAmount}
                                        onChange={(e) => setNewSavings({ ...newSavings, targetAmount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="frequency">Frequency *</Label>
                                    <Select
                                        value={newSavings.frequency}
                                        onValueChange={(value) => setNewSavings({ ...newSavings, frequency: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select frequency..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Daily">Daily</SelectItem>
                                            <SelectItem value="Weekly">Weekly</SelectItem>
                                            <SelectItem value="Monthly">Monthly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="frequencyAmount">Frequency Amount (₦) *</Label>
                                    <Input
                                        id="frequencyAmount"
                                        type="number"
                                        placeholder="1000"
                                        value={newSavings.frequencyAmount}
                                        onChange={(e) => setNewSavings({ ...newSavings, frequencyAmount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="duration">Duration *</Label>
                                    <Input
                                        id="duration"
                                        placeholder="e.g., 3 months, 6 weeks"
                                        value={newSavings.duration}
                                        onChange={(e) => setNewSavings({ ...newSavings, duration: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date *</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={newSavings.startDate}
                                    onChange={(e) => setNewSavings({ ...newSavings, startDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowCreateDialog(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateSavings}
                                disabled={submitting || !newSavings.userId || !newSavings.savingsName ||
                                    !newSavings.targetAmount || !newSavings.frequency ||
                                    !newSavings.frequencyAmount || !newSavings.duration}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    "Create Savings Plan"
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={!!planToDelete} onOpenChange={() => setPlanToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Savings Plan</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this savings plan? This action cannot be undone.
                                {planToDelete && (
                                    <div className="mt-4 p-3 bg-muted rounded-lg">
                                        <div className="text-sm font-medium text-foreground">
                                            {planToDelete.savingsName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            User: {getUserName(planToDelete.userId)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Current Balance: {formatCurrency(planToDelete.actualAmount)}
                                        </div>
                                    </div>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteSavings} className="bg-destructive hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}
