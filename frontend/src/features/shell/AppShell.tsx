import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Conversation } from "@/api/friends";
import type { Channel } from "@/api/rooms";
import AppSidebar from "@/features/navigation/AppSidebar";
import ChatArea from "@/features/chat/ChatArea";
import MemberList from "@/features/members/MemberList";
import RoomDialog from "@/features/rooms/RoomDialog";
import { roomKeys, useCreateChannel, useRoom, useRoomMembers, useRooms } from "@/features/rooms/queries";
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useConversations,
  useFriends,
  useIncomingRequests,
  useOpenConversation,
  useSendFriendRequest,
} from "@/features/friends/queries";
import { useFriendEvents } from "@/features/friends/useFriendEvents";
import { useRoomEvents } from "@/features/rooms/useRoomEvents";
import MatchFoundDialog from "@/features/matchmaking/MatchFoundDialog";
import PromptDialog from "@/components/ui/prompt-dialog";
import CreateChannelDialog from "@/features/channels/CreateChannelDialog";
import { ApiError } from "@/api/client";
import { toast } from "@/stores/toastStore";
import { useMatchmaking } from "@/features/matchmaking/useMatchmaking";
import { useVoiceSession } from "@/features/voice/useVoiceSession";
import VoiceStage from "@/features/voice/VoiceStage";
import VoiceGrid from "@/features/voice/VoiceGrid";
import AppBackground from "@/features/shell/AppBackground";

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
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [prompt, setPrompt] = useState<"channel" | "friend" | null>(null);
  /**
   * Ses izgarasi mi sohbet mi gosterilecek. Ses baglantisi route'tan bagimsiz
   * yasiyor; kullanici sese bagliyken metin kanalina gecebilmeli, bu yuzden
   * "bagli olmak" ile "izgarayi goruyor olmak" ayri durumlar.
   */
  const [voiceViewOpen, setVoiceViewOpen] = useState(false);
  /** Ses izgarasinin yanindaki kanal sohbeti acik mi. */
  const [voiceChatOpen, setVoiceChatOpen] = useState(false);
  /** Baglanilan ses kanalinin kendisi; sohbeti bu kanala yazilir. */
  const [voiceChannel, setVoiceChannel] = useState<Channel | null>(null);

  const voice = useVoiceSession();
  const queryClient = useQueryClient();

  const roomsQuery = useRooms();
  const rooms = roomsQuery.data ?? [];

  const isRoomSection = rooms.some((r) => r.id === activeSection);
  const roomQuery = useRoom(isRoomSection ? activeSection : null);
  const membersQuery = useRoomMembers(isRoomSection ? activeSection : null);
  useRoomEvents(isRoomSection ? activeSection : null);
  const createChannel = useCreateChannel(activeSection);

  const friendsQuery = useFriends();
  const incomingQuery = useIncomingRequests();
  const conversationsQuery = useConversations();
  const openConversation = useOpenConversation();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const sendFriendRequest = useSendFriendRequest();

  // Arkadaslik ve DM olaylari cache'i tazeler.
  useFriendEvents(true);

  const matchmaking = useMatchmaking(true);

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
      if (!activeRoom) return;
      void voice.connect(channel.id, channel.name, activeRoom.name);
      setVoiceChannel(channel);
      setVoiceViewOpen(true);
    },
    [activeRoom, voice],
  );

  const handleOpenDmWith = useCallback(
    async (userId: string) => {
      const conversation = await openConversation.mutateAsync(userId);
      setActiveSection("dms");
      setActiveConversation(conversation);
    },
    [openConversation],
  );

  const handleAddFriend = useCallback(
    (username: string) => {
      sendFriendRequest.mutate(username, {
        onSuccess: (friend) => {
          toast.success(`${friend.displayName} kişisine istek gönderildi.`);
          setPrompt(null);
        },
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "İstek gönderilemedi."),
      });
    },
    [sendFriendRequest],
  );

  const handleCreateChannel = useCallback(
    (name: string, type: Channel["type"]) => {
      createChannel.mutate(
        { name, type },
        {
          onSuccess: (channel) => {
            toast.success(`${channel.type === "VOICE" ? "🔊" : "#"}${channel.name} oluşturuldu.`);
            setPrompt(null);
            // Ses kanali olusturmak otomatik baglanmasin; kullanici kendi girsin.
            if (channel.type === "TEXT") {
              setActiveChannelId(channel.id);
              setVoiceViewOpen(false);
            }
          },
          onError: (error) =>
            toast.error(error instanceof ApiError ? error.message : "Kanal oluşturulamadı."),
        },
      );
    },
    [createChannel],
  );

  return (
    <div className="relative bg-[#1a1a1a] h-screen w-full flex items-center justify-center p-4">
      <AppBackground />
      <div className="relative h-full w-full max-w-[1600px] flex rounded-2xl overflow-hidden">
        <AppSidebar
          rooms={rooms}
          activeRoom={activeRoom}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          activeChannelId={activeChannelId}
          onSelectChannel={(channel) => {
            setActiveChannelId(channel.id);
            setVoiceViewOpen(false);
          }}
          onJoinVoice={handleJoinVoice}
          onCreateChannel={() => setPrompt("channel")}
          onOpenRoomDialog={() => setRoomDialogOpen(true)}
          friends={friendsQuery.data ?? []}
          incomingRequests={incomingQuery.data ?? []}
          conversations={conversationsQuery.data ?? []}
          activeConversationId={activeConversation?.id ?? null}
          onSelectConversation={(conversation) => {
            setActiveConversation(conversation);
            setVoiceViewOpen(false);
          }}
          onOpenDmWith={(userId) => void handleOpenDmWith(userId)}
          onAcceptFriendRequest={(id) => acceptRequest.mutate(id)}
          onDeclineFriendRequest={(id) => declineRequest.mutate(id)}
          onAddFriend={() => setPrompt("friend")}
          games={matchmaking.games}
          ticket={matchmaking.ticket}
          queueElapsedSeconds={matchmaking.elapsedSeconds}
          onJoinQueue={(gameId, partySize) => void matchmaking.joinQueue(gameId, partySize)}
          onLeaveQueue={() => void matchmaking.leaveQueue()}
          voice={voice.session}
          onToggleMute={voice.toggleMute}
          onToggleDeafen={voice.toggleDeafen}
          onToggleScreenShare={voice.toggleScreenShare}
          onToggleCamera={voice.toggleCamera}
          onDisconnectVoice={() => {
            voice.disconnect();
            setVoiceViewOpen(false);
            setVoiceChannel(null);
          }}
        />

        {voiceViewOpen && voice.session ? (
          <>
            <VoiceGrid
              session={voice.session}
              chatOpen={voiceChatOpen}
              onToggleChat={() => setVoiceChatOpen((value) => !value)}
            />
            {voiceChatOpen && voiceChannel && (
              <div className="w-96 shrink-0 border-l border-neutral-800 flex">
                <ChatArea
                  channel={voiceChannel}
                  conversation={null}
                  roomName={voice.session.roomName}
                  membersVisible={false}
                  onToggleMembers={() => undefined}
                />
              </div>
            )}
          </>
        ) : (
        <ChatArea
          channel={activeChannel}
          conversation={activeConversation}
          roomName={activeRoom?.name ?? ""}
          membersVisible={membersVisible}
          onToggleMembers={() => setMembersVisible((v) => !v)}
          emptyHint={
            rooms.length === 0
              ? "Henüz bir odan yok. Soldaki + ile oda oluştur veya davet koduyla katıl."
              : "Soldaki raydan bir oda seçip metin kanalına tıkla."
          }
        />
        )}

        {!voiceViewOpen && membersVisible && isRoomSection && !activeConversation && membersQuery.data && (
          <MemberList
            members={membersQuery.data}
            onAddFriend={handleAddFriend}
            onOpenDm={(userId) => void handleOpenDmWith(userId)}
          />
        )}
      </div>

      {/* Uzak ses/ekran akislari; gorunur bir yeri yok ama olmadan ses duyulmaz. */}
      <VoiceStage session={voice.session} />

      <CreateChannelDialog
        open={prompt === "channel"}
        loading={createChannel.isPending}
        onSubmit={handleCreateChannel}
        onClose={() => setPrompt(null)}
      />

      <PromptDialog
        open={prompt === "friend"}
        title="Arkadaş ekle"
        description="Kullanıcı adıyla istek gönder. E-posta paylaşmana gerek yok."
        label="Kullanıcı adı"
        placeholder="oyuncu_42"
        submitLabel="İstek gönder"
        loading={sendFriendRequest.isPending}
        onSubmit={handleAddFriend}
        onClose={() => setPrompt(null)}
      />

      <MatchFoundDialog
        match={matchmaking.match}
        onDismiss={matchmaking.dismissMatch}
        onJoin={(match) => {
          // Yeni gecici oda listede henuz yok; once tazele sonra gec.
          void queryClient.invalidateQueries({ queryKey: roomKeys.all });
          setActiveSection(match.roomId);
          setActiveChannelId(match.textChannelId);
          matchmaking.dismissMatch();
        }}
      />

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
