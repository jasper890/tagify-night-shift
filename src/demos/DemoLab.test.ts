import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DEMO_STEPS } from '../data/cronDemo'
import CronDemo from '../pages/CronDemo'
import { DEMO_TRACK } from '../terminal/demoTrack'

const page = () => renderToString(createElement(MemoryRouter, null, createElement(CronDemo)))

describe('the Cron & at demo page', () => {
  it('opens with the terminal lab and the Old Admin on step 1', () => {
    const html = page()
    expect(html).toContain('aria-label="Simulated terminal"')
    expect(html).toContain('Old Admin')
    expect(html).toContain('Step 1 of 10')
    expect(html).toContain(DEMO_STEPS[0].title)
    expect(html).toContain('Run it for me')
    expect(html).toContain('student@lab-server:~$')
    // the Old Admin’s first words are readable even before they finish typing
    expect(html).toContain(DEMO_TRACK.steps[0].explain[0])
  })

  it('puts the Run it for me button once, right at the terminal, so it is seen without scrolling', () => {
    const html = page()
    const terminal = html.indexOf('aria-label="Simulated terminal"')
    const buttons = [...html.matchAll(/<button[^>]*>(?:(?!<\/button>)[\s\S])*?Run it for me/g)]
    expect(buttons).toHaveLength(1)
    expect(buttons[0].index!).toBeGreaterThan(terminal)
    expect(buttons[0].index!).toBeLessThan(html.indexOf('demo-term-input'))
  })

  it('never puts a white-on-dark button (like Copy) on the pale Your turn box, where it cannot be read', () => {
    const html = page()
    const box = html.slice(html.indexOf('Your turn'), html.indexOf('aria-label="Simulated terminal"'))
    expect(box.length).toBeGreaterThan(100)
    expect(box).not.toMatch(/<button[^>]*text-white/)
  })

  it('still lists the real terminal commands, one per step, without a Mark as done box', () => {
    const html = page()
    expect(html).toContain('Real terminal commands')
    for (const s of DEMO_STEPS) expect(html).toContain(`id="step-${s.id}"`)
    expect(html).not.toContain('Mark as done')
  })

  it('shows 0 of 10 steps and 0/200 XP before anything is done', () => {
    // React puts <!-- --> between text pieces; take them out before reading the text
    const html = page().replace(/<!-- -->/g, '')
    expect(html).toContain('0 of 10 steps done')
    expect(html).toContain('0/200 XP')
  })
})
