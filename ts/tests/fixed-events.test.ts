import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { recommend } from '../src/recommender'
import type { Policy } from '../src/policy'

const FX = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const basePolicy = (): Policy => JSON.parse(readFileSync(resolve(FX, 'policy.json'), 'utf8')) as Policy

// 7/13/2026 is a Monday, when the "Co-Ed 3.75+ Level Play" fixed event (17:00, Advanced) runs.
const MON = '7/13/2026'

describe('distinct fixed events (Level Play)', () => {
  it('books a fixed event with its own event_id as that distinct event', () => {
    const policy = basePolicy()
    const fe = policy.fixed_events!.events!.find((e) => e.name === 'Co-Ed 3.75+ Level Play')!
    fe.event_id = 1982138
    const { recommendations } = recommend([], MON, policy, { popularity: new Map() })

    const levelPlay = recommendations.find((r) => r.event_id === 1982138)
    expect(levelPlay).toBeDefined()
    expect(levelPlay!.event_name).toBe('Co-Ed 3.75+ Level Play')
    expect(levelPlay!.level).toBe('Advanced')
    expect(levelPlay!.start.formatHm()).toBe('17:00')
    // It did NOT also book the generic Advanced Open Play at that same slot.
    expect(
      recommendations.some((r) => r.event_id === 1633147 && r.start.formatHm() === '17:00'),
    ).toBe(false)
  })

  it('without event_id, maps to the generic Open Play event (unchanged behaviour)', () => {
    const policy = basePolicy() // fixture has no event_id on fixed events
    const { recommendations } = recommend([], MON, policy, { popularity: new Map() })
    const at17 = recommendations.find((r) => r.start.formatHm() === '17:00')
    expect(at17?.event_id).toBe(1633147) // generic Co-ed Advanced Open Play
  })
})
