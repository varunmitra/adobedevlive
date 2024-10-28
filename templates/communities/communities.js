import {
  buildBlock, decorateBlock, getMetadata, loadBlock,
} from '../../scripts/aem.js';
import {
  a,
  aside,
  br, dd,
  div, dl, dt,
  form,
  h1,
  h2,
  h4,
  option, p,
  select, span, strong,
} from '../../scripts/dom-helpers.js';
import {
  getHeaderTitleForFilter,
  getInventoryHomesForCommunity,
} from '../../scripts/inventory.js';
import { getCommunityForUrl } from '../../scripts/communities.js';
import { getModelsByCommunity } from '../../scripts/models.js';
import { loadRates } from '../../scripts/mortgage.js';
import DeferredPromise from '../../scripts/deferred.js';
import formatPhoneNumber from '../../scripts/phone-formatter.js';
import loadSVG from '../../scripts/svg-helper.js';
import { loadWorkbook } from '../../scripts/workbook.js';
import { getPageTitleForUrl } from '../../scripts/pages.js';
import { safeAppend } from '../../scripts/block-helper.js';
import renderCards from '../blocks/cards/Card.js';
import { getSalesCenterForCommunity } from '../../scripts/sales-center.js';
import { filters } from '../../scripts/inventory-filters.js';

async function createSpecialists(specialists) {
  const agents = [];
  const deferred = DeferredPromise();
  const promises = [];

  specialists.forEach((specialist) => {
    const content = [];
    content.push(['name', specialist.name]);
    content.push(['phone', specialist.phone]);
    content.push(['photo', specialist.headshotImage]);
    content.push(['email', specialist.email]);

    const specialistsBlock = buildBlock('specialists', content);
    const blockWrapper = div(specialistsBlock);
    decorateBlock(specialistsBlock);
    promises.push(loadBlock(specialistsBlock, true));
    agents.push(blockWrapper);
  });

  Promise.all(promises)
    .then(() => deferred.resolve(agents));
  return deferred.promise;
}

async function createRightAside(doc, community, salesCenter) {
  const mainDiv = div({ class: 'sales-center-info' });
  const heading = h2(formatPhoneNumber(community.phone));

  mainDiv.append(heading);

  if (salesCenter.hours) {
    const hoursEl = div({ class: 'hours' }, ...salesCenter.hours.split('\n')
      .map((hour) => span(hour, br())));
    mainDiv.append(div({ class: 'sales-office-hours' }, strong('Regular Hours'), hoursEl));
  }

  if (salesCenter['sales-center-model'] || salesCenter.models) {
    const salesCenterModelInfo = div();
    if (salesCenter['sales-center-model']) {
      salesCenterModelInfo.append(
        div(span({ class: 'label' }, 'Sales Center: '), span(salesCenter['sales-center-model'])),
      );
    }

    if (salesCenter.models) {
      salesCenterModelInfo.append(
        div(span({ class: 'label' }, 'Model: '), span(salesCenter.models)),
      );
    }
    mainDiv.append(salesCenterModelInfo);
  }

  if (salesCenter.note) {
    mainDiv.append(p({ class: 'note' }, salesCenter.note));
  }

  if (salesCenter.specialists && salesCenter.specialists.length > 0) {
    const emailIcon = await loadSVG('/icons/email.svg');
    const phoneIcon = await loadSVG('/icons/phone.svg');
    const sEl = salesCenter.specialists.map((specialist) => {
      const emailEl = emailIcon.cloneNode(true);
      const phoneEl = phoneIcon.cloneNode(true);
      return dd(
        span({ class: 'specialist' }, specialist.name),
        a({ class: 'email', href: `mailto:${specialist.email}` }, specialist.email, emailEl),
        a({ class: 'phone', href: `tel:${specialist.phone}` }, formatPhoneNumber(specialist.phone), phoneEl),
      );
    });
    mainDiv.append(dl({ class: 'sales-center-data' }, dt({ class: 'label' }, 'New Home Specialists: '), ...sEl));
  }
  if (salesCenter.address && community && salesCenter.city && salesCenter['zip-code-abbr'] && salesCenter.zipcode) {
    const directionsIcon = await loadSVG('/icons/directions.svg');
    let googleLink;
    if (salesCenter.longitude && salesCenter.latitude) {
      googleLink = a({
        href: `https://www.google.com/maps/dir/Current+Location/${salesCenter.latitude},${salesCenter.longitude}`,
        target: '_blank',
      }, directionsIcon);
    }
    const addressEl = div(
      { class: 'sales-center-address' },
      p(
        { class: 'label' },
        'Sales Center Location: ',
        googleLink,
      ),
      span(salesCenter['sales-center-location']),
      span(salesCenter.address),
      span(`${salesCenter.city}, ${salesCenter['zip-code-abbr']}, ${salesCenter.zipcode}`),
    );
    mainDiv.append(addressEl);
  }

  return div(mainDiv, doc.querySelector('.links-wrapper'));
}

function buildFilterForm(filterByValue) {
  function buildOptions(allFilters) {
    const optionEls = [];

    // eslint-disable-next-line max-len
    const selectedItem = allFilters.find((filter) => filter.value === filterByValue) || allFilters[0];
    selectedItem.selected = true;

    allFilters.forEach((filter) => {
      const properties = {
        value: filter.value
          ? `${window.location.pathname}?filter=${filter.value}#inventory`
          : `${window.location.pathname}#inventory`,
        ...(filter.selected ? { selected: true } : {}),
      };
      optionEls.push(option(properties, filter.label));
    });
    return optionEls;
  }

  function createSelectElement(options) {
    return select({
      onchange: (event) => {
        let { value } = event.target.options[event.target.selectedIndex];
        if (value.indexOf('*') !== -1) {
          value = window.location.pathname;
        }
        window.location = value;
      },
    }, ...options);
  }

  const allListingOptions = buildOptions(
    filters.filter((filter) => filter.category === 'status'),
  );

  const sortBy = filters.filter(
    (filter) => filter.category === 'sortBy'
    || filter.category === 'priceAcsDesc'
    || filter.category === 'bedsAcsDesc'
    || filter.category === 'bathsAcsDesc'
    || filter.category === 'sqftAcsDesc',
  );
  const sortByOptions = buildOptions(sortBy);

  const filterBy = filters.filter(
    (filter) => filter.category === 'filterBy'
    || filter.category === 'beds'
    || filter.category === 'sqft',
  ) // filter any of the ALL options
    .filter((filter) => filter.value.indexOf('*') === -1);

  const filterByOptions = buildOptions(filterBy);

  const allListingSelect = createSelectElement(allListingOptions);
  const sortBySelect = createSelectElement(sortByOptions);
  const filterBySelect = createSelectElement(filterByOptions);

  let resetEl;
  // if there is a filter, then we can provide a reset link to clear the filter
  if (filterByValue) {
    resetEl = a({
      class: 'rest',
      href: `${window.location.pathname}#plans`,
    }, 'Reset');
  }

  return div({ class: 'filter-form' }, form({ class: 'fluid-flex' }, allListingSelect, sortBySelect, filterBySelect), resetEl);
}

async function checkIfSoldOut(community, doc) {
  if (community.status !== 'Sold Out') {
    return false;
  }

  const mainSection = doc.querySelector('main > .section');

  // Find the overview wrapper and remove everything after it and itself
  const overviewWrapperEl = mainSection.querySelector('.overview-wrapper');
  while (overviewWrapperEl.nextSibling) {
    overviewWrapperEl.nextSibling.remove();
  }
  overviewWrapperEl.remove();

  // create a link to the parent community
  // using window.location go up one level
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  pathSegments.pop();
  const newPathname = `/${pathSegments.join('/')}`;
  const target = `${window.location.protocol}//${window.location.host}${newPathname}`;
  const title = await getPageTitleForUrl(newPathname);

  const link = span(
    'Come take a look at our other communities in ',
    a({ href: target }, `${title}.`),
  );

  mainSection.append(div({ class: 'section' }, h1('Sold Out'), link));
  return true;
}

export default async function decorate(doc) {
  await loadWorkbook();
  await loadRates();

  const url = new URL(window.location);
  const params = url.searchParams;
  const filter = params.get('filter');
  const areaName = getMetadata('city', doc);

  const mainSection = doc.querySelector('main > .section');
  const community = await getCommunityForUrl(window.location.pathname);
  const salesCenter = await getSalesCenterForCommunity(community.name);

  const isSoldOut = await checkIfSoldOut(community, doc);
  if (isSoldOut) {
    return;
  }

  const filterSectionTitle = div({ class: 'grey-divider full-width' }, getHeaderTitleForFilter(filter));
  const data = await getInventoryHomesForCommunity(community.name, filter || 'priceasc');

  const directionsIcon = await loadSVG('/icons/directions.svg', 'directions-icon');

  const modelNameAddr = div({ class: 'page-info' }, h1(community.name), a({
    class: 'directions',
    href: `https://www.google.com/maps/dir/Current+Location/${community.latitude},${community.longitude}`,
    target: '_blank',
  }, div({ class: 'directions-container' }, h4(`${areaName}, ${community['zip-code-abbr']}`), directionsIcon)));

  const requestButtons = div({ class: 'request-btns' }, a({
    class: 'btn yellow fancy',
    href: '/contact-us',
  }, 'Request Information'));

  const overview = doc.querySelector('.overview-wrapper');
  const tabsWrapper = doc.querySelector('.tabs-wrapper');
  const rightAside = await createRightAside(doc, community, salesCenter);
  const modelFilter = buildFilterForm(filter);

  const plansAnchor = a({ id: 'plans' }, '');
  const inventoryAnchor = a({ id: 'inventory' }, '');
  const inventory = await renderCards('inventory', data, 5);
  const inventoryEl = div({ class: 'section inventory' }, inventory);
  const disclaimer = doc.querySelector('.fragment-wrapper');
  const featuredPlansTitle = div({ class: 'grey-divider full-width' }, 'Featured Plans');

  const featured = await getModelsByCommunity(community.name);
  if (featured.length > 0) {
    featured.sort((f1, f2) => f1.price - f2.price);
  }

  const hasFeaturedModels = featured.length > 0;
  const featuredCards = await renderCards('featured', featured, 2);
  const featuredModels = div({ class: 'section featured-models' }, featuredCards);

  let specialistsSection;
  let specialistBanner;
  if (salesCenter.specialists && salesCenter.specialists.length > 0) {
    specialistBanner = div({ class: 'grey-divider full-width' }, `${community.name} New Home Specialists`);
    specialistsSection = div({ class: 'specialists fluid-flex full-width' });
    const specialistEl = await createSpecialists(salesCenter.specialists);
    specialistEl.forEach((el) => {
      specialistsSection.appendChild(el);
    });
  }

  const twoCols = div(
    modelNameAddr,
    div({ class: 'repeating-grid' }, doc.querySelector('.description-wrapper'), div(overview)),
    tabsWrapper,
    requestButtons,
  );

  const leftRight = div({ class: 'section' }, div(
    { class: 'content-wrapper' },
    div(
      { class: 'content' },
      twoCols,
    ),
    aside(
      rightAside,
    ),
  ));

  mainSection.append(
    leftRight,
    modelFilter,
    filterSectionTitle,
    inventoryAnchor,
    inventoryEl,
  );

  if (hasFeaturedModels) {
    mainSection.append(plansAnchor, featuredPlansTitle, featuredModels);
  }

  safeAppend(
    mainSection,
    specialistBanner,
    specialistsSection,
    div({ class: 'section disclaimer' }, disclaimer),
  );
}
