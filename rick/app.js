(() => {
  'use strict';
  const card = document.getElementById('interactive-card');
  const artwork = document.getElementById('card-artwork');
  const sheen = document.getElementById('card-sheen');
  const downloadButton = document.getElementById('download-card');
  const exportCard = document.getElementById('export-card');
  const motionButton = document.getElementById('motion-enable');
  const status = document.getElementById('status-message');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.createElement('div');
  stage.className = 'card-stage';
  card.before(stage);
  stage.append(card);

  const resize = () => { artwork.style.transform = `scale(${card.clientWidth / 600})`; };
  new ResizeObserver(resize).observe(card);
  resize();

  const qrUrl = 'https://card.soaralloy.com/rick/';
  document.querySelectorAll('.qr-code').forEach(node => {
    new QRCode(node, { text: qrUrl, width: 256, height: 256, colorDark: '#234F70', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  });

  let animationFrame = 0;
  let pointerStart = null;
  let dragged = false;
  let lastRotation = { x: 0, y: 0 };
  const applyTilt = (x, y, transition = 'none') => {
    if (reduced.matches) return;
    lastRotation = { x, y };
    card.style.transition = transition;
    card.style.transform = `perspective(1000px) rotateX(${x}deg) rotateY(${y}deg)`;
  };
  const reset = () => {
    cancelAnimationFrame(animationFrame);
    applyTilt(0, 0, 'transform 0.5s ease-out');
    sheen.style.transition = 'opacity 0.5s';
    sheen.style.opacity = '0';
  };
  const pointerTilt = event => {
    if (event.pointerType !== 'mouse' && !pointerStart) return;
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 7) dragged = true;
    const bounds = stage.getBoundingClientRect();
    const x = Math.min(bounds.width, Math.max(0, event.clientX - bounds.left));
    const y = Math.min(bounds.height, Math.max(0, event.clientY - bounds.top));
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      applyTilt((y - bounds.height / 2) / 15, (bounds.width / 2 - x) / 15);
      sheen.style.transition = 'none';
      sheen.style.opacity = '1';
      sheen.style.background = `radial-gradient(circle at ${x / bounds.width * 100}% ${y / bounds.height * 100}%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 80%)`;
    });
  };
  stage.addEventListener('pointermove', pointerTilt);
  stage.addEventListener('pointerleave', reset);
  card.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; dragged = false; });
  card.addEventListener('pointerup', event => { pointerStart = null; if (event.pointerType !== 'mouse') reset(); });
  card.addEventListener('pointercancel', () => { pointerStart = null; dragged = true; reset(); });
  card.addEventListener('blur', reset);
  reduced.addEventListener('change', reset);

  let toastTimer;
  const announce = message => {
    clearTimeout(toastTimer);
    status.textContent = message;
    status.classList.add('visible');
    toastTimer = setTimeout(() => status.classList.remove('visible'), 4500);
  };
  const wechatButton = document.getElementById('wechat-action');
  const wechatHelp = document.getElementById('wechat-help');
  wechatButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(wechatButton.dataset.wechatId);
      wechatHelp.hidden = true;
      announce(`WeChat ID copied: ${wechatButton.dataset.wechatId}`);
    } catch {
      wechatHelp.hidden = false;
      announce('Select the WeChat ID below the buttons to copy it.');
    }
  });
  let busy = false;
  const download = async () => {
    if (busy) return;
    busy = true;
    downloadButton.setAttribute('aria-busy', 'true');
    const originalLabel = downloadButton.innerHTML;
    downloadButton.textContent = 'Preparing…';
    try {
      await document.fonts.ready;
      await Promise.all([...exportCard.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
      const dataUrl = await htmlToImage.toPng(exportCard, { pixelRatio: 3, backgroundColor: '#ffffff', cacheBust: false, style: { transform: 'none' } });
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = 'Rick-SOAR-Business-Card.png';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      announce('Business card downloaded.');
    } catch (error) {
      console.error('Business card export failed:', error);
      announce('Unable to download the card. Please try again.');
    } finally {
      busy = false;
      downloadButton.innerHTML = originalLabel;
      downloadButton.removeAttribute('aria-busy');
    }
  };
  downloadButton.addEventListener('click', download);
  card.addEventListener('click', event => { if (dragged) { event.preventDefault(); dragged = false; return; } download(); });
  card.addEventListener('keydown', event => {
    const steps = { ArrowUp: [-3, 0], ArrowDown: [3, 0], ArrowLeft: [0, 3], ArrowRight: [0, -3] };
    if (steps[event.key]) {
      event.preventDefault();
      const [dx, dy] = steps[event.key];
      applyTilt(Math.max(-15, Math.min(15, lastRotation.x + dx)), Math.max(-15, Math.min(15, lastRotation.y + dy)), 'transform 0.15s ease-out');
    } else if (event.key === 'Escape') reset();
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); download(); }
  });

  const onOrientation = event => {
    if (!window.matchMedia('(pointer: coarse)').matches || event.beta == null || event.gamma == null || document.hidden) return;
    const beta = Math.max(-15, Math.min(15, event.beta - 45));
    const gamma = Math.max(-15, Math.min(15, event.gamma));
    applyTilt(-beta, gamma, 'transform 0.1s ease-out');
    sheen.style.opacity = '1';
    sheen.style.background = `linear-gradient(${135 + 2 * gamma}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${Math.abs(gamma) / 50}) 50%, rgba(255,255,255,0) 100%)`;
  };
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    motionButton.hidden = !window.matchMedia('(pointer: coarse)').matches;
    motionButton.addEventListener('click', async () => {
      try {
        if (await DeviceOrientationEvent.requestPermission() === 'granted') {
          window.addEventListener('deviceorientation', onOrientation);
          motionButton.hidden = true;
          announce('Motion enabled. Tilt your phone to move the card.');
        } else announce('Motion access was not enabled. You can still drag the card.');
      } catch { announce('Motion is unavailable here. You can still drag the card.'); }
    });
  } else window.addEventListener('deviceorientation', onOrientation);
})();
