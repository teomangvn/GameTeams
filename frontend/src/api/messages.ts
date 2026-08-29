import { request } from "@/api/client";

export interface MessageAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  /** Kanal mesajiysa dolu, DM ise null. */
  channelId: string | null;
  /** DM ise dolu, kanal mesajiysa null. */
  conversationId: string | null;
  author: MessageAuthor;
  content: string;
  replyToId: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
}

export interface MessagePage {
  messages: ChatMessage[];
  /** Bir sonraki (daha eski) sayfa icin imlec; null ise gecmis bitti. */
  nextCursor: string | null;
}

export type ChannelEvent =
  | { type: "MESSAGE_CREATED"; message: ChatMessage }
  | { type: "MESSAGE_EDITED"; message: ChatMessage }
  | { type: "MESSAGE_DELETED"; message: ChatMessage }
  | { type: "TYPING"; channelId: string; userId: string; displayName: string };

export const messagesApi = {
  history: (channelId: string, cursor?: string | null) =>
    request<MessagePage>(
      `/api/channels/${channelId}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),

  send: (channelId: string, content: string, replyToId?: string) =>
    request<ChatMessage>(`/api/channels/${channelId}/messages`, {
      method: "POST",
      body: { content, replyToId },
    }),

  edit: (messageId: string, content: string) =>
    request<ChatMessage>(`/api/messages/${messageId}`, { method: "PATCH", body: { content } }),

  remove: (messageId: string) =>
    request<ChatMessage>(`/api/messages/${messageId}`, { method: "DELETE" }),
};
