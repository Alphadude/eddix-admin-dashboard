"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Settings, Users, DollarSign, Bell, Shield, Upload, Plus, Edit, Trash2, Loader2, Eye } from "lucide-react"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase_config"
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp
} from "firebase/firestore"
import { toast, Toaster } from "react-hot-toast"
import { auth } from "@/lib/firebase_config"
import { createUserWithEmailAndPassword } from "firebase/auth"

interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  lastLogin: Timestamp
  createdAt: Timestamp
}

export default function ClientSettingsPage() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loadingAdmins, setLoadingAdmins] = useState(true)
  const [newAdmin, setNewAdmin] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "support"
  })
  const [showAddAdminDialog, setShowAddAdminDialog] = useState(false)
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null)
  const [showViewAdminDialog, setShowViewAdminDialog] = useState(false)
  const [suspendingAdmin, setSuspendingAdmin] = useState(false)
  const [deletingAdmin, setDeletingAdmin] = useState(false)
  const [feeSettings, setFeeSettings] = useState({
    completedPlanFee: "10",
    brokenPlanFee: "20",
  })
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    pushNotifications: true,
    weeklyReports: true,
  })

  // Fetch fee settings from Firebase
  useEffect(() => {
    const fetchFees = async () => {
      try {
        if (!db) return

        const feeDocRef = doc(db, "feesManagement", "withdrawalFees")
        const feeDoc = await getDoc(feeDocRef)

        if (feeDoc.exists()) {
          const data = feeDoc.data()
          setFeeSettings({
            completedPlanFee: data.completedPlanFeePercentage?.toString() || "10",
            brokenPlanFee: data.brokenPlanFeePercentage?.toString() || "20",
          })
        }
      } catch (error) {
        console.error("Error fetching fees:", error)
        toast.error("Failed to load fee settings")
      }
    }

    fetchFees()
  }, [])

  // Fetch admin users from Firebase
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        setLoadingAdmins(true)
        if (!db) return

        const adminsRef = collection(db, "admin")
        const adminsQuery = query(adminsRef, orderBy("createdAt", "desc"))
        const adminsSnapshot = await getDocs(adminsQuery)

        const adminsData = adminsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AdminUser[]

        setAdminUsers(adminsData)
      } catch (error) {
        console.error("Error fetching admins:", error)
        toast.error("Failed to load admin users")
      } finally {
        setLoadingAdmins(false)
      }
    }

    fetchAdmins()
  }, [])

  // Save fee settings to Firebase
  const handleSaveFees = async () => {
    try {
      setLoading(true)

      if (!db) {
        throw new Error("Firebase not initialized")
      }

      const adminEmail = localStorage.getItem("adminEmail") || "admin@company.com"

      const feeDocRef = doc(db, "feesManagement", "withdrawalFees")
      await setDoc(feeDocRef, {
        completedPlanFeePercentage: Number.parseFloat(feeSettings.completedPlanFee),
        brokenPlanFeePercentage: Number.parseFloat(feeSettings.brokenPlanFee),
        updatedAt: serverTimestamp(),
        updatedBy: adminEmail,
      })

      toast.success("Fee settings saved successfully!")
    } catch (error: any) {
      console.error("Error saving fees:", error)
      toast.error(`Failed to save fee settings: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Create new admin user
  const handleCreateAdmin = async () => {
    // Validate required fields
    if (!newAdmin.firstName || !newAdmin.lastName || !newAdmin.email || !newAdmin.password || !newAdmin.role) {
      toast.error("Please fill in all required fields")
      return
    }

    // Validate password length
    if (newAdmin.password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    try {
      setCreatingAdmin(true)

      if (!db || !auth) {
        throw new Error("Firebase not initialized")
      }

      // Create Firebase Authentication user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newAdmin.email,
        newAdmin.password
      )

      const userId = userCredential.user.uid

      // Create admin document in Firestore
      const adminDocRef = doc(db, "admin", userId)
      await setDoc(adminDocRef, {
        email: newAdmin.email,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        role: newAdmin.role,
        isActive: true,
        createdAt: serverTimestamp(),
        lastLogin: null,
      })

      toast.success("Admin user created successfully!")

      // Refresh admin list
      const adminsRef = collection(db, "admin")
      const adminsQuery = query(adminsRef, orderBy("createdAt", "desc"))
      const adminsSnapshot = await getDocs(adminsQuery)

      const adminsData = adminsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AdminUser[]

      setAdminUsers(adminsData)

      // Reset form and close dialog
      setNewAdmin({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "support",
      })
      setShowAddAdminDialog(false)
    } catch (error: any) {
      console.error("Error creating admin:", error)

      // Handle specific Firebase Auth errors
      if (error.code === "auth/email-already-in-use") {
        toast.error("Email address is already in use")
      } else if (error.code === "auth/invalid-email") {
        toast.error("Invalid email address")
      } else if (error.code === "auth/weak-password") {
        toast.error("Password is too weak")
      } else {
        toast.error(`Failed to create admin: ${error.message}`)
      }
    } finally {
      setCreatingAdmin(false)
    }
  }

  // Suspend/Activate admin user
  const handleToggleSuspendAdmin = async () => {
    if (!selectedAdmin) return

    try {
      setSuspendingAdmin(true)

      if (!db) {
        throw new Error("Firebase not initialized")
      }

      const adminDocRef = doc(db, "admin", selectedAdmin.id)
      await setDoc(adminDocRef, {
        isActive: !selectedAdmin.isActive,
      }, { merge: true })

      toast.success(`Admin ${selectedAdmin.isActive ? 'suspended' : 'activated'} successfully!`)

      // Refresh admin list
      const adminsRef = collection(db, "admin")
      const adminsQuery = query(adminsRef, orderBy("createdAt", "desc"))
      const adminsSnapshot = await getDocs(adminsQuery)

      const adminsData = adminsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AdminUser[]

      setAdminUsers(adminsData)
      setShowViewAdminDialog(false)
      setSelectedAdmin(null)
    } catch (error: any) {
      console.error("Error toggling admin status:", error)
      toast.error(`Failed to update admin: ${error.message}`)
    } finally {
      setSuspendingAdmin(false)
    }
  }

  // Delete admin user
  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return

    if (!window.confirm(`Are you sure you want to delete ${selectedAdmin.firstName} ${selectedAdmin.lastName}? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingAdmin(true)

      if (!db) {
        throw new Error("Firebase not initialized")
      }

      // Note: This only deletes from Firestore, not from Firebase Auth
      // You may want to use Firebase Admin SDK on the backend to delete the auth user
      const adminDocRef = doc(db, "admin", selectedAdmin.id)
      await setDoc(adminDocRef, {
        isActive: false,
        deletedAt: serverTimestamp(),
      }, { merge: true })

      toast.success("Admin deleted successfully!")

      // Refresh admin list
      const adminsRef = collection(db, "admin")
      const adminsQuery = query(adminsRef, orderBy("createdAt", "desc"))
      const adminsSnapshot = await getDocs(adminsQuery)

      const adminsData = adminsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AdminUser[]

      setAdminUsers(adminsData)
      setShowViewAdminDialog(false)
      setSelectedAdmin(null)
    } catch (error: any) {
      console.error("Error deleting admin:", error)
      toast.error(`Failed to delete admin: ${error.message}`)
    } finally {
      setDeletingAdmin(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const roleFormatted = role.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())

    switch (role) {
      case "super_admin":
        return <Badge className="bg-primary/10 text-primary border-primary/20">{roleFormatted}</Badge>
      case "manager":
        return <Badge className="bg-success/10 text-success border-success/20">{roleFormatted}</Badge>
      case "support":
        return <Badge variant="outline">{roleFormatted}</Badge>
      default:
        return <Badge variant="outline">{roleFormatted}</Badge>
    }
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
    ) : (
      <Badge variant="outline">Inactive</Badge>
    )
  }

  const formatDateTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return "Never"
    try {
      const date = timestamp.toDate()
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    } catch {
      return "N/A"
    }
  }

  return (
    <DashboardLayout>
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-balance">Admin Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure platform settings, manage administrators, and system preferences
          </p>
        </div>

        <Tabs defaultValue="fees" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="fees" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Fee Rules
            </TabsTrigger>
            <TabsTrigger value="admins" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Admins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fees">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal Plan Fee Configuration</CardTitle>
                <CardDescription>Manage withdrawal fees for completed and broken savings plans</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium">Withdrawal Plan Fees</h4>
                    <div className="space-y-2">
                      <Label htmlFor="completed-plan-fee">Completed Plan Fee (%)</Label>
                      <Input
                        id="completed-plan-fee"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={feeSettings.completedPlanFee}
                        onChange={(e) => setFeeSettings((prev) => ({ ...prev, completedPlanFee: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Fee charged when withdrawing from a completed savings plan
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="broken-plan-fee">Broken Plan Fee (%)</Label>
                      <Input
                        id="broken-plan-fee"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={feeSettings.brokenPlanFee}
                        onChange={(e) => setFeeSettings((prev) => ({ ...prev, brokenPlanFee: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Fee charged when withdrawing from a plan before completion (early withdrawal)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Fee Preview</h4>
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div>
                        <div className="text-sm font-medium mb-1">Completed Plan Withdrawal</div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Withdrawal Amount: ₦100,000</div>
                          <div>Fee ({feeSettings.completedPlanFee}%): ₦
                            {((100000 * Number.parseFloat(feeSettings.completedPlanFee || "0")) / 100).toLocaleString()}
                          </div>
                          <div className="font-medium text-foreground">
                            Amount Received: ₦
                            {(100000 - (100000 * Number.parseFloat(feeSettings.completedPlanFee || "0")) / 100).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="border-t pt-3">
                        <div className="text-sm font-medium mb-1">Broken Plan Withdrawal (Early)</div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Withdrawal Amount: ₦100,000</div>
                          <div>Fee ({feeSettings.brokenPlanFee}%): ₦
                            {((100000 * Number.parseFloat(feeSettings.brokenPlanFee || "0")) / 100).toLocaleString()}
                          </div>
                          <div className="font-medium text-foreground">
                            Amount Received: ₦
                            {(100000 - (100000 * Number.parseFloat(feeSettings.brokenPlanFee || "0")) / 100).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Button onClick={handleSaveFees} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Fee Settings"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Administrator Management</CardTitle>
                    <CardDescription>Manage admin users and their permissions</CardDescription>
                  </div>
                  <Dialog open={showAddAdminDialog} onOpenChange={setShowAddAdminDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Admin
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Administrator</DialogTitle>
                        <DialogDescription>Create a new admin user with Firebase Authentication</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin-firstName">First Name *</Label>
                          <Input
                            id="admin-firstName"
                            placeholder="First name"
                            value={newAdmin.firstName}
                            onChange={(e) => setNewAdmin((prev) => ({ ...prev, firstName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-lastName">Last Name</Label>
                          <Input
                            id="admin-lastName"
                            placeholder="Last name"
                            value={newAdmin.lastName}
                            onChange={(e) => setNewAdmin((prev) => ({ ...prev, lastName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-email">Email Address</Label>
                          <Input
                            id="admin-email"
                            type="email"
                            value={newAdmin.email}
                            onChange={(e) => setNewAdmin((prev) => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-password">Password *</Label>
                          <Input
                            id="admin-password"
                            type="password"
                            placeholder="Minimum 6 characters"
                            value={newAdmin.password}
                            onChange={(e) => setNewAdmin((prev) => ({ ...prev, password: e.target.value }))}
                          />
                          <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-role">Role *</Label>
                          <Select
                            value={newAdmin.role}
                            onValueChange={(value) => setNewAdmin((prev) => ({ ...prev, role: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="support">Support</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddAdminDialog(false)}
                          disabled={creatingAdmin}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateAdmin}
                          disabled={creatingAdmin}
                        >
                          {creatingAdmin ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create Admin"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAdmins ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mt-2">Loading admins...</p>
                        </TableCell>
                      </TableRow>
                    ) : adminUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <p className="text-sm text-muted-foreground">No admin users found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      adminUsers.map((admin) => (
                        <TableRow key={admin.id}>
                          <TableCell className="font-medium">{admin.firstName} {admin.lastName}</TableCell>
                          <TableCell>{admin.email}</TableCell>
                          <TableCell>{getRoleBadge(admin.role)}</TableCell>
                          <TableCell>{getStatusBadge(admin.isActive)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDateTime(admin.lastLogin)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAdmin(admin)
                                setShowViewAdminDialog(true)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* View Admin Dialog */}
            <Dialog open={showViewAdminDialog} onOpenChange={setShowViewAdminDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Admin Details</DialogTitle>
                  <DialogDescription>View and manage administrator information</DialogDescription>
                </DialogHeader>

                {selectedAdmin && (
                  <div className="space-y-6">
                    {/* Admin Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Full Name</Label>
                        <p className="font-medium">{selectedAdmin.firstName} {selectedAdmin.lastName}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Email</Label>
                        <p className="font-medium">{selectedAdmin.email}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Role</Label>
                        <div className="mt-1">{getRoleBadge(selectedAdmin.role)}</div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Status</Label>
                        <div className="mt-1">{getStatusBadge(selectedAdmin.isActive)}</div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Created At</Label>
                        <p className="text-sm">{formatDateTime(selectedAdmin.createdAt)}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Last Login</Label>
                        <p className="text-sm">{formatDateTime(selectedAdmin.lastLogin)}</p>
                      </div>
                    </div>

                    {/* Actions - Only show for non-super_admin */}
                    {selectedAdmin.role !== "super_admin" && (
                      <div className="border-t pt-4">
                        <Label className="text-sm font-medium mb-3 block">Admin Actions</Label>
                        <div className="flex gap-3">
                          <Button
                            variant={selectedAdmin.isActive ? "destructive" : "default"}
                            onClick={handleToggleSuspendAdmin}
                            disabled={suspendingAdmin || deletingAdmin}
                            className="flex-1"
                          >
                            {suspendingAdmin ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {selectedAdmin.isActive ? "Suspending..." : "Activating..."}
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-2" />
                                {selectedAdmin.isActive ? "Suspend Admin" : "Activate Admin"}
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            onClick={handleDeleteAdmin}
                            disabled={suspendingAdmin || deletingAdmin}
                            className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            {deletingAdmin ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Admin
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {selectedAdmin.isActive
                            ? "Suspending will prevent this admin from logging in"
                            : "Activating will allow this admin to log in again"}
                        </p>
                      </div>
                    )}

                    {selectedAdmin.role === "super_admin" && (
                      <div className="border-t pt-4">
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Super Admin accounts cannot be suspended or deleted for security reasons.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowViewAdminDialog(false)
                      setSelectedAdmin(null)
                    }}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
