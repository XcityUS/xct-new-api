import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Bot, Wrench, RefreshCw } from 'lucide-react'
import { SectionPageLayout } from '@/components/layout'
import { getMarketplaceAgents, getMarketplaceSkills } from './api'
import type { MarketplaceAgent, MarketplaceSkill } from './types'

function normalizeAgents(data: unknown): MarketplaceAgent[] {
  if (!data) return []
  if (Array.isArray(data)) return data as MarketplaceAgent[]
  const d = data as Record<string, unknown>
  if (Array.isArray(d.agents)) return d.agents as MarketplaceAgent[]
  if (Array.isArray(d.items)) return d.items as MarketplaceAgent[]
  if (d.data) return normalizeAgents(d.data)
  return []
}

function normalizeSkills(data: unknown): MarketplaceSkill[] {
  if (!data) return []
  if (Array.isArray(data)) return data as MarketplaceSkill[]
  const d = data as Record<string, unknown>
  if (Array.isArray(d.skills)) return d.skills as MarketplaceSkill[]
  if (Array.isArray(d.items)) return d.items as MarketplaceSkill[]
  if (d.data) return normalizeSkills(d.data)
  return []
}

type Tab = 'agents' | 'skills'

function AgentCard({ agent }: { agent: MarketplaceAgent }) {
  return (
    <div className='rounded-lg border border-border bg-card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow'>
      <div className='flex items-center gap-3'>
        {agent.icon_url ? (
          <img
            src={agent.icon_url}
            alt={agent.name}
            className='w-10 h-10 rounded-full object-cover'
          />
        ) : (
          <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center'>
            <Bot size={20} className='text-muted-foreground' />
          </div>
        )}
        <div className='flex-1 min-w-0'>
          <p className='font-medium text-sm truncate'>{agent.name}</p>
          {agent.author && (
            <p className='text-xs text-muted-foreground truncate'>
              {agent.author}
            </p>
          )}
        </div>
        {agent.status && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              agent.status === 'active'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {agent.status}
          </span>
        )}
      </div>
      {agent.description && (
        <p className='text-xs text-muted-foreground line-clamp-2'>
          {agent.description}
        </p>
      )}
      {agent.tags && agent.tags.length > 0 && (
        <div className='flex flex-wrap gap-1'>
          {agent.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className='text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded'
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SkillCard({ skill }: { skill: MarketplaceSkill }) {
  return (
    <div className='rounded-lg border border-border bg-card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow'>
      <div className='flex items-center gap-3'>
        {skill.icon_url ? (
          <img
            src={skill.icon_url}
            alt={skill.name}
            className='w-10 h-10 rounded-full object-cover'
          />
        ) : (
          <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center'>
            <Wrench size={20} className='text-muted-foreground' />
          </div>
        )}
        <div className='flex-1 min-w-0'>
          <p className='font-medium text-sm truncate'>{skill.name}</p>
          {skill.author && (
            <p className='text-xs text-muted-foreground truncate'>
              {skill.author}
            </p>
          )}
        </div>
      </div>
      {skill.description && (
        <p className='text-xs text-muted-foreground line-clamp-2'>
          {skill.description}
        </p>
      )}
      {skill.tags && skill.tags.length > 0 && (
        <div className='flex flex-wrap gap-1'>
          {skill.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className='text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded'
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Marketplace() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('agents')
  const [agents, setAgents] = useState<MarketplaceAgent[]>([])
  const [skills, setSkills] = useState<MarketplaceSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'agents') {
        const res = await getMarketplaceAgents({
          keyword: search || undefined,
          category: categoryFilter || undefined,
        })
        setAgents(normalizeAgents(res))
      } else {
        const res = await getMarketplaceSkills({
          keyword: search || undefined,
          category: categoryFilter || undefined,
        })
        setSkills(normalizeSkills(res))
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : t('Failed to load marketplace data')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [tab, search, categoryFilter, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const categories = tab === 'agents'
    ? [...new Set(agents.map((a) => a.category).filter(Boolean) as string[])]
    : [...new Set(skills.map((s) => s.category).filter(Boolean) as string[])]

  const filteredAgents = agents.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    const matchCat = !categoryFilter || a.category === categoryFilter
    return matchSearch && matchCat
  })

  const filteredSkills = skills.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    const matchCat = !categoryFilter || s.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Marketplace')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Browse and discover Tokenhub Agents and Skills')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Actions>
        <button
          onClick={loadData}
          disabled={loading}
          className='inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50'
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('Refresh')}
        </button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        {/* Tabs */}
        <div className='flex gap-2 border-b border-border mb-4'>
          {(['agents', 'skills'] as Tab[]).map((t_) => (
            <button
              key={t_}
              onClick={() => {
                setTab(t_)
                setCategoryFilter('')
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t_
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t_ === 'agents' ? t('Agents') : t('Skills')}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className='flex flex-wrap gap-2 mb-4'>
          <div className='relative flex-1 min-w-[200px]'>
            <Search
              size={14}
              className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground'
            />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search...')}
              className='w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring'
            />
          </div>
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className='text-sm rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring'
            >
              <option value=''>{t('All Categories')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Content */}
        {error ? (
          <div className='rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm'>
            {error}
          </div>
        ) : loading ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className='h-32 rounded-lg bg-muted animate-pulse'
              />
            ))}
          </div>
        ) : tab === 'agents' ? (
          filteredAgents.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-muted-foreground gap-2'>
              <Bot size={40} className='opacity-30' />
              <p className='text-sm'>{t('No agents found')}</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )
        ) : filteredSkills.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 text-muted-foreground gap-2'>
            <Wrench size={40} className='opacity-30' />
            <p className='text-sm'>{t('No skills found')}</p>
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {filteredSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
