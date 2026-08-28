import { api } from '@/lib/api'
import type {
  MarketplaceAgent,
  MarketplaceSkill,
  MarketplaceListResponse,
} from './types'

export async function getMarketplaceAgents(params: {
  search?: string
  category?: string
}): Promise<MarketplaceListResponse<MarketplaceAgent>> {
  const res = await api.get('/api/marketplace/agents', { params })
  return res.data
}

export async function getMarketplaceSkills(params: {
  search?: string
}): Promise<MarketplaceListResponse<MarketplaceSkill>> {
  const res = await api.get('/api/marketplace/skills', { params })
  return res.data
}
