function pickField(data, keys) {
  if (!data || typeof data !== 'object') return null;
  for (const key of keys) {
    if (data[key] != null && data[key] !== '') {
      return String(data[key]);
    }
  }
  return null;
}

function haystack(checks, state) {
  const parts = [state];
  for (const check of Object.values(checks)) {
    if (check?.data != null) {
      parts.push(typeof check.data === 'object' ? JSON.stringify(check.data) : String(check.data));
    }
  }
  return parts.join(' ').toLowerCase();
}

const NO_SIM_PATTERNS = [
  'sim_not',
  'no sim',
  'nosim',
  'sim absent',
  'sim_destroy',
  'sim_not_ready',
  'sim_not_insert',
  'sim not insert',
  'sim card absent',
  'sim failure',
  'sim invalid',
  'sim error',
  'no sim card',
  'simcard absent',
  'modem_sim_not',
  'sim undetected',
];

const NO_NETWORK_PATTERNS = [
  'no service',
  'limited service',
  'not registered',
  'searching',
  'denied',
  'unavailable',
];

export function evaluateModemOperational(checks, state) {
  const text = haystack(checks, state);

  for (const pattern of NO_SIM_PATTERNS) {
    if (text.includes(pattern)) {
      return {
        operational: false,
        simReady: false,
        issue: 'SIM kartica nije umetnuta ili nije spremna',
      };
    }
  }

  const simStatus = pickField(checks.sim_status?.data, [
    'sim_status',
    'SIMStatus',
    'simStatus',
    'SIMstatus',
  ]);

  if (simStatus) {
    const simLower = simStatus.toLowerCase();
    const simOk = ['ready', 'valid', 'ok', 'present', 'inserted', '1'].some((s) => simLower.includes(s));
    const simBad = ['absent', 'not', 'error', 'fail', 'destroy', '255', '0', '-1'].some((s) =>
      simLower.includes(s)
    );

    if (simBad && !simOk) {
      return {
        operational: false,
        simReady: false,
        issue: `SIM status: ${simStatus}`,
      };
    }

    if (simOk) {
      // continue to network check
    }
  }

  const networkType = pickField(checks.network_type?.data, [
    'network_type',
    'NetworkType',
    'networkType',
    'network_type_str',
  ]);

  if (networkType) {
    const netLower = networkType.toLowerCase();
    if (NO_NETWORK_PATTERNS.some((p) => netLower.includes(p)) || networkType === '0') {
      return {
        operational: false,
        simReady: simStatus != null,
        issue: `Nema mreže: ${networkType}`,
      };
    }
  }

  const pppStatus = pickField(checks.ppp_status?.data, ['ppp_status', 'PPPStatus', 'connectStatus']);
  if (pppStatus && ['disconnected', 'disconnect', '0'].includes(pppStatus.toLowerCase())) {
    // PPP disconnected alone isn't fatal if modem responds, but flag if no network too
    if (!networkType || networkType === '0') {
      return {
        operational: false,
        simReady: null,
        issue: 'Modem nije povezan na mrežu',
      };
    }
  }

  return {
    operational: true,
    simReady: true,
    issue: null,
  };
}
