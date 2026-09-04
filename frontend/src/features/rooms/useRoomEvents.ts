import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RoomMember } from "@/api/rooms";
import { roomKeys } from "@/features/rooms/queries";
import { subscribe } from "@/lib/stompClient";

export interface RoomEvent {
  type: "PRESENCE_UPDATE";
  userId: string;
  online: boolean;
}

/**
 * Aktif odanin olaylarini dinler ve uye listesini gunceller.
 *
 * Cevrimici gostergesi eskiden periyodik yoklamayla tazeleniyordu; sunucu artik
 * degisikligi yayinladigi icin cache dogrudan guncelleniyor. Yeniden fetch
 * yerine setQueryData: tek bir bayrak icin butun listeyi cekmeye gerek yok.
 */
export function useRoomEvents(roomId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) return;

    return subscribe<RoomEvent>(`/topic/room.${roomId}`, (event) => {
      if (event.type !== "PRESENCE_UPDATE") return;

      queryClient.setQueryData<RoomMember[]>(roomKeys.members(roomId), (current) =>
        current?.map((member) =>
          member.userId === event.userId ? { ...member, online: event.online } : member,
        ),
      );
    });
  }, [roomId, queryClient]);
}
