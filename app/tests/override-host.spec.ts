/**
 * Covers how an Airport Display zone trigger reaches the screen in the Vue
 * renderer: `ContentHost` swaps the slot's content object for one built from
 * the override, leaving the slot's geometry and styling from the layout.
 *
 * Worth testing at the component level rather than on the store, because the
 * substitution is the whole mechanism -- the legacy renderer snapshots a
 * slot's DOM and restores it afterwards, and the claim here is that swapping
 * content makes the revert free. If the swap does not happen, a zone trigger
 * silently does nothing, which is exactly how the media case behaved before.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ContentHost from '@/components/ContentHost.vue'
import { useAirportDisplayStore } from '@/stores'
import { MediaContent, TextContent } from '@core/models'
import { contentSlotSchema } from '@core/layouts/schema/layout'
import type { AirportSlotOverride } from '@core/airport-display'

const MEDIA_BASE = 'https://cms.example.com/media/uploads'

function slotDefinition(type: string, name: string, items: string[]) {
  return contentSlotSchema.parse({
    type,
    id: `${type}-1`,
    name,
    geometry: { top: 0, left: 0, width: 800, height: 400, layer: 1 },
    config: { fontSize: 40, fontColor: '#ffffff' },
    items: items.map((text, index) => ({ id: `${index}`, text, order: index })),
  })
}

function textSlot(name: string, text: string) {
  return new TextContent(slotDefinition('text', name, [text]))
}

function mediaSlot(name: string, items: string[]) {
  return new MediaContent(slotDefinition('media', name, items), MEDIA_BASE)
}

function override(partial: Partial<AirportSlotOverride> & { slotName: string }): AirportSlotOverride {
  return {
    slotType: 'text',
    value: '',
    mediaItems: [],
    temporary: true,
    appliedAt: Date.now(),
    ...partial,
  }
}

function host(content: TextContent | MediaContent) {
  return mount(ContentHost, {
    props: { content, mediaBaseUrl: MEDIA_BASE },
    global: { stubs: { transition: false } },
  })
}

describe('ContentHost override substitution', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the layout content when no override is active', () => {
    expect(host(textSlot('FlightHeading', 'DEPARTURES')).text()).toContain('DEPARTURES')
  })

  it('shows an overridden text value in place of the layout value', () => {
    useAirportDisplayStore().applyOverrides([
      override({ slotName: 'FlightHeading', value: 'BOARDING SQ318' }),
    ])

    const wrapper = host(textSlot('FlightHeading', 'DEPARTURES'))
    expect(wrapper.text()).toContain('BOARDING SQ318')
    expect(wrapper.text()).not.toContain('DEPARTURES')
  })

  it('leaves slots the override does not name alone', () => {
    useAirportDisplayStore().applyOverrides([
      override({ slotName: 'SomeOtherSlot', value: 'BOARDING SQ318' }),
    ])

    expect(host(textSlot('FlightHeading', 'DEPARTURES')).text()).toContain('DEPARTURES')
  })

  it('plays the override media instead of the slot playlist', () => {
    useAirportDisplayStore().applyOverrides([
      override({
        slotName: 'GateVisual',
        slotType: 'media',
        mediaItems: [
          { filename: 'boarding.jpg', path: 'gate/boarding.jpg', order: 1, duration: 10, selected: true },
          { filename: 'final.jpg', path: 'gate/final.jpg', order: 2, duration: 10, selected: true },
        ],
      }),
    ])

    const html = host(mediaSlot('GateVisual', ['gate/idle.jpg'])).html()
    expect(html).toContain(`${MEDIA_BASE}/gate/boarding.jpg`)
    expect(html).not.toContain('gate/idle.jpg')
  })

  it('keeps the slot playlist when a media override carries no items', () => {
    // A text-shaped override aimed at a media slot has nothing to play, and
    // blanking the slot would be worse than ignoring it.
    useAirportDisplayStore().applyOverrides([
      override({ slotName: 'GateVisual', slotType: 'media', value: 'BOARDING' }),
    ])

    expect(host(mediaSlot('GateVisual', ['gate/idle.jpg'])).html()).toContain('gate/idle.jpg')
  })

  it('restores the layout content when the override is cleared', () => {
    const store = useAirportDisplayStore()
    store.applyOverrides([override({ slotName: 'FlightHeading', value: 'BOARDING SQ318' })])

    const wrapper = host(textSlot('FlightHeading', 'DEPARTURES'))
    expect(wrapper.text()).toContain('BOARDING SQ318')

    store.clearTemporaryOverrides()
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.text()).toContain('DEPARTURES')
    })
  })
})
