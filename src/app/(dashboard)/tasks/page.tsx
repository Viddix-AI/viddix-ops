import { Suspense } from "react"

import { TasksView } from "./tasks-view"

// TasksView consumes useSearchParams() to round-trip filters through the URL.
// Next 16 bails out of static prerender when that runs at the page root, so
// we wrap in a Suspense boundary to keep the rest of the route static.
export default function TasksPage() {
  return (
    <Suspense>
      <TasksView />
    </Suspense>
  )
}
