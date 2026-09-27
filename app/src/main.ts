import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import { PlayerRuntime, createHost } from '@core/player'
import { Logger } from '@core/utilities'
import { bindRuntime } from './bindRuntime'
import { REGISTRY_KEY, RUNTIME_KEY } from './renderers'

const logger = Logger.forScope('bootstrap')

// The host is resolved by the platform layer, so this file is identical on
// Electron, Android and iOS.
const runtime = new PlayerRuntime(createHost())

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

// Stores exist only once the app is mounted, so the binding is made here
// rather than in the runtime, which must stay framework-free.
const unbind = bindRuntime(runtime)

void runtime.start().catch((error: unknown) => {
  logger.error('Runtime failed to start', error)
})

// Stop timers cleanly so a reload does not leave orphaned intervals behind.
window.addEventListener('beforeunload', () => {
  unbind()
  runtime.stop()
})
