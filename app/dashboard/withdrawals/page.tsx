import WithdrawalsClientPage from "./_components/WithdrawalsClientPage"

export const metadata = {
  title: "Withdrawals | Eddix Admin",
  description:
    "Review and process user withdrawal requests. Approve or decline withdrawals, initiate admin withdrawals, and track withdrawal history with detailed approval workflows.",
}

export default function WithdrawalsPage() {
  return <WithdrawalsClientPage />
}
