import { getUnreadCount } from "@/services/supportApi"
import { useQuery } from "@tanstack/react-query"

/**
 * Hook to get unread support messages count
 * @param isChatPage - Whether the current page is a chat page
 * @returns Number of unread support messages
 */
export function useSupportUnreadCount(isChatPage: boolean): number {
  const { data } = useQuery({
    queryKey: ["support-unread-count"],
    queryFn: async () => {
      const response = await getUnreadCount()
      return response?.data?.unreadCount ?? 0
    },
    staleTime: 15000,
    refetchInterval: isChatPage ? 30000 : 15000,
    refetchIntervalInBackground: true,
  })

  return data ?? 0
}
