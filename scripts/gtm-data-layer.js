import { getMetadata } from './aem.js';

/**
 * Get the page type from the metadata by looking at the page-type, template, or page-name in that
 * order.
 * @returns {string|string} The page type or an empty string if not found.
 */
function getPageType() {
  const p = getMetadata('page-type');
  const t = getMetadata('template');
  const n = getMetadata('page-name');
  const w = (window.location.pathname === '/') ? 'Home' : '';

  return p || t || n || w;
}

const dataLayer = {
  pageType: getPageType().toLowerCase() || '',
  city: getMetadata('city').toLowerCase() || '',
  state: getMetadata('state').toLowerCase() || '',
  region: getMetadata('region').toLowerCase() || '',
  community: getMetadata('community').toLowerCase() || '',
  model: getMetadata('model').toLowerCase() || '',
  spec: getMetadata('spec').toLowerCase() || '',
};

window.dataLayer = dataLayer;

export default async function setupDataLayer() {
  const scriptEl = document.createElement('script');
  const data = JSON.stringify(dataLayer, null, 2).replace(/"/g, "'");
  scriptEl.innerHTML = `dataLayer = [${data}];`;
  document.querySelector('head').appendChild(scriptEl);
}
