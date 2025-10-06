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
import { Search, Download, Check, X, Eye, Clock, ArrowDownToLine } from "lucide-react"
import { useState } from "react"

const pendingWithdrawals = [
  {
    id: "WTH001",
    user: "Sarah Johnson",
    amount: "₦25,000",
    date: "2024-03-15",
    time: "14:30",
    reason: "Emergency medical expenses",
    accountDetails: "GTBank - 0123456789",
    status: "pending",
    requestDate: "2024-03-15",
  },
  {
    id: "WTH002",
    user: "Michael Brown",
    amount: "₦50,000",
    date: "2024-03-15",
    time: "12:15",
    reason: "School fees payment",
    accountDetails: "Access Bank - 0987654321",
    status: "pending",
    requestDate: "2024-03-15",
  },
  {
    id: "WTH003",
    user: "Emily Davis",
    amount: "₦15,000",
    date: "2024-03-14",
    time: "16:20",
    reason: "Business investment",
    accountDetails: "First Bank - 0456789123",
    status: "pending",
    requestDate: "2024-03-14",
  },
]

const processedWithdrawals = [
  {
    id: "WTH004",
    user: "John Doe",
    amount: "₦30,000",
    date: "2024-03-14",
    time: "09:45",
    reason: "Personal emergency",
    accountDetails: "UBA - 0789123456",
    status: "approved",
    processedBy: "Admin User",
    processedDate: "2024-03-14",
  },
  {
    id: "WTH005",
    user: "David Wilson",
    amount: "₦20,000",
    date: "2024-03-13",
    time: "11:30",
    reason: "Medical bills",
    accountDetails: "Zenith Bank - 0321654987",
    status: "declined",
    processedBy: "Admin User",
    processedDate: "2024-03-13",
    declineReason: "Insufficient savings period",
  },
  {
    id: "WTH006",
    user: "Lisa Anderson",
    amount: "₦40,000",
    date: "2024-03-12",
    time: "15:20",
    reason: "Home renovation",
    accountDetails: "Sterling Bank - 0654321098",
    status: "approved",
    processedBy: "Admin User",
    processedDate: "2024-03-12",
  },
]

export default function WithdrawalsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null)
  const [actionType, setActionType] = useState<"approve" | "decline" | null>(null)
  const [declineReason, setDeclineReason] = useState("")
  const [showInitiateWithdrawal, setShowInitiateWithdrawal] = useState(false)
  const [newWithdrawal, setNewWithdrawal] = useState({
    userId: "",
    amount: "",
    reason: "",
    accountDetails: "",
    notes: "",
  })

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

  const handleApprove = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal)
    setActionType("approve")
  }

  const handleDecline = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal)
    setActionType("decline")
  }

  const confirmAction = () => {
    console.log(`${actionType}ing withdrawal ${selectedWithdrawal?.id}`)
    if (actionType === "decline") {
      console.log("Decline reason:", declineReason)
    }
    setSelectedWithdrawal(null)
    setActionType(null)
    setDeclineReason("")
  }

  const handleInitiateWithdrawal = () => {
    console.log("[v0] Initiating new withdrawal:", newWithdrawal)
    setShowInitiateWithdrawal(false)
    setNewWithdrawal({
      userId: "",
      amount: "",
      reason: "",
      accountDetails: "",
      notes: "",
    })
  }

  return (
    <DashboardLayout>
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
              <div className="text-2xl font-bold">23</div>
              <div className="text-xs text-warning">₦890,000 total</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <div className="text-xs text-success">₦450,000 processed</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦2,340,500</div>
              <div className="text-xs text-muted-foreground">156 transactions</div>
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
                    {pendingWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="font-medium">{withdrawal.id}</TableCell>
                        <TableCell>{withdrawal.user}</TableCell>
                        <TableCell className="font-semibold">{withdrawal.amount}</TableCell>
                        <TableCell className="max-w-32 truncate">{withdrawal.reason}</TableCell>
                        <TableCell className="text-sm">{withdrawal.accountDetails}</TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">{withdrawal.requestDate}</div>
                            <div className="text-xs text-muted-foreground">{withdrawal.time}</div>
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
                                      <div className="text-sm">{withdrawal.id}</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">User</label>
                                      <div className="text-sm">{withdrawal.user}</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Amount</label>
                                      <div className="text-lg font-semibold">{withdrawal.amount}</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Request Date</label>
                                      <div className="text-sm">
                                        {withdrawal.requestDate} at {withdrawal.time}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Reason for Withdrawal</label>
                                    <div className="text-sm mt-1">{withdrawal.reason}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Account Details</label>
                                    <div className="text-sm mt-1">{withdrawal.accountDetails}</div>
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
                    ))}
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
                    {processedWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="font-medium">{withdrawal.id}</TableCell>
                        <TableCell>{withdrawal.user}</TableCell>
                        <TableCell className="font-semibold">{withdrawal.amount}</TableCell>
                        <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        <TableCell>{withdrawal.processedBy}</TableCell>
                        <TableCell>{withdrawal.processedDate}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {withdrawal.status === "declined" ? withdrawal.declineReason : "Approved"}
                        </TableCell>
                      </TableRow>
                    ))}
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
                      <div className="text-sm">{selectedWithdrawal.user}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Amount</label>
                      <div className="text-lg font-semibold">{selectedWithdrawal.amount}</div>
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Initiate Withdrawal</DialogTitle>
              <DialogDescription>Process a withdrawal request directly from the admin panel</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user">Select User</Label>
                <Select
                  value={newWithdrawal.userId}
                  onValueChange={(value) => setNewWithdrawal({ ...newWithdrawal, userId: value })}
                >
                  <SelectTrigger id="user">
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">John Doe - ₦125,000</SelectItem>
                    <SelectItem value="2">Sarah Johnson - ₦89,500</SelectItem>
                    <SelectItem value="3">Michael Brown - ₦0</SelectItem>
                    <SelectItem value="4">Emily Davis - ₦234,750</SelectItem>
                    <SelectItem value="5">David Wilson - ₦67,200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Withdrawal Amount (₦)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={newWithdrawal.amount}
                  onChange={(e) => setNewWithdrawal({ ...newWithdrawal, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Withdrawal</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason..."
                  value={newWithdrawal.reason}
                  onChange={(e) => setNewWithdrawal({ ...newWithdrawal, reason: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account">Account Details</Label>
                <Input
                  id="account"
                  placeholder="Bank Name - Account Number"
                  value={newWithdrawal.accountDetails}
                  onChange={(e) => setNewWithdrawal({ ...newWithdrawal, accountDetails: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Admin Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any internal notes..."
                  value={newWithdrawal.notes}
                  onChange={(e) => setNewWithdrawal({ ...newWithdrawal, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => setShowInitiateWithdrawal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleInitiateWithdrawal}
                disabled={
                  !newWithdrawal.userId ||
                  !newWithdrawal.amount ||
                  !newWithdrawal.reason ||
                  !newWithdrawal.accountDetails
                }
              >
                Initiate Withdrawal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
