import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"

/**
 * AvatarStack — overlapping cluster of UserAvatar with a "+N" overflow chip.
 *
 * Designed for compact list rows (tasks, events) where a single assignee
 * cell may now hold multiple people. The first three names get a real
 * avatar; anything beyond collapses into "+N" so the row width stays
 * predictable.
 */
export function AvatarStack({
  profiles,
  max = 3,
  size = "sm",
  className,
}: {
  profiles: Profile[]
  /** Hard cap for visible avatars. Anything beyond collapses into "+N". */
  max?: number
  size?: "default" | "sm" | "lg"
  className?: string
}) {
  if (profiles.length === 0) {
    return <UserAvatar profile={null} size={size} className={className} />
  }
  const visible = profiles.slice(0, max)
  const overflow = profiles.length - visible.length
  return (
    <div
      className={cn("flex items-center", className)}
      title={profiles.map((p) => p.full_name).join(", ")}
    >
      {visible.map((p, i) => (
        <UserAvatar
          key={p.id}
          profile={p}
          size={size}
          className={i === 0 ? undefined : "-ml-2"}
        />
      ))}
      {overflow > 0 && (
        <Avatar size={size} className="-ml-2 ring-1 ring-background">
          <AvatarFallback className="bg-surface-3 text-[10px] font-medium text-text-secondary">
            +{overflow}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
