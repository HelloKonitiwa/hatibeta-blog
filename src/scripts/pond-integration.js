import './pond.js';

// このモジュールはClientRouterのページ移動では再実行されない。
// Canvasとcontrollerはtransition:persistで同じ実体を保持する。
let surface;
let pond;
let species = 'koi';
let navigating = false;

const blocked = target => !(target instanceof Element) || Boolean(target.closest(
  '[data-pond-ui], a, button, input, label, select, textarea, summary, [contenteditable]'
));

function localPoint(event) {
  const rect = surface.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function clearPointer() {
  pond?.setPointer(0, 0, false);
}

document.addEventListener('astro:page-load', () => {
  navigating = false;
  const current = document.querySelector('[data-mosaic-pond]');
  if (surface !== current || !pond) {
    pond?.destroy();
    surface = current;
    pond = surface && window.MosaicPond.mountPond(surface, { theme: 'light', species });
  }
  const select = document.querySelector('[data-pond-species]');
  if (select) select.value = species;
  clearPointer();

  // 本文の位置はページ移動ごとに先頭へ戻す。魚の状態とは分けて扱う。
  const panel = document.querySelector('.reading-panel');
  if (panel) panel.scrollTop = 0;
  if (location.hash) {
    try {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    } catch { /* 不正なエンコードのハッシュは無視する。 */ }
  }
});

document.addEventListener('astro:before-preparation', () => {
  navigating = true;
  clearPointer();
});

// 除外対象は毎回現在のDOMから判定し、ページごとのイベントを増やさない。
document.addEventListener('pointermove', event => {
  if (!pond || navigating) return;
  const p = localPoint(event);
  pond.setPointer(p.x, p.y, event.pointerType !== 'touch' && !blocked(event.target));
});
document.addEventListener('pointerout', event => {
  if (!event.relatedTarget) clearPointer();
});
window.addEventListener('blur', clearPointer);
document.addEventListener('click', event => {
  if (!pond || navigating || event.defaultPrevented || event.button !== 0 || event.detail === 0 || blocked(event.target)) return;
  if (window.getSelection()?.toString()) return;
  const p = localPoint(event);
  pond.feedAt(p.x, p.y);
});
document.addEventListener('change', event => {
  if (!(event.target instanceof HTMLSelectElement) || !event.target.matches('[data-pond-species]')) return;
  species = event.target.value;
  pond?.setSpecies(species);
});
