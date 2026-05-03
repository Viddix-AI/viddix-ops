import * as React from "react"

import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { TaskRemindersClient } from "./task-reminders-client"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <TaskRemindersClient />
    </div>
  )
}
