"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase_config"
import { useRouter } from "next/navigation"

interface AdminData {
    email: string
    firstName: string
    lastName: string
    role: "super_admin" | "admin"
    isActive: boolean
    createdAt: any
    lastLogin: any
}

interface AuthContextType {
    user: User | null
    adminData: AdminData | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<void>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [adminData, setAdminData] = useState<AdminData | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user)

            if (user) {
                // Fetch admin data from Firestore
                try {
                    const adminDoc = await getDoc(doc(db, "admin", user.uid))
                    if (adminDoc.exists()) {
                        const data = adminDoc.data() as AdminData

                        // Check if admin is active
                        if (!data.isActive) {
                            await firebaseSignOut(auth)
                            setUser(null)
                            setAdminData(null)
                            setLoading(false)
                            return
                        }

                        setAdminData(data)
                    } else {
                        // User authenticated but not an admin
                        await firebaseSignOut(auth)
                        setUser(null)
                        setAdminData(null)
                    }
                } catch (error) {
                    console.error("Error fetching admin data:", error)
                    await firebaseSignOut(auth)
                    setUser(null)
                    setAdminData(null)
                }
            } else {
                setAdminData(null)
            }

            setLoading(false)
        })

        return () => unsubscribe()
    }, [])

    const signIn = async (email: string, password: string) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password)

            // Verify admin exists in Firestore
            const adminDoc = await getDoc(doc(db, "admin", userCredential.user.uid))

            if (!adminDoc.exists()) {
                await firebaseSignOut(auth)
                throw new Error("You are not authorized to access this dashboard")
            }

            const adminData = adminDoc.data() as AdminData

            if (!adminData.isActive) {
                await firebaseSignOut(auth)
                throw new Error("Your account has been deactivated")
            }

            // Update last login
            await updateDoc(doc(db, "admin", userCredential.user.uid), {
                lastLogin: serverTimestamp()
            })

            setAdminData(adminData)
        } catch (error: any) {
            console.error("Sign in error:", error)
            throw error
        }
    }

    const signOut = async () => {
        try {
            await firebaseSignOut(auth)
            setUser(null)
            setAdminData(null)
            router.push("/login")
        } catch (error) {
            console.error("Sign out error:", error)
            throw error
        }
    }

    return (
        <AuthContext.Provider value={{ user, adminData, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
