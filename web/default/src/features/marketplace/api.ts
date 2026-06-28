import { api } from '@/lib/api'
import type {
  GetMarketplaceAgentsResponse,
  GetMarketplaceSkillsResponse,
  MarketplaceAgent,
} from './types'

export async function getMarketplaceAgents(params?: {
  page?: number
  page_size?: number
  category?: string
  keyword?: string
}): Promise<GetMarketplaceAgentsResponse> {
  const res = await api.get('/api/marketplace/agents', { params })
  return res.data
}

export async function getMarketplaceAgent(id: string): Promise<{
  success?: boolean
  data?: MarketplaceAgent
  [key: string]: unknown
}> {
  const res = await api.get(`/api/marketplace/agents/${id}`)
  return res.data
}

export async function getMarketplaceSkills(params?: {
  page?: number
  page_size?: number
  category?: string
  keyword?: string
}): Promise<GetMarketplaceSkillsResponse> {
  const res = await api.get('/api/marketplace/skills', { params })
  return res.data
}
