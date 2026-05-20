/* ============================================================
 * Offline Layout Manager
 * ----------------------------------------------------------
 * Allows operators to view, modify and add slot content for
 * cached offline layouts when the player is in offline mode.
 *
 * Layouts are stored in localStorage as:
 *   - layout-<ID>           (active layout used by the player)
 *   - layout-offline-<ID>   (offline cached layout)
 *
 * This module is shared by the Electron build (src/) and the
 * Capacitor mobile build (mobile/www/). It must therefore avoid
 * any hard dependency on Electron-specific APIs.
 * ============================================================ */
(function () {
  'use strict';

  // ----- Environment detection -----
  var isElectron = !!(window && window.process && window.process.type) ||
                   typeof window.require === 'function' ||
                   !!window.ipcRenderer ||
                   !!window.remote;

  var ipcRenderer = window.ipcRenderer || null;
  var remote = window.remote || null;

  // ----- State -----
  var state = {
    config: null,
    layouts: [],          // [{ id, key, name, slots, raw }]
    activeLayoutId: null,
    editing: null         // { layoutId, slotIndex, originalSlot }
  };

  // ----- DOM refs -----
  var els = {};

  // ============================================================
  // Initialization
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    cacheDom();
    bindUI();
    loadConfig().then(function () {
      renderTopbar();
      renderBanner();
      loadLayouts();
      renderLayouts();
    }).catch(function (err) {
      console.warn('[OLM] Failed to load config:', err);
      renderTopbar();
      renderBanner();
      loadLayouts();
      renderLayouts();
    });
  });

  function cacheDom() {
    els.modeBadge   = document.getElementById('olm-mode-badge');
    els.dsidValue   = document.getElementById('olm-dsid-value');
    els.layoutCount = document.getElementById('olm-layout-count');
    els.banner      = document.getElementById('olm-banner');
    els.sidebar     = document.getElementById('olm-sidebar-list');
    els.main        = document.getElementById('olm-main');
    els.modal       = document.getElementById('olm-modal');
    els.modalTitle  = document.getElementById('olm-modal-title');
    els.modalBody   = document.getElementById('olm-modal-body');
    els.btnBack     = document.getElementById('olm-btn-back');
    els.btnReload   = document.getElementById('olm-btn-reload-cache');
    els.btnPlayer   = document.getElementById('olm-btn-reload-player');
  }

  function bindUI() {
    if (els.btnBack)   els.btnBack.addEventListener('click', goBackToPlayer);
    if (els.btnReload) els.btnReload.addEventListener('click', function () {
      loadLayouts();
      renderLayouts();
      toast('Reloaded layouts from cache.', 'success');
    });
    if (els.btnPlayer) els.btnPlayer.addEventListener('click', reloadPlayer);

    // Modal close on backdrop click + Esc
    els.modal.addEventListener('click', function (e) {
      if (e.target === els.modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.modal.classList.contains('show')) closeModal();
    });
  }

  // ============================================================
  // Configuration
  // ============================================================
  function loadConfig() {
    return new Promise(function (resolve) {
      // Wait briefly for the configLoader to finish
      function pickConfig() {
        if (window.config && Object.keys(window.config).length) {
          state.config = window.config;
          return true;
        }
        if (window.configLoader && window.configLoader.config) {
          state.config = window.configLoader.config;
          return true;
        }
        if (window.mobileConfigLoader && window.mobileConfigLoader.config) {
          state.config = window.mobileConfigLoader.config;
          return true;
        }
        return false;
      }
      if (pickConfig()) return resolve();

      var attempts = 0;
      var t = setInterval(function () {
        attempts++;
        if (pickConfig() || attempts > 20) {
          clearInterval(t);
          resolve();
        }
      }, 100);

      window.addEventListener('configLoaded', function () {
        if (pickConfig()) {
          clearInterval(t);
          resolve();
        }
      }, { once: true });
    });
  }

  // ============================================================
  // Top bar / banner
  // ============================================================
  function renderTopbar() {
    var mode = (state.config && state.config.mode) || 'unknown';
    var dsid = (state.config && state.config.id) || '—';
    if (els.modeBadge) {
      els.modeBadge.textContent = mode;
      els.modeBadge.className = 'olm-badge ' + (mode === 'offline' ? 'offline' : (mode === 'online' ? 'online' : 'warn'));
    }
    if (els.dsidValue) els.dsidValue.textContent = dsid;
  }

  function renderBanner() {
    if (!els.banner) return;
    var mode = state.config && state.config.mode;
    if (mode === 'offline') {
      els.banner.className = 'olm-banner info';
      els.banner.innerHTML =
        '<strong>Offline Mode active.</strong>&nbsp;Edits made here are stored to the offline cache and will be applied to the running player when you click <em>Reload Player</em>.';
    } else {
      els.banner.className = 'olm-banner warn';
      els.banner.innerHTML =
        '<strong>Player is not in offline mode.</strong>&nbsp;You can still inspect and edit cached layouts, but in online mode the next sync from the server will overwrite your changes.';
    }
  }

  // ============================================================
  // Layout collection
  // ============================================================
  function loadLayouts() {
    var byId = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key) continue;
      var id = null;
      if (key.indexOf('layout-offline-') === 0) {
        id = key.substring('layout-offline-'.length);
      } else if (key.indexOf('layout-') === 0) {
        id = key.substring('layout-'.length);
      } else {
        continue;
      }
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) continue;
      if (!byId[id]) byId[id] = { id: id, hasOffline: false, hasLive: false };
      if (key.indexOf('layout-offline-') === 0) byId[id].hasOffline = true;
      else byId[id].hasLive = true;
    }

    var list = [];
    Object.keys(byId).forEach(function (id) {
      var rec = byId[id];
      // Prefer offline cache as source of truth for this manager
      var primaryKey = rec.hasOffline ? ('layout-offline-' + id) : ('layout-' + id);
      try {
        var raw = localStorage.getItem(primaryKey);
        if (!raw) return;
        var data = JSON.parse(raw);
        var meta = extractLayoutMeta(data);
        list.push({
          id: id,
          key: primaryKey,
          hasOffline: rec.hasOffline,
          hasLive: rec.hasLive,
          name: meta.name || ('Layout ' + id),
          resolution: meta.resolution,
          slotCount: meta.slotCount,
          raw: data
        });
      } catch (e) {
        console.warn('[OLM] Failed to parse', primaryKey, e);
      }
    });

    // Sort numerically when possible
    list.sort(function (a, b) {
      var na = parseInt(a.id, 10), nb = parseInt(b.id, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });

    state.layouts = list;
    if (els.layoutCount) els.layoutCount.textContent = list.length;
  }

  function extractLayoutMeta(data) {
    var meta = { name: null, resolution: null, slotCount: 0 };
    try {
      var root = data && data.elements && data.elements[0];
      if (!root) return meta;
      meta.name = (root.attributes && root.attributes.layout) || null;
      var inner = root.elements && root.elements[0];
      if (inner && inner.attributes) meta.resolution = inner.attributes.resolution || null;
      var slots = getSlotsArray(data);
      if (slots) meta.slotCount = slots.length;
    } catch (e) {}
    return meta;
  }

  function getSlotsArray(layoutData) {
    try {
      return layoutData.elements[0].elements[0].elements[0].elements || [];
    } catch (e) {
      return null;
    }
  }

  // ============================================================
  // Render: sidebar + main
  // ============================================================
  function renderLayouts() {
    if (!els.sidebar) return;
    if (!state.layouts.length) {
      els.sidebar.innerHTML = '<div class="olm-layout-item" style="cursor:default;color:#64748b;">No cached layouts found.</div>';
      els.main.innerHTML =
        '<div class="empty-state">' +
          '<div class="big-icon">&#128230;</div>' +
          '<div><strong>No cached layouts available.</strong></div>' +
          '<div>Run the player online at least once to populate the offline cache.</div>' +
        '</div>';
      return;
    }

    els.sidebar.innerHTML = state.layouts.map(function (lyt) {
      var active = state.activeLayoutId === lyt.id ? ' active' : '';
      var pills = [];
      if (lyt.hasOffline) pills.push('<span class="pill" title="Offline cache available">offline</span>');
      if (lyt.resolution) pills.push('<span class="pill">' + escapeHtml(lyt.resolution) + '</span>');
      pills.push('<span class="pill">' + lyt.slotCount + ' slots</span>');
      return (
        '<div class="olm-layout-item' + active + '" data-id="' + escapeAttr(lyt.id) + '">' +
          '<div class="name">' + escapeHtml(lyt.name) + '</div>' +
          '<div class="meta">' +
            '<span style="font-family:ui-monospace,monospace;color:#94a3b8">#' + escapeHtml(lyt.id) + '</span>' +
            pills.join('') +
          '</div>' +
        '</div>'
      );
    }).join('');

    Array.prototype.forEach.call(els.sidebar.querySelectorAll('.olm-layout-item[data-id]'), function (el) {
      el.addEventListener('click', function () {
        selectLayout(el.getAttribute('data-id'));
      });
    });

    if (!state.activeLayoutId && state.layouts.length) {
      selectLayout(state.layouts[0].id);
    } else if (state.activeLayoutId) {
      renderSlots();
    }
  }

  function selectLayout(id) {
    state.activeLayoutId = id;
    Array.prototype.forEach.call(els.sidebar.querySelectorAll('.olm-layout-item'), function (el) {
      el.classList.toggle('active', el.getAttribute('data-id') === id);
    });
    renderSlots();
  }

  function renderSlots() {
    var lyt = currentLayout();
    if (!lyt) {
      els.main.innerHTML = '<div class="empty-state">Select a layout to view its slots.</div>';
      return;
    }
    var slots = getSlotsArray(lyt.raw) || [];

    var header =
      '<div class="olm-section-header">' +
        '<div>' +
          '<h2>' + escapeHtml(lyt.name) + '</h2>' +
          '<div class="sub">Layout ID <code>' + escapeHtml(lyt.id) + '</code> · ' +
            (lyt.resolution ? escapeHtml(lyt.resolution) + ' · ' : '') +
            slots.length + ' slot(s) · ' +
            (lyt.hasOffline ? 'offline cache' : 'live cache only') +
          '</div>' +
        '</div>' +
      '</div>';

    if (!slots.length) {
      els.main.innerHTML = header + '<div class="empty-state">This layout has no slots.</div>';
      return;
    }

    var grid = slots.map(function (slot, idx) { return renderSlotCard(slot, idx); }).join('');
    els.main.innerHTML = header + '<div class="olm-slot-grid">' + grid + '</div>';

    Array.prototype.forEach.call(els.main.querySelectorAll('[data-edit-slot]'), function (btn) {
      btn.addEventListener('click', function () {
        openEditor(parseInt(btn.getAttribute('data-edit-slot'), 10));
      });
    });
  }

  function renderSlotCard(slot, idx) {
    var type = (slot && slot.name) || 'slot';
    var attr = (slot && slot.attributes) || {};
    var name = attr.name || ('slot-' + (attr.id || idx));
    var items = readSlotItems(slot);
    var preview = items.length
      ? items.map(function (it) {
          var dur = (it.duration != null) ? ' (' + it.duration + 's)' : '';
          return (it.content || '— empty —') + dur;
        }).join('\n')
      : getSlotPreview(slot);
    var pos = [];
    if (attr.x !== undefined) pos.push('<span>x: ' + escapeHtml(String(attr.x)) + '</span>');
    if (attr.y !== undefined) pos.push('<span>y: ' + escapeHtml(String(attr.y)) + '</span>');
    if (attr.w !== undefined) pos.push('<span>w: ' + escapeHtml(String(attr.w)) + '</span>');
    if (attr.h !== undefined) pos.push('<span>h: ' + escapeHtml(String(attr.h)) + '</span>');

    var itemCountBadge = items.length
      ? '<span class="item-count" title="Number of content items">' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</span>'
      : '';

    return (
      '<div class="olm-slot-card">' +
        '<div class="head">' +
          '<span class="type-badge ' + escapeAttr(type) + '">' + escapeHtml(type) + '</span>' +
          '<span class="slot-name">' + escapeHtml(name) + '</span>' +
          itemCountBadge +
        '</div>' +
        '<div class="slot-id">id: ' + escapeHtml(String(attr.id || '—')) + '</div>' +
        (pos.length ? '<div class="position">' + pos.join('') + '</div>' : '') +
        '<div class="preview ' + (preview ? '' : 'empty') + '">' +
          (preview ? escapeHtml(truncate(preview, 260)) : '— no inline content —') +
        '</div>' +
        '<div class="actions">' +
          '<button class="olm-btn primary" data-edit-slot="' + idx + '">Edit Content</button>' +
        '</div>' +
      '</div>'
    );
  }

  // ============================================================
  // Slot content extraction
  // ============================================================
  // Returns a flat list of strings representing the editable
  // text items inside a slot. For text-like slots there is one
  // item; for ticker/scroller/fader there can be many.
  function extractTextItems(slot) {
    var items = [];
    if (!slot || !slot.elements) return items;
    var type = slot.name;

    function walkText(node, collect) {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(function (n) { walkText(n, collect); });
        return;
      }
      if (node.type === 'text' && typeof node.text === 'string') {
        collect.push({ ref: node, text: node.text });
        return;
      }
      if (node.elements) walkText(node.elements, collect);
    }

    if (type === 'ticker' || type === 'scroller' || type === 'fader') {
      // Each child element is typically one item
      slot.elements.forEach(function (item) {
        var collected = [];
        walkText(item, collected);
        if (collected.length) {
          items.push({
            wrapper: item,
            refs: collected,
            text: collected.map(function (c) { return c.text; }).join('')
          });
        } else {
          items.push({ wrapper: item, refs: [], text: '' });
        }
      });
    } else {
      // Generic: all text leaves merged
      var collected = [];
      walkText(slot.elements, collected);
      if (collected.length) {
        items.push({
          wrapper: null,
          refs: collected,
          text: collected.map(function (c) { return c.text; }).join('')
        });
      }
    }
    return items;
  }

  function getSlotPreview(slot) {
    var items = extractTextItems(slot);
    if (items.length) return items.map(function (i) { return i.text; }).filter(Boolean).join(' | ');
    var attr = slot && slot.attributes;
    if (attr) {
      if (attr.src) return 'src: ' + attr.src;
      if (attr.url) return 'url: ' + attr.url;
    }
    return '';
  }

  // ============================================================
  // Editor modal — friendly multi-item editor
  // ============================================================
  // Slot type classification
  var MEDIA_LIKE_SLOTS  = ['media', 'image', 'video', 'audio'];
  var TEXT_LIKE_SLOTS   = ['text', 'ticker', 'scroller', 'fader', 'html'];
  var ROTATING_SLOTS    = ['media', 'image', 'video', 'text', 'ticker', 'scroller', 'fader', 'audio', 'html'];

  function isMediaLikeSlot(slot)   { return slot && MEDIA_LIKE_SLOTS.indexOf(slot.name) !== -1; }
  function isTextLikeSlot(slot)    { return slot && TEXT_LIKE_SLOTS.indexOf(slot.name) !== -1; }
  function supportsItems(slot)     { return slot && ROTATING_SLOTS.indexOf(slot.name) !== -1; }

  // Read the items array from a slot in a normalized form:
  // { raw: <element>, tag: itemTag, content: string, duration: number|null, attributes: {...} }
  function readSlotItems(slot) {
    var out = [];
    if (!slot || !slot.elements || !Array.isArray(slot.elements)) return out;
    slot.elements.forEach(function (el) {
      // Skip stray text nodes between elements (whitespace artefacts from xml2json)
      if (!el || el.type === 'text') return;
      var content = '';
      if (el.elements && el.elements.length) {
        // Find first inner text node
        for (var i = 0; i < el.elements.length; i++) {
          var child = el.elements[i];
          if (child && child.type === 'text' && typeof child.text === 'string') { content = child.text; break; }
        }
      }
      var attrs = el.attributes || {};
      var dur = attrs.duration;
      if (dur === undefined || dur === null || dur === '') {
        dur = null;
      } else {
        var n = parseFloat(dur);
        dur = isNaN(n) ? null : n;
      }
      out.push({
        raw: el,
        tag: el.name || 'item',
        content: content,
        duration: dur,
        attributes: attrs
      });
    });
    return out;
  }

  // Pick a sensible XML tag name to use when creating a brand new item
  function inferItemTagName(slot) {
    if (slot && Array.isArray(slot.elements)) {
      for (var i = 0; i < slot.elements.length; i++) {
        var el = slot.elements[i];
        if (el && el.type !== 'text' && el.name) return el.name;
      }
    }
    // Sensible defaults per slot type
    var type = slot && slot.name;
    if (type === 'media' || type === 'image' || type === 'video' || type === 'audio') return 'media';
    if (type === 'text' || type === 'ticker' || type === 'scroller' || type === 'fader' || type === 'html') return 'text';
    return 'item';
  }

  // Rebuild slot.elements from a list of normalized items (after edit / reorder)
  function rebuildSlotElements(slot, items) {
    var defaultTag = inferItemTagName(slot);
    slot.elements = items.map(function (it) {
      var raw = it.raw || {
        type: 'element',
        name: it.tag || defaultTag,
        attributes: {},
        elements: []
      };
      // Ensure object shape
      if (!raw.attributes) raw.attributes = {};
      if (!raw.elements) raw.elements = [];

      // Update duration (only set if numeric value given; remove if null/empty)
      if (it.duration === null || it.duration === undefined || it.duration === '' || isNaN(it.duration)) {
        if ('duration' in raw.attributes) delete raw.attributes.duration;
      } else {
        raw.attributes.duration = String(it.duration);
      }

      // Update inner text node — replace first text leaf, or insert a new one
      var replaced = false;
      for (var i = 0; i < raw.elements.length; i++) {
        if (raw.elements[i] && raw.elements[i].type === 'text') {
          raw.elements[i].text = it.content == null ? '' : String(it.content);
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        raw.elements.unshift({ type: 'text', text: it.content == null ? '' : String(it.content) });
      }
      // Ensure type / name fields exist
      if (!raw.type) raw.type = 'element';
      if (!raw.name) raw.name = it.tag || defaultTag;
      return raw;
    });
  }

  // List filenames from the local res folder (Electron) or Capacitor Filesystem (mobile).
  // Returns Promise<string[]>. Resolves to [] on any failure.
  function listResFiles() {
    return new Promise(function (resolve) {
      // Electron: use fs from preload
      try {
        if (window.fs && window.os && typeof window.fs.readdirSync === 'function') {
          var dir = window.os.homedir() + '/clessapp/res';
          var files = window.fs.readdirSync(dir).filter(function (f) {
            // Filter out hidden files and directories (best-effort)
            return f && f.indexOf('.') !== 0;
          });
          return resolve(files.sort());
        }
      } catch (e) {
        console.warn('[OLM] fs.readdirSync failed:', e);
      }
      // Mobile / Capacitor: try Filesystem API if exposed
      try {
        var Capacitor = window.Capacitor;
        if (Capacitor && Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
          // Try a list of likely res paths
          var candidates = ['res', 'clessapp/res', 'media', 'Documents/clessapp/res'];
          var Filesystem = Capacitor.Plugins.Filesystem;
          var tried = 0, found = false;
          candidates.forEach(function (p) {
            Filesystem.readdir({ path: p, directory: 'DATA' }).then(function (r) {
              if (found) return;
              if (r && r.files && r.files.length) {
                found = true;
                var names = r.files.map(function (f) { return typeof f === 'string' ? f : (f && f.name); }).filter(Boolean);
                resolve(names.sort());
              }
            }).catch(function () {}).then(function () {
              tried++;
              if (tried === candidates.length && !found) resolve([]);
            });
          });
          return;
        }
      } catch (e) {
        console.warn('[OLM] Capacitor Filesystem listing failed:', e);
      }
      resolve([]);
    });
  }

  function openEditor(slotIndex) {
    var lyt = currentLayout();
    if (!lyt) return;
    var slots = getSlotsArray(lyt.raw);
    if (!slots || !slots[slotIndex]) return;

    var slot = slots[slotIndex];
    var attr = slot.attributes || {};
    var type = slot.name || 'slot';

    state.editing = { layoutId: lyt.id, slotIndex: slotIndex };

    els.modalTitle.textContent = 'Edit slot · ' + (attr.name || ('slot-' + (attr.id || slotIndex))) + ' (' + type + ')';

    var items = readSlotItems(slot);
    var allowMulti = supportsItems(slot);
    var isMedia = isMediaLikeSlot(slot);

    // Build modal body
    var datalistId = 'olm-res-files-' + Date.now();
    els.modalBody.innerHTML =
      '<div class="olm-tabs">' +
        '<button class="olm-tab active" data-tab="items">Items</button>' +
        '<button class="olm-tab" data-tab="json">Advanced (JSON)</button>' +
      '</div>' +
      '<div class="olm-tab-panel active" data-panel="items">' +
        '<div class="olm-items-toolbar">' +
          '<div class="hint">' +
            (allowMulti
              ? 'Reorder items by dragging the <strong>&#x2630;</strong> handle. ' +
                (isMedia ? 'Filename is taken from your local <code>~/clessapp/res</code> cache — pick from the dropdown or type manually.' : 'Edit the text and per-item duration as needed.')
              : 'This slot supports a single content item.') +
          '</div>' +
        '</div>' +
        '<div class="olm-item-cards" id="olm-item-cards"></div>' +
        (allowMulti ? '<button class="olm-btn ghost olm-add-item-btn" id="olm-add-item">+ Add Item</button>' : '') +
      '</div>' +
      '<div class="olm-tab-panel" data-panel="json">' +
        '<div class="olm-field">' +
          '<label>Slot JSON</label>' +
          '<textarea class="json" id="olm-json-editor" spellcheck="false">' + escapeHtml(JSON.stringify(slot, null, 2)) + '</textarea>' +
          '<div class="hint">Direct edit the slot JSON (parsed XML form). Invalid JSON will be rejected on save.</div>' +
        '</div>' +
      '</div>' +
      '<datalist id="' + datalistId + '"></datalist>';

    // Tab switching
    Array.prototype.forEach.call(els.modalBody.querySelectorAll('.olm-tab'), function (tab) {
      tab.addEventListener('click', function () {
        Array.prototype.forEach.call(els.modalBody.querySelectorAll('.olm-tab'), function (t) { t.classList.remove('active'); });
        Array.prototype.forEach.call(els.modalBody.querySelectorAll('.olm-tab-panel'), function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var name = tab.getAttribute('data-tab');
        var panel = els.modalBody.querySelector('.olm-tab-panel[data-panel="' + name + '"]');
        if (panel) panel.classList.add('active');
      });
    });

    var cardsContainer = document.getElementById('olm-item-cards');

    // Render existing items
    if (!items.length) {
      cardsContainer.innerHTML = '<div class="hint" style="padding:14px;">No items yet. Click <strong>+ Add Item</strong> to create one.</div>';
    } else {
      items.forEach(function (it, idx) {
        cardsContainer.appendChild(buildItemCard(it, idx, { isMedia: isMedia, datalistId: datalistId }));
      });
    }

    // Add item button
    var addBtn = document.getElementById('olm-add-item');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var hint = cardsContainer.querySelector('.hint');
        if (hint) hint.remove();
        var blank = { raw: null, tag: inferItemTagName(slot), content: '', duration: isMedia ? 10 : 5, attributes: {} };
        var newIdx = cardsContainer.querySelectorAll('.olm-item-card').length;
        var card = buildItemCard(blank, newIdx, { isMedia: isMedia, datalistId: datalistId });
        cardsContainer.appendChild(card);
        // Renumber + focus first input
        reindexCards(cardsContainer);
        var firstInput = card.querySelector('.olm-item-content');
        if (firstInput) firstInput.focus();
      });
    }

    // Populate res file picker asynchronously (only useful for media-like slots)
    if (isMedia) {
      var datalist = document.getElementById(datalistId);
      listResFiles().then(function (files) {
        if (!datalist) return;
        datalist.innerHTML = files.map(function (f) {
          return '<option value="' + escapeAttr(f) + '"></option>';
        }).join('');
        // Update hint count
        var summary = els.modalBody.querySelector('.olm-items-toolbar .hint');
        if (summary && files.length) {
          summary.innerHTML += ' <em>(' + files.length + ' file(s) available in res cache.)</em>';
        }
      });
    }

    // Show modal with footer buttons
    var foot = els.modal.querySelector('.olm-modal-foot');
    foot.innerHTML =
      '<button class="olm-btn ghost" id="olm-cancel">Cancel</button>' +
      '<button class="olm-btn success" id="olm-save">Save Changes</button>';
    document.getElementById('olm-cancel').addEventListener('click', closeModal);
    document.getElementById('olm-save').addEventListener('click', saveEditor);

    els.modal.classList.add('show');
  }

  function buildItemCard(item, index, opts) {
    opts = opts || {};
    var card = document.createElement('div');
    card.className = 'olm-item-card';
    card.draggable = true;
    card.dataset.itemIndex = index;

    var isMedia = !!opts.isMedia;
    var datalistAttr = opts.datalistId ? (' list="' + opts.datalistId + '"') : '';
    var contentPlaceholder = isMedia ? 'folder/file.ext or external URL' : 'Text content';

    card.innerHTML =
      '<div class="olm-item-handle" title="Drag to reorder">&#x2630;</div>' +
      '<div class="olm-item-order">' + (index + 1) + '</div>' +
      '<div class="olm-item-fields">' +
        '<div class="olm-field-inline">' +
          '<label>' + (isMedia ? 'Filename / URL' : 'Content') + '</label>' +
          (isMedia
            ? '<input type="text" class="olm-item-content"' + datalistAttr + ' placeholder="' + contentPlaceholder + '" value="' + escapeAttr(item.content || '') + '" />'
            : '<textarea class="olm-item-content" rows="2" placeholder="' + contentPlaceholder + '">' + escapeHtml(item.content || '') + '</textarea>') +
        '</div>' +
        '<div class="olm-field-inline duration">' +
          '<label>Duration (s)</label>' +
          '<input type="number" min="0" step="1" class="olm-item-duration" placeholder="—" value="' + (item.duration == null ? '' : escapeAttr(item.duration)) + '" />' +
        '</div>' +
      '</div>' +
      '<button class="olm-item-remove" title="Remove item" aria-label="Remove item">&times;</button>';

    // Stash the original raw element on the card via a Map (so we can preserve unknown attrs)
    card._rawItem = item.raw || null;
    card._itemTag = item.tag || null;
    card._itemAttrs = item.attributes || {};

    // Bind remove
    card.querySelector('.olm-item-remove').addEventListener('click', function () {
      var container = card.parentNode;
      card.remove();
      if (container) reindexCards(container);
    });

    // Drag handlers
    card.addEventListener('dragstart', function (e) {
      card.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); } catch (_) {}
    });
    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      Array.prototype.forEach.call(document.querySelectorAll('.olm-item-card.drag-over'), function (c) { c.classList.remove('drag-over'); });
      var container = card.parentNode;
      if (container) reindexCards(container);
    });
    card.addEventListener('dragover', function (e) {
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
      var dragging = document.querySelector('.olm-item-card.dragging');
      if (!dragging || dragging === card) return;
      var bounding = card.getBoundingClientRect();
      var offset = e.clientY - bounding.top;
      if (offset < bounding.height / 2) {
        card.parentNode.insertBefore(dragging, card);
      } else {
        card.parentNode.insertBefore(dragging, card.nextSibling);
      }
    });

    return card;
  }

  function reindexCards(container) {
    var cards = container.querySelectorAll('.olm-item-card');
    Array.prototype.forEach.call(cards, function (card, idx) {
      card.dataset.itemIndex = idx;
      var orderEl = card.querySelector('.olm-item-order');
      if (orderEl) orderEl.textContent = String(idx + 1);
    });
  }

  function closeModal() {
    els.modal.classList.remove('show');
    state.editing = null;
  }

  function saveEditor() {
    if (!state.editing) return;
    var lyt = state.layouts.filter(function (l) { return l.id === state.editing.layoutId; })[0];
    if (!lyt) return;
    var slots = getSlotsArray(lyt.raw);
    if (!slots) return;
    var slot = slots[state.editing.slotIndex];
    if (!slot) return;

    var activePanel = els.modalBody.querySelector('.olm-tab-panel.active');
    var panelName = activePanel ? activePanel.getAttribute('data-panel') : 'items';

    if (panelName === 'json') {
      var raw = document.getElementById('olm-json-editor').value;
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        toast('Invalid JSON: ' + e.message, 'error');
        return;
      }
      slots[state.editing.slotIndex] = parsed;
    } else {
      // Items panel: read all cards in current DOM order
      var cards = els.modalBody.querySelectorAll('.olm-item-card');
      var newItems = Array.prototype.map.call(cards, function (card) {
        var contentEl = card.querySelector('.olm-item-content');
        var durEl = card.querySelector('.olm-item-duration');
        var durStr = durEl ? durEl.value : '';
        var dur = durStr === '' ? null : parseFloat(durStr);
        return {
          raw: card._rawItem || null,
          tag: card._itemTag || null,
          attributes: card._itemAttrs || {},
          content: contentEl ? contentEl.value : '',
          duration: dur
        };
      });
      rebuildSlotElements(slot, newItems);
    }

    persistLayout(lyt);
    toast('Slot saved.', 'success');
    closeModal();
    renderSlots();
  }

  // ============================================================
  // Persistence
  // ============================================================
  function persistLayout(lyt) {
    try {
      var serialized = JSON.stringify(lyt.raw);
      localStorage.setItem('layout-offline-' + lyt.id, serialized);
      localStorage.setItem('layout-' + lyt.id, serialized);
      lyt.hasOffline = true;
      lyt.hasLive = true;
      // Refresh meta
      var meta = extractLayoutMeta(lyt.raw);
      lyt.name = meta.name || lyt.name;
      lyt.slotCount = meta.slotCount;
      renderLayouts();
    } catch (e) {
      console.error('[OLM] Failed to persist layout', lyt.id, e);
      toast('Failed to save: ' + e.message, 'error');
    }
  }

  // ============================================================
  // Navigation actions
  // ============================================================
  function goBackToPlayer() {
    location.href = 'index.html';
  }

  function reloadPlayer() {
    if (isElectron && ipcRenderer) {
      try {
        ipcRenderer.send('app-refresh');
        toast('Reload signal sent to player.', 'success');
        setTimeout(goBackToPlayer, 600);
        return;
      } catch (e) { console.warn('[OLM] ipc app-refresh failed:', e); }
    }
    // Fallback: just go to index
    goBackToPlayer();
  }

  // ============================================================
  // Helpers
  // ============================================================
  function currentLayout() {
    if (!state.activeLayoutId) return null;
    return state.layouts.filter(function (l) { return l.id === state.activeLayoutId; })[0] || null;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  var toastTimer = null;
  function toast(message, kind) {
    var existing = document.querySelector('.olm-toast');
    if (existing) existing.remove();
    var node = document.createElement('div');
    node.className = 'olm-toast ' + (kind || '');
    node.textContent = message;
    document.body.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove('show');
      setTimeout(function () { node.remove(); }, 250);
    }, 2600);
  }
})();
