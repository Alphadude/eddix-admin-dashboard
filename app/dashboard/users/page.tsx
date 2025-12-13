"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, MoreHorizontal, Eye, Ban, CheckCircle, UserPlus, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase_config"
import { collection, onSnapshot, query, orderBy, Timestamp, getDocs, where } from "firebase/firestore"
import { formatDistanceToNow } from "date-fns"

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

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showAddUser, setShowAddUser] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loading2, setLoading2] = useState(true)
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: ""
  })
  const fetchUserSavingsBalance = async (uid: string) => {
    try {
      if (!db) {
        console.error("Firebase not initialized")
        return 0
      }

      const savingsRef = collection(db, "savings")
      const q = query(savingsRef, where("userId", "==", uid))

      const savingsSnapshot = await getDocs(q)

      let totalBalance = 0

      savingsSnapshot.forEach((doc) => {
        const data = doc.data()
        totalBalance += data.actualAmount || 0
      })

      return totalBalance
    } catch (error) {
      console.error("Error fetching savings balance:", error)
      return 0
    }
  }
  const fetchUsers = async () => {
    try {
      setLoading(true)

      if (!db) {
        console.error("Firebase not initialized")
        setLoading(false)
        return
      }

      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      const usersData = await Promise.all(
        usersSnapshot.docs.map(async (doc: any) => {
          const userData = doc.data()
          const savingsBalance = await fetchUserSavingsBalance(doc.id)
          return {
            id: doc.id,
            ...userData,
            initialBalance: savingsBalance,
          }
        })
      ) as User[]

      console.log("usersData", usersData)
      setUsers(usersData)
      setLoading(false)

    } catch (error) {
      console.error("Error fetching users:", error)
      setLoading(false)
    }
  }
  // Fetch users from Firebase
  useEffect(() => {
    fetchUsers()
  }, [])

  // Calculate stats from real data
  const totalUsers = users.length
  const activeUsers = users.filter(u => u.status === "active").length
  const suspendedUsers = users.filter(u => u.status === "suspended").length
  const newThisMonth = users.filter(u => {
    const createdDate = u.createdAt?.toDate()
    if (!createdDate) return false
    const now = new Date()
    return createdDate.getMonth() === now.getMonth() &&
      createdDate.getFullYear() === now.getFullYear()
  }).length

  const filteredUsers = users.filter(
    (user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
      const search = searchTerm.toLowerCase()
      return fullName.includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.phoneNumber.includes(searchTerm)
    }
  )

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
    } else {
      return <Badge variant="destructive">Suspended</Badge>
    }
  }

  const formatLastActivity = (updatedAt: Timestamp) => {
    try {
      return formatDistanceToNow(updatedAt.toDate(), { addSuffix: true })
    } catch {
      return "Unknown"
    }
  }

  const handleAddUser = async () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.phoneNumber) {
      alert("Please fill in all fields")
      return
    }

    if (!newUser.phoneNumber.startsWith("+")) {
      alert("Phone number must start with a plus sign (+)")
      return
    }

    if (!newUser.phoneNumber.startsWith("+234")) {
      alert("Phone number must start with +234")
      return
    }

    try {
      setLoading2(true) // Re-using loading state or create a specific one if preferred

      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user")
      }

      console.log("User created successfully:", data)

      // Reset form and close dialog
      setNewUser({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: ""
      })
      setShowAddUser(false)

      await fetchUsers()
      // The onSnapshot listener in useEffect will automatically pick up the new user!
      // But we can trigger a manual fetch if needed, though onSnapshot is best.

    } catch (error: any) {
      console.error("Error creating user:", error)
      alert(error.message)
    } finally {
      setLoading2(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-balance">User Management</h1>
          <p className="text-muted-foreground mt-2">Manage user accounts, view profiles, and monitor activity</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalUsers.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : activeUsers.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : suspendedUsers.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">New This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : newThisMonth.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Complete list of registered users</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                <Button size="sm" onClick={() => setShowAddUser(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">Loading users...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <p className="text-sm text-muted-foreground">No users found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-sm text-muted-foreground">ID: {user.uid.substring(0, 8)}...</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{user.email}</div>
                          <div className="text-sm text-muted-foreground">{user.phoneNumber}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ₦
                        {Number(user.initialBalance || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatLastActivity(user.updatedAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            {user.isVerified ? (
                              <DropdownMenuItem className="text-destructive">
                                <Ban className="h-4 w-4 mr-2" />
                                Suspend User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="text-success">
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Activate User
                              </DropdownMenuItem>
                            )}
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

        {/* User Profile Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>User Profile</DialogTitle>
              <DialogDescription>Detailed information about the user account</DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <div className="text-sm font-medium">{selectedUser.firstName} {selectedUser.lastName}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Status</Label>
                    <div>{getStatusBadge(selectedUser.status)}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <div className="text-sm">{selectedUser.email}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <div className="text-sm">{selectedUser.phoneNumber}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <div className="text-sm font-mono">{selectedUser.uid}</div>
                  </div>

                  <div className="space-y-2">
                    <Label>Verified</Label>
                    <div className="text-sm">{selectedUser.isVerified ? "Yes" : "No"}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Join Date</Label>
                    <div className="text-sm">{selectedUser.createdAt?.toDate().toLocaleDateString()}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Activity</Label>
                    <div className="text-sm">{formatLastActivity(selectedUser.updatedAt)}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Recent Contributions</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <div className="text-sm font-medium">Weekly Contribution</div>
                        <div className="text-xs text-muted-foreground">March 15, 2024</div>
                      </div>
                      <div className="text-sm font-medium text-success">+₦25,000</div>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <div className="text-sm font-medium">Weekly Contribution</div>
                        <div className="text-xs text-muted-foreground">March 8, 2024</div>
                      </div>
                      <div className="text-sm font-medium text-success">+₦25,000</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Withdrawal History</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <div className="text-sm font-medium">Emergency Withdrawal</div>
                        <div className="text-xs text-muted-foreground">February 28, 2024</div>
                      </div>
                      <div className="text-sm font-medium text-destructive">-₦15,000</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1 bg-transparent">
                    Send Message
                  </Button>
                  {selectedUser.isVerified ? (
                    <Button variant="destructive" className="flex-1">
                      <Ban className="h-4 w-4 mr-2" />
                      Suspend Account
                    </Button>
                  ) : (
                    <Button className="flex-1">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Activate Account
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add User Dialog */}
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Manually register a new user to the platform</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Enter first name"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Enter last name"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+234 800 000 0000"
                  value={newUser.phoneNumber}
                  onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setShowAddUser(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddUser}
                disabled={!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.phoneNumber}
              >
                Add User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
