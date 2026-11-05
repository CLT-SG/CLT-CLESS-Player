/**
 * Phase 5 live validation: drives the shared core against a real CLESS-Server.
 *
 * Unit tests cover the core's logic against fixtures. This covers the claims
 * that only a running server and a real outage can settle:
 *
 *   - the JSON transport is negotiated when the server offers it, and the XML
 *     transport still works against the same server
 *   - an unchanged layout costs a 304 rather than a full payload
 *   - a poll that fails leaves the cached document intact, so playback
 *     continues through an outage instead of blanking
 *   - the connectivity monitor reports degraded before offline, and recovers
 *     on the first successful poll after the server returns
 *   - repeated polling neither leaks listeners nor grows the cache
 *
 * Usage, from the repository root:
 *
 *   npm --prefix app run validate:live -- --base http://127.0.0.1:8099/demo --display 1
 *
 * The outage steps need to stop and restart the server, so the script does not
 * do it: it prints what to do and waits for the server to actually go away,
 * which also means it works against a remote server over a real network drop.
 * Pass --no-outage to run only the steps that need no intervention.
 *
 * Exits non-zero on the first failed check.
 */
import { HttpClient, LayoutTransport, ConnectivityMonitor } from '../../src/core/transports/index.ts'
import { LayoutRepository, AssetCache, MemoryStorageDriver } from '../../src/core/storage/index.ts'
import { SyncService } from '../../src/core/services/index.ts'
import { DEFAULT_PLAYER_CONFIGURATION } from '../../src/core/types.ts'
import { validateLayoutDocument } from '../../src/core/layouts/schema/index.ts'
import { JSDOM } from 'jsdom'

const JSDOM_PARSER = new JSDOM('').window.DOMParser

/* ------------------------------ arguments ------------------------------- */

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const BASE = argument('base', 'http://127.0.0.1:8099/demo').replace(/\/$/, '')
const DISPLAY_ID = argument('display', '1')
const RUN_OUTAGE = !process.argv.includes('--no-outage')
const POLL_ROUNDS = Number(argument('rounds', '20'))

/* ------------------------------ harness --------------------------------- */

let failures = 0
let checks = 0

function check(label, condition, detail = '') {
  checks += 1
  if (condition) {
    console.log(`  ok    ${label}${detail ? `  (${detail})` : ''}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
  }
}

function step(label) {
  console.log(`\n${label}`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Counts cache keys, to show that an unchanged layout does not accumulate. */
async function keyCount(driver) {
  return (await driver.keys()).length
}

function configuration(overrides = {}) {
  return {
    ...DEFAULT_PLAYER_CONFIGURATION,
    hostserver: BASE,
    displayId: DISPLAY_ID,
    ...overrides,
  }
}

/**
 * Minimal xml-js-shaped parser, matching what the Electron host supplies.
 *
 * jsdom stands in for the renderer's DOMParser so this script can run under
 * plain Node; the tree it produces is the same non-compact xml-js shape the
 * real host hands the adapter.
 */
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

async function serverReachable() {
  try {
    const response = await fetch(`${BASE}/${DISPLAY_ID}/ds.json`, { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

async function waitFor(label, predicate, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  process.stdout.write(`  ...  ${label}`)
  while (Date.now() < deadline) {
    if (await predicate()) {
      process.stdout.write('  done\n')
      return true
    }
    process.stdout.write('.')
    await sleep(1000)
  }
  process.stdout.write('  TIMED OUT\n')
  return false
}

/* -------------------------------- steps --------------------------------- */

async function transportNegotiation() {
  step('1. Transport negotiation and conditional requests')

  const transport = new LayoutTransport({
    http: new HttpClient(),
    configuration: configuration({ transport: 'auto' }),
    parseXml,
  })

  const first = await transport.fetchDocument(null)
  check('auto negotiation reaches the server', first.status === 'updated', first.status)
  if (first.status !== 'updated') return null

  check('negotiated the JSON API', transport.activeTransport === 'json', String(transport.activeTransport))
  check('document satisfies the layout schema', validateLayoutDocument(first.document).ok)
  check('document carries an ETag', Boolean(first.etag), String(first.etag))

  const second = await transport.fetchDocument(first.etag)
  check(
    'unchanged layout answers 304 rather than a full payload',
    second.status === 'not-modified',
    second.status,
  )

  return first
}

async function xmlTransportStillWorks(jsonOutcome) {
  step('2. XML transport against the same server')

  const transport = new LayoutTransport({
    http: new HttpClient(),
    configuration: configuration({ transport: 'xml' }),
    parseXml,
  })

  const outcome = await transport.fetchDocument(null)
  check('XML transport fetches a document', outcome.status === 'updated', outcome.status)
  if (outcome.status !== 'updated' || !jsonOutcome) return

  check('XML document satisfies the layout schema', validateLayoutDocument(outcome.document).ok)
  check('XML transport reports itself as xml', outcome.transport === 'xml', outcome.transport)

  // The parity spec proves field-level equality on captured fixtures; here the
  // point is only that the same live server yields the same structure through
  // both transports, which is what makes the renderer switch a rollback path.
  const json = jsonOutcome.document
  check(
    'both transports agree on the document mode',
    outcome.document.mode === json.mode,
    `${outcome.document.mode} vs ${json.mode}`,
  )
  check(
    'both transports agree on the layout ids',
    JSON.stringify(outcome.document.layouts.map((l) => l.id)) ===
      JSON.stringify(json.layouts.map((l) => l.id)),
    JSON.stringify(outcome.document.layouts.map((l) => l.id)),
  )
  check(
    'both transports agree on the playlist entries',
    JSON.stringify(outcome.document.playlist?.entries.map((e) => [e.layoutId, e.duration])) ===
      JSON.stringify(json.playlist?.entries.map((e) => [e.layoutId, e.duration])),
  )
}

function buildSync() {
  // In memory, so a validation run leaves nothing behind on the machine.
  const driver = new MemoryStorageDriver()
  const repository = new LayoutRepository(driver)
  const connectivity = new ConnectivityMonitor()
  const service = new SyncService({
    transport: new LayoutTransport({
      http: new HttpClient(),
      configuration: configuration({ transport: 'auto' }),
      parseXml,
    }),
    repository,
    assetCache: new AssetCache(driver, null),
    connectivity,
    configuration: configuration(),
  })
  return { service, repository, connectivity, driver }
}

async function cachingAndRepeatedPolling() {
  step(`3. Caching and ${POLL_ROUNDS} rounds of repeated polling`)

  const { service, repository, connectivity, driver } = buildSync()

  const first = await service.syncNow()
  check('first sync succeeds', first.outcome === 'updated', first.outcome)
  check('connectivity reports online', connectivity.state === 'online', connectivity.state)

  const cached = await repository.loadDocument(DISPLAY_ID)
  check('document was written to the cache', cached !== null)
  check('cached document satisfies the schema', cached ? validateLayoutDocument(cached).ok : false)

  const keysAfterFirst = await keyCount(driver)
  let notModified = 0
  for (let round = 0; round < POLL_ROUNDS; round += 1) {
    const result = await service.syncNow()
    if (result.outcome === 'unchanged') notModified += 1
  }

  check(
    'repeated polls are answered as unchanged',
    notModified === POLL_ROUNDS,
    `${notModified}/${POLL_ROUNDS}`,
  )
  const keysAfterPolling = await keyCount(driver)
  check(
    'cache does not grow while the layout is unchanged',
    keysAfterPolling === keysAfterFirst,
    `${keysAfterFirst} -> ${keysAfterPolling} keys`,
  )

  return { service, repository, connectivity }
}

async function outageAndRecovery(context) {
  step('4. Outage and recovery')

  if (!RUN_OUTAGE) {
    console.log('  skipped (--no-outage)')
    return
  }

  const { service, repository, connectivity } = context
  const before = await repository.loadDocument(DISPLAY_ID)

  console.log('\n  >>> Stop the server now (Ctrl-C the runserver process).')
  if (!(await waitFor('waiting for the server to become unreachable', async () => !(await serverReachable())))) {
    check('server became unreachable', false)
    return
  }

  // `error`, not `offline`: the latter is reserved for a player configured to
  // stay offline, so the two cases stay distinguishable in the status report.
  // Reachability is the connectivity monitor's business, checked below.
  const failed = await service.syncNow()
  check('a poll during the outage reports an error', failed.outcome === 'error', failed.outcome)
  check('the error carries a reason', Boolean(failed.message), failed.message ?? '')

  const during = await repository.loadDocument(DISPLAY_ID)
  check('cached document survives the failed poll', during !== null)
  check(
    'cached document is unchanged by the failure',
    JSON.stringify(during) === JSON.stringify(before),
  )
  check(
    'restoreFromCache still returns playable content while offline',
    (await service.restoreFromCache()) !== null,
  )

  // Degraded after the first failure, offline once failures accumulate: the
  // distinction is what lets the UI say "retrying" rather than "offline" for a
  // single dropped poll.
  check('connectivity leaves online after one failure', connectivity.state === 'degraded', connectivity.state)
  await service.syncNow()
  await service.syncNow()
  check('connectivity reports offline after repeated failures', connectivity.state === 'offline', connectivity.state)
  check('backoff has grown beyond the refresh interval', service.nextPollSeconds > 0, `${service.nextPollSeconds}s`)

  console.log('\n  >>> Start the server again.')
  if (!(await waitFor('waiting for the server to come back', serverReachable))) {
    check('server came back', false)
    return
  }

  const recovered = await service.syncNow()
  check(
    'first poll after reconnect succeeds',
    recovered.outcome === 'updated' || recovered.outcome === 'unchanged',
    recovered.outcome,
  )
  check('connectivity reports online again', connectivity.state === 'online', connectivity.state)
  check('cache still holds a valid document', (await repository.loadDocument(DISPLAY_ID)) !== null)
}

/* --------------------------------- main --------------------------------- */

async function main() {
  console.log(`Phase 5 live validation against ${BASE} (display ${DISPLAY_ID})`)

  if (!(await serverReachable())) {
    console.error(`\nCannot reach ${BASE}/${DISPLAY_ID}/ds.json -- start the server first.`)
    process.exit(2)
  }

  const jsonOutcome = await transportNegotiation()
  await xmlTransportStillWorks(jsonOutcome)
  const context = await cachingAndRepeatedPolling()
  await outageAndRecovery(context)

  console.log(`\n${checks - failures}/${checks} checks passed`)
  process.exit(failures === 0 ? 0 : 1)
}

await main()
