import type { Metadata } from "next"
import NotificationsClient from "./client"

export const metadata: Metadata = {
  title: "Notifications | Eddix Admin",
  description:
    "Real-time system alerts and platform updates for Eddix Savings. Monitor high-priority notifications, system events, user activities, and payment alerts in one centralized hub.",
}

export default function NotificationsPage() {
  return <NotificationsClient />
}
