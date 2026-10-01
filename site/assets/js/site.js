const button = document.querySelector('.menu-button');
const nav = document.querySelector('#site-nav');
const closeMenu = () => {
  if (!button || !nav) return;
  button.setAttribute('aria-expanded', 'false');
  nav.classList.remove('open');
};

if (button && nav) {
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('click', event => {
    if (!nav.contains(event.target) && !button.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); button.focus(); }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1400) closeMenu();
  });
}

// On narrow screens, reference-table cells are presented as labelled rows.
// The original table remains unchanged for wide screens and assistive tools.
document.querySelectorAll('.document table').forEach(table => {
  const headings = [...table.querySelectorAll('thead th')].map(cell => cell.textContent.trim());
  if (!headings.length) return;
  table.classList.add('responsive-reference');
  table.querySelectorAll('tbody tr').forEach(row => {
    [...row.children].forEach((cell, index) => {
      if (headings[index]) cell.dataset.label = headings[index];
    });
  });
});

// Every meaningful content image can be enlarged without changing the Markdown
// used by the page. The same interaction works with touch, mouse and keyboard.
const zoomableImages = [...document.querySelectorAll('main img:not([data-no-zoom])')];
if (zoomableImages.length) {
  const lightbox = document.createElement('div');
  lightbox.className = 'image-lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Enlarged documentation image');
  lightbox.hidden = true;
  lightbox.innerHTML = `
    <div class="image-lightbox__bar">
      <p class="image-lightbox__caption" aria-live="polite"></p>
      <button class="image-lightbox__close" type="button" aria-label="Close enlarged image">Close</button>
    </div>
    <div class="image-lightbox__viewport">
      <img class="image-lightbox__image" alt="">
    </div>`;
  document.body.appendChild(lightbox);

  const fullImage = lightbox.querySelector('.image-lightbox__image');
  const caption = lightbox.querySelector('.image-lightbox__caption');
  const closeButton = lightbox.querySelector('.image-lightbox__close');
  let opener = null;
  let backgroundInert = [];

  const closeLightbox = () => {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    fullImage.removeAttribute('src');
    fullImage.classList.remove('is-zoomed');
    backgroundInert.forEach(([element, wasInert]) => { element.inert = wasInert; });
    backgroundInert = [];
    opener?.focus();
  };
  fullImage.addEventListener('click', () => {
    fullImage.classList.toggle('is-zoomed');
  });
  const openLightbox = image => {
    opener = image;
    fullImage.src = image.currentSrc || image.src;
    fullImage.alt = image.alt || '';
    const figureCaption = image.closest('figure')?.querySelector('figcaption')?.textContent.trim();
    caption.textContent = figureCaption || image.alt || 'Enlarged image';
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
    backgroundInert = [...document.body.children].filter(element => element !== lightbox && element.tagName !== 'SCRIPT').map(element => [element, element.inert]);
    backgroundInert.forEach(([element]) => { element.inert = true; });
    closeButton.focus();
  };

  zoomableImages.forEach(image => {
    image.classList.add('zoomable-image');
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `${(image.alt || 'Image').replace(/[.\s]+$/, '')}. Open full-size view.`);
    image.addEventListener('click', () => openLightbox(image));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox(image);
      }
    });
  });
  closeButton.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox || event.target.classList.contains('image-lightbox__viewport')) closeLightbox();
  });
  document.addEventListener('keydown', event => {
    if (!lightbox.hidden && event.key === 'Tab') {
      event.preventDefault();
      closeButton.focus();
    }
    if (event.key === 'Escape') {
      closeLightbox();
      closeMenu();
    }
  });
}

// Keep the outline compact on phones, with the complete static list as fallback.
const outline = document.querySelector('.doc-outline');
if (outline && matchMedia('(max-width: 1000px)').matches) outline.open = false;
const revealFragment = () => {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  let parent = target;
  while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  target.scrollIntoView({block:'start'});
};
window.addEventListener('hashchange', revealFragment);

// Compact reading removes only walkthrough screenshots, never wiring or instructions.
const readingToggle = document.querySelector('[data-reading-toggle]');
if (readingToggle && document.querySelector('.build-screen')) {
  readingToggle.hidden = false;
  let compact = false;
  try { compact = localStorage.getItem('ot-docs-compact') === '1'; } catch {}
  const apply = () => {
    document.body.classList.toggle('compact-reading', compact);
    readingToggle.setAttribute('aria-pressed', String(compact));
    readingToggle.textContent = compact ? 'Show walkthrough screenshots' : 'Hide walkthrough screenshots';
  };
  apply();
  readingToggle.addEventListener('click', () => {
    compact = !compact; apply();
    try { localStorage.setItem('ot-docs-compact', compact ? '1' : '0'); } catch {}
  });
}

const normalizeQuery = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const fieldFilter = document.querySelector('[data-field-filter]');
if (fieldFilter) {
  fieldFilter.hidden = false;
  const input = fieldFilter.querySelector('input');
  const sections = [...document.querySelectorAll('.reference-section')];
  const status = fieldFilter.querySelector('[data-field-status]');
  input.addEventListener('input', () => {
    const terms = normalizeQuery(input.value).split(' ').filter(Boolean);
    let matches = 0;
    sections.forEach(section => {
      let visible = 0;
      section.querySelectorAll('tbody tr').forEach(row => {
        const text = normalizeQuery(row.textContent);
        row.hidden = !terms.every(term => text.includes(term));
        if (!row.hidden) {visible++;matches++;}
      });
      section.hidden = visible === 0;
      section.open = terms.length > 0 && visible > 0;
    });
    status.textContent = terms.length ? `${matches} matching fields` : 'Browse the groups below or filter by field name and description.';
  });
  input.dispatchEvent(new Event('input'));
}

const finder = document.querySelector('[data-doc-search]');
if (finder) {
  finder.hidden = false;
  const input = finder.querySelector('input');
  const list = finder.querySelector('[data-search-results]');
  const status = finder.querySelector('[data-search-status]');
  let records = [];
  let loaded = false;
  const render = () => {
    list.replaceChildren();
    const query = normalizeQuery(input.value);
    if (!query) {status.textContent = 'Search page topics and Controllers/System fields. Task links are below.';return;}
    if (!loaded) {status.textContent = 'Loading the documentation index…';return;}
    const terms = query.split(' ');
    const matches = records.map(record => {
      const title = normalizeQuery(record.title);
      const text = normalizeQuery(`${record.title} ${record.context} ${record.text}`);
      return {record,score:(title===query?100:0)+(title.includes(query)?40:0)+terms.filter(term=>title.includes(term)).length*8,match:terms.every(term=>text.includes(term))};
    }).filter(item=>item.match).sort((a,b)=>b.score-a.score);
    status.textContent = matches.length ? `${matches.length} results${matches.length>12?' · showing the first 12; add another word to narrow the search':''}` : 'No matches. Try the screen label, another word, or a task link below.';
    matches.slice(0,12).forEach(({record})=>{
      const item=document.createElement('li');
      const link=document.createElement('a');link.href=finder.dataset.base+record.url;link.textContent=record.title;
      const context=document.createElement('span');context.className='quiet';context.textContent=record.context;
      const snippet=document.createElement('p');snippet.textContent=record.text.slice(0,180)+(record.text.length>180?'…':'');
      item.append(link,context,snippet);list.append(item);
    });
  };
  input.addEventListener('input', render);
  // Search destinations must match the currently served guide, including after
  // an update in an already-open browser. Do not reuse an older cached index.
  fetch(finder.dataset.index, {cache:'no-store'}).then(response=>{if(!response.ok)throw Error('Search index unavailable');return response.json();}).then(data=>{
    records=data;loaded=true;render();
  }).catch(()=>{status.textContent='Search could not load. Use the task links below.';});
}

// Run after field-filter initialization so a direct field link stays expanded.
revealFragment();
