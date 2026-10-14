'use strict';
// Страницы и ссылки доступны без JavaScript; этот файл только улучшает интерфейс.
const menu = document.getElementById('site-menu');
const openMenu = document.getElementById('open-menu');
const closeMenu = document.getElementById('close-menu');
if (menu && openMenu && closeMenu && typeof menu.showModal === 'function') {
  openMenu.hidden = false;
  openMenu.addEventListener('click', () => {
    menu.showModal(); // Нативный dialog изолирует фон и удерживает клавиатурный фокус.
    document.body.classList.add('menu-open');
    openMenu.setAttribute('aria-expanded', 'true');
    closeMenu.focus();
  });
  closeMenu.addEventListener('click', () => menu.close());
  // Явный цикл фокуса дополняет нативный dialog в разных браузерах.
  menu.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...menu.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(item => !item.disabled && item.getClientRects().length);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  menu.addEventListener('click', event => {
    const rect = menu.getBoundingClientRect();
    if (event.target === menu && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) menu.close();
  });
  menu.addEventListener('close', () => {
    document.body.classList.remove('menu-open');
    openMenu.setAttribute('aria-expanded', 'false');
    openMenu.focus({preventScroll:true});
  });
} else if (menu) {
  // Запасная обычная навигация в старых браузерах без dialog.
  const nav = menu.querySelector('nav').cloneNode(true);
  nav.className = 'nojs-nav';
  menu.parentNode.insertBefore(nav, document.querySelector('main'));
}
const motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !motionReduced.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:0.08});
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}
const progress = document.querySelector('.reading-progress');
let scheduled = false;
function updateProgress() {
  const length = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.transform = `scaleX(${length > 0 ? Math.min(1, Math.max(0, window.scrollY / length)) : 0})`;
  scheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scheduled) {scheduled = true; requestAnimationFrame(updateProgress);}
}, {passive:true});
window.addEventListener('resize', updateProgress);
updateProgress();

// Фильтры статей. Скрываются сами материалы, а не только их подписи.
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const articleCards = [...document.querySelectorAll('[data-category]')];
filterButtons.forEach(button => button.addEventListener('click', () => {
  const chosen = button.dataset.filter;
  filterButtons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  let count = 0;
  articleCards.forEach(card => {
    const show = chosen === 'Все' || card.dataset.category === chosen;
    card.hidden = !show;
    if (show) {count++; card.classList.remove('is-visible');}
  });
  const label = document.getElementById('article-count');
  if (label) label.textContent = `Показано материалов: ${count}`;
  updateProgress();
}));

// Поиск по русскому и английскому названию, определению и примеру.
const searchInput = document.getElementById('term-search');
const normalize = value => value.toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
if (searchInput) {
  const terms = [...document.querySelectorAll('[data-search]')];
  const indexed = terms.map(card => ({card, text: normalize(card.dataset.search)}));
  const count = document.getElementById('term-count');
  const empty = document.getElementById('no-terms');
  function filterTerms() {
    const words = normalize(searchInput.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    indexed.forEach(({card,text}) => {
      const show = words.every(word => text.includes(word));
      card.hidden = !show;
      if (show) {shown++;card.classList.remove('is-visible');}
    });
    count.textContent = `Найдено терминов: ${shown} из ${terms.length}`;
    empty.hidden = shown !== 0;
    updateProgress();
  }
  searchInput.addEventListener('input', filterTerms);
  document.getElementById('clear-search').addEventListener('click', () => {
    searchInput.value = '';
    filterTerms();
    searchInput.focus();
  });
}

// Копирование: HTTPS Clipboard API; запасной путь для локального файла/старого браузера.
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {await navigator.clipboard.writeText(text); return true;} catch (_) {/* fallback below */}
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('aria-label', 'Текст для копирования');
  area.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;';
  document.body.append(area);
  area.select();
  let copied = false;
  try {copied = document.execCommand('copy');} catch (_) {copied = false;}
  area.remove();
  return copied;
}
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const code = document.getElementById(button.dataset.copy);
  if (!code) return;
  const copied = await copyText(code.textContent);
  const status = document.getElementById('copy-status');
  if (copied) {
    button.textContent = 'Скопировано';
    if (status) status.textContent = 'Текст скопирован в буфер обмена.';
  } else {
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    button.textContent = 'Текст выделен';
    if (status) status.textContent = 'Автокопирование недоступно. Текст выделен: нажмите Ctrl+C или используйте команду копирования.';
  }
  button.focus({preventScroll:true});
  window.setTimeout(() => {button.textContent = 'Копировать';}, 2500);
}));

// Подсветка текущей главы в боковом содержании длинных страниц.
const tocLinks = [...document.querySelectorAll('.toc a')];
if (tocLinks.length && 'IntersectionObserver' in window) {
  const chapterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocLinks.forEach(link => {
          const active = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current','location');
          else link.removeAttribute('aria-current');
        });
      }
    });
  }, {rootMargin:'-15% 0px -65% 0px', threshold:0});
  document.querySelectorAll('.text-section').forEach(section => chapterObserver.observe(section));
}
