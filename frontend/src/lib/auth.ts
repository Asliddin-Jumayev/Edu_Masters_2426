import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Me } from '@/api/types'

interface AuthState {
  accessToken?: string
  refreshToken?: string
  me?: Me
  setTokens: (a: string, r: string) => void
  setMe: (m: Me) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setMe: (me) => set({ me }),
      logout: () => set({ accessToken: undefined, refreshToken: undefined, me: undefined }),
    }),
    { name: 'em-auth' },
  ),
)

/** Tanlangan filial (yuqori paneldagi almashtirgich). null = barcha ruxsat etilgan filiallar. */
interface BranchState { branchId: number | null; setBranch: (id: number | null) => void }
export const useBranch = create<BranchState>()(
  persist((set) => ({ branchId: null, setBranch: (branchId) => set({ branchId }) }), { name: 'em-branch' }),
)
