import { useEffect, useRef, useState } from "react";
import { Hashtag, Chat, SendAlt, UserMultiple } from "@carbon/icons-react";

import EmojiPicker from "@/features/chat/EmojiPicker";

import type { Conversation } from "@/api/friends";
import type { Channel } from "@/api/rooms";
import type { ChatMessage } from "@/api/messages";
import { useChat, type ChatTarget } from "@/features/chat/useChat";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

export interface ChatAreaProps {
  channel: Channel | null;
  /** DM goruntuleniyorsa dolu; kanal ile ayni anda dolu olmaz. */
  conversation?: Conversation | null;
  roomName: string;
  membersVisible: boolean;
  onToggleMembers: () => void;
  /** Hicbir hedef secili degilken gosterilecek yonlendirme. */
  emptyHint?: string;
}

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});

function MessageRow({
  message,
  isSelf,
  /** Ayni kisinin arka arkaya mesajlarinda avatar/isim tekrar edilmez. */
  grouped,
}: {
  message: ChatMessage;
  isSelf: boolean;
  grouped: boolean;
}) {
  const { author } = message;
  const initials = author.displayName.slice(0, 2).toUpperCase();

  return (
    <div className={cn("flex gap-3 px-6 hover:bg-neutral-900/40", grouped ? "py-0.5" : "pt-4 pb-0.5")}>
      <div className="w-10 shrink-0 flex justify-center">
        {grouped ? (
          <span className="font-lexend text-[10px] text-neutral-600">
            {timeFormatter.format(new Date(message.createdAt))}
          </span>
        ) : author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt={author.displayName}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <span className="size-10 rounded-full bg-neutral-800 flex items-center justify-center font-lexend text-[13px] text-neutral-300">
            {initials}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "font-lexend font-semibold text-[14px]",
                isSelf ? "text-emerald-400" : "text-neutral-50",
              )}
            >
              {author.displayName}
            </span>
            <span className="font-lexend text-[11px] text-neutral-500">
              {timeFormatter.format(new Date(message.createdAt))}
            </span>
          </div>
        )}
        {message.deleted ? (
          <p className="font-lexend text-[14px] text-neutral-600 italic">Bu mesaj silindi.</p>
        ) : (
          <p className="font-lexend text-[14px] text-neutral-200 leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
            {message.editedAt && (
              <span className="ml-1.5 font-lexend text-[11px] text-neutral-600">(düzenlendi)</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export function ChatArea({
  channel,
  conversation,
  roomName,
  membersVisible,
  onToggleMembers,
  emptyHint,
}: ChatAreaProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // DM ile kanal ayni anda gosterilmez; DM onceliklidir.
  const target: ChatTarget = conversation
    ? { kind: "dm", id: conversation.id }
    : channel
      ? { kind: "channel", id: channel.id }
      : null;

  const isDm = Boolean(conversation);
  const title = conversation?.otherDisplayName ?? channel?.name ?? "";
  const topic = conversation ? null : channel?.topic;

  const chat = useChat(target);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Emojiyi imlecin bulundugu yere ekler, sonuna degil. */
  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const at = input?.selectionStart ?? draft.length;

    setDraft((current) => current.slice(0, at) + emoji + current.slice(at));

    // Imleci eklenen emojinin arkasina tasi ve odagi geri ver.
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const next = at + emoji.length;
      input.setSelectionRange(next, next);
    });
  };

  const { messages, loading, hasMore, loadingMore, typingUsers, loadOlder, send, notifyTyping } =
    chat;

  const lastMessageId = messages.at(-1)?.id;

  // Yeni mesajda dibe kaydir. Kullanici yukari kaydirip gecmis okuyorsa
  // yerinden ziplatmamak icin yalnizca dibe yakinken calisir.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 200) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [lastMessageId]);

  useEffect(() => setDraft(""), [target?.id]);

  if (!target) {
    return (
      <div className="flex-1 min-w-0 bg-neutral-950 flex items-center justify-center p-8">
        <p className="font-lexend text-[14px] text-neutral-500 text-center max-w-sm">
          {emptyHint ?? "Soldaki raydan bir oda seçip metin kanalına tıkla."}
        </p>
      </div>
    );
  }

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;
    send(content);
    setDraft("");
  };

  return (
    <div className="flex-1 min-w-0 bg-neutral-950 flex flex-col">
      <header className="h-14 shrink-0 border-b border-neutral-800 flex items-center gap-2 px-6">
        {isDm ? (
          <Chat size={18} className="text-neutral-400 shrink-0" />
        ) : (
          <Hashtag size={18} className="text-neutral-400 shrink-0" />
        )}
        <span className="font-lexend font-semibold text-[15px] text-neutral-50 truncate">
          {title}
        </span>
        {topic && (
          <>
            <span className="w-px h-5 bg-neutral-800 mx-2 shrink-0" />
            <span className="font-lexend text-[13px] text-neutral-400 truncate">
              {topic}
            </span>
          </>
        )}
        <span className="ml-auto flex items-center gap-1 shrink-0">
          {!isDm && (
          <button
            type="button"
            onClick={onToggleMembers}
            aria-label="Üye listesi"
            aria-pressed={membersVisible}
            className={cn(
              "size-8 rounded-md flex items-center justify-center transition-colors",
              membersVisible
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
            )}
          >
            <UserMultiple size={16} />
          </button>
          )}
        </span>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-4">
        {hasMore ? (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingMore}
              className="font-lexend text-[13px] text-neutral-400 hover:text-neutral-200 px-3 py-1.5 rounded-md hover:bg-neutral-900 disabled:opacity-50"
            >
              {loadingMore ? "Yükleniyor..." : "Daha eski mesajları yükle"}
            </button>
          </div>
        ) : (
          !loading && (
            <div className="px-6 pb-4">
              <h2 className="font-lexend font-semibold text-[20px] text-neutral-50">
                {isDm ? title : `#${title}`}
              </h2>
              <p className="font-lexend text-[13px] text-neutral-500 mt-1">
                {isDm
                  ? `${title} ile özel sohbetinin başlangıcı.`
                  : `${roomName} odasındaki bu kanalın başlangıcı.`}
              </p>
            </div>
          )
        )}

        {loading ? (
          <p className="px-6 font-lexend text-[13px] text-neutral-500">Mesajlar yükleniyor...</p>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1];
            const grouped =
              previous !== undefined &&
              previous.author.id === message.author.id &&
              new Date(message.createdAt).getTime() -
                new Date(previous.createdAt).getTime() <
                5 * 60 * 1000;

            return (
              <MessageRow
                key={message.id}
                message={message}
                isSelf={message.author.id === currentUserId}
                grouped={grouped}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-6 pb-6 pt-2">
        <div className="h-5 px-1">
          {typingUsers.length > 0 && (
            <span className="font-lexend text-[12px] text-neutral-500">
              {typingUsers.join(", ")} yazıyor...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 focus-within:border-neutral-700">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              notifyTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isDm ? `${title} kişisine mesaj gönder` : `#${title} kanalına mesaj gönder`}
            className="flex-1 min-w-0 bg-transparent border-none outline-none font-lexend text-[14px] text-neutral-50 placeholder:text-neutral-500"
          />
          <EmojiPicker onPick={insertEmoji} />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim()}
            aria-label="Gönder"
            className="size-8 rounded-md flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent shrink-0"
          >
            <SendAlt size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatArea;
