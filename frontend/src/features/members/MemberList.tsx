import type { RoomMember } from "@/api/rooms";
import { cn } from "@/lib/utils";

/** Odanin uye listesi. Sahip ustte, digerleri katilma sirasina gore. */
export function MemberList({ members }: { members: RoomMember[] }) {
  const owners = members.filter((m) => m.role === "OWNER");
  const others = members.filter((m) => m.role !== "OWNER");

  return (
    <aside className="w-60 shrink-0 bg-neutral-950 border-l border-neutral-800 flex flex-col">
      <div className="h-14 shrink-0 border-b border-neutral-800 flex items-center px-4">
        <span className="font-lexend font-semibold text-[13px] text-neutral-300">
          Üyeler — {members.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-4">
        {owners.length > 0 && <Section title="Sahip" members={owners} />}
        {others.length > 0 && <Section title={`Üye — ${others.length}`} members={others} />}
      </div>
    </aside>
  );
}

function Section({ title, members }: { title: string; members: RoomMember[] }) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="font-lexend text-[11px] uppercase tracking-wide text-neutral-500 px-2 py-1">
        {title}
      </h3>
      {members.map((member) => (
        <MemberRow key={member.userId} member={member} />
      ))}
    </section>
  );
}

function MemberRow({ member }: { member: RoomMember }) {
  const label = member.nickname ?? member.displayName;

  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left hover:bg-neutral-800 transition-colors"
    >
      <span className="relative shrink-0">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={label} className="size-8 rounded-full object-cover" />
        ) : (
          <span className="size-8 rounded-full bg-neutral-800 flex items-center justify-center font-lexend text-[12px] text-neutral-300">
            {label.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-lexend text-[14px] text-neutral-100 truncate">{label}</span>
        <span
          className={cn(
            "block font-lexend text-[11px] truncate",
            member.role === "OWNER" ? "text-amber-400" : "text-neutral-500",
          )}
        >
          {member.role === "OWNER" ? "Oda sahibi" : `@${member.username}`}
        </span>
      </span>
    </button>
  );
}

export default MemberList;
