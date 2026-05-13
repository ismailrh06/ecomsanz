/* ============================================================
   SCROLL PROGRESS BAR
   ============================================================ */
const scrollBar = document.getElementById('scrollBar');

function updateScrollBar() {
  if (!scrollBar) return;
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
  scrollBar.style.width = `${pct}%`;
}

window.addEventListener('scroll', updateScrollBar, { passive: true });
window.addEventListener('resize', updateScrollBar);
updateScrollBar();

/* ============================================================
   MASTERCLASS ACCESS GUARD
   ============================================================ */
(function () {
  if (!document.body.classList.contains('masterclass-body')) return;

  try {
    if (localStorage.getItem('masterclassAccess') !== 'verified') {
      window.location.href = 'index.html#leadForm';
    }
  } catch (error) {
    window.location.href = 'index.html#leadForm';
  }
})();

/* ============================================================
   REVEAL ON SCROLL
   ============================================================ */
(function () {
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -45px 0px' }
  );

  els.forEach((el) => observer.observe(el));

  requestAnimationFrame(() => {
    els.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight - 20) {
        el.classList.add('visible');
        observer.unobserve(el);
      }
    });
  });
})();

/* ============================================================
   SMOOTH SCROLL
   ============================================================ */
document.querySelectorAll('.smooth-scroll, a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.length <= 1) return;

    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();

    const mobileToClassBlock =
      target.id === 'leadForm' &&
      window.matchMedia('(max-width: 860px)').matches &&
      target.closest('.hero-left');

    const scrollTarget = mobileToClassBlock || target;
    const revealTarget = scrollTarget.closest('.reveal, .reveal-left, .reveal-right') || scrollTarget;
    revealTarget.classList.add('visible');

    const topbar = document.querySelector('.topbar');
    const offset = topbar ? topbar.offsetHeight + 18 : 24;
    const targetTop = scrollTarget.getBoundingClientRect().top + window.scrollY;
    const to = Math.max(0, targetTop - offset);

    window.scrollTo({ top: to, behavior: 'smooth' });
  });
});

/* ============================================================
   MOBILE CAROUSEL TRACKERS
   ============================================================ */
(function () {
  const mobileQuery = window.matchMedia('(max-width: 640px)');
  if (!mobileQuery.matches) return;

  function setupCarouselTracker(trackSelector, dotSelector, itemSelector) {
    const track = document.querySelector(trackSelector);
    const dots = Array.from(document.querySelectorAll(dotSelector));
    const items = Array.from(document.querySelectorAll(itemSelector));

    if (!track || !dots.length || !items.length) return;

    const setActive = (index) => {
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    };

    const scrollToItem = (index) => {
      const item = items[index];
      if (!item) return;

      const left = Math.max(0, item.offsetLeft - (track.clientWidth - item.clientWidth) / 2);
      track.scrollTo({ left, behavior: 'smooth' });
      setActive(index);
    };

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => scrollToItem(index));
    });

    let rafId = 0;
    const updateFromScroll = () => {
      rafId = 0;
      let bestIndex = 0;
      let bestScore = -1;

      const trackRect = track.getBoundingClientRect();
      const trackCenter = trackRect.left + trackRect.width / 2;

      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const left = Math.max(rect.left, trackRect.left);
        const right = Math.min(rect.right, trackRect.right);
        const visibleWidth = Math.max(0, right - left);
        const centerDistance = Math.abs((rect.left + rect.width / 2) - trackCenter);
        const score = visibleWidth - centerDistance * 0.02;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });

      setActive(bestIndex);
    };

    const queueUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateFromScroll);
    };

    track.addEventListener('scroll', queueUpdate, { passive: true });
    track.addEventListener('touchend', queueUpdate, { passive: true });
    track.addEventListener('pointerup', queueUpdate, { passive: true });
    track.addEventListener('scrollend', updateFromScroll, { passive: true });

    window.addEventListener('resize', queueUpdate, { passive: true });
    window.addEventListener('load', queueUpdate, { once: true });
    queueUpdate();
  }

  setupCarouselTracker('.proof-masonry', '.proof-dot', '.proof-item');
  setupCarouselTracker('.student-videos-grid', '.video-dot', '.sv-item');
})();

/* ============================================================
   DESKTOP PROOF GALLERY (3 PER VIEW)
   ============================================================ */
(function () {
  const desktopQuery = window.matchMedia('(min-width: 641px)');
  const track = document.querySelector('.proof-masonry');
  const items = Array.from(document.querySelectorAll('.proof-masonry .proof-item'));
  const dots = Array.from(document.querySelectorAll('.proof-dot'));
  const prevButton = document.querySelector('.proof-arrow-prev');
  const nextButton = document.querySelector('.proof-arrow-next');

  if (!track || !items.length || !prevButton || !nextButton) return;

  const getGap = () => {
    const styles = window.getComputedStyle(track);
    return parseFloat(styles.gap || styles.columnGap || '0') || 0;
  };

  const getItemSpan = () => {
    const itemWidth = items[0]?.getBoundingClientRect().width || 0;
    return itemWidth + getGap();
  };

  const getPageStep = () => getItemSpan() * 3;

  const setActiveDot = () => {
    if (!dots.length) return;
    const span = getItemSpan();
    if (!span) return;
    const index = Math.round(track.scrollLeft / span);
    const clamped = Math.max(0, Math.min(index, dots.length - 1));
    dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === clamped));
  };

  const updateArrows = () => {
    if (!desktopQuery.matches) {
      prevButton.disabled = true;
      nextButton.disabled = true;
      return;
    }

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth - 2);
    prevButton.disabled = track.scrollLeft <= 2;
    nextButton.disabled = track.scrollLeft >= maxScroll;
  };

  const scrollByPage = (direction) => {
    if (!desktopQuery.matches) return;
    track.scrollBy({ left: getPageStep() * direction, behavior: 'smooth' });
  };

  prevButton.addEventListener('click', () => scrollByPage(-1));
  nextButton.addEventListener('click', () => scrollByPage(1));

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      if (!desktopQuery.matches) return;
      track.scrollTo({ left: getItemSpan() * index, behavior: 'smooth' });
    });
  });

  const queueUiUpdate = () => {
    window.requestAnimationFrame(() => {
      setActiveDot();
      updateArrows();
    });
  };

  track.addEventListener('scroll', queueUiUpdate, { passive: true });
  window.addEventListener('resize', queueUiUpdate, { passive: true });
  desktopQuery.addEventListener('change', queueUiUpdate);
  window.addEventListener('load', queueUiUpdate, { once: true });

  queueUiUpdate();
})();

/* ============================================================
   DESKTOP TESTIMONIAL VIDEO PICKER
   ============================================================ */
(function () {
  const desktopQuery = window.matchMedia('(min-width: 641px)');
  const section = document.querySelector('.student-videos-section');
  const items = Array.from(document.querySelectorAll('.student-videos-grid .sv-item'));
  const dots = Array.from(document.querySelectorAll('.video-dot'));
  const prevButton = document.querySelector('.video-arrow-prev');
  const nextButton = document.querySelector('.video-arrow-next');

  if (!section || !items.length || !dots.length) return;
  let activeIndex = Math.max(0, items.findIndex((item) => item.classList.contains('is-active')));

  const pauseAndUnload = (item) => {
    const video = item.querySelector('video');
    if (!video) return;
    if (!video.paused) video.pause();
    if (video.dataset.loaded === 'true') {
      video.removeAttribute('src');
      video.dataset.loaded = 'false';
      video.load();
    }
  };

  const loadVideo = (item) => {
    const video = item.querySelector('video');
    if (!video || video.dataset.loaded === 'true') return video;
    const src = video.dataset.src;
    if (!src) return video;
    video.src = src;
    video.dataset.loaded = 'true';
    video.load();
    return video;
  };

  const setActive = (index, shouldPlay = false) => {
    if (!desktopQuery.matches) return;
    const normalizedIndex = (index + items.length) % items.length;
    activeIndex = normalizedIndex;

    items.forEach((item, itemIndex) => {
      const active = itemIndex === normalizedIndex;
      item.classList.toggle('is-active', active);
      if (!active) pauseAndUnload(item);
    });

    dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === normalizedIndex));

    const activeVideo = loadVideo(items[normalizedIndex]);
    if (shouldPlay && activeVideo) {
      activeVideo.muted = false;
      activeVideo.volume = 1;
      const playPromise = activeVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    }
  };

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => setActive(index, true));
  });

  prevButton?.addEventListener('click', () => setActive(activeIndex - 1, true));
  nextButton?.addEventListener('click', () => setActive(activeIndex + 1, true));

  setActive(activeIndex);

  desktopQuery.addEventListener('change', () => {
    if (desktopQuery.matches) setActive(0);
    else items.forEach((item) => item.classList.add('is-active'));
  });
})();

/* ============================================================
   PREMIUM CURSOR GLOW
   ============================================================ */
(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const glow = document.createElement('div');
  glow.setAttribute('aria-hidden', 'true');
  glow.style.cssText = `
    position:fixed;
    left:0;
    top:0;
    width:360px;
    height:360px;
    border-radius:50%;
    pointer-events:none;
    z-index:0;
    opacity:.55;
    transform:translate(-50%,-50%);
    background:radial-gradient(circle,rgba(232,196,106,.13) 0%,rgba(232,196,106,.04) 38%,transparent 72%);
    transition:opacity .2s ease;
  `;

  document.body.appendChild(glow);

  document.addEventListener('mousemove', (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }, { passive: true });

  document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { glow.style.opacity = '.55'; });
})();

/* ============================================================
   MASTERCLASS LOCAL VIDEO — play only while visible
   ============================================================ */
(function () {
  const autoVideo = document.getElementById('mainVideo');
  const playOverlay = document.getElementById('mainVideoPlay');
  if (!autoVideo) return;

  autoVideo.muted = false;
  autoVideo.defaultMuted = false;
  autoVideo.volume = 1;
  autoVideo.preload = 'metadata';

  let shouldPlay = false;

  const tryPlay = () => {
    if (!shouldPlay || document.hidden) return;
    const playPromise = autoVideo.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => playOverlay?.classList.remove('is-visible'))
        .catch(() => playOverlay?.classList.add('is-visible'));
    }
  };

  const pauseVideo = () => {
    if (!autoVideo.paused) autoVideo.pause();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      shouldPlay = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.55);
      if (shouldPlay) tryPlay();
      else pauseVideo();
    },
    { threshold: [0, 0.35, 0.55, 0.75] }
  );

  observer.observe(autoVideo);

  playOverlay?.addEventListener('click', () => {
    shouldPlay = true;
    autoVideo.muted = false;
    autoVideo.volume = 1;
    autoVideo.play()
      .then(() => playOverlay.classList.remove('is-visible'))
      .catch(() => playOverlay.classList.add('is-visible'));
  });

  autoVideo.addEventListener('play', () => playOverlay?.classList.remove('is-visible'));
  autoVideo.addEventListener('canplay', tryPlay);
  window.addEventListener('load', tryPlay, { once: true });
  window.addEventListener('pointerdown', tryPlay, { passive: true });
  window.addEventListener('touchstart', tryPlay, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseVideo();
    else tryPlay();
  });
})();

/* ============================================================
   STUDENT VIDEO ITEMS — click placeholder to load iframe
   ============================================================ */
document.querySelectorAll('.sv-item').forEach((item) => {
  const src = item.getAttribute('data-src');
  const placeholder = item.querySelector('.sv-placeholder');
  const iframe = item.querySelector('iframe');

  if (!src || !src.trim() || !placeholder || !iframe) return;

  placeholder.addEventListener('click', () => {
    iframe.src = src.includes('?') ? `${src}&autoplay=1` : `${src}?autoplay=1`;
    iframe.style.display = 'block';
    item.classList.add('playing');
  });
});

/* ============================================================
   LOCAL TESTIMONIAL VIDEOS — play only the visible item
   ============================================================ */
(function () {
  const section = document.querySelector('.student-videos-section');
  const localVideos = Array.from(document.querySelectorAll('.sv-item.sv-local video'));

  if (!section || !localVideos.length) return;

  let sectionVisible = false;
  let rafId = 0;

  const ensureVideoSource = (video) => {
    if (video.dataset.loaded === 'true') return;
    const src = video.dataset.src;
    if (!src) return;
    video.src = src;
    video.dataset.loaded = 'true';
    video.load();
  };

  const unloadVideo = (video) => {
    if (video.dataset.loaded !== 'true' || !video.paused) return;
    video.removeAttribute('src');
    video.dataset.loaded = 'false';
    video.load();
  };

  const pauseVideo = (video) => {
    if (!video.paused) video.pause();
  };

  const pauseAll = () => {
    localVideos.forEach(pauseVideo);
  };

  const getActiveVideo = () => {
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    let activeVideo = null;
    let bestScore = -Infinity;

    localVideos.forEach((video) => {
      const rect = video.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;
      const centerDistance = Math.hypot(
        rect.left + rect.width / 2 - viewportCenterX,
        rect.top + rect.height / 2 - viewportCenterY
      );
      const score = visibleArea - centerDistance * 8;

      if (score > bestScore) {
        bestScore = score;
        activeVideo = video;
      }
    });

    return activeVideo;
  };

  const updatePlayback = () => {
    rafId = 0;

    if (!sectionVisible || document.hidden) {
      pauseAll();
      return;
    }

    const activeVideo = getActiveVideo();

    localVideos.forEach((video) => {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1;
      video.playsInline = true;

      if (video === activeVideo) {
        ensureVideoSource(video);
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
      } else {
        pauseVideo(video);
        unloadVideo(video);
      }
    });
  };

  const queueUpdate = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(updatePlayback);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        sectionVisible = entry.isIntersecting;
        queueUpdate();
      });
    },
    { threshold: 0.35 }
  );

  observer.observe(section);

  window.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate, { passive: true });

  const track = document.querySelector('.student-videos-grid');
  if (track) {
    track.addEventListener('scroll', queueUpdate, { passive: true });
    track.addEventListener('touchend', queueUpdate, { passive: true });
    track.addEventListener('pointerup', queueUpdate, { passive: true });
    track.addEventListener('scrollend', updatePlayback, { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAll();
    else queueUpdate();
  });
})();

/* ============================================================
   PROOF PHOTO LIGHTBOX
   ============================================================ */
(function () {
  const proofImages = document.querySelectorAll('.proof-item img');
  if (!proofImages.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <span class="lightbox-close" aria-label="Cerrar">&times;</span>
    <img src="" alt="Prueba ampliada" />
  `;
  document.body.appendChild(overlay);

  const lbImg = overlay.querySelector('img');
  const closeBtn = overlay.querySelector('.lightbox-close');

  proofImages.forEach((img) => {
    img.addEventListener('click', () => {
      lbImg.src = img.src;
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeLightbox() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { lbImg.src = ''; }, 180);
  }

  closeBtn.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLightbox();
  });
})();

/* ============================================================
   LEAD FORM
   ============================================================ */

// Form entrance animation
(function () {
  const leadForm = document.getElementById('leadForm');
  if (!leadForm) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const triggerAnimation = () => {
    leadForm.classList.add('form-entrance-play');
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.setTimeout(triggerAnimation, 300);
  } else {
    window.addEventListener('load', () => {
      window.setTimeout(triggerAnimation, 300);
    }, { once: true });
  }
})();

const form = document.getElementById('leadForm');
const errEl = document.getElementById('formError');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidName(name) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/.test(name);
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  const hasValidChars = /^[\d\s()+.-]+$/.test(phone);
  return hasValidChars && digits.length >= 8 && digits.length <= 15;
}

function isValidPhoneLocal(phone) {
  const digits = phone.replace(/\D/g, '');
  const hasValidChars = /^[\d\s().-]+$/.test(phone);
  return hasValidChars && digits.length >= 6 && digits.length <= 12;
}

if (form) {
  const nameInput = document.getElementById('fname');
  nameInput?.addEventListener('input', () => {
    nameInput.value = nameInput.value.replace(/\d+/g, '');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nameInput = document.getElementById('fname');
    const emailInput = document.getElementById('femail');
    const phoneCodeInput = document.getElementById('fphoneCode');
    const phoneInput = document.getElementById('fphone');

    const name = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const phoneCode = phoneCodeInput?.value || '+34';
    const phoneLocal = phoneInput?.value.trim() || '';
    const phone = `${phoneCode}${phoneLocal.replace(/\D/g, '')}`;
    const btn = form.querySelector('button[type="submit"]');
    const originalHtml = btn.innerHTML;

    if (!name) {
      showError('Por favor, introduce tu nombre.');
      nameInput?.focus();
      return;
    }

    if (!isValidName(name)) {
      showError('El nombre no puede contener números.');
      nameInput?.focus();
      return;
    }

    if (!email || !isValidEmail(email)) {
      showError('Por favor, introduce un email válido.');
      emailInput?.focus();
      return;
    }

    if (!phoneLocal || !isValidPhoneLocal(phoneLocal) || !isValidPhone(phone)) {
      showError('Por favor, introduce un teléfono válido con prefijo si es necesario.');
      phoneInput?.focus();
      return;
    }

    hideError();

    btn.innerHTML = 'ACCEDIENDO...';
    btn.disabled = true;
    btn.style.opacity = '.9';

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        throw new Error(result.error || result.message || 'No se pudo enviar el formulario.');
      }

      const leads = JSON.parse(localStorage.getItem('leads') || '[]');
      leads.push({ name, email, phone, date: new Date().toISOString() });
      localStorage.setItem('leads', JSON.stringify(leads));
      localStorage.setItem('masterclassAccess', 'verified');

      if (typeof fbq !== 'undefined') {
        fbq('track', 'Lead', {
          content_name: 'Masterclass Dropshipping IA',
          status: 'submitted'
        });
      }

      window.location.href = 'masterclass.html';
    } catch (error) {
      showError(error?.message || 'No se pudo continuar. Inténtalo de nuevo.');
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      btn.style.opacity = '';
      return;
    }
  });
}

function showError(message) {
  if (!errEl) return;
  errEl.classList.remove('form-info');
  errEl.textContent = message;
}

function showInfo(message) {
  if (!errEl) return;
  errEl.classList.add('form-info');
  errEl.textContent = message;
}

function hideError() {
  if (!errEl) return;
  errEl.classList.remove('form-info');
  errEl.textContent = '';
}

/* ============================================================
   META PIXEL CLICK TRACKING
   ============================================================ */
document.querySelectorAll('.whatsapp-track').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Contact');
    }
  });
});

document.querySelectorAll('.calendly-track').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Schedule');
    }
  });
});
