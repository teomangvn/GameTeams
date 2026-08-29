import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { FriendEvent } from "@/api/friends";
import type { ChatMessage } from "@/api/messages";
import { subscribe } from "@/lib/stompClient";
import { friendKeys } from "@/features/friends/queries";

/**
 * Arkadaslik ve DM olaylarini dinleyip ilgili sorgu cache'lerini tazeler.
 * Uygulama kokunde bir kez calisir.
 */
export function useFriendEvents(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const offFriends = subscribe<FriendEvent>("/user/queue/friends", () => {
      void queryClient.invalidateQueries({ queryKey: friendKeys.friends });
      void queryClient.invalidateQueries({ queryKey: friendKeys.incoming });
      void queryClient.invalidateQueries({ queryKey: friendKeys.outgoing });
    });

    const offDm = subscribe<ChatMessage>("/user/queue/dm", () => {
      // Sohbet listesindeki son mesaj onizlemesi guncellensin.
      void queryClient.invalidateQueries({ queryKey: friendKeys.conversations });
    });

    return () => {
      offFriends();
      offDm();
    };
  }, [enabled, queryClient]);
}
