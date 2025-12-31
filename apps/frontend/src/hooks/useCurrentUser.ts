import { logger } from "@/lib/logger"
import { storage } from "@/lib/storage"
import { api } from '@/services/api'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        // First check localStorage for cached user data
        const cachedUser = storage.getUser()
        
        // Se non c'è un utente nel localStorage, non fare chiamate API
        if (!cachedUser) {
          throw new Error('No user data available')
        }
        
        const response = await api.get('/auth/me')
        if (response.data?.user) {
          // Cache user data in localStorage
          storage.setUser(response.data.user)
          return response.data.user
        }
        throw new Error('User not found')
      } catch (error) {
        // Clear invalid cached data on authentication errors
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 404)) {
          logger.warn('Authentication failed, clearing cached data')
          storage.clearUser()
          storage.clearWorkspace()
        }
        
        // Se siamo nella pagina settings, non propagare errori di autenticazione
        // per evitare redirect indesiderati
        if (window.location.pathname.includes('/settings')) {
          logger.warn('Auth error in settings page, using cached data if available')
          
          // Cerca di recuperare i dati utente dal localStorage
          const cachedUserFallback = storage.getUser()
          if (cachedUserFallback) {
            return cachedUserFallback
          }
        }
        
        throw error
      }
    },
    // Increase staleTime to 5 minutes to reduce unnecessary API calls
    staleTime: 5 * 60 * 1000,
    // Disable refetching on window focus to prevent excessive API calls
    refetchOnWindowFocus: false,
    // Disable automatic refetching when the query is inactive
    refetchOnMount: false,
    // Cache successful responses for 10 minutes (using gcTime instead of deprecated cacheTime)
    gcTime: 10 * 60 * 1000,
    // Disable the query completely if no user data is available
    enabled: !!storage.getUser(),
    retry: (failureCount, error: any) => {
      // Non riprovare in caso di errori 401 o 404 (non autorizzato o utente non trovato)
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 404)) {
        return false
      }
      // Riprova al massimo 1 volta per altri errori
      return failureCount < 1
    }
  })
} 
