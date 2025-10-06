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
import { Textarea } from "@/components/ui/textarea"
import { Search, Download, Plus } from "lucide-react"
import { useState } from "react"

const contributions = [
  {
    id: "CTB001",
    user: "John Doe",
    amount: "₦50,000",
    date: "2024-03-15",
    time: "14:30",
    method: "Bank Transfer",
    status: "completed",
    reference: "REF123456789",
  },
  {
    id: "CTB002",
    user: "Sarah Johnson",
    amount: "₦25,000",
    date: "2024-03-15",
    time: "12:15",
    method: "Card Payment",
    status: "completed",
    reference: "REF123456790",
  },
  {
    id: "CTB003",
    user: "Michael Brown",
    amount: "₦75,000",
    date: "2024-03-15",
    time: "09:45",
    method: "Bank Transfer",
    status: "processing",
    reference: "REF123456791",
  },
  {
    id: "CTB004",
    user: "Emily Davis",
    amount: "₦40,000",
    date: "2024-03-14",
    time: "16:20",
    method: "Mobile Money",
    status: "completed",
    reference: "REF123456792",
  },
  {
    id: "CTB005",
    user: "David Wilson",
    amount: "₦30,000",
    date: "2024-03-14",
    time: "11:30",
    method: "Card Payment",
    status: "failed",
    reference: "REF123456793",
  },
]

export function ContributionsClientPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddContribution, setShowAddContribution] = useState(false)
  const [newContribution, setNewContribution] = useState({
    userId: "",
    userName: "",
    amount: "",
    method: "bank-transfer",
    reference: "",
    notes: "",
  })

  const filteredContributions = contributions.filter((contribution) => {
    const matchesSearch =
      contribution.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contribution.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contribution.reference.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || contribution.status === statusFilter

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

  const totalAmount = contributions
    .filter((c) => c.status === "completed")
    .reduce((sum, c) => sum + Number.parseInt(c.amount.replace(/[₦,]/g, "")), 0)

  const handleAddContribution = () => {
    console.log("[v0] Adding new contribution:", newContribution)
    setShowAddContribution(false)
    setNewContribution({
      userId: "",
      userName: "",
      amount: "",
      method: "bank-transfer",
      reference: "",
      notes: "",
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-balance">Contributions</h1>
          <p className="text-muted-foreground mt-2">Track and manage all user contributions to the platform</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦195,000</div>
              <div className="text-xs text-success">+15% from yesterday</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦1,247,500</div>
              <div className="text-xs text-success">+8.2% from last week</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦4,892,300</div>
              <div className="text-xs text-success">+12.5% from last month</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦75,000</div>
              <div className="text-xs text-muted-foreground">1 transaction</div>
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
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContributions.map((contribution) => (
                  <TableRow key={contribution.id}>
                    <TableCell className="font-medium">{contribution.id}</TableCell>
                    <TableCell>{contribution.user}</TableCell>
                    <TableCell className="font-semibold">{contribution.amount}</TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{contribution.date}</div>
                        <div className="text-xs text-muted-foreground">{contribution.time}</div>
                      </div>
                    </TableCell>
                    <TableCell>{contribution.method}</TableCell>
                    <TableCell>{getStatusBadge(contribution.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contribution.reference}</TableCell>
                  </TableRow>
                ))}
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
                <Label htmlFor="user">Select User</Label>
                <Select
                  value={newContribution.userId}
                  onValueChange={(value) => setNewContribution({ ...newContribution, userId: value })}
                >
                  <SelectTrigger id="user">
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">John Doe</SelectItem>
                    <SelectItem value="2">Sarah Johnson</SelectItem>
                    <SelectItem value="3">Michael Brown</SelectItem>
                    <SelectItem value="4">Emily Davis</SelectItem>
                    <SelectItem value="5">David Wilson</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₦)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={newContribution.amount}
                  onChange={(e) => setNewContribution({ ...newContribution, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Payment Method</Label>
                <Select
                  value={newContribution.method}
                  onValueChange={(value) => setNewContribution({ ...newContribution, method: value })}
                >
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card Payment</SelectItem>
                    <SelectItem value="mobile-money">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
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
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes..."
                  value={newContribution.notes}
                  onChange={(e) => setNewContribution({ ...newContribution, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setShowAddContribution(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddContribution}
                disabled={!newContribution.userId || !newContribution.amount}
              >
                Add Contribution
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
