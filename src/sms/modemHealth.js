function pickField(data, keys) {
  if (!data || typeof data !== 'object') return null;
  for (const key of keys) {
    if (data[key] != null && data[key] !== '') {
      return String(data[key]);
    }
  }
  return null;
}

function normalize(text) {
  return String(text).toLowerCase().replace(/_/g, ' ');
}

function haystack(checks, state) {
  const parts = [state];
  for (const check of Object.values(checks)) {
    if (check?.data != null) {
      parts.push(typeof check.data === 'object' ? JSON.stringify(check.data) : String(check.data));
    }
  }
  return normalize(parts.join(' '));
}

const NO_SIM_PATTERNS = [
  'sim undetected',
  'sim not',
  'no sim',
  'nosim',
  'sim absent',
  'sim destroy',
  'sim not ready',
  'sim not insert',
  'sim card absent',
  'sim failure',
  'sim invalid',
  'sim error',
  'no sim card',
  'simcard absent',
  'modem sim not',
];

const BAD_NETWORK_PATTERNS = [
  'limited service',
  'limited',
  'no service',
  'not registered',
  'searching',
  'denied',
  'unavailable',
  'none',
];

export function evaluateModemOperational(checks, state) {
  const text = haystack(checks, state);
  const stateNorm = normalize(state);

  for (const pattern of NO_SIM_PATTERNS) {
    if (text.includes(pattern) || stateNorm.includes(pattern)) {
      return {
        operational: false,
        simReady: false,
        issue: 'SIM kartica nije umetnuta ili nije detektovana',
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
    const simLower = normalize(simStatus);
    const simOk = ['ready', 'valid', 'ok', 'present', 'inserted'].some((s) => simLower.includes(s));
    const simBad = ['absent', 'not', 'error', 'fail', 'destroy', 'undetected'].some((s) =>
      simLower.includes(s)
    );

    if (simBad && !simOk) {
      return {
        operational: false,
        simReady: false,
        issue: `SIM status: ${simStatus}`,
      };
    }
  }

  const networkType = pickField(checks.network_type?.data, [
    'network_type',
    'NetworkType',
    'networkType',
    'network_type_str',
  ]);

  if (networkType) {
    const netLower = normalize(networkType);
    if (BAD_NETWORK_PATTERNS.some((p) => netLower.includes(p)) || networkType === '0') {
      return {
        operational: false,
        simReady: false,
        issue: `Nema punu mrežnu registraciju: ${networkType}`,
      };
    }
  } else {
    return {
      operational: false,
      simReady: false,
      issue: 'Mreža nije registrovana',
    };
  }

  const pppStatus = pickField(checks.ppp_status?.data, ['ppp_status', 'PPPStatus', 'connectStatus']);
  if (pppStatus && normalize(pppStatus).includes('disconnect')) {
    return {
      operational: false,
      simReady: false,
      issue: `PPP nije povezan: ${pppStatus}`,
    };
  }

  const goodStates = ['modem data connected', 'modem ready', 'connected'];
  const hasGoodState = goodStates.some((s) => stateNorm.includes(s));
  if (!hasGoodState && stateNorm.includes('modem')) {
    return {
      operational: false,
      simReady: false,
      issue: `Modem nije spreman: ${state}`,
    };
  }

  return {
    operational: true,
    simReady: true,
    issue: null,
  };
}
