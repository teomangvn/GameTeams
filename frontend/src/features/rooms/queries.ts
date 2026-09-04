import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { roomsApi, type ChannelType } from "@/api/rooms";

/** Sorgu anahtarlari tek yerde: cache gecersizlestirmesi tutarli kalsin. */
export const roomKeys = {
  all: ["rooms"] as const,
  detail: (roomId: string) => ["rooms", roomId] as const,
  members: (roomId: string) => ["rooms", roomId, "members"] as const,
};

export function useRooms() {
  return useQuery({ queryKey: roomKeys.all, queryFn: roomsApi.list });
}

export function useRoom(roomId: string | null) {
  return useQuery({
    queryKey: roomKeys.detail(roomId ?? ""),
    queryFn: () => roomsApi.get(roomId!),
    enabled: Boolean(roomId),
  });
}

export function useRoomMembers(roomId: string | null) {
  return useQuery({
    queryKey: roomKeys.members(roomId ?? ""),
    queryFn: () => roomsApi.members(roomId!),
    enabled: Boolean(roomId),
    // Cevrimici durumu artik /topic/room.{id} uzerinden aninda geliyor
    // (useRoomEvents), periyodik yoklamaya gerek yok. Sekmeye donusta yine
    // tazelensin: soket kapaliyken kacirilan degisiklikler telafi edilir.
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useJoinRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomsApi.join,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useCreateChannel(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; type: ChannelType; topic?: string; userLimit?: number }) =>
      roomsApi.createChannel(roomId, body),
    // Kanal listesi oda detayinin icinde geldigi icin detay da tazelenir.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomId) }),
  });
}

export function useLeaveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomsApi.leave,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}
