// Simulated "AI" trade analysis. Classifies a permit description with keyword
// rules, then flags trades the project probably needs but the scope doesn't name.

const PROJECT_TYPES = [
  {
    key: 'newConstruction',
    label: 'New construction',
    pattern: /\bnew (\S+ ){0,4}(building|construction|structure|facility|office|warehouse|store|hotel|church|school)s?\b|\b(construct|ground[- ]up|erect)/,
    needs: { electrical: 3, plumbing: 3, hvac: 3, concrete: 3 },
  },
  {
    key: 'shell',
    label: 'Shell building',
    pattern: /\b(shell|core and shell|warehouse|tilt[- ]?wall)\b/,
    needs: { electrical: 2, plumbing: 2, hvac: 1, concrete: 3 },
  },
  {
    key: 'addition',
    label: 'Addition / expansion',
    pattern: /\b(addition|expan(d|sion)|extend)\b/,
    needs: { electrical: 3, plumbing: 2, hvac: 3, concrete: 3 },
  },
  {
    key: 'restaurant',
    label: 'Food service build-out',
    pattern: /\b(restaurant|kitchen|cafe|bar|food|coffee|bakery|grill)\b/,
    needs: { electrical: 3, plumbing: 3, hvac: 3, concrete: 1 },
  },
  {
    key: 'medical',
    label: 'Medical / lab space',
    pattern: /\b(medical|clinic|dental|hospital|lab(oratory)?|surgery|veterinar)/,
    needs: { electrical: 3, plumbing: 3, hvac: 3, concrete: 1 },
  },
  {
    key: 'finishOut',
    label: 'Interior finish-out / remodel',
    pattern: /\b(finish[- ]?out|tenant|interior|remodel|renovat\w*|alteration|buildout|build[- ]out|improvement|upgrade)\b/,
    needs: { electrical: 3, plumbing: 2, hvac: 2, concrete: 1 },
  },
  {
    key: 'site',
    label: 'Site / paving work',
    pattern: /\b(parking|paving|pavement|slab|foundation|sidewalk|drive(way)?|canopy|pad)\b/,
    needs: { electrical: 2, plumbing: 1, hvac: 1, concrete: 3 },
  },
  {
    key: 'roof',
    label: 'Roofing / exterior',
    pattern: /\b(roof\w*|re-?roof|facade|exterior|siding|window)\b/,
    needs: { electrical: 1, plumbing: 1, hvac: 2, concrete: 1 },
  },
  {
    key: 'demolition',
    label: 'Demolition',
    pattern: /\b(demo(lition|lish)?)\b/,
    needs: { electrical: 1, plumbing: 1, hvac: 1, concrete: 2 },
  },
];

const TRADES = [
  {
    key: 'electrical',
    name: 'Electrical',
    pattern: /\b(electric\w*|wiring|panel|lighting|power|service upgrade|generator|ev charg\w*|solar)\b/,
    why: {
      3: 'New circuits, panels and lighting are almost always required at this scope.',
      2: 'Likely needs lighting, receptacles or service work.',
      1: 'Minor or no electrical work expected.',
    },
  },
  {
    key: 'plumbing',
    name: 'Plumbing',
    pattern: /\b(plumb\w*|restrooms?|bathrooms?|toilets?|sinks?|water heaters?|grease (trap|interceptor)s?|sewer|gas lines?|backflow|fixtures?)\b/,
    why: {
      3: 'Restrooms, water service and drain lines are expected for this occupancy.',
      2: 'Possible fixture relocation or new restroom work.',
      1: 'Little plumbing implied by the scope.',
    },
  },
  {
    key: 'hvac',
    name: 'HVAC',
    pattern: /\b(hvac|mechanical|a\/?c|air condition\w*|heating|ventilat\w*|duct\w*|rtu|rooftop unit|exhaust|hood|chiller|boiler)\b/,
    why: {
      3: 'Conditioned space at this scope needs new or rebalanced HVAC.',
      2: 'Ductwork or equipment changes are likely.',
      1: 'HVAC impact appears minimal.',
    },
  },
  {
    key: 'concrete',
    name: 'Concrete',
    pattern: /\b(concrete|slab|foundation|footing|pier|paving|flatwork|tilt[- ]?wall|curb|sidewalk)\b/,
    why: {
      3: 'Foundations, slabs or flatwork are required.',
      2: 'Some slab, pad or flatwork is probable.',
      1: 'Little structural concrete expected.',
    },
  },
];

const LIKELIHOOD = { 1: 'Low', 2: 'Medium', 3: 'High' };

export function analyzeNeeds(description, declaredValue = 0) {
  const text = String(description || '').toLowerCase();
  const matchedTypes = PROJECT_TYPES.filter((t) => t.pattern.test(text));

  // Combine the needs of every matched project type, keeping the highest score.
  // With no recognizable keywords, assume a generic commercial finish-out.
  const baseTypes = matchedTypes.length
    ? matchedTypes
    : [PROJECT_TYPES.find((t) => t.key === 'finishOut')];
  const needs = {};
  for (const trade of TRADES) {
    needs[trade.key] = Math.max(...baseTypes.map((t) => t.needs[trade.key]));
    // Large projects rarely skip a trade entirely.
    if (declaredValue >= 1_000_000) needs[trade.key] = Math.max(needs[trade.key], 2);
  }

  const trades = TRADES.map((trade) => {
    const score = needs[trade.key];
    const mentioned = trade.pattern.test(text);
    let status;
    if (mentioned) status = 'covered';
    else if (score >= 2) status = 'missing';
    else status = 'unlikely';
    return {
      key: trade.key,
      name: trade.name,
      likelihood: LIKELIHOOD[score],
      status,
      reason: mentioned ? 'Explicitly referenced in the permit scope.' : trade.why[score],
    };
  });

  const missing = trades.filter((t) => t.status === 'missing');
  const projectType = matchedTypes.length
    ? matchedTypes.map((t) => t.label).join(' · ')
    : 'General commercial work (scope unclear)';

  // Confidence is a display heuristic: richer descriptions read as more confident.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const confidence = Math.min(95, 55 + matchedTypes.length * 12 + Math.min(wordCount, 10) * 2);

  let summary;
  if (!text.trim()) {
    summary = 'No description was filed, so this read relies on typical commercial scopes.';
  } else if (missing.length === 0) {
    summary = 'The filed scope already references the major trades this project likely needs.';
  } else {
    summary = `${missing.length} major trade${missing.length > 1 ? 's' : ''} likely needed but not named in the scope: ${missing
      .map((t) => t.name)
      .join(', ')}.`;
  }

  return { projectType, confidence, summary, trades, missingCount: missing.length };
}
