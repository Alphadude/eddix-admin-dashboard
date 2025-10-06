"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Bell,
  Search,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  User,
  CreditCard,
  Settings,
  MoreHorizontal,
} from "lucide-react"
import { useState } from "react"

const notifications = [
  {
    id: 1,
    type: "alert",
    title: "High Volume Withdrawal Requests",
    message: "23 withdrawal requests pending approval - above normal threshold",
    timestamp: "2 minutes ago",
    priority: "high",
    category: "system",
    read: false,
  },
  {
    id: 2,
    type: "success",
    title: "Daily Backup Completed",
    message: "System backup completed successfully at 02:00 AM",
    timestamp: "6 hours ago",
    priority: "low",
    category: "system",
    read: true,
  },
  {
    id: 3,
    type: "info",
    title: "New User Registration",
    message: "Sarah Johnson has successfully registered and made first contribution",
    timestamp: "1 hour ago",
    priority: "medium",
    category: "user",
    read: false,
  },
  {
    id: 4,
    type: "alert",
    title: "Failed Payment Attempt",
    message: "Multiple failed payment attempts detected for user ID: 1847",
    timestamp: "3 hours ago",
    priority: "high",
    category: "payment",
    read: false,
  },
  {
    id: 5,
    type: "info",
    title: "Monthly Report Generated",
    message: "March 2024 financial report is ready for review",
    timestamp: "5 hours ago",
    priority: "medium",
    category: "report",
    read: true,
  },
  {
    id: 6,
    type: "success",
    title: "System Update Completed",
    message: "Platform updated to version 2.1.4 with security enhancements",
    timestamp: "1 day ago",
    priority: "medium",
    category: "system",
    read: true,
  },
]

export default function NotificationsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")

  const filteredNotifications = notifications.filter((notification) => {
    const matchesSearch =
      notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === "all" || notification.category === filterType
    const matchesPriority = filterPriority === "all" || notification.priority === filterPriority

    return matchesSearch && matchesType && matchesPriority
  })

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="h-5 w-5 text-destructive" />
      case "success":
        return <CheckCircle className="h-5 w-5 text-success" />
      case "info":
        return <Info className="h-5 w-5 text-primary" />
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "user":
        return <User className="h-4 w-4" />
      case "payment":
        return <CreditCard className="h-4 w-4" />
      case "system":
        return <Settings className="h-4 w-4" />
      case "report":
        return <TrendingUp className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High</Badge>
      case "medium":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Medium</Badge>
      case "low":
        return <Badge variant="outline">Low</Badge>
      default:
        return <Badge variant="outline">{priority}</Badge>
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-balance">Notifications Center</h1>
            <p className="text-muted-foreground mt-2">Real-time system alerts and platform updates</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {unreadCount} unread
            </Badge>
            <Button variant="outline" size="sm">
              Mark All Read
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications.length}</div>
              <div className="text-xs text-muted-foreground">Last 24 hours</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {notifications.filter((n) => n.priority === "high").length}
              </div>
              <div className="text-xs text-destructive">Requires attention</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">System Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications.filter((n) => n.category === "system").length}</div>
              <div className="text-xs text-muted-foreground">Platform updates</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unreadCount}</div>
              <div className="text-xs text-muted-foreground">Need review</div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Notifications</CardTitle>
                <CardDescription>System events and platform updates</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search notifications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${
                    !notification.read ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="flex-shrink-0 mt-1">{getNotificationIcon(notification.type)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4
                            className={`font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {notification.title}
                          </h4>
                          {!notification.read && <div className="w-2 h-2 bg-primary rounded-full" />}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{notification.timestamp}</span>
                          <div className="flex items-center gap-1">
                            {getCategoryIcon(notification.category)}
                            <span className="capitalize">{notification.category}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getPriorityBadge(notification.priority)}
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
