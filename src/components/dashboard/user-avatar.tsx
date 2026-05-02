import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import type { Profile } from "@/lib/types"

const SEEDS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
]

function tone(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return SEEDS[h % SEEDS.length]
}

export function UserAvatar({
  profile,
  size = "sm",
  className,
}: {
  profile: Pick<Profile, "id" | "full_name"> | null | undefined
  size?: "default" | "sm" | "lg"
  className?: string
}) {
  if (!profile) {
    return (
      <Avatar size={size} className={className}>
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
    )
  }
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className={cn(tone(profile.id))}>
        {initials(profile.full_name)}
      </AvatarFallback>
    </Avatar>
  )
}
