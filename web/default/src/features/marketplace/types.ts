export interface MarketplaceAgent {
  id: string
  slug: string
  display_name: string
  name: string
  description: string
  category: string
  tags: string[]
  skills: MarketplaceSkill[]
  version: string | null
  streaming: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface MarketplaceSkill {
  id: string
  name: string
  description: string
  version: string | null
  tags: string[]
}

export interface MarketplaceListResponse<T> {
  success: boolean
  message?: string
  data?: {
    items: T[]
    total: number
  }
}

export interface MarketplaceDetailResponse<T> {
  success: boolean
  message?: string
  data?: T
}
