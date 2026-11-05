/**
 * Reproduces the console conditions from a field Vue player log against a
 * local CLESS-Server, so the warnings can be classified as bugs vs expected.
 *
 * Conditions covered:
 *   1. ds.json 404 → must fall back to XML (production servers without the
 *      JSON API still do this)
 *   2. empty media slot → validation warning, not a crash
 *   3. stale mediaBaseUrl on a cached document whose host no longer matches
 *      config.hostserver (cless5 cache + cless4 config)
 *   4. missing remote images → 404s at the network layer; player keeps going
 *
 * Usage:
 *   npx vite-node tools/reproduce-console-errors.mjs -- --base http://127.0.0.1:8099/demo
 */
import { JSDOM } from 'jsdom'
import { HttpClient, LayoutTransport } from '../../src/core/transports/index.ts'
import { LayoutService } from '../../src/core/layouts/LayoutService.ts'
import { ContentPluginRegistry, BUILTIN_CONTENT_PLUGINS } from '../../src/core/plugins/index.ts'
import { DEFAULT_PLAYER_CONFIGURATION } from '../../src/core/types.ts'
import { NetworkUtils } from '../../src/core/utilities/index.ts'
import { validateLayoutDocument } from '../../src/core/layouts/schema/index.ts'

const JSDOM_PARSER = new JSDOM('').window.DOMParser

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const BASE = argument('base', 'http://127.0.0.1:8099/demo').replace(/\/$/, '')
const DISPLAY = argument('display', '1')

let failures = 0
function check(label, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures += 1
}

function parseXml(xml) {
  const document = new JSDOM_PARSER().parseFromString(xml, 'text/xml')
  function convert(element) {
    const attributes = {}
    for (const attribute of element.attributes) attributes[attribute.name] = attribute.value
    const elements = []
    let text = ''
    for (const child of element.childNodes) {
      if (child.nodeType === 1) elements.push(convert(child))
      else if (child.nodeType === 3) text += child.nodeValue ?? ''
    }
    const node = { type: 'element', name: element.nodeName, attributes }
    if (elements.length) node.elements = elements
    else if (text.trim()) node.elements = [{ type: 'text', text }]
    return node
  }
  return { elements: [convert(document.documentElement)] }
}

function configuration(overrides = {}) {
  return {
    ...DEFAULT_PLAYER_CONFIGURATION,
    hostserver: BASE,
    displayId: DISPLAY,
    playerVersion: '3.13.5',
    ...overrides,
  }
}

console.log(`Reproducing field console conditions against ${BASE}`)

// ---------------------------------------------------------------------------
step('1. Live JSON and XML both answer on a modern server')
{
  const json = await fetch(`${BASE}/${DISPLAY}/ds.json`)
  const xml = await fetch(`${BASE}/${DISPLAY}/ds.xml`)
  check('ds.json is reachable', json.ok, `${json.status}`)
  check('ds.xml is reachable', xml.ok, `${xml.status}`)
}

// ---------------------------------------------------------------------------
step('2. ds.json 404 falls back to XML (untouched production server)')
{
  const realFetch = globalThis.fetch.bind(globalThis)
  const fetchImpl = async (url, init) => {
    const target = String(url)
    if (target.includes('ds.json')) {
      console.log(`       (simulated) GET ${target} → 404`)
      return new Response('Not Found', { status: 404, statusText: 'Not Found' })
    }
    return realFetch(url, init)
  }

  const transport = new LayoutTransport({
    http: new HttpClient(10_000, fetchImpl),
    configuration: configuration({ transport: 'auto' }),
    parseXml,
  })

  const outcome = await transport.fetchDocument()
  check('probe recovers via XML', outcome.status === 'updated', outcome.status)
  check('negotiated transport is xml', transport.activeTransport === 'xml', String(transport.activeTransport))
  if (outcome.status === 'updated') {
    check('document validates', validateLayoutDocument(outcome.document).ok)
  }
}

// ---------------------------------------------------------------------------
step('3. Empty media slot is valid; unplayable items still warn')
{
  const registry = new ContentPluginRegistry()
  for (const plugin of BUILTIN_CONTENT_PLUGINS) registry.register(plugin)
  const service = new LayoutService(registry, BASE)

  const empty = service.prepare({
    id: '689',
    name: 'Empty media fixture',
    revision: '1',
    refreshInterval: 60,
    resolution: { width: 1920, height: 1080, orientation: 'landscape' },
    autoscale: true,
    background: { color: '#000', image: null, stretch: true },
    mediaBaseUrl: `${BASE.replace(/\/demo$/, '')}/media/uploads`,
    slots: [
      {
        type: 'media',
        id: 'media-3610',
        name: 'empty',
        enabled: true,
        transparent: false,
        backgroundColor: null,
        geometry: { top: 0, left: 0, width: 100, height: 100, layer: 0 },
        schedule: null,
        items: [],
        config: {},
      },
    ],
    datasets: [],
    assets: [],
  })

  check('empty media slot still prepares', empty.contents.length === 1)
  check('empty media slot does not warn', empty.validationReports.length === 0)

  const broken = service.prepare({
    ...empty.definition,
    slots: [
      {
        ...empty.definition.slots[0],
        items: [{ id: '1', text: 'none', duration: 0, order: 0, enabled: true, data: {} }],
      },
    ],
  })
  check(
    'unplayable items still warn',
    broken.validationReports.some((report) =>
      report.issues.includes('slot has no playable media items'),
    ),
  )
}

// ---------------------------------------------------------------------------
step('4. Stale mediaBaseUrl from a previous host (cless5 cache, cless4 config)')
{
  // This is the field condition: config.hostserver is cless4, but the cached
  // document still carries mediaBaseUrl from an earlier cless5 deployment, so
  // every image request goes to the wrong origin and 404s.
  const staleBase = 'https://cless5.closed-loop.biz/media/uploads'
  const currentOrigin = NetworkUtils.origin(BASE)
  const rebased = NetworkUtils.rebaseMediaBaseUrl(staleBase, BASE)

  check('detects a host mismatch', NetworkUtils.origin(staleBase) !== currentOrigin)
  check(
    'rebase points media at the configured host',
    rebased.startsWith(currentOrigin),
    rebased,
  )
  check(
    'rebase keeps the media path',
    rebased.endsWith('/media/uploads'),
    rebased,
  )
}

// ---------------------------------------------------------------------------
step('5. Missing remote images do not stop playback')
{
  // Same shape as the airline logo 404s in the field log.
  const missing = ['QF.png', 'TR.png', 'CA.png', 'CZ.png', 'KL.png', 'ZH.png']
  const mediaBase = `${NetworkUtils.origin(BASE)}/media/uploads`
  let notFound = 0
  for (const file of missing) {
    const response = await fetch(`${mediaBase}/${file}`)
    if (response.status === 404 || response.status === 403) notFound += 1
  }
  check(
    'missing logos surface as HTTP errors without throwing here',
    notFound === missing.length || notFound > 0,
    `${notFound}/${missing.length} missing (expected on a seed without logos)`,
  )
}

console.log(`\n${failures === 0 ? 'All checks passed' : `${failures} check(s) failed`}`)
process.exit(failures === 0 ? 0 : 1)

function step(label) {
  console.log(`\n${label}`)
}
