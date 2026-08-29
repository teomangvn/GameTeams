import { useMemo, useState } from "react";
import {
  Flash,
  UserMultiple,
  Chat,
  Settings as SettingsIcon,
  Hashtag,
  VolumeUp,
  Add,
  Locked,
  Microphone,
  Headphones,
  UserFollow,
  Trophy,
  Time,
} from "@carbon/icons-react";
import { Gamepad2 } from "lucide-react";

import type { Channel, RoomDetail, RoomSummary } from "@/api/rooms";
import {
  TwoLevelSidebar,
  type SidebarMenuItem,
  type SidebarPanel,
  type SidebarRailItem,
} from "@/components/ui/sidebar-component";
import { DM_CONVERSATIONS, FRIEND_IDS, GAMES, getUser } from "@/lib/mock-data";
import { VoiceControlBar } from "@/features/voice/VoiceControlBar";
import type { VoiceSession } from "@/features/voice/useVoiceSession";
import { useAuthStore } from "@/stores/authStore";

const iconClass = "text-neutral-50";

const statusDot: Record<string, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  dnd: "bg-red-500",
  offline: "bg-neutral-600",
};

function StatusDot({ status }: { status: string }) {
  return <span className={`size-2 rounded-full ${statusDot[status]}`} />;
}

/** Oda adindan ray ikonu icin kisaltma uretir. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function buildRoomPanel(
  room: RoomDetail,
  activeChannelId: string | null,
  onSelectChannel: (channel: Channel) => void,
  onJoinVoice: (channel: Channel) => void,
  onCreateChannel: () => void,
): SidebarPanel {
  const text = room.channels.filter((c) => c.type === "TEXT");
  const voice = room.channels.filter((c) => c.type === "VOICE");

  const sections = [
    {
      title: "Metin Kanalları",
      items: [
        ...text.map<SidebarMenuItem>((c) => ({
          id: c.id,
          icon: <Hashtag size={16} className={iconClass} />,
          label: c.name,
          isActive: c.id === activeChannelId,
          onSelect: () => onSelectChannel(c),
        })),
      ],
    },
    {
      title: "Ses Kanalları",
      items: voice.map<SidebarMenuItem>((c) => ({
        id: c.id,
        icon: <VolumeUp size={16} className={iconClass} />,
        label: c.name,
        badge: `0/${c.userLimit ?? 6}`,
        onSelect: () => onJoinVoice(c),
      })),
    },
  ];

  // Kanal acma yalnizca oda sahibinde; uyeye buton gosterilmez.
  if (room.myRole === "OWNER") {
    sections.push({
      title: "Yönetim",
      items: [
        {
          id: "new-channel",
          icon: <Add size={16} className={iconClass} />,
          label: "Kanal oluştur",
          onSelect: onCreateChannel,
        },
        ...(room.inviteCode
          ? [
              {
                id: "invite",
                icon: <Locked size={16} className={iconClass} />,
                label: `Davet kodu: ${room.inviteCode}`,
                onSelect: () => void navigator.clipboard?.writeText(room.inviteCode!),
              } satisfies SidebarMenuItem,
            ]
          : []),
      ],
    });
  }

  return { title: room.name, sections };
}

/* --- Quick Match / arkadaslar / DM panolari henuz mock veriden besleniyor --- */

function buildQuickMatchPanel(): SidebarPanel {
  return {
    title: "Quick Match",
    sections: [
      {
        title: "Oyun Seç",
        items: GAMES.map<SidebarMenuItem>((g) => ({
          id: g.id,
          icon: <Trophy size={16} className={iconClass} />,
          label: g.name,
          badge: g.queued,
          children: g.teamSizes.map<SidebarMenuItem>((size) => ({
            id: `${g.id}-${size}`,
            label: `${size} kişilik takım`,
          })),
        })),
      },
      {
        title: "Kuyruğum",
        items: [
          { id: "queue", icon: <Time size={16} className={iconClass} />, label: "Kuyrukta değilsin" },
        ],
      },
    ],
  };
}

function buildFriendsPanel(): SidebarPanel {
  const friends = FRIEND_IDS.map(getUser);
  const online = friends.filter((f) => f.status !== "offline");
  const offline = friends.filter((f) => f.status === "offline");

  return {
    title: "Arkadaşlar",
    sections: [
      {
        title: `Çevrimiçi — ${online.length}`,
        items: online.map<SidebarMenuItem>((f) => ({
          id: f.id,
          icon: <StatusDot status={f.status} />,
          label: f.playing ? `${f.displayName} · ${f.playing}` : f.displayName,
        })),
      },
      {
        title: `Çevrimdışı — ${offline.length}`,
        items: offline.map<SidebarMenuItem>((f) => ({
          id: f.id,
          icon: <StatusDot status={f.status} />,
          label: f.displayName,
        })),
      },
      {
        title: "İşlemler",
        items: [
          { id: "add-friend", icon: <UserFollow size={16} className={iconClass} />, label: "Arkadaş ekle" },
        ],
      },
    ],
  };
}

function buildDmPanel(): SidebarPanel {
  return {
    title: "Direkt Mesajlar",
    sections: [
      {
        title: "Sohbetler",
        items: DM_CONVERSATIONS.map<SidebarMenuItem>((d) => ({
          id: d.id,
          icon: <Chat size={16} className={iconClass} />,
          label: getUser(d.userId).displayName,
          badge: d.unread,
        })),
      },
    ],
  };
}

function buildSettingsPanel(onLogout: () => void): SidebarPanel {
  return {
    title: "Ayarlar",
    sections: [
      {
        title: "Hesap",
        items: [
          { id: "s-profile", icon: <UserMultiple size={16} className={iconClass} />, label: "Profil" },
          { id: "s-logout", icon: <Locked size={16} className={iconClass} />, label: "Çıkış yap", onSelect: onLogout },
        ],
      },
      {
        title: "Ses ve Görüntü",
        items: [
          { id: "s-mic", icon: <Microphone size={16} className={iconClass} />, label: "Mikrofon" },
          { id: "s-out", icon: <Headphones size={16} className={iconClass} />, label: "Çıkış aygıtı" },
        ],
      },
    ],
  };
}

export interface AppSidebarProps {
  rooms: RoomSummary[];
  activeRoom: RoomDetail | null;
  activeSection: string;
  onSectionChange: (id: string) => void;
  activeChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
  onJoinVoice: (channel: Channel) => void;
  onCreateChannel: () => void;
  onOpenRoomDialog: () => void;
  voice: VoiceSession | null;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onDisconnectVoice: () => void;
}

export function AppSidebar({
  rooms,
  activeRoom,
  activeSection,
  onSectionChange,
  activeChannelId,
  onSelectChannel,
  onJoinVoice,
  onCreateChannel,
  onOpenRoomDialog,
  voice,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onDisconnectVoice,
}: AppSidebarProps) {
  const [search, setSearch] = useState("");
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const railItems = useMemo<SidebarRailItem[]>(
    () => [
      { id: "quickmatch", icon: <Flash size={16} />, label: "Quick Match" },
      { id: "friends", icon: <UserMultiple size={16} />, label: "Arkadaşlar" },
      { id: "dms", icon: <Chat size={16} />, label: "Direkt Mesajlar" },
      ...rooms.map<SidebarRailItem>((room, index) => ({
        id: room.id,
        label: room.name,
        separatorBefore: index === 0,
        icon: (
          <span className="font-lexend text-[11px] font-semibold tracking-tight">
            {initialsOf(room.name)}
          </span>
        ),
      })),
      {
        id: "new-room",
        icon: <Add size={16} />,
        label: "Oda oluştur veya katıl",
        separatorBefore: rooms.length === 0,
      },
    ],
    [rooms],
  );

  const panel = useMemo<SidebarPanel>(() => {
    if (activeRoom && activeRoom.id === activeSection) {
      return buildRoomPanel(
        activeRoom,
        activeChannelId,
        onSelectChannel,
        onJoinVoice,
        onCreateChannel,
      );
    }

    switch (activeSection) {
      case "friends":
        return buildFriendsPanel();
      case "dms":
        return buildDmPanel();
      case "settings":
        return buildSettingsPanel(() => void logout());
      default:
        return buildQuickMatchPanel();
    }
  }, [
    activeRoom,
    activeSection,
    activeChannelId,
    onSelectChannel,
    onJoinVoice,
    onCreateChannel,
    logout,
  ]);

  const filteredPanel = useMemo<SidebarPanel>(() => {
    const query = search.trim().toLowerCase();
    if (!query) return panel;

    return {
      title: panel.title,
      sections: panel.sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.label.toLowerCase().includes(query)),
        }))
        .filter((section) => section.items.length > 0),
    };
  }, [panel, search]);

  return (
    <TwoLevelSidebar
      brand={{
        name: "GameTeams",
        logo: <Gamepad2 className="size-6 text-neutral-50" strokeWidth={2} />,
      }}
      railItems={railItems}
      railFooterItems={[
        { id: "settings", icon: <SettingsIcon size={16} />, label: "Ayarlar" },
      ]}
      activeSection={activeSection}
      onSectionChange={(id) => (id === "new-room" ? onOpenRoomDialog() : onSectionChange(id))}
      panel={filteredPanel}
      searchPlaceholder="Kanal, arkadaş, oyun ara..."
      searchValue={search}
      onSearchChange={setSearch}
      footer={
        voice && (
          <VoiceControlBar
            channelName={voice.channelName}
            roomName={voice.roomName}
            pingMs={voice.pingMs}
            muted={voice.muted}
            deafened={voice.deafened}
            screenSharing={voice.screenSharing}
            onToggleMute={onToggleMute}
            onToggleDeafen={onToggleDeafen}
            onToggleScreenShare={onToggleScreenShare}
            onDisconnect={onDisconnectVoice}
          />
        )
      }
      user={{
        name: authUser?.displayName ?? "",
        avatarUrl: authUser?.avatarUrl ?? undefined,
        status: "online",
        onMenuClick: () => void logout(),
      }}
    />
  );
}

export default AppSidebar;
