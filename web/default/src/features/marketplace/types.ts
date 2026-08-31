export interface MarketplaceAgent {
  id: string
  name: string
  description?: string
  category?: string
  tags?: string[]
  icon_url?: string
  version?: string
  author?: string
  capabilities?: string[]
  endpoint?: string
  status?: 'active' | 'inactive' | string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface MarketplaceSkill {
  id: string
  name: string
  description?: string
  category?: string
  tags?: string[]
  icon_url?: string
  version?: string
  author?: string
  input_schema?: Record<string, unknown>
  output_schema?: Record<string, unknown>
  [key: string]: unknown
}

export interface GetMarketplaceAgentsResponse {
  success?: boolean
  data?: MarketplaceAgent[] | { agents?: MarketplaceAgent[]; items?: MarketplaceAgent[] }
  agents?: MarketplaceAgent[]
  items?: MarketplaceAgent[]
  total?: number
  [key: string]: unknown
}

export interface GetMarketplaceSkillsResponse {
  success?: boolean
  data?: MarketplaceSkill[] | { skills?: MarketplaceSkill[]; items?: MarketplaceSkill[] }
  skills?: MarketplaceSkill[]
  items?: MarketplaceSkill[]
  total?: number
  [key: string]: unknown
}
