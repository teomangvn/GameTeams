import { useEffect, useRef, useState } from "react";
import { Chat, UserFollow } from "@carbon/icons-react";

import type { RoomMember } from "@/api/rooms";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

/**
 * Odanin uye listesi. Sahip ustte, digerleri katilma sirasina gore.
 *
 * Cevrimici olanlar once gelir ve nokta ile isaretlenir: "kim su an burada"
 * sorusunun cevabi listeyi bastan sona okumadan gorulebilmeli.
 */
export function MemberList({
  members,
  onAddFriend,
  onOpenDm,
}: {
  members: RoomMember[];
  onAddFriend: (username: string) => void;
  onOpenDm: (userId: string) => void;
}) {
  const online = members.filter((m) => m.online);
  const offline = members.filter((m) => !m.online);

  return (
    <aside className="w-60 shrink-0 bg-neutral-950 border-l border-neutral-800 flex flex-col">
      <div className="h-14 shrink-0 border-b border-neutral-800 flex items-center px-4">
        <span className="font-lexend font-semibold text-[13px] text-neutral-300">
          Üyeler — {members.length}
        </span>
        {online.length > 0 && (
          <span className="ml-auto font-lexend text-[12px] text-emerald-500">
            {online.length} çevrimiçi
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-4">
        {online.length > 0 && (
          <Section
            title={`Çevrimiçi — ${online.length}`}
            members={online}
            onAddFriend={onAddFriend}
            onOpenDm={onOpenDm}
          />
        )}
        {offline.length > 0 && (
          <Section
            title={`Çevrimdışı — ${offline.length}`}
            members={offline}
            onAddFriend={onAddFriend}
            onOpenDm={onOpenDm}
          />
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  members,
  onAddFriend,
  onOpenDm,
}: {
  title: string;
  members: RoomMember[];
  onAddFriend: (username: string) => void;
  onOpenDm: (userId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="font-lexend text-[11px] uppercase tracking-wide text-neutral-500 px-2 py-1">
        {title}
      </h3>
      {members.map((member) => (
        <MemberRow
          key={member.userId}
          member={member}
          onAddFriend={onAddFriend}
          onOpenDm={onOpenDm}
        />
      ))}
    </section>
  );
}

function MemberRow({
  member,
  onAddFriend,
  onOpenDm,
}: {
  member: RoomMember;
  onAddFriend: (username: string) => void;
  onOpenDm: (userId: string) => void;
}) {
  const selfId = useAuthStore((s) => s.user?.id ?? null);
  const isSelf = selfId === member.userId;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const label = member.nickname ?? member.displayName;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        // Kendine arkadaslik istegi veya DM anlamsiz; menuyu hic acmiyoruz.
        onClick={() => !isSelf && setOpen((value) => !value)}
        aria-haspopup={isSelf ? undefined : "menu"}
        aria-expanded={isSelf ? undefined : open}
        className={cn(
          "w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left transition-colors",
          isSelf ? "cursor-default" : "hover:bg-neutral-800",
          open && "bg-neutral-800",
          !member.online && "opacity-60",
        )}
      >
        <span className="relative shrink-0">
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="size-8 rounded-full bg-neutral-800 flex items-center justify-center font-lexend text-[12px] text-neutral-300">
              {label.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span
            aria-label={member.online ? "çevrimiçi" : "çevrimdışı"}
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-neutral-950",
              member.online ? "bg-emerald-500" : "bg-neutral-600",
            )}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-lexend text-[14px] text-neutral-100 truncate">
            {label}
            {isSelf && <span className="text-neutral-500"> (sen)</span>}
          </span>
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

      {open && !isSelf && (
        <div
          role="menu"
          aria-label={`${label} işlemleri`}
          className="absolute right-2 top-full z-20 mt-1 w-44 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-lg shadow-black/60"
        >
          <MenuItem
            icon={<UserFollow size={16} />}
            label="Arkadaş ekle"
            onClick={() => {
              setOpen(false);
              onAddFriend(member.username);
            }}
          />
          <MenuItem
            icon={<Chat size={16} />}
            label="Mesaj gönder"
            onClick={() => {
              setOpen(false);
              onOpenDm(member.userId);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full h-9 flex items-center gap-2 rounded-md px-3 text-left font-lexend text-[13px] text-neutral-200 transition-colors hover:bg-neutral-800"
    >
      {icon}
      {label}
    </button>
  );
}

export default MemberList;
