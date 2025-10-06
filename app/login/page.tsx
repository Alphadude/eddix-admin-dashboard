export const metadata = {
  title: "Admin Login | Eddix Admin",
  description:
    "Secure admin login for Eddix Savings platform. Access your dashboard with two-factor authentication to manage users, contributions, withdrawals, and platform settings.",
}

import LoginPageClient from "./loginClient"

export default function LoginPage() {
  return <LoginPageClient />
}
