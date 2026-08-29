import { useEffect, useMemo, useRef, useState } from "react";
import { Hashtag, SendAlt, Attachment, FaceSatisfied, Pin, UserMultiple } from "@carbon/icons-react";

import { cn } from "@/lib/utils";
import type { Channel } from "@/api/rooms";
import {
  CURRENT_USER_ID,
  getChannelMessages,
  getUser,
  type Message,
} from "@/lib/mock-data";

/**
 * Metin kanalı görünümü: başlık, mesaj akışı ve composer.
 * Phase 3'te mesajlar STOMP üzerinden gelecek; şu an mock veriden besleniyor.
 */

export interface ChatAreaProps {
  channel: Channel | null;
  roomName: string;
  membersVisible: boolean;
  onToggleMembers: () => void;
  /** Kanal secili degilken gosterilecek yonlendirme. */
  emptyHint?: string;
}

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});

function MessageRow({
  message,
  /** Aynı kişinin arka arkaya mesajlarında avatar/isim tekrar edilmez. */
  grouped,
}: {
  message: Message;
  grouped: boolean;
}) {
  const author = getUser(message.authorId);
  const isSelf = author.id === CURRENT_USER_ID;

  return (
    <div className={cn("flex gap-3 px-6 hover:bg-neutral-900/40", grouped ? "py-0.5" : "pt-4 pb-0.5")}>
      <div className="w-10 shrink-0 flex justify-center">
        {grouped ? (
          <span className="font-lexend text-[10px] text-neutral-600 opacity-0 group-hover:opacity-100">
            {timeFormatter.format(new Date(message.createdAt))}
          </span>
        ) : (
          <img
            src={author.avatarUrl}
            alt={author.displayName}
            className="size-10 rounded-full object-cover"
          />
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
        <p className="font-lexend text-[14px] text-neutral-200 leading-relaxed break-words">
          {message.content}
        </p>
      </div>
    </div>
  );
}

export function ChatArea({
  channel,
  roomName,
  membersVisible,
  onToggleMembers,
  emptyHint,
}: ChatAreaProps) {
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => (channel ? [...getChannelMessages(channel.id), ...sent] : []),
    [channel, sent],
  );

  // Kanal değişince yerel taslak ve gönderilenler sıfırlanır.
  useEffect(() => {
    setSent([]);
    setDraft("");
  }, [channel?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (!channel) {
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
    setSent((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        channelId: channel.id,
        authorId: CURRENT_USER_ID,
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");
  };

  return (
    <div className="flex-1 min-w-0 bg-neutral-950 flex flex-col">
      <header className="h-14 shrink-0 border-b border-neutral-800 flex items-center gap-2 px-6">
        <Hashtag size={18} className="text-neutral-400 shrink-0" />
        <span className="font-lexend font-semibold text-[15px] text-neutral-50 truncate">
          {channel.name}
        </span>
        {channel.topic && (
          <>
            <span className="w-px h-5 bg-neutral-800 mx-2 shrink-0" />
            <span className="font-lexend text-[13px] text-neutral-400 truncate">
              {channel.topic}
            </span>
          </>
        )}
        <span className="ml-auto flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Sabitlenmiş mesajlar"
            className="size-8 rounded-md flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <Pin size={16} />
          </button>
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
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto py-4">
        <div className="px-6 pb-4">
          <h2 className="font-lexend font-semibold text-[20px] text-neutral-50">
            #{channel.name}
          </h2>
          <p className="font-lexend text-[13px] text-neutral-500 mt-1">
            {roomName} odasındaki bu kanalın başlangıcı.
          </p>
        </div>

        <div className="group">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const grouped =
              previous !== undefined &&
              previous.authorId === message.authorId &&
              new Date(message.createdAt).getTime() -
                new Date(previous.createdAt).getTime() <
                5 * 60 * 1000;

            return <MessageRow key={message.id} message={message} grouped={grouped} />;
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-6 pb-6 pt-2">
        <div className="flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 focus-within:border-neutral-700">
          <button
            type="button"
            aria-label="Dosya ekle"
            className="size-8 rounded-md flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 shrink-0"
          >
            <Attachment size={16} />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`#${channel.name} kanalına mesaj gönder`}
            className="flex-1 min-w-0 bg-transparent border-none outline-none font-lexend text-[14px] text-neutral-50 placeholder:text-neutral-500"
          />
          <button
            type="button"
            aria-label="Emoji"
            className="size-8 rounded-md flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 shrink-0"
          >
            <FaceSatisfied size={16} />
          </button>
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
