import * as React from "react"

import { KeyboardShortcutsClient } from "@/components/dashboard/keyboard-shortcuts"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { Grain } from "@/components/ui/grain"
import { TaskRemindersClient } from "./task-reminders-client"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-svh">
      <Grain />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <TaskRemindersClient />
      <KeyboardShortcutsClient />
    </div>
  )
}
