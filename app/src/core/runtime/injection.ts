import type { InjectionKey } from 'vue'
import type { ContentPluginRegistry } from '../plugins'
import type { PlayerRuntime } from './PlayerRuntime'

/**
 * Injection keys for the two objects components are allowed to reach for.
 *
 * Components get the registry (to resolve a renderer) and the runtime (to
 * request an action such as "advance the playlist"). Everything else flows
 * through stores, which keeps the dependency direction one-way.
 */
export const REGISTRY_KEY = Symbol('cless.registry') as InjectionKey<ContentPluginRegistry>
export const RUNTIME_KEY = Symbol('cless.runtime') as InjectionKey<PlayerRuntime>
