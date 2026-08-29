import { useCallback, useEffect, useState } from "react";

import type { Channel } from "@/api/rooms";
import AppSidebar from "@/features/navigation/AppSidebar";
import ChatArea from "@/features/chat/ChatArea";
import MemberList from "@/features/members/MemberList";
import RoomDialog from "@/features/rooms/RoomDialog";
import { useCreateChannel, useRoom, useRoomMembers, useRooms } from "@/features/rooms/queries";
import { useVoiceSession } from "@/features/voice/useVoiceSession";

/**
 * Uygulama kabugu: ray + kanal paneli + icerik + uye listesi.
 * Secim ve ses oturumu durumu burada tutulur; ses baglantisinin kanal
 * degistirince kopmamasi icin tek bir ust seviyede yasamasi gerekir.
 */
export function AppShell() {
  const [activeSection, setActiveSection] = useState<string>("quickmatch");
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [membersVisible, setMembersVisible] = useState(true);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);

  const voice = useVoiceSession();

  const roomsQuery = useRooms();
  const rooms = roomsQuery.data ?? [];

  const isRoomSection = rooms.some((r) => r.id === activeSection);
  const roomQuery = useRoom(isRoomSection ? activeSection : null);
  const membersQuery = useRoomMembers(isRoomSection ? activeSection : null);
  const createChannel = useCreateChannel(activeSection);

  const activeRoom = roomQuery.data ?? null;

  // Odaya gecildiginde ilk metin kanalini ac.
  useEffect(() => {
    if (!activeRoom) {
      setActiveChannelId(null);
      return;
    }
    const stillExists = activeRoom.channels.some((c) => c.id === activeChannelId);
    if (!stillExists) {
      setActiveChannelId(activeRoom.channels.find((c) => c.type === "TEXT")?.id ?? null);
    }
  }, [activeRoom, activeChannelId]);

  const activeChannel =
    activeRoom?.channels.find((c) => c.id === activeChannelId) ?? null;

  const handleJoinVoice = useCallback(
    (channel: Channel) => {
      if (activeRoom) voice.connect(channel.id, channel.name, activeRoom.name);
    },
    [activeRoom, voice],
  );

  const handleCreateChannel = useCallback(() => {
    const name = window.prompt("Kanal adı:");
    if (!name?.trim()) return;
    createChannel.mutate({ name: name.trim(), type: "TEXT" });
  }, [createChannel]);

  return (
    <div className="bg-[#1a1a1a] h-screen w-full flex items-center justify-center p-4">
      <div className="h-full w-full max-w-[1600px] flex rounded-2xl overflow-hidden">
        <AppSidebar
          rooms={rooms}
          activeRoom={activeRoom}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          activeChannelId={activeChannelId}
          onSelectChannel={(channel) => setActiveChannelId(channel.id)}
          onJoinVoice={handleJoinVoice}
          onCreateChannel={handleCreateChannel}
          onOpenRoomDialog={() => setRoomDialogOpen(true)}
          voice={voice.session}
          onToggleMute={voice.toggleMute}
          onToggleDeafen={voice.toggleDeafen}
          onToggleScreenShare={voice.toggleScreenShare}
          onDisconnectVoice={voice.disconnect}
        />

        <ChatArea
          channel={activeChannel}
          roomName={activeRoom?.name ?? ""}
          membersVisible={membersVisible}
          onToggleMembers={() => setMembersVisible((v) => !v)}
          emptyHint={
            rooms.length === 0
              ? "Henüz bir odan yok. Soldaki + ile oda oluştur veya davet koduyla katıl."
              : "Soldaki raydan bir oda seçip metin kanalına tıkla."
          }
        />

        {membersVisible && isRoomSection && membersQuery.data && (
          <MemberList members={membersQuery.data} />
        )}
      </div>

      <RoomDialog
        open={roomDialogOpen}
        onClose={() => setRoomDialogOpen(false)}
        onDone={(roomId) => {
          setRoomDialogOpen(false);
          setActiveSection(roomId);
        }}
      />
    </div>
  );
}

export default AppShell;
