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
import { Search, Filter, MoreHorizontal, Eye, Ban, CheckCircle, UserPlus } from "lucide-react"
import { useState } from "react"

const users = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@email.com",
    phone: "+234 801 234 5678",
    balance: "₦125,000",
    frequency: "Weekly",
    status: "active",
    joinDate: "2024-01-15",
    lastActivity: "2 hours ago",
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    phone: "+234 802 345 6789",
    balance: "₦89,500",
    frequency: "Monthly",
    status: "active",
    joinDate: "2024-02-20",
    lastActivity: "1 day ago",
  },
  {
    id: 3,
    name: "Michael Brown",
    email: "m.brown@email.com",
    phone: "+234 803 456 7890",
    balance: "₦0",
    frequency: "Bi-weekly",
    status: "suspended",
    joinDate: "2024-01-08",
    lastActivity: "1 week ago",
  },
  {
    id: 4,
    name: "Emily Davis",
    email: "emily.davis@email.com",
    phone: "+234 804 567 8901",
    balance: "₦234,750",
    frequency: "Weekly",
    status: "active",
    joinDate: "2024-03-10",
    lastActivity: "5 minutes ago",
  },
  {
    id: 5,
    name: "David Wilson",
    email: "d.wilson@email.com",
    phone: "+234 805 678 9012",
    balance: "₦67,200",
    frequency: "Monthly",
    status: "active",
    joinDate: "2024-02-28",
    lastActivity: "3 hours ago",
  },
]

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<(typeof users)[0] | null>(null)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    frequency: "weekly",
    initialBalance: "",
  })

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm),
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleAddUser = () => {
    console.log("[v0] Adding new user:", newUser)
    setShowAddUser(false)
    setNewUser({
      name: "",
      email: "",
      phone: "",
      frequency: "weekly",
      initialBalance: "",
    })
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
              <div className="text-2xl font-bold">1,847</div>
              <div className="text-xs text-success">+47 this week</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,823</div>
              <div className="text-xs text-muted-foreground">98.7% active rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <div className="text-xs text-destructive">-3 from last week</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">New This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">156</div>
              <div className="text-xs text-success">+12% vs last month</div>
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
                  <TableHead>Frequency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">ID: {user.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{user.email}</div>
                        <div className="text-sm text-muted-foreground">{user.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{user.balance}</TableCell>
                    <TableCell>{user.frequency}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.lastActivity}</TableCell>
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
                          {user.status === "active" ? (
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
                ))}
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
                    <div className="text-sm font-medium">{selectedUser.name}</div>
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
                    <div className="text-sm">{selectedUser.phone}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Current Balance</Label>
                    <div className="text-lg font-semibold">{selectedUser.balance}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Savings Frequency</Label>
                    <div className="text-sm">{selectedUser.frequency}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Join Date</Label>
                    <div className="text-sm">{selectedUser.joinDate}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Activity</Label>
                    <div className="text-sm">{selectedUser.lastActivity}</div>
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
                  {selectedUser.status === "active" ? (
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
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter full name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
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
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Savings Frequency</Label>
                <Select
                  value={newUser.frequency}
                  onValueChange={(value) => setNewUser({ ...newUser, frequency: value })}
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance">Initial Balance (Optional)</Label>
                <Input
                  id="balance"
                  type="number"
                  placeholder="0"
                  value={newUser.initialBalance}
                  onChange={(e) => setNewUser({ ...newUser, initialBalance: e.target.value })}
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
                disabled={!newUser.name || !newUser.email || !newUser.phone}
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
