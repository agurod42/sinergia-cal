import { getAllActivityTypes } from './sinergiaApi.js';

export default async function handler(req, res) {
  try {
    const urlSearchParams = new URLSearchParams(req?.query || {});
    const noCache = urlSearchParams.get('nocache') === '1';
    const cacheMinutes = Number(urlSearchParams.get('cacheMinutes'));
    const ttlMs = Number.isFinite(cacheMinutes) && cacheMinutes > 0 ? cacheMinutes * 60 * 1000 : 5 * 60 * 1000;

    const defaultCompany = process.env.COMPANY_ID_DEFAULT || '5';
    const companyId = urlSearchParams.get('cId') || defaultCompany;

    const types = await getAllActivityTypes({ useCache: !noCache, ttlMs }, companyId);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json({ types, companyId });
  } catch (error) {
    console.error('Error fetching activity types:', error);
    res.status(500).json({ error: 'Failed to fetch activity types' });
  }
}
