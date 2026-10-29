import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export const SESSION_KEY = ['session'] as const

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => api.getSession(),
    staleTime: 30_000,
  })
}
