// ------ Compact REST polling for engine mode -------------------------------------------------------------------------------------------------------------------------------
function updateEngineMode(mode) {
  engineMode = mode;
  const active = (engineMode === 'STANDBY' || engineMode === 'FAULT');
  updateSequenceSaveControls();
  if (!active) {
    setSaveStatus(`Warning: Engine is ${engineMode} - STANDBY or FAULT is required to save`);
  } else {
    const status = document.getElementById('save-status');
    if (status && /Engine is .*required to save/.test(status.textContent)) {
      setSaveStatus(_seqDirty ? 'Unsaved changes — save to apply' : 'No unsaved changes');
    }
  }
}

async function refreshEngineStatus() {
  if (seqStatusInFlight) return;
  seqStatusInFlight = true;
  try {
    const r = await fetch('/api/telemetry', { cache: 'no-store' });
    if (!r.ok) { setSeqConnectionState(false, 'Disconnected'); return; }
    const d = await r.json();
    setSeqConnectionState(true, 'Connected');
    if (d.mode !== undefined) updateEngineMode(d.mode);
    if (d.seq_issues !== undefined) _applySeqValidation(d);
  } catch (_) { setSeqConnectionState(false, 'Disconnected'); }
  finally { seqStatusInFlight = false; }
}

let statusPollTimer = null;
let seqStatusInFlight = false;
window.OTWaitForPageTelemetryIdle = (timeoutMs = 1500) => new Promise(resolve => {
  const started = Date.now();
  const poll = () => {
    if (!seqStatusInFlight) resolve(true);
    else if (Date.now() - started >= timeoutMs) resolve(false);
    else setTimeout(poll, 25);
  };
  poll();
});
function setSeqConnectionState(ok, text) {
  const dot = document.getElementById('conn');
  const lbl = document.getElementById('conn-label');
  if (dot) dot.className = 'conn-dot ' + (ok ? 'connected' : 'disconnected');
  if (lbl) lbl.textContent = text || (ok ? 'Connected' : 'Disconnected');
}
function startStatusPoll() {
  if (statusPollTimer) return;
  refreshEngineStatus();
  statusPollTimer = setInterval(refreshEngineStatus, 2000);
}
function stopStatusPoll() {
  if (!statusPollTimer) return;
  clearInterval(statusPollTimer);
  statusPollTimer = null;
}

function startSequenceTelemetryForPlatform() {
  startStatusPoll();
}
function stopSequenceTelemetry() {
  stopStatusPoll();
}
function prepareSequenceTelemetryNavigation() {
  stopStatusPoll();
}
window.addEventListener('pagehide', stopSequenceTelemetry);
window.addEventListener('beforeunload', stopSequenceTelemetry);
window.addEventListener('ot:navigation-prepare', prepareSequenceTelemetryNavigation);
window.addEventListener('ot:navigation-start', stopSequenceTelemetry);
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  startSequenceTelemetryForPlatform();
});
// ------ Sequence validation banner ---------------------------------------------------------------------------------------------------------------------------------------
function sequenceIssueDestination(issue) {
  const fields = {
    'P1 Hard Trip':'sf_p1t', 'P2 Hard Trip':'sf_p2t', 'Torque Hard Trip':'sf_tqt',
    'P1 Pullback':'pb_p1e', 'P2 Pullback':'pb_p2e', 'Torque Pullback':'pb_tqe',
    'N2 Pullback':'pb_n2e', 'N2 Overspeed':'n2_rpm_limit', Overspeed:'rpm_limit',
    Overtemp:'eg_src', DynamicIdle:'di_src',
    AutoRelight:'rl_en', 'Windmill Oil':'so_en', 'Oil Safety':'oil_rm',
    'Oil Temp':'sf_ot', 'Fuel Pressure':'sf_fp', Battery:'sf_bv',
    'Hot Start':'sf_hs', Flameout:'sf_fs', Surge:'sf_sg'
  };
  if (/no .*sensor|no .*input|not configured in Hardware|no compatible fitted|selected output.*missing/i.test(issue.msg || '') &&
      !/Hard Trip$/.test(issue.block || '')) return '/hardware.html';
  if (fields[issue.block]) return '/controllers.html#cf-' + fields[issue.block];
  if (['Governor','N2 Governor','N2 speed control'].includes(issue.block)) return '/controllers.html#controller-overview';
  if (issue.block === 'N2 Cluster Warning') return '/system.html#cf-cl_n2';
  if (['startup','shutdown'].includes(issue.block)) return '#tab-' + issue.block;
  if (issue.block === 'AB Trigger' || issue.block === 'Oil Sensor') return '/hardware.html#hardware-inputs-panel';
  if (['Afterburner','AB Pump','Starter'].includes(issue.block)) return '/hardware.html#hardware-outputs-panel';
  // Device assignments and safety switches live in Hardware. Unknown issues
  // still have a useful destination rather than a guessed settings field.
  if (!BLOCKS[issue.block]) return '/hardware.html';
  const tab = AFTERBURNER_BLOCKS.includes(issue.block) || AB_SHUT_BLOCKS.includes(issue.block)
    ? 'afterburner' : SHUTDOWN_BLOCKS.includes(issue.block) ? 'shutdown' : 'startup';
  return '#tab-' + tab;
}

function _applySeqValidation(d) {
  const issues   = d.seq_issues   || [];
  const hasErr   = d.seq_has_errors || false;
  const banner   = document.getElementById('seq-validation-banner');
  if (!banner) return;

  if (issues.length === 0) { banner.innerHTML = ''; return; }

  let html = '';
  if (hasErr) {
    html += `<a class="seq-val-start-blocked" data-ot-warning-link href="${sequenceIssueDestination(issues.find(issue => issue.error) || issues[0])}">` +
      `&#9888; START is blocked - one or more sequence errors must be resolved. ` +
      `Select a warning below to review the relevant configuration.` +
      `</a>`;
  }
  for (const iss of issues) {
    const cls  = iss.error ? 'seq-val-error' : 'seq-val-warn';
    const icon = iss.error ? '&#10060;' : '&#9888;';
    const issueLabels = {
      AutoRelight:'Automatic Relight', Flameout:'Flameout Protection', Overtemp:'Overtemperature Protection',
      OilSafety:'Oil Protection', Battery:'Battery / Bus Protection', Governor:'Power-Turbine Governor',
      DynamicIdle:'Automatic Idle Control'
    };
    const friendlyBlock = BLOCKS[iss.block]?.label || issueLabels[iss.block] || iss.block || 'Sequence';
    const block = String(friendlyBlock).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const tripSensor = {'P1 Hard Trip':'P1', 'P2 Hard Trip':'P2', 'Torque Hard Trip':'torque'}[iss.block];
    const guidance = tripSensor && /without.*sensor/i.test(iss.msg || '')
      ? ` Assign the intended ${tripSensor} sensor in Hardware, or set this shutdown limit to 0 if that measurement is not used.` : '';
    const msg = String((iss.msg || '') + guidance).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    html += `<a class="${cls}" data-ot-warning-link href="${sequenceIssueDestination(iss)}">` +
      `<span class="seq-val-icon">${icon}</span>` +
      `<span class="seq-val-text"><span class="seq-val-block">${block}:</span>${msg}<span class="seq-val-action">Review configuration &rarr;</span></span>` +
      `</a>`;
  }
  banner.innerHTML = html;
}

// ------ Init ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  startSequenceTelemetryForPlatform();
}, { once:true });
