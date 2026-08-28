import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { SectionPageLayout } from '@/components/layout'
import { getMarketplaceAgents, getMarketplaceSkills } from './api'
import type { MarketplaceAgent, MarketplaceSkill } from './types'

const CATEGORIES = [
  'all',
  'engineering',
  'design',
  'marketing',
  'finance',
  'product',
  'sales',
  'support',
  'specialized',
]

type Tab = 'agents' | 'skills'

export function Marketplace() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('agents')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [agents, setAgents] = useState<MarketplaceAgent[]>([])
  const [skills, setSkills] = useState<MarketplaceSkill[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    if (tab === 'agents') {
      getMarketplaceAgents({ search, category })
        .then((res) => {
          if (res.success && res.data) setAgents(res.data.items)
        })
        .finally(() => setLoading(false))
    } else {
      getMarketplaceSkills({ search })
        .then((res) => {
          if (res.success && res.data) setSkills(res.data.items)
        })
        .finally(() => setLoading(false))
    }
  }, [tab, search, category])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Agent Marketplace')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Browse and discover AI agents and skills from Tokenhub')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          {/* Tabs */}
          <div className='flex gap-2 border-b'>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'agents'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab('agents')}
            >
              {t('Agents')}
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === 'skills'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab('skills')}
            >
              {t('Skills')}
            </button>
          </div>

          {/* Search + Category Filter */}
          <div className='flex flex-wrap gap-3'>
            <div className='relative flex-1 min-w-[200px]'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <input
                type='text'
                placeholder={t('Search...')}
                className='w-full rounded-md border bg-background px-9 py-2 text-sm'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {tab === 'agents' && (
              <select
                className='rounded-md border bg-background px-3 py-2 text-sm'
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className='flex items-center justify-center py-12 text-muted-foreground'>
              {t('Loading...')}
            </div>
          ) : tab === 'agents' ? (
            <AgentGrid agents={agents} t={t} />
          ) : (
            <SkillGrid skills={skills} t={t} />
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function AgentGrid({
  agents,
  t,
}: {
  agents: MarketplaceAgent[]
  t: (key: string) => string
}) {
  if (agents.length === 0) {
    return (
      <div className='flex items-center justify-center py-12 text-muted-foreground'>
        {t('No agents found. Enable Tokenhub integration in System Settings.')}
      </div>
    )
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {agents.map((agent) => (
        <div
          key={agent.id}
          className='rounded-lg border bg-card p-4 transition-shadow hover:shadow-md'
        >
          <div className='mb-2 flex items-start justify-between'>
            <h3 className='text-sm font-semibold'>{agent.display_name || agent.name}</h3>
            {agent.version && (
              <span className='rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>
                {agent.version}
              </span>
            )}
          </div>
          <p className='mb-3 text-xs text-muted-foreground line-clamp-2'>
            {agent.description}
          </p>
          <div className='flex flex-wrap gap-1'>
            {agent.category && (
              <span className='rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary'>
                {agent.category}
              </span>
            )}
            {agent.streaming && (
              <span className='rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600'>
                Streaming
              </span>
            )}
            {agent.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
              >
                {tag}
              </span>
            ))}
          </div>
          {agent.skills && agent.skills.length > 0 && (
            <div className='mt-3 border-t pt-2'>
              <p className='mb-1 text-xs font-medium text-muted-foreground'>
                {t('Skills')} ({agent.skills.length})
              </p>
              <div className='flex flex-wrap gap-1'>
                {agent.skills.slice(0, 3).map((skill) => (
                  <span
                    key={skill.id}
                    className='rounded bg-muted px-1.5 py-0.5 text-xs'
                  >
                    {skill.name}
                  </span>
                ))}
                {agent.skills.length > 3 && (
                  <span className='text-xs text-muted-foreground'>
                    +{agent.skills.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SkillGrid({
  skills,
  t,
}: {
  skills: MarketplaceSkill[]
  t: (key: string) => string
}) {
  if (skills.length === 0) {
    return (
      <div className='flex items-center justify-center py-12 text-muted-foreground'>
        {t('No skills found. Enable Tokenhub integration in System Settings.')}
      </div>
    )
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {skills.map((skill) => (
        <div
          key={skill.id}
          className='rounded-lg border bg-card p-4 transition-shadow hover:shadow-md'
        >
          <div className='mb-2 flex items-start justify-between'>
            <h3 className='text-sm font-semibold'>{skill.name}</h3>
            {skill.version && (
              <span className='rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>
                {skill.version}
              </span>
            )}
          </div>
          <p className='mb-3 text-xs text-muted-foreground line-clamp-2'>
            {skill.description}
          </p>
          {skill.tags && skill.tags.length > 0 && (
            <div className='flex flex-wrap gap-1'>
              {skill.tags.map((tag) => (
                <span
                  key={tag}
                  className='rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
