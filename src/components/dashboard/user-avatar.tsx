import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/format"
import { teamFor, type Profile } from "@/lib/types"

// Fallback palette for non-team profiles (e.g. the "Unassigned" placeholder
// or freshly created Supabase auth users that haven't been classified yet).
const SEEDS = [
  "bg-slate-100 text-slate-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-800",
]
function fallbackTone(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return SEEDS[h % SEEDS.length]
}

export function UserAvatar({
  profile,
  size = "sm",
  className,
}: {
  profile: Pick<Profile, "id" | "full_name" | "team"> | null | undefined
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
  // Tone follows the team so Madrid (Pablo M + Pablo C) reads visually
  // distinct from US (Pablo S) at a glance. Plus a thin coloured ring
  // doubles up the signal for users with smaller avatars.
  const team = profile.team ? teamFor(profile.team) : null
  const tone = team?.avatarTone ?? fallbackTone(profile.id)
  const ring = team ? cn("ring-1 ring-offset-1 ring-offset-background", team.ringTone) : ""
  return (
    <Avatar
      size={size}
      className={cn(ring, className)}
      title={team ? `${profile.full_name} · ${team.label}` : profile.full_name}
    >
      <AvatarFallback className={tone}>
        {initials(profile.full_name)}
      </AvatarFallback>
    </Avatar>
  )
}
