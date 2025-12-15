"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Search, Plus, Loader2, MoreVertical, CheckCircle2, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase_config"
import {
    collection,
    getDocs,
    query,
    orderBy,
    Timestamp,
    where,
    updateDoc,
    doc,
    serverTimestamp,
    addDoc,
    deleteDoc,
    writeBatch,
} from "firebase/firestore"
import { toast, Toaster } from "react-hot-toast"

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

interface User {
    uid: string
    firstName: string
    lastName: string
    email: string
}

export default function BanksClientPage() {
    const [banks, setBanks] = useState<Bank[]>([])
    const [users, setUsers] = useState<Record<string, User>>({})
    const [allUsers, setAllUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [bankToDelete, setBankToDelete] = useState<Bank | null>(null)
    const [newBank, setNewBank] = useState({
        userId: "",
        accountName: "",
        accountNumber: "",
        bankName: "",
        bankCode: "",
    })

    // Fetch banks and users
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!db) {
                    console.error("Firebase not initialized")
                    setLoading(false)
                    return
                }

                // Fetch banks
                const banksRef = collection(db, "banks")
                const banksQuery = query(banksRef, orderBy("createdAt", "desc"))
                const banksSnapshot = await getDocs(banksQuery)
                const banksData = banksSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Bank[]
                setBanks(banksData)

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
                toast.error("Failed to load banks")
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    // Calculate statistics
    const totalBanks = banks.length
    const activeBanks = banks.filter((b) => b.isActive).length
    const usersWithBanks = new Set(banks.map((b) => b.userId)).size
    const recentAdditions = banks.filter((b) => {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return b.createdAt.toDate() >= weekAgo
    }).length

    // Helper function to get user name
    const getUserName = (userId: string) => {
        const user = users[userId]
        return user ? `${user.firstName} ${user.lastName}` : "Unknown User"
    }

    // Helper function to format date
    const formatDate = (timestamp: Timestamp) => {
        try {
            const date = timestamp.toDate()
            return date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
            })
        } catch {
            return "N/A"
        }
    }

    // Filter banks
    const filteredBanks = banks.filter((bank) => {
        const userName = getUserName(bank.userId).toLowerCase()
        const search = searchTerm.toLowerCase()
        return (
            userName.includes(search) ||
            bank.accountName.toLowerCase().includes(search) ||
            bank.accountNumber.includes(search) ||
            bank.bankName.toLowerCase().includes(search)
        )
    })

    // Handle create bank
    const handleCreateBank = async () => {
        // Validate required fields
        if (
            !newBank.userId ||
            !newBank.accountName ||
            !newBank.accountNumber ||
            !newBank.bankName ||
            !newBank.bankCode
        ) {
            toast.error("Please fill in all required fields")
            return
        }

        try {
            setSubmitting(true)

            if (!db) {
                throw new Error("Firebase not initialized")
            }

            // Check if user already has 3 banks
            const userBanksQuery = query(collection(db, "banks"), where("userId", "==", newBank.userId))
            const userBanksSnapshot = await getDocs(userBanksQuery)
            const userBanksCount = userBanksSnapshot.docs.length

            if (userBanksCount >= 3) {
                toast.error("User already has maximum 3 banks")
                setSubmitting(false)
                return
            }

            // Check if user has an active bank
            const activeBankDoc = userBanksSnapshot.docs.find((doc) => doc.data().isActive === true)

            // If user has an active bank, set it to inactive
            if (activeBankDoc) {
                await updateDoc(doc(db, "banks", activeBankDoc.id), {
                    isActive: false,
                    updatedAt: serverTimestamp(),
                })
            }

            // Create new bank with isActive = true
            const bankData = {
                userId: newBank.userId,
                accountName: newBank.accountName,
                accountNumber: newBank.accountNumber,
                bankName: newBank.bankName,
                bankCode: newBank.bankCode,
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }

            await addDoc(collection(db, "banks"), bankData)

            toast.success("Bank created successfully!")

            // Refresh banks
            const banksRef = collection(db, "banks")
            const banksQuery = query(banksRef, orderBy("createdAt", "desc"))
            const banksSnapshot = await getDocs(banksQuery)
            const banksData = banksSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Bank[]
            setBanks(banksData)

            // Reset form
            setNewBank({
                userId: "",
                accountName: "",
                accountNumber: "",
                bankName: "",
                bankCode: "",
            })
            setShowCreateDialog(false)
            setSubmitting(false)
        } catch (error: any) {
            console.error("Error creating bank:", error)
            toast.error(`Failed to create bank: ${error.message}`)
            setSubmitting(false)
        }
    }

    // Handle set active bank
    const handleSetActive = async (bankId: string, userId: string) => {
        try {
            if (!db) return

            const batch = writeBatch(db)

            // Get all banks for this user
            const userBanksQuery = query(collection(db, "banks"), where("userId", "==", userId))
            const userBanksSnapshot = await getDocs(userBanksQuery)

            // Set all banks to inactive
            userBanksSnapshot.docs.forEach((bankDoc) => {
                batch.update(bankDoc.ref, { isActive: false })
            })

            // Set selected bank to active
            batch.update(doc(db, "banks", bankId), {
                isActive: true,
                updatedAt: serverTimestamp(),
            })

            await batch.commit()

            toast.success("Bank set as active successfully!")

            // Refresh banks
            const banksRef = collection(db, "banks")
            const banksQuery = query(banksRef, orderBy("createdAt", "desc"))
            const banksSnapshot = await getDocs(banksQuery)
            const banksData = banksSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Bank[]
            setBanks(banksData)
        } catch (error: any) {
            console.error("Error setting active bank:", error)
            toast.error(`Failed to set active bank: ${error.message}`)
        }
    }

    // Handle delete bank
    const handleDeleteBank = async () => {
        if (!bankToDelete || !db) return

        try {
            await deleteDoc(doc(db, "banks", bankToDelete.id))

            toast.success("Bank deleted successfully!")

            // Refresh banks
            const banksRef = collection(db, "banks")
            const banksQuery = query(banksRef, orderBy("createdAt", "desc"))
            const banksSnapshot = await getDocs(banksQuery)
            const banksData = banksSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Bank[]
            setBanks(banksData)

            setBankToDelete(null)
        } catch (error: any) {
            console.error("Error deleting bank:", error)
            toast.error(`Failed to delete bank: ${error.message}`)
        }
    }

    return (
        <DashboardLayout>
            <Toaster position="top-right" />
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold text-balance">Bank Management</h1>
                        <p className="text-muted-foreground mt-2">Manage user bank accounts</p>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Bank
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-6 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Banks</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalBanks}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Banks</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : activeBanks}</div>
                            <div className="text-xs text-success">Currently active</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Users with Banks</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : usersWithBanks}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Additions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : recentAdditions}</div>
                            <div className="text-xs text-muted-foreground">Last 7 days</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Banks Table */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>All Banks</CardTitle>
                                <CardDescription>View and manage all user bank accounts</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                    <Input
                                        placeholder="Search banks..."
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
                                    <TableHead>User</TableHead>
                                    <TableHead>Account Name</TableHead>
                                    <TableHead>Account Number</TableHead>
                                    <TableHead>Bank Name</TableHead>
                                    <TableHead>Bank Code</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created Date</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground mt-2">Loading banks...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredBanks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10">
                                            <p className="text-sm text-muted-foreground">No banks found</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredBanks.map((bank) => (
                                        <TableRow key={bank.id}>
                                            <TableCell className="font-medium">{getUserName(bank.userId)}</TableCell>
                                            <TableCell>{bank.accountName}</TableCell>
                                            <TableCell className="font-mono">{bank.accountNumber}</TableCell>
                                            <TableCell>{bank.bankName}</TableCell>
                                            <TableCell className="font-mono">{bank.bankCode}</TableCell>
                                            <TableCell>
                                                {bank.isActive ? (
                                                    <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
                                                ) : (
                                                    <Badge variant="outline">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>{formatDate(bank.createdAt)}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => handleSetActive(bank.id, bank.userId)}
                                                            disabled={bank.isActive}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                                            {bank.isActive ? "Already Active" : "Set Active"}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => setBankToDelete(bank)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Create Bank Dialog */}
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add New Bank</DialogTitle>
                            <DialogDescription>Create a new bank account for a user (max 3 per user)</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="user">Select User *</Label>
                                <Select value={newBank.userId} onValueChange={(value) => setNewBank({ ...newBank, userId: value })}>
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
                                <Label htmlFor="accountName">Account Name *</Label>
                                <Input
                                    id="accountName"
                                    placeholder="e.g., John Doe"
                                    value={newBank.accountName}
                                    onChange={(e) => setNewBank({ ...newBank, accountName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountNumber">Account Number *</Label>
                                <Input
                                    id="accountNumber"
                                    placeholder="e.g., 0123456789"
                                    value={newBank.accountNumber}
                                    onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bankName">Bank Name *</Label>
                                <Input
                                    id="bankName"
                                    placeholder="e.g., GTBank"
                                    value={newBank.bankName}
                                    onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bankCode">Bank Code *</Label>
                                <Input
                                    id="bankCode"
                                    placeholder="e.g., 044"
                                    value={newBank.bankCode}
                                    onChange={(e) => setNewBank({ ...newBank, bankCode: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateBank} disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    "Create Bank"
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={!!bankToDelete} onOpenChange={() => setBankToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Bank Account</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this bank account? This action cannot be undone.
                                {bankToDelete && (
                                    <div className="mt-4 p-3 bg-muted rounded-lg">
                                        <div className="text-sm font-medium text-foreground">
                                            {bankToDelete.accountName} - {bankToDelete.bankName}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{bankToDelete.accountNumber}</div>
                                    </div>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteBank} className="bg-destructive hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}
