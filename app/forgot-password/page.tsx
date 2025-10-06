export const metadata = {
  title: "Forgot Password | Eddix Admin",
  description:
    "Reset your Eddix Admin password. Enter your email address to receive password reset instructions and regain access to your administrator account.",
}

import ForgotPasswordClient from "./forgot-password-client"

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />
}
