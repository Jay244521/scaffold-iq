// Loads recent commercial permits from the City of Fort Worth's open data
// FeatureServer. The service's field names aren't documented in one place, so
// the layer schema is read first and the query is built from the fields found.

export const SERVICE_URL =
  'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer';

const RESULT_COUNT = 20;

const FIELD_PATTERNS = {
  permitNum: [/^permit_?(no|num|number)$/i, /^(record_?id|b1_alt_id)$/i, /permit.*(no|num)/i],
  type: [/^permit_?type$/i, /^(record_?)?type$/i],
  subtype: [/^permit_?sub_?type$/i, /sub_?type/i],
  address: [/^(full_|original_|street_|site_)?address$/i, /address/i, /addr/i],
  description: [/^(work_?)?desc(ription)?$/i, /desc/i],
  value: [/^(declared|job|project|construction)_?val(ue|uation)?$/i, /valuation/i, /value/i],
  contractor: [/^contractor(_?(full_)?name)?$/i, /contractor/i],
  applicant: [/^applicant(_?(full_)?name)?$/i, /applicant/i, /owner_?full_?name/i, /owner/i],
};

const DATE_PATTERNS = [/^file_?date$/i, /issue\w*_?date/i, /appl\w*_?date/i, /open\w*_?date/i, /status_?date/i];

function matchField(fields, patterns, allowedTypes) {
  const candidates = allowedTypes ? fields.filter((f) => allowedTypes.includes(f.type)) : fields;
  for (const pattern of patterns) {
    const found = candidates.find((f) => pattern.test(f.name)) || candidates.find((f) => pattern.test(f.alias || ''));
    if (found) return found.name;
  }
  return null;
}

async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const data = await response.json();
  // ArcGIS reports errors with HTTP 200 and an `error` object.
  if (data.error) {
    const details = Array.isArray(data.error.details) ? data.error.details.filter(Boolean).join(' ') : '';
    throw new Error(`Permit service error: ${data.error.message || 'unknown'}${details && details !== data.error.message ? ` (${details})` : ''}`);
  }
  return data;
}

export function resolveFields(fields) {
  const textFields = ['esriFieldTypeString'];
  const numberFields = ['esriFieldTypeDouble', 'esriFieldTypeInteger', 'esriFieldTypeSmallInteger', 'esriFieldTypeSingle', 'esriFieldTypeString'];
  return {
    permitNum: matchField(fields, FIELD_PATTERNS.permitNum),
    type: matchField(fields, FIELD_PATTERNS.type, textFields),
    subtype: matchField(fields, FIELD_PATTERNS.subtype, textFields),
    address: matchField(fields, FIELD_PATTERNS.address, textFields),
    description: matchField(fields, FIELD_PATTERNS.description, textFields),
    value: matchField(fields, FIELD_PATTERNS.value, numberFields),
    contractor: matchField(fields, FIELD_PATTERNS.contractor, textFields),
    applicant: matchField(fields, FIELD_PATTERNS.applicant, textFields),
    date:
      matchField(fields, DATE_PATTERNS, ['esriFieldTypeDate', 'esriFieldTypeDateOnly']) ||
      (fields.find((f) => f.type === 'esriFieldTypeDate') || {}).name ||
      null,
  };
}

export function buildWhere(resolved) {
  const clauses = [resolved.type, resolved.subtype]
    .filter(Boolean)
    .map((name) => `UPPER(${name}) LIKE '%COMMERCIAL%'`);
  return clauses.length ? `(${clauses.join(' OR ')})` : '1=1';
}

export async function fetchCommercialPermits(signal) {
  const service = await getJson(`${SERVICE_URL}?f=json`, signal);
  const sources = [...(service.tables || []), ...(service.layers || [])];
  if (sources.length === 0) {
    throw new Error('The permit service has no layers or tables.');
  }
  const source = sources.find((s) => /permit/i.test(s.name || '')) || sources[0];
  const layerUrl = `${SERVICE_URL}/${source.id}`;

  const layer = await getJson(`${layerUrl}?f=json`, signal);
  const resolved = resolveFields(layer.fields || []);

  const params = new URLSearchParams({
    where: buildWhere(resolved),
    outFields: '*',
    returnGeometry: 'false',
    resultRecordCount: String(RESULT_COUNT),
    f: 'json',
  });
  if (resolved.date) params.set('orderByFields', `${resolved.date} DESC`);

  const data = await getJson(`${layerUrl}/query?${params}`, signal);
  const features = Array.isArray(data.features) ? data.features : [];
  return { features: features.map((f) => f.attributes || {}), fields: resolved };
}
