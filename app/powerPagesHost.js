/**
 * Power Pages host postMessage bridge for Chat Widget Studio.
 *
 * Protocol (all messages: { type: "cws:*", source, ts, ... }):
 *   Outgoing -> window.parent:
 *     cws:ready           (sent once on app boot)
 *     cws:request-current (sent when SE clicks "Pull from Power Pages")
 *     cws:export-embed    (sent when SE clicks "Export to Power Pages")
 *   Incoming from host  (data.source === "power-pages-host"):
 *     cws:host-ready, cws:load-embed, cws:export-ack
 *
 * In standalone mode (i.e. not loaded in an iframe) this module is a safe
 * no-op: no listeners are attached, no messages are posted, and the public
 * API simply does nothing. That guarantees existing behaviour is preserved.
 */
(function () {
  'use strict';

  var VERSION = '3.2.0';
  var SOURCE  = 'chat-widget-studio';

  // Are we framed? Treat any access error as "yes" to be safe.
  var inFrame = false;
  try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }

  var hostReadyCbs   = [];
  var loadEmbedCbs   = [];
  var exportAckCbs   = [];
  var hostReadyFired = false;
  var lastHostReady  = null;

  function safeCall(cb, a, b) {
    try { cb(a, b); } catch (err) {
      console.warn('[PowerPagesHost] handler threw:', err && err.message);
    }
  }

  function post(msg) {
    if (!inFrame) return;
    try {
      // targetOrigin "*" per spec; the host validates by message type.
      window.parent.postMessage(msg, '*');
    } catch (e) {
      console.warn('[PowerPagesHost] postMessage failed:', e && e.message);
    }
  }

  function onMessage(ev) {
    var data = ev && ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.source !== 'power-pages-host') return;
    switch (data.type) {
      case 'cws:host-ready':
        hostReadyFired = true;
        lastHostReady  = data;
        hostReadyCbs.forEach(function (cb) { safeCall(cb, data); });
        break;
      case 'cws:load-embed':
        loadEmbedCbs.forEach(function (cb) { safeCall(cb, data.code, data); });
        break;
      case 'cws:export-ack':
        exportAckCbs.forEach(function (cb) { safeCall(cb, data); });
        break;
    }
  }

  if (inFrame) {
    window.addEventListener('message', onMessage, false);
  }

  // ---- Public API ----------------------------------------------------------

  function onHostReady(cb) {
    if (typeof cb !== 'function') return;
    hostReadyCbs.push(cb);
    // Fire immediately if host already announced itself.
    if (hostReadyFired) safeCall(cb, lastHostReady);
  }

  function onLoadEmbed(cb) {
    if (typeof cb !== 'function') return;
    loadEmbedCbs.push(cb);
  }

  function onExportAck(cb) {
    if (typeof cb !== 'function') return;
    exportAckCbs.push(cb);
  }

  function sendReady() {
    post({
      type:    'cws:ready',
      source:  SOURCE,
      version: VERSION,
      ts:      Date.now()
    });
  }

  function requestCurrent() {
    post({
      type:   'cws:request-current',
      source: SOURCE,
      ts:     Date.now()
    });
  }

  function exportEmbed(opts) {
    opts = opts || {};
    post({
      type:    'cws:export-embed',
      source:  SOURCE,
      version: VERSION,
      profile: opts.profile || null,
      code:    String(opts.code == null ? '' : opts.code),
      auto:    !!opts.auto,
      ts:      Date.now()
    });
  }

  window.PowerPagesHost = {
    inFrame:        inFrame,
    version:        VERSION,
    onHostReady:    onHostReady,
    onLoadEmbed:    onLoadEmbed,
    onExportAck:    onExportAck,
    sendReady:      sendReady,
    requestCurrent: requestCurrent,
    exportEmbed:    exportEmbed,
    isHostReady:    function () { return hostReadyFired; }
  };
})();
