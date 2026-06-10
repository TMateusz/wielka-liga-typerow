import { getDisplayName } from "@shared/display-names";
import { formatPoints } from "@shared/scoring";
import { Trophy } from "lucide-react";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  totalPoints: number;
};

type Props = {
  users: User[];
  currentUserId?: string;
};

export function LeaderGapBanner({ users, currentUserId }: Props) {
  if (!currentUserId || users.length < 2) return null;

  const leader = users[0];
  const me = users.find((u) => u.id === currentUserId);
  if (!me || me.id === leader.id) return null;

  const gap = leader.totalPoints - me.totalPoints;
  const myRank = users.findIndex((u) => u.id === me.id) + 1;

  return (
    <div className="card-pitch flex flex-wrap items-center gap-2 border-[var(--wc-gold)]/20 bg-[var(--wc-gold)]/5 px-4 py-3 text-sm text-white/70">
      <Trophy className="h-4 w-4 shrink-0 text-[var(--wc-gold)]" />
      <span>
        Jesteś na <strong className="text-white/90">#{myRank}</strong> miejscu —{" "}
        <strong className="text-[var(--wc-gold)]">{formatPoints(gap)} pkt</strong> za liderem (
        {getDisplayName(leader)})
      </span>
    </div>
  );
}
