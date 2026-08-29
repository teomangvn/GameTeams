/**
 * Geçici mock veri. Şekli backend'in döneceği DTO'larla aynı tutuldu; API
 * bağlandığında bu dosya silinip yerine TanStack Query sorguları gelecek.
 */

export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  status: PresenceStatus;
  playing?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  topic?: string;
  unread?: number;
  /** Ses kanalındaki kullanıcı id'leri. */
  participantIds?: string[];
  userLimit?: number;
  isPrivate?: boolean;
}

export interface Room {
  id: string;
  name: string;
  /** Ray ikonunda gösterilen kısaltma. */
  initials: string;
  memberIds: string[];
  channels: Channel[];
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Game {
  id: string;
  name: string;
  queued: number;
  teamSizes: number[];
}

/** Unsplash portre görselleri — kare kırpma, yüz merkezli. */
const avatar = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?w=96&h=96&fit=crop&crop=faces&auto=format&q=80`;

export const CURRENT_USER_ID = "u-teoman";

export const USERS: Record<string, User> = {
  "u-teoman": {
    id: "u-teoman",
    username: "teoman",
    displayName: "Teoman",
    avatarUrl: avatar("photo-1535713875002-d1d0cf377fde"),
    status: "online",
    playing: "Valorant",
  },
  "u-kaan": {
    id: "u-kaan",
    username: "kaan",
    displayName: "Kaan",
    avatarUrl: avatar("photo-1500648767791-00dcc994a43e"),
    status: "online",
    playing: "Valorant",
  },
  "u-elif": {
    id: "u-elif",
    username: "elif",
    displayName: "Elif",
    avatarUrl: avatar("photo-1494790108377-be9c29b29330"),
    status: "online",
    playing: "League of Legends",
  },
  "u-mert": {
    id: "u-mert",
    username: "mert",
    displayName: "Mert",
    avatarUrl: avatar("photo-1506794778202-cad84cf45f1d"),
    status: "idle",
  },
  "u-burak": {
    id: "u-burak",
    username: "burak",
    displayName: "Burak",
    avatarUrl: avatar("photo-1507003211169-0a1dd7228f2d"),
    status: "dnd",
    playing: "CS2",
  },
  "u-zeynep": {
    id: "u-zeynep",
    username: "zeynep",
    displayName: "Zeynep",
    avatarUrl: avatar("photo-1438761681033-6461ffad8d80"),
    status: "offline",
  },
  "u-selin": {
    id: "u-selin",
    username: "selin",
    displayName: "Selin",
    avatarUrl: avatar("photo-1517841905240-472988babdf9"),
    status: "online",
  },
};

export const getUser = (id: string): User => USERS[id];

export const ROOMS: Room[] = [
  {
    id: "room-valorant",
    name: "Valorant Türkiye",
    initials: "VT",
    memberIds: ["u-teoman", "u-kaan", "u-elif", "u-burak", "u-selin", "u-zeynep"],
    channels: [
      { id: "ch-genel", name: "genel", type: "TEXT", topic: "Genel sohbet", unread: 12 },
      { id: "ch-strateji", name: "strateji", type: "TEXT", topic: "Harita ve taktik" },
      { id: "ch-clip", name: "clip-paylaşımı", type: "TEXT", unread: 3 },
      {
        id: "ch-ses-genel",
        name: "Genel Sohbet",
        type: "VOICE",
        participantIds: ["u-teoman", "u-kaan", "u-elif"],
        userLimit: 6,
      },
      {
        id: "ch-ses-takim1",
        name: "Takım 1",
        type: "VOICE",
        participantIds: ["u-burak"],
        userLimit: 6,
      },
      { id: "ch-ses-afk", name: "AFK", type: "VOICE", participantIds: [], userLimit: 6 },
    ],
  },
  {
    id: "room-lol",
    name: "LoL Ranked Grubu",
    initials: "LR",
    memberIds: ["u-teoman", "u-elif", "u-mert"],
    channels: [
      { id: "ch-lol-genel", name: "genel", type: "TEXT", unread: 5 },
      { id: "ch-lol-duo", name: "duo-arayanlar", type: "TEXT" },
      { id: "ch-lol-yonetim", name: "yönetim", type: "TEXT", isPrivate: true },
      {
        id: "ch-lol-ses",
        name: "Ranked Takım",
        type: "VOICE",
        participantIds: ["u-teoman", "u-mert"],
        userLimit: 5,
      },
    ],
  },
  {
    id: "room-cs2",
    name: "CS2 Scrim",
    initials: "CS",
    memberIds: ["u-teoman", "u-burak", "u-kaan"],
    channels: [
      { id: "ch-cs-genel", name: "genel", type: "TEXT" },
      { id: "ch-cs-scrim", name: "scrim-ayarla", type: "TEXT", unread: 1 },
      { id: "ch-cs-ses", name: "Scrim Sesi", type: "VOICE", participantIds: [], userLimit: 6 },
    ],
  },
];

export const FRIEND_IDS = ["u-kaan", "u-elif", "u-mert", "u-burak", "u-zeynep"];

export const DM_CONVERSATIONS = [
  { id: "dm-kaan", userId: "u-kaan", unread: 2 },
  { id: "dm-elif", userId: "u-elif" },
  { id: "dm-mert", userId: "u-mert", unread: 7 },
];

export const GAMES: Game[] = [
  { id: "valorant", name: "Valorant", queued: 128, teamSizes: [2, 3, 5] },
  { id: "lol", name: "League of Legends", queued: 94, teamSizes: [2, 3, 5] },
  { id: "cs2", name: "CS2", queued: 61, teamSizes: [2, 5] },
  { id: "dota2", name: "Dota 2", queued: 23, teamSizes: [2, 5] },
  { id: "rocket-league", name: "Rocket League", queued: 17, teamSizes: [2, 3] },
];

export const MESSAGES: Message[] = [
  {
    id: "m1",
    channelId: "ch-genel",
    authorId: "u-kaan",
    content: "Akşam scrim var mı? 5 kişi toplayabilirsek Ascent çalışalım.",
    createdAt: "2026-08-28T18:12:00+03:00",
  },
  {
    id: "m2",
    channelId: "ch-genel",
    authorId: "u-elif",
    content: "Ben varım ama 21:00'den sonra olur.",
    createdAt: "2026-08-28T18:14:00+03:00",
  },
  {
    id: "m3",
    channelId: "ch-genel",
    authorId: "u-teoman",
    content: "21:00 bana da uyar. Quick Match'ten iki kişi daha bulalım.",
    createdAt: "2026-08-28T18:15:00+03:00",
  },
  {
    id: "m4",
    channelId: "ch-genel",
    authorId: "u-burak",
    content: "Sentinel oynayan biri lazım, ben duelist alırım.",
    createdAt: "2026-08-28T18:17:00+03:00",
  },
  {
    id: "m5",
    channelId: "ch-genel",
    authorId: "u-selin",
    content: "Sentinel bende. Cypher ya da Killjoy fark etmez.",
    createdAt: "2026-08-28T18:19:00+03:00",
  },
  {
    id: "m6",
    channelId: "ch-genel",
    authorId: "u-kaan",
    content: "Süper, o zaman ses kanalına geçelim de son kişiyi kuyruktan bulalım.",
    createdAt: "2026-08-28T18:21:00+03:00",
  },
];

export const getChannelMessages = (channelId: string) =>
  MESSAGES.filter((m) => m.channelId === channelId);
