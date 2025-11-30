import type { Metadata } from "next"
import ClientSettingsPage from "./client-page"

export const metadata: Metadata = {
  title: "Admin Settings | Eddix Admin",
  description:
    "Configure Eddix Savings platform settings. Manage administrators, set fee rules, configure notifications, adjust security settings, and control system preferences.",
}

export default function SettingsPage() {
  return <ClientSettingsPage />
}
