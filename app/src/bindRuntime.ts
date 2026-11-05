import type { PlayerRuntime } from '@core/player'
import {
  useAirportDisplayStore,
  useConnectivityStore,
  useLayoutStore,
  useMediaStore,
  usePlayerStatusStore,
  usePlaylistStore,
  useScheduleStore,
  useSettingsStore,
} from '@/stores'

/**
 * Connects the runtime's event surface to this renderer's stores.
 *
 * This file is the entire seam between the shared core and Vue. The runtime
 * publishes plain values and knows nothing about Pinia; the stores receive
 * them and know nothing about the runtime. That inversion is what lets the
 * same core drive the Electron build, the Capacitor build and — through the
 * `window.ClessCore` bridge — the legacy renderer, without any of them
 * carrying a framework dependency they do not use.
 *
 * Returns an unsubscribe function so a hot reload or a test can tear the
 * binding down without leaving listeners attached to a dead runtime.
 */
export function bindRuntime(runtime: PlayerRuntime): () => void {
  const settings = useSettingsStore()
  const status = usePlayerStatusStore()
  const connectivity = useConnectivityStore()
  const layout = useLayoutStore()
  const playlist = usePlaylistStore()
  const schedule = useScheduleStore()
  const media = useMediaStore()
  const airport = useAirportDisplayStore()

  status.markBooted()

  const subscriptions = [
    runtime.on('configuration', (configuration) => settings.apply(configuration)),

    runtime.on('lifecycle', ({ state, message }) => status.setLifecycle(state, message ?? null)),

    runtime.on('connectivity', ({ state, failureStreak }) => connectivity.setState(state, failureStreak)),

    runtime.on('transport', (transport) => connectivity.setTransport(transport)),

    runtime.on('clock', (now) => schedule.tick(now)),

    runtime.on('document', (document) => layout.setDocument(document)),

    runtime.on('scheduleId', (id) => schedule.setScheduleId(id)),

    runtime.on('layout', ({ position, prepared }) => {
      playlist.setPosition(position.index)
      layout.setPrepared(prepared)
    }),

    runtime.on('playlist', ({ playlist: definition, layoutCount }) => {
      playlist.setPlaylist(definition, layoutCount)
    }),

    runtime.on('paused', ({ paused, reason }) => playlist.setPaused(paused, reason ?? null)),

    runtime.on('sync', ({ result, nextPollSeconds }) => {
      connectivity.recordSync(result.outcome, result.message, result.at)
      connectivity.setNextPoll(nextPollSeconds)
    }),

    runtime.on('identity', (identity) => status.setIdentity(identity)),

    runtime.on('assets', ({ pending, backend, summary }) => {
      media.setPending(pending)
      media.setBackend(backend)
      if (summary) media.recordSummary(summary)
    }),

    runtime.on('airportOverrides', (overrides) => airport.applyOverrides(overrides)),

    runtime.on('airportAnnouncement', (announcement) => airport.enqueueAnnouncement(announcement)),
  ]

  return () => {
    for (const unsubscribe of subscriptions) unsubscribe()
  }
}
