import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { PlayerRuntime, REGISTRY_KEY, RUNTIME_KEY, createBrowserHost, createElectronHost } from '@/core/runtime'
import { Logger } from '@/core/utils'

const logger = Logger.forScope('bootstrap')

/**
 * Electron exposes `@electron/remote` on `window` through `preload.js`; its
 * presence is what distinguishes the packaged player from a browser preview.
 */
function isElectronRenderer(): boolean {
  return typeof (globalThis as { remote?: unknown }).remote !== 'undefined'
}

const host = isElectronRenderer() ? createElectronHost() : createBrowserHost()
const runtime = new PlayerRuntime(host)

const app = createApp(App)
app.use(createPinia())
app.provide(RUNTIME_KEY, runtime)
app.provide(REGISTRY_KEY, runtime.registry)

// A component that throws must not take the whole player down; the layout it
// belongs to keeps playing and the failure is logged for the control panel.
app.config.errorHandler = (error, _instance, info) => {
  logger.error(`Unhandled component error (${info})`, error)
}

app.mount('#app')

void runtime.start().catch((error: unknown) => {
  logger.error('Runtime failed to start', error)
})

// Stop timers cleanly so a reload does not leave orphaned intervals behind.
window.addEventListener('beforeunload', () => runtime.stop())
