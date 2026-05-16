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

    // Add highlight animation to form if clicking on "Clase" button
    if (link.textContent.trim() === 'Clase') {
      const form = document.getElementById('leadForm');
      if (form) {
        form.classList.remove('form-highlight');
        // Trigger reflow to restart animation
        void form.offsetWidth;
        form.classList.add('form-highlight');
      }
    }

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

    let activeIndex = 0;
    let scrollTimeout = null;

    const setActive = (index) => {
      const normalized = Math.max(0, Math.min(index, items.length - 1));
      activeIndex = normalized;
      dots.forEach((dot, i) => dot.classList.toggle('active', i === normalized));

      if (trackSelector === '.student-videos-grid') {
        items.forEach((item, itemIndex) => {
          const video = item.querySelector('video');
          if (!video) return;
          if (itemIndex === normalized) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      }
    };

    const scrollToItem = (index, behavior = 'smooth') => {
      const item = items[index];
      if (!item) return;
      item.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
      setActive(index);
    };

    const getClosestIndex = () => {
      const trackRect = track.getBoundingClientRect();
      const trackCenter = trackRect.left + trackRect.width / 2;
      return items.reduce((closest, item, index) => {
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.left + rect.width / 2;
        const distance = Math.abs(itemCenter - trackCenter);
        return distance < closest.distance ? { distance, index } : closest;
      }, { distance: Infinity, index: 0 }).index;
    };

    const updateFromScroll = () => {
      setActive(getClosestIndex());
    };

    const onScrollEnd = () => {
      const closest = getClosestIndex();
      scrollToItem(closest);
    };

    const onScroll = () => {
      updateFromScroll();
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(onScrollEnd, 120);
    };

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => scrollToItem(index));
    });

    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('touchend', () => {
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(onScrollEnd, 60);
    }, { passive: true });
    track.addEventListener('pointerup', () => {
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(onScrollEnd, 60);
    }, { passive: true });

    window.addEventListener('resize', updateFromScroll, { passive: true });
    window.addEventListener('load', () => scrollToItem(0, 'auto'), { once: true });

    scrollToItem(0, 'auto');
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
   DESKTOP STUDENT VIDEO PICKER
   ============================================================ */
(function () {
  const desktopQuery = window.matchMedia('(min-width: 641px)');
  const items = Array.from(document.querySelectorAll('.student-videos-grid .sv-item'));
  const dots = Array.from(document.querySelectorAll('.student-videos-section .video-dot'));
  const prevButton = document.querySelector('.video-arrow-prev');
  const nextButton = document.querySelector('.video-arrow-next');

  if (!items.length || !prevButton || !nextButton) return;

  let activeIndex = Math.max(0, items.findIndex((item) => item.classList.contains('is-active')));

  const setActive = (index) => {
    if (!desktopQuery.matches) return;
    activeIndex = (index + items.length) % items.length;
    items.forEach((item, itemIndex) => {
      const isActive = itemIndex === activeIndex;
      item.classList.toggle('is-active', isActive);
      if (!isActive) item.querySelector('video')?.pause();
    });
    dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === activeIndex));
  };

  prevButton.addEventListener('click', () => setActive(activeIndex - 1));
  nextButton.addEventListener('click', () => setActive(activeIndex + 1));

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => setActive(index));
  });

  desktopQuery.addEventListener('change', () => setActive(activeIndex));
  setActive(activeIndex);
})();

/* ============================================================
   CENTRALIZED VIDEO PLAYBACK
   ============================================================ */
(function () {
  const videos = Array.from(document.querySelectorAll('video[data-video-role]'));
  if (!videos.length) return;

  const states = new WeakMap();
  const visibleVideos = new Set();

  const configureVideo = (video) => {
    const role = video.dataset.videoRole;
    video.preload = 'metadata';
    video.playsInline = true;
    video.setAttribute('playsinline', '');

    if (role === 'alumnos') {
      video.muted = false;
      video.defaultMuted = false;
      video.autoplay = false;
      video.removeAttribute('autoplay');
      video.removeAttribute('muted');
      video.loop = true;
      video.controls = true;
      video.volume = 1;
    } else if (role === 'vsl') {
      video.muted = false;
      video.defaultMuted = false;
      video.loop = false;
      video.controls = true;
      video.autoplay = true;
      video.volume = 1;
    }

    states.set(video, {
      role,
      visible: false,
      userPaused: false,
      pausingBySystem: false
    });
  };

  const pauseVideo = (video) => {
    const state = states.get(video);
    if (!state || video.paused) return;
    state.pausingBySystem = true;
    video.pause();
    window.setTimeout(() => {
      state.pausingBySystem = false;
    }, 250);
  };

  const playVideo = async (video) => {
    const state = states.get(video);
    if (!state || !state.visible || state.userPaused || document.hidden) return;

    try {
      video.muted = false;
      video.defaultMuted = false;
      video.volume = 1;
      delete video.dataset.autoplayFallback;

      await video.play();
    } catch (error) {
      if (state.role === 'vsl') {
        video.dataset.autoplayFallback = 'blocked';
      }
    }
  };

  const unlockBlockedAutoplay = () => {
    visibleVideos.forEach((video) => {
      const state = states.get(video);
      if (!state || state.role !== 'vsl' || video.dataset.autoplayFallback !== 'blocked') return;
      state.userPaused = false;
      playVideo(video);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const state = states.get(video);
        if (!state) return;

        const minRatio = state.role === 'vsl' ? 0.5 : 0.35;
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= minRatio;
        state.visible = isVisible;

        if (isVisible) {
          visibleVideos.add(video);
          if (state.role !== 'alumnos') playVideo(video);
        } else {
          visibleVideos.delete(video);
          state.userPaused = false;
          pauseVideo(video);
        }
      });
    },
    {
      threshold: [0, 0.2, 0.35, 0.5, 0.75],
      rootMargin: '80px 0px 80px 0px'
    }
  );

  videos.forEach((video) => {
    configureVideo(video);

    video.addEventListener('pause', () => {
      const state = states.get(video);
      if (!state) return;
      if (state.pausingBySystem) {
        state.pausingBySystem = false;
        return;
      }
      if (!state.visible || document.hidden) return;
      state.userPaused = true;
    });

    video.addEventListener('play', () => {
      const state = states.get(video);
      if (state) state.userPaused = false;
    });

    observer.observe(video);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      videos.forEach(pauseVideo);
      return;
    }

    visibleVideos.forEach((video) => {
      const state = states.get(video);
      if (state) state.userPaused = false;
      if (state && state.role !== 'alumnos') playVideo(video);
    });
  });

  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    document.addEventListener(eventName, unlockBlockedAutoplay, { passive: true });
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

function submitLeadInBackground(payload) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon('/api/lead', new Blob([body], { type: 'application/json' }));
    if (sent) return;
  }

  fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {});
}

if (form) {
  const nameInput = document.getElementById('fname');
  nameInput?.addEventListener('input', () => {
    nameInput.value = nameInput.value.replace(/\d+/g, '');
  });

  const phoneCodeSelect = document.getElementById('fphoneCode');
  const customPhoneCodeInput = document.getElementById('fphoneCodeCustom');

  const updateCustomPhoneCode = () => {
    if (phoneCodeSelect?.value === 'custom') {
      customPhoneCodeInput?.classList.add('visible');
      customPhoneCodeInput?.focus();
    } else if (customPhoneCodeInput) {
      customPhoneCodeInput.value = '';
      customPhoneCodeInput.classList.remove('visible');
    }
  };

  phoneCodeSelect?.addEventListener('change', updateCustomPhoneCode);
  updateCustomPhoneCode();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nameInput = document.getElementById('fname');
    const emailInput = document.getElementById('femail');
    const phoneCodeInput = document.getElementById('fphoneCode');
    const phoneInput = document.getElementById('fphone');
    const customPhoneCodeInput = document.getElementById('fphoneCodeCustom');

    const name = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const selectedPhoneCode = phoneCodeInput?.value || '+34';
    const customPhoneCode = customPhoneCodeInput?.value.trim() || '';
    const phoneCode = selectedPhoneCode === 'custom' && customPhoneCode
      ? `+${customPhoneCode.replace(/^\+/, '')}`
      : selectedPhoneCode;
    const phoneLocal = phoneInput?.value.trim() || '';
    const phone = `${phoneCode}${phoneLocal.replace(/\D/g, '')}`;
    const btn = form.querySelector('button[type="submit"]');

    if (selectedPhoneCode === 'custom') {
      if (!customPhoneCode || !/^\+?\d{1,4}$/.test(customPhoneCode)) {
        showError('Por favor, introduce un prefijo internacional válido, por ejemplo +33.');
        customPhoneCodeInput?.focus();
        return;
      }
    }

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

    if (btn) {
      btn.innerHTML = 'ACCEDIENDO...';
      btn.disabled = true;
      btn.style.opacity = '.9';
    }

    try {
      const leads = JSON.parse(localStorage.getItem('leads') || '[]');
      leads.push({ name, email, phone, date: new Date().toISOString() });
      localStorage.setItem('leads', JSON.stringify(leads));
      localStorage.setItem('masterclassAccess', 'verified');
    } catch (error) {
      localStorage.setItem('masterclassAccess', 'verified');
    }

    if (typeof fbq !== 'undefined') {
      fbq('track', 'Lead', {
        content_name: 'Masterclass Dropshipping IA',
        status: 'submitted'
      });
    }

    submitLeadInBackground({ name, email, phone });
    window.location.href = 'masterclass.html';
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
  btn.addEventListener('click', (event) => {
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Contact');
    }

    const phone = '34631708085';
    const text = 'Hola, tengo una pregunta sobre la masterclass.';
    const encodedText = encodeURIComponent(text);
    const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);

    event.preventDefault();

    if (isMobile) {
      window.location.href = `whatsapp://send?phone=${phone}&text=${encodedText}`;
      window.setTimeout(() => {
        window.location.href = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
      }, 900);
      return;
    }

    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`, '_blank', 'noopener');
  });
});

document.querySelectorAll('.calendly-track').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Schedule');
    }
  });
});