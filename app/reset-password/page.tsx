export const metadata = {
  title: "Reset Password | Eddix Admin",
  description:
    "Create a new password for your Eddix Admin account. Enter and confirm your new password to complete the password reset process and access your dashboard.",
}

import ResetPasswordClient from "./_components/ResetPasswordClient"

export default function ResetPasswordPage() {
  return <ResetPasswordClient />
}
