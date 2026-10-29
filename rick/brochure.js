(() => {
  'use strict';
  const total = 6;
  const preview = document.getElementById('brochure-preview');
  const previewImage = document.getElementById('brochure-thumbnail');
  // The complete reading preview travels with the page, without separate requests.
  const embeddedPages = [previewImage.getAttribute('src'), ...JSON.parse(document.getElementById('brochure-page-data').textContent)];
  const pageCount = document.getElementById('brochure-page-count');
  const reader = document.getElementById('brochure-reader');
  const stage = document.getElementById('brochure-reader-stage');
  const paper = document.getElementById('brochure-paper');
  const fullImage = document.getElementById('brochure-full-image');
  const message = document.getElementById('brochure-reader-message');
  const selector = document.getElementById('brochure-page-select');
  const fitButton = document.getElementById('brochure-fit');
  const announcement = document.getElementById('brochure-announcement');
  const previousButtons = document.querySelectorAll('[data-brochure-previous]');
  const nextButtons = document.querySelectorAll('[data-brochure-next]');
  const zoomOut = document.getElementById('brochure-zoom-out');
  const zoomIn = document.getElementById('brochure-zoom-in');
  let currentPage = 1;
  let zoom = 1;
  let bodyOverflow = '';
  let returnFocus = null;
  let imageRequest = 0;
  const cachedImages = new Map();

  const asset = (kind, page) => kind === 'thumb' ? embeddedPages[page - 1] : `assets/brochure/page-${page}.jpg`;
  const warmImage = (kind, page) => {
    if (page < 1 || page > total) return;
    const url = asset(kind, page);
    if (cachedImages.has(url)) return cachedImages.get(url);
    const image = new Image();
    cachedImages.set(url, image);
    image.onerror = () => cachedImages.delete(url);
    image.src = url;
    return image;
  };
  let drag = null;
  let suppressClick = false;
  const stopDrag = () => {
    if (drag && fullImage.hasPointerCapture(drag.id)) fullImage.releasePointerCapture(drag.id);
    drag = null;
    paper.classList.remove('is-dragging');
  };
  const updateZoom = () => {
    if (!reader.open || paper.hidden) return;
    const style = getComputedStyle(stage);
    const availableWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availableHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const ratio = fullImage.naturalWidth ? fullImage.naturalWidth / fullImage.naturalHeight : 704 / 1000;
    const fitWidth = Math.max(1, Math.min(availableWidth, availableHeight * ratio));
    paper.style.width = `${fitWidth * zoom}px`;
    paper.dataset.zoomed = String(zoom > 1);
    stage.dataset.zoomed = String(zoom > 1);
    fullImage.setAttribute('aria-label', zoom > 1 ? 'Drag to explore details. Click to fit page.' : 'Click to zoom in.');
    fullImage.setAttribute('aria-pressed', String(zoom > 1));
    fitButton.textContent = zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`;
    fitButton.setAttribute('aria-label', `Fit page to screen. Current zoom ${Math.round(zoom * 100)} percent`);
    zoomOut.disabled = zoom <= 1;
    zoomIn.disabled = zoom >= 3;
  };
  const setZoom = (value, point) => {
    stopDrag();
    const before = fullImage.getBoundingClientRect();
    const viewport = stage.getBoundingClientRect();
    const x = point ? point.clientX : viewport.left + stage.clientWidth / 2;
    const y = point ? point.clientY : viewport.top + stage.clientHeight / 2;
    const relativeX = before.width ? (x - before.left) / before.width : 0.5;
    const relativeY = before.height ? (y - before.top) / before.height : 0.5;
    zoom = Math.max(1, Math.min(3, value));
    updateZoom();
    if (zoom === 1) stage.scrollTo(0, 0);
    else {
      const after = fullImage.getBoundingClientRect();
      stage.scrollLeft += after.left + relativeX * after.width - x;
      stage.scrollTop += after.top + relativeY * after.height - y;
    }
  };
  const loadFullPage = () => {
    stopDrag();
    const request = ++imageRequest;
    const page = currentPage;
    zoom = 1;
    paper.hidden = false;
    message.hidden = true;
    stage.scrollTo(0, 0);
    fullImage.alt = `SOAR Alloy product catalogue, page ${page} of ${total}`;
    fullImage.onload = () => {
      if (request !== imageRequest) return;
      updateZoom();
    };
    fullImage.onerror = () => {
      if (request !== imageRequest) return;
      fullImage.onerror = null;
      fullImage.src = asset('thumb', page);
    };
    // Show the embedded page immediately; sharpen it only after the full image arrives.
    fullImage.src = asset('thumb', page);
    updateZoom();
    const highResolution = warmImage('page', page);
    const sharpen = () => {
      if (request !== imageRequest || !reader.open || !highResolution.naturalWidth) return;
      fullImage.src = highResolution.src;
      warmImage('page', page + 1);
      warmImage('page', page - 1);
    };
    if (highResolution.complete && highResolution.naturalWidth) sharpen();
    else highResolution.addEventListener('load', sharpen, { once: true });
  };
  const showPage = (page, announce = true) => {
    currentPage = Math.max(1, Math.min(total, page));
    previewImage.src = asset('thumb', currentPage);
    previewImage.alt = `SOAR Alloy product catalogue, page ${currentPage} of ${total}`;
    preview.setAttribute('aria-label', `Enlarge product catalogue, page ${currentPage} of ${total}`);
    pageCount.textContent = `${currentPage} / ${total}`;
    selector.value = String(currentPage);
    previousButtons.forEach(button => { button.disabled = currentPage === 1; });
    nextButtons.forEach(button => { button.disabled = currentPage === total; });
    if (announce) announcement.textContent = `Page ${currentPage} of ${total}`;
    warmImage('thumb', currentPage + 1);
    if (reader.open) loadFullPage();
  };
  const turnPage = direction => {
    const page = Math.max(1, Math.min(total, currentPage + direction));
    if (page !== currentPage) showPage(page);
  };
  preview.addEventListener('click', () => {
    returnFocus = document.activeElement;
    bodyOverflow = document.body.style.overflow;
    reader.showModal();
    document.body.style.overflow = 'hidden';
    loadFullPage();
  });
  document.getElementById('brochure-close').addEventListener('click', () => reader.close());
  reader.addEventListener('click', event => { if (event.target === reader) reader.close(); });
  reader.addEventListener('close', () => {
    stopDrag();
    document.body.style.overflow = bodyOverflow;
    returnFocus?.focus({ preventScroll: true });
  });
  previousButtons.forEach(button => button.addEventListener('click', () => turnPage(-1)));
  nextButtons.forEach(button => button.addEventListener('click', () => turnPage(1)));
  selector.addEventListener('change', () => showPage(Number(selector.value)));
  zoomOut.addEventListener('click', () => setZoom(zoom - 0.5));
  zoomIn.addEventListener('click', () => setZoom(zoom + 0.5));
  fitButton.addEventListener('click', () => setZoom(1));
  fullImage.tabIndex = 0;
  fullImage.setAttribute('role', 'button');
  fullImage.addEventListener('dragstart', event => event.preventDefault());
  fullImage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    if (zoom === 1) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      left: stage.scrollLeft, top: stage.scrollTop, moved: false };
    fullImage.setPointerCapture(event.pointerId);
  });
  fullImage.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    suppressClick = true;
    paper.classList.add('is-dragging');
    stage.scrollLeft = drag.left - dx;
    stage.scrollTop = drag.top - dy;
  });
  fullImage.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const tapped = !drag.moved && event.pointerType === 'touch';
    stopDrag();
    // Handle touch taps before releasing capture; ignore any compatibility click.
    if (tapped) {
      setZoom(1);
      suppressClick = true;
    }
  });
  fullImage.addEventListener('pointercancel', () => { suppressClick = true; stopDrag(); });
  fullImage.addEventListener('lostpointercapture', stopDrag);
  fullImage.addEventListener('click', event => {
    if (!swiped && !suppressClick) setZoom(zoom === 1 ? 2 : 1, event.detail ? event : null);
    swiped = false;
    suppressClick = false;
  });
  fullImage.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setZoom(zoom === 1 ? 2 : 1);
    }
  });
  reader.addEventListener('keydown', event => {
    if (event.target.tagName === 'SELECT') return;
    const keys = { ArrowLeft: () => turnPage(-1), ArrowRight: () => turnPage(1), '+': () => setZoom(zoom + .5), '=': () => setZoom(zoom + .5), '-': () => setZoom(zoom - .5), '0': () => setZoom(1) };
    if (keys[event.key]) { event.preventDefault(); keys[event.key](); }
  });
  let touchStart = null;
  let swiped = false;
  stage.addEventListener('touchstart', event => {
    swiped = false;
    touchStart = event.touches.length === 1 && zoom === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length || zoom !== 1) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; turnPage(dx < 0 ? 1 : -1); }
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  new ResizeObserver(updateZoom).observe(stage);
  for (let page = 1; page <= total; page++) warmImage('thumb', page);
  showPage(1, false);
})();
