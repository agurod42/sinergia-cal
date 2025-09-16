const AUTH_TOKEN = 'Bearer 9108b9e0-dff1-41c2-8091-8ab1544c6ccb';
const BASE_URL = 'https://api-agenda.sinergialife.uy';

const DEFAULT_HEADERS = {
  'Authorization': AUTH_TOKEN,
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://agenda.sinergialife.uy',
  'Referer': 'https://agenda.sinergialife.uy/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
};

// Simple in-memory cache for external API calls
const cacheStore = new Map(); // key -> { data, expiresAt }

function getCache(key) {
  const entry = cacheStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache(key, data, ttlMs) {
  cacheStore.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export async function fetchJSON(url, { useCache = true, ttlMs = 5 * 60 * 1000 } = {}) {
  const cacheKey = url;
  if (useCache) {
    const cached = getCache(cacheKey);
    if (cached !== undefined) {
      console.log('[sinergia][cache] HIT', { url });
      return cached;
    }
    console.log('[sinergia][cache] MISS', { url });
  }
  const start = Date.now();
  const response = await fetch(url, { method: 'GET', headers: DEFAULT_HEADERS });
  const ms = Date.now() - start;
  if (!response.ok) {
    console.error('[sinergia][fetch][error]', { url, status: response.status, ms });
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  const json = await response.json();
  console.log('[sinergia][fetch]', { url, status: response.status, ms });
  if (useCache) setCache(cacheKey, json, ttlMs);
  return json;
}

export async function getAllActivityTypes(options, companyIdFilter) {
  const url = `${BASE_URL}/nooauthactivity/get/?type=cat`;
  const json = await fetchJSON(url, options);
  const list = Array.isArray(json?.description) ? json.description : [];
  const active = list.filter(item => item?.status === 'ACTIVE');
  const companyIdNum = companyIdFilter != null ? Number(companyIdFilter) : undefined;
  const filtered = companyIdNum != null ? active.filter(item => Number(item?.companyId) === companyIdNum) : active;
  console.log('[sinergia][types]', { total: list.length, active: active.length, companyId: companyIdNum, filtered: filtered.length });
  return filtered;
}

export async function getActivitySchedule(activityId, companyId, options) {
  const url = `${BASE_URL}/nooauthactivity/?type=act&id=${encodeURIComponent(activityId)}&cId=${encodeURIComponent(companyId)}`;
  const json = await fetchJSON(url, options);
  const days = json?.description ? Object.keys(json.description).length : 0;
  console.log('[sinergia][schedule]', { activityId, companyId, days });
  return json?.description || {};
}

export function mergeSchedules(scheduleMaps) {
  const merged = {};
  for (const schedule of scheduleMaps) {
    if (!schedule || typeof schedule !== 'object') continue;
    for (const [dayName, events] of Object.entries(schedule)) {
      if (!Array.isArray(events) || events.length === 0) continue;
      if (!merged[dayName]) merged[dayName] = [];
      merged[dayName].push(...events);
    }
  }
  console.log('[sinergia][merge]', { schedules: scheduleMaps.length, days: Object.keys(merged).length });
  return merged;
}
