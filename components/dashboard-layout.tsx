"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  TrendingDown,
  Bell,
  BarChart3,
  Settings,
  Menu,
  LogOut,
  ChevronDown,
  PiggyBank,
  Building2,
  ChevronLeft,
  ChevronRight,
  Power,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { db } from "@/lib/firebase_config"
import { collection, query, where, getDocs } from "firebase/firestore"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Savings", href: "/dashboard/savings", icon: PiggyBank },
  { name: "Banks", href: "/dashboard/banks", icon: Building2 },
  { name: "Contributions", href: "/dashboard/contributions", icon: TrendingUp },
  { name: "Withdrawals", href: "/dashboard/withdrawals", icon: TrendingDown },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

interface AdminUser {
  uid: string
  email: string
  firstName?: string
  lastName?: string
  role?: string
  createdAt?: any
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  // Fetch admin user data
  useEffect(() => {
    const fetchAdminUser = async () => {
      try {
        // Get admin email from localStorage or session
        const adminEmail = localStorage.getItem("adminEmail") || "admin@company.com"
        
        // Fetch admin user from Firebase
        const usersRef = collection(db, "admin")
        const q = query(usersRef, where("email", "==", adminEmail))
        const querySnapshot = await getDocs(q)
        
        if (!querySnapshot.empty) {
          const adminDoc = querySnapshot.docs[0]
          setAdminUser({
            uid: adminDoc.id,
            ...adminDoc.data()
          } as AdminUser)
        } else {
          // Fallback to default admin
          setAdminUser({
            uid: "admin",
            email: adminEmail,
            firstName: "Admin",
            lastName: "User",
            role: "Administrator"
          })
        }
      } catch (error) {
        console.error("Error fetching admin user:", error)
        // Set default admin on error
        setAdminUser({
          uid: "admin",
          email: "admin@company.com",
          firstName: "Admin",
          lastName: "User",
          role: "Administrator"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAdminUser()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("adminEmail")
    router.push("/login")
  }

  const getInitials = (user: AdminUser | null) => {
    if (!user) return "AD"
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    }
    return user.email[0].toUpperCase()
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex flex-col h-full transition-all duration-300", mobile ? "w-full" : sidebarCollapsed ? "w-20" : "w-64")}>
      <div className={cn("flex items-center gap-2 px-6 py-4 border-b border-border", sidebarCollapsed && !mobile && "justify-center px-4")}>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
        </div>
        {(!sidebarCollapsed || mobile) && <span className="font-semibold text-lg">Eddix Savings</span>}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
                sidebarCollapsed && !mobile && "justify-center"
              )}
              onClick={() => mobile && setSidebarOpen(false)}
              title={sidebarCollapsed && !mobile ? item.name : undefined}
            >
              <item.icon className="w-5 h-5" />
              {(!sidebarCollapsed || mobile) && item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        {!mobile && (
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full", sidebarCollapsed ? "justify-center px-0" : "justify-start")}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!sidebarCollapsed && <span className="ml-2">Collapse</span>}
          </Button>
        )}
        <Button 
          variant="ghost" 
          className={cn(
            "w-full text-red-600 hover:text-red-700 hover:bg-red-50",
            sidebarCollapsed && !mobile ? "justify-center px-0" : "justify-start gap-3 px-3"
          )}
          onClick={handleLogout}
          title={sidebarCollapsed && !mobile ? "Logout" : undefined}
        >
          <Power className="w-5 h-5" />
          {(!sidebarCollapsed || mobile) && "Logout"}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className={cn("hidden lg:flex lg:flex-col lg:border-r lg:border-border transition-all duration-300", sidebarCollapsed ? "lg:w-20" : "lg:w-64")}>
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-4 px-6 py-4 border-b border-border lg:px-8">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
          </Sheet>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getInitials(adminUser)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <div className="text-sm font-medium">
                    {loading ? "Loading..." : adminUser?.email || "Admin User"}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Account Information</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(adminUser)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {adminUser?.firstName && adminUser?.lastName 
                        ? `${adminUser.firstName} ${adminUser.lastName}`
                        : "Admin User"}
                    </div>
                    <div className="text-xs text-muted-foreground">{adminUser?.email || "admin@company.com"}</div>
                  </div>
                </div>
                {adminUser?.role && (
                  <div className="pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Role</div>
                    <div className="text-sm font-medium">{adminUser.role}</div>
                  </div>
                )}
                {adminUser?.createdAt && (
                  <div className="pt-2">
                    <div className="text-xs text-muted-foreground">Member Since</div>
                    <div className="text-sm">
                      {new Date(adminUser.createdAt.toDate()).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </div>
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
