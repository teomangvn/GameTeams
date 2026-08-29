import { useMemo, useState } from "react";
import {
  Flash,
  UserMultiple,
  Chat,
  Settings as SettingsIcon,
  Settings,
  Hashtag,
  VolumeUp,
  Add,
  Locked,
  Microphone,
  MicrophoneOff,
  Headphones,
  UserFollow,
  Trophy,
  Time,
} from "@carbon/icons-react";
import { Gamepad2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { Channel, RoomDetail, RoomSummary } from "@/api/rooms";
import {
  TwoLevelSidebar,
  type SidebarMenuItem,
  type SidebarPanel,
  type SidebarRailItem,
} from "@/components/ui/sidebar-component";
import type { Conversation, Friend, FriendRequest } from "@/api/friends";
import type { Game, Ticket } from "@/api/matchmaking";
import { VoiceControlBar } from "@/features/voice/VoiceControlBar";
import type { VoiceSession } from "@/features/voice/useVoiceSession";
import { useAuthStore } from "@/stores/authStore";

const iconClass = "text-neutral-50";

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`size-2 rounded-full ${online ? "bg-emerald-500" : "bg-neutral-600"}`}
    />
  );
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
  voice: VoiceSession | null,
  onSelectChannel: (channel: Channel) => void,
  onJoinVoice: (channel: Channel) => void,
  onCreateChannel: () => void,
): SidebarPanel {
  const text = room.channels.filter((c) => c.type === "TEXT");
  const voiceChannels = room.channels.filter((c) => c.type === "VOICE");

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
      items: voiceChannels.map<SidebarMenuItem>((c) => {
        // Doluluk yalnizca bagli olunan kanal icin bilinir; digerleri icin
        // sunucudan ayrica cekmek gerekir (Phase 7'de eklenecek).
        const connectedHere = voice?.channelId === c.id;
        const occupants = connectedHere
          ? [...voice.participants, { userId: "self", displayName: "Sen", muted: voice.muted }]
          : [];

        return {
          id: c.id,
          icon: <VolumeUp size={16} className={connectedHere ? "text-emerald-400" : iconClass} />,
          label: c.name,
          badge: connectedHere ? `${occupants.length}/${c.userLimit ?? 6}` : undefined,
          onSelect: () => onJoinVoice(c),
          children: occupants.length
            ? occupants.map<SidebarMenuItem>((p) => ({
                id: `${c.id}-${p.userId}`,
                icon: p.muted ? (
                  <MicrophoneOff size={14} className="text-red-400" />
                ) : (
                  <Microphone size={14} className="text-neutral-300" />
                ),
                label: p.displayName,
              }))
            : undefined,
        };
      }),
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

function buildQuickMatchPanel(
  games: Game[],
  ticket: Ticket | null,
  elapsedSeconds: number,
  onJoinQueue: (gameId: string, partySize: number) => void,
  onLeaveQueue: () => void,
): SidebarPanel {
  const queueSection = ticket
    ? {
        title: "Kuyruktasın",
        items: [
          {
            id: "queue-status",
            icon: <Time size={16} className="text-emerald-400" />,
            label: `${ticket.gameName} · ${ticket.partySize} kişi`,
            badge: formatDuration(elapsedSeconds),
          },
          {
            id: "queue-rank",
            icon: <Trophy size={16} className={iconClass} />,
            label: ticket.rank ? `Rank: ${ticket.rank.name}` : "Rank belirtilmedi",
          },
          {
            id: "queue-leave",
            icon: <Locked size={16} className="text-red-400" />,
            label: "Kuyruktan çık",
            onSelect: onLeaveQueue,
          },
        ],
      }
    : {
        title: "Kuyruğum",
        items: [
          {
            id: "queue-empty",
            icon: <Time size={16} className={iconClass} />,
            label: "Kuyrukta değilsin",
          },
        ],
      };

  return {
    title: "Quick Match",
    sections: [
      queueSection,
      {
        title: "Oyun Seç",
        items: games.map<SidebarMenuItem>((g) => ({
          id: g.id,
          icon: <Trophy size={16} className={iconClass} />,
          label: g.name,
          // Takim boyutu secenekleri oyunun kendi sinirlarindan uretilir.
          children: teamSizesOf(g).map<SidebarMenuItem>((size) => ({
            id: `${g.id}-${size}`,
            label: `${size} kişilik takım`,
            onSelect: () => onJoinQueue(g.id, size),
          })),
        })),
      },
    ],
  };
}

function teamSizesOf(game: Game): number[] {
  const sizes: number[] = [];
  for (let size = game.minTeamSize; size <= game.maxTeamSize; size++) sizes.push(size);
  return sizes;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildFriendsPanel(
  friends: Friend[],
  incoming: FriendRequest[],
  onAddFriend: () => void,
  onOpenDm: (userId: string) => void,
  onAccept: (friendshipId: string) => void,
): SidebarPanel {
  const online = friends.filter((f) => f.online);
  const offline = friends.filter((f) => !f.online);

  const sections = [];

  // Bekleyen istekler en ustte: aksiyon gerektiren tek bolum.
  if (incoming.length > 0) {
    sections.push({
      title: `İstekler — ${incoming.length}`,
      items: incoming.map<SidebarMenuItem>((r) => ({
        id: r.friendshipId,
        icon: <UserFollow size={16} className="text-amber-400" />,
        label: `${r.displayName} · kabul et`,
        onSelect: () => onAccept(r.friendshipId),
      })),
    });
  }

  sections.push(
    {
      title: `Çevrimiçi — ${online.length}`,
      items: online.map<SidebarMenuItem>((f) => ({
        id: f.userId,
        icon: <StatusDot online />,
        label: f.displayName,
        onSelect: () => onOpenDm(f.userId),
      })),
    },
    {
      title: `Çevrimdışı — ${offline.length}`,
      items: offline.map<SidebarMenuItem>((f) => ({
        id: f.userId,
        icon: <StatusDot online={false} />,
        label: f.displayName,
        onSelect: () => onOpenDm(f.userId),
      })),
    },
    {
      title: "İşlemler",
      items: [
        {
          id: "add-friend",
          icon: <UserFollow size={16} className={iconClass} />,
          label: "Arkadaş ekle",
          onSelect: onAddFriend,
        },
      ],
    },
  );

  return { title: "Arkadaşlar", sections };
}

function buildDmPanel(
  conversations: Conversation[],
  activeConversationId: string | null,
  onSelect: (conversation: Conversation) => void,
): SidebarPanel {
  return {
    title: "Direkt Mesajlar",
    sections: [
      {
        title: conversations.length ? "Sohbetler" : "Henüz sohbet yok",
        items: conversations.map<SidebarMenuItem>((c) => ({
          id: c.id,
          icon: <StatusDot online={c.otherOnline} />,
          label: c.otherDisplayName,
          isActive: c.id === activeConversationId,
          onSelect: () => onSelect(c),
        })),
      },
    ],
  };
}

function buildSettingsPanel(
  isAdmin: boolean,
  onOpenAdmin: () => void,
  onLogout: () => void,
): SidebarPanel {
  const accountItems: SidebarMenuItem[] = [
    { id: "s-profile", icon: <UserMultiple size={16} className={iconClass} />, label: "Profil" },
  ];

  // Yonetim baglantisi yalnizca yoneticilere gosterilir.
  if (isAdmin) {
    accountItems.push({
      id: "s-admin",
      icon: <Settings size={16} className="text-amber-400" />,
      label: "Yönetim paneli",
      onSelect: onOpenAdmin,
    });
  }

  accountItems.push({
    id: "s-logout",
    icon: <Locked size={16} className={iconClass} />,
    label: "Çıkış yap",
    onSelect: onLogout,
  });

  return {
    title: "Ayarlar",
    sections: [
      { title: "Hesap", items: accountItems },
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
  friends: Friend[];
  incomingRequests: FriendRequest[];
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onOpenDmWith: (userId: string) => void;
  onAcceptFriendRequest: (friendshipId: string) => void;
  onAddFriend: () => void;
  games: Game[];
  ticket: Ticket | null;
  queueElapsedSeconds: number;
  onJoinQueue: (gameId: string, partySize: number) => void;
  onLeaveQueue: () => void;
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
  friends,
  incomingRequests,
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenDmWith,
  onAcceptFriendRequest,
  onAddFriend,
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
  games,
  ticket,
  queueElapsedSeconds,
  onJoinQueue,
  onLeaveQueue,
}: AppSidebarProps) {
  const [search, setSearch] = useState("");
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const railItems = useMemo<SidebarRailItem[]>(
    () => [
      {
        id: "quickmatch",
        icon: <Flash size={16} className={ticket ? "text-emerald-400" : undefined} />,
        label: ticket ? "Quick Match · kuyruktasın" : "Quick Match",
      },
      {
        id: "friends",
        icon: <UserMultiple size={16} />,
        label: "Arkadaşlar",
        badge: incomingRequests.length,
      },
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
    [rooms, incomingRequests.length, ticket],
  );

  const panel = useMemo<SidebarPanel>(() => {
    if (activeRoom && activeRoom.id === activeSection) {
      return buildRoomPanel(
        activeRoom,
        activeChannelId,
        voice,
        onSelectChannel,
        onJoinVoice,
        onCreateChannel,
      );
    }

    switch (activeSection) {
      case "friends":
        return buildFriendsPanel(
          friends,
          incomingRequests,
          onAddFriend,
          onOpenDmWith,
          onAcceptFriendRequest,
        );
      case "dms":
        return buildDmPanel(conversations, activeConversationId, onSelectConversation);
      case "settings":
        return buildSettingsPanel(
          authUser?.role === "ADMIN",
          () => navigate("/admin"),
          () => void logout(),
        );
      default:
        return buildQuickMatchPanel(
          games,
          ticket,
          queueElapsedSeconds,
          onJoinQueue,
          onLeaveQueue,
        );
    }
  }, [
    activeRoom,
    activeSection,
    activeChannelId,
    voice,
    friends,
    incomingRequests,
    conversations,
    activeConversationId,
    onSelectChannel,
    onJoinVoice,
    onCreateChannel,
    onSelectConversation,
    onOpenDmWith,
    onAcceptFriendRequest,
    onAddFriend,
    games,
    ticket,
    queueElapsedSeconds,
    onJoinQueue,
    onLeaveQueue,
    authUser?.role,
    navigate,
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
            participantCount={voice.participants.length + 1}
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
