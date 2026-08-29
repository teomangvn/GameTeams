import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dmApi, friendsApi } from "@/api/friends";

export const friendKeys = {
  friends: ["friends"] as const,
  incoming: ["friends", "incoming"] as const,
  outgoing: ["friends", "outgoing"] as const,
  conversations: ["conversations"] as const,
};

export function useFriends() {
  return useQuery({ queryKey: friendKeys.friends, queryFn: friendsApi.list });
}

export function useIncomingRequests() {
  return useQuery({ queryKey: friendKeys.incoming, queryFn: friendsApi.incoming });
}

export function useConversations() {
  return useQuery({ queryKey: friendKeys.conversations, queryFn: dmApi.list });
}

/** Arkadas listesi ve istekler ayni islemlerden etkilenir; birlikte tazelenir. */
function useFriendMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: friendKeys.friends });
      void queryClient.invalidateQueries({ queryKey: friendKeys.incoming });
      void queryClient.invalidateQueries({ queryKey: friendKeys.outgoing });
    },
  });
}

export const useSendFriendRequest = () => useFriendMutation(friendsApi.sendRequest);
export const useAcceptFriendRequest = () => useFriendMutation(friendsApi.accept);
export const useDeclineFriendRequest = () => useFriendMutation(friendsApi.decline);
export const useRemoveFriend = () => useFriendMutation(friendsApi.remove);

export function useOpenConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dmApi.open,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendKeys.conversations }),
  });
}
