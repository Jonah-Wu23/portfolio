/**
 * Flip Engine (flip.js)
 * High-performance, zero-dependency horizontal slide flip engine.
 * 
 * Part of Wu Zonghe Portfolio (portfolio/site/assets/js/flip.js)
 * Compliant with PRD Technical Specification §3.4.4
 * 
 * Features:
 * - Horizontal deck scroll container management (scroll-snap / smooth scroll)
 * - Window capture phase passive wheel interception with vertical-scroll boundary fallback
 * - Keyboard navigation (Arrows, Space with interactive element isolation, PageUp/Down, Home, End)
 * - Touch swipe delegation to native CSS scroll-snap with IntersectionObserver sync
 * - URL Hash deep linking (#s1..#sN, history.replaceState, popstate synchronization)
 * - Active slide state management (.is-active, aria-hidden, data-visible)
 * - Staggered .reveal entry transitions (60ms configurable delay)
 * - IntersectionObserver (threshold 0.6) for off-screen energy conservation & swipe tracking
 * - prefers-reduced-motion instant transitions and accessibility
 * - Document visibilitychange listener to suspend background rAF
 * - High performance (zero allocations per frame/event, zero long tasks)
 */
(function (global) {
  'use strict';

  var DEFAULT_OPTIONS = {
    wheelCooldown: 800,      // ms cooldown between wheel page turns (default: 800ms)
    revealStagger: 60,       // ms delay stagger between sequential .reveal elements (default: 60ms)
    threshold: 0.6,          // IntersectionObserver visibility threshold for slide detection (default: 0.6)
    hashPrefix: 's',         // URL hash prefix (#s1..#sN)
    wheelThreshold: 20,      // Minimum deltaY magnitude to trigger wheel flip
    onChange: null           // Callback function(slideIndex, totalCount, activeSlideElement)
  };

  // Single internal state store
  var state = {
    deckEl: null,
    slides: [],
    slideCount: 0,
    currentIndex: -1,
    targetIndex: -1,
    isNavigating: false,
    navTimer: null,
    lastFlipTime: 0,
    observer: null,
    mediaQuery: null,
    prefersReducedMotion: false,
    options: null,
    isInitialized: false,
    handlers: {},
    rafId: null
  };

  /**
   * Helper: check if element or any of its scrollable ancestors inside the current slide
   * has remaining vertical scroll space in the direction of scroll.
   */
  function canScrollVertically(target, deltaY) {
    if (!state.deckEl || state.currentIndex < 0) return false;
    var currentSlide = state.slides[state.currentIndex];
    if (!currentSlide) return false;

    var node = target;
    // If target is null or outside the current slide (e.g. fixed navigation HUD), fallback to currentSlide
    if (!node || !currentSlide.contains(node)) {
      node = currentSlide;
    }

    while (node && node !== state.deckEl && node !== document.body && node !== document.documentElement) {
      if (currentSlide === node || currentSlide.contains(node)) {
        var style = window.getComputedStyle(node);
        var overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          var scrollHeight = node.scrollHeight;
          var clientHeight = node.clientHeight;
          if (scrollHeight > clientHeight + 1) { // 1px tolerance for sub-pixel rendering
            var scrollTop = node.scrollTop;
            var maxScroll = scrollHeight - clientHeight;
            if (deltaY > 0) {
              // Scrolling down: can we scroll further down?
              if (scrollTop < maxScroll - 2) {
                return true;
              }
            } else if (deltaY < 0) {
              // Scrolling up: can we scroll further up?
              if (scrollTop > 2) {
                return true;
              }
            }
          }
        }
      }
      node = node.parentElement;
    }
    return false;
  }

  /**
   * Helper: check if target is an interactive element where Space should not flip slides.
   */
  function isInteractive(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a' || tag === 'summary') {
      return true;
    }
    if (target.isContentEditable) return true;
    if (target.getAttribute) {
      var role = target.getAttribute('role');
      if (role === 'button' || role === 'link' || role === 'textbox' || role === 'combobox' || role === 'slider') {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper: check if target is a text input where arrow keys should not trigger page turns.
   */
  function isTextInput(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    if (tag === 'textarea' || target.isContentEditable) return true;
    if (tag === 'input') {
      var type = target.type ? target.type.toLowerCase() : 'text';
      return (type === 'text' || type === 'password' || type === 'email' || type === 'number' || type === 'search' || type === 'tel' || type === 'url');
    }
    return false;
  }

  /**
   * Helper: parse slide index from current URL hash (#s1..#sN or #customId).
   */
  function getIndexFromHash() {
    var hash = window.location.hash;
    if (!hash) return 0;

    var rawHash = hash.replace(/^#/, '');
    // Check if matches direct slide id
    for (var i = 0; i < state.slideCount; i++) {
      if (state.slides[i].id === rawHash) {
        return i;
      }
    }

    // Check if matches prefix pattern (e.g. #s3)
    var prefix = state.options.hashPrefix || 's';
    var regex = new RegExp('^' + prefix + '([1-9]\\d*)$', 'i');
    var match = rawHash.match(regex);
    if (match && match[1]) {
      var num = parseInt(match[1], 10);
      var idx = num - 1;
      if (idx >= 0 && idx < state.slideCount) {
        return idx;
      }
    }
    return 0;
  }

  /**
   * Helper: update URL hash using replaceState (does not clutter history).
   */
  function updateHash(index) {
    if (index < 0 || index >= state.slideCount) return;
    var currentSlide = state.slides[index];
    var targetHash;
    if (currentSlide && currentSlide.id) {
      targetHash = '#' + currentSlide.id;
    } else {
      var prefix = state.options.hashPrefix || 's';
      targetHash = '#' + prefix + (index + 1);
    }

    if (window.location.hash !== targetHash) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', targetHash);
      } else {
        window.location.hash = targetHash;
      }
    }
  }

  /**
   * Apply staggered transition-delay to .reveal elements in the active slide.
   */
  function applyReveal(slideEl) {
    if (!slideEl) return;
    var reveals = slideEl.querySelectorAll('.reveal');
    var len = reveals.length;
    if (len === 0) return;

    if (state.prefersReducedMotion) {
      for (var i = 0; i < len; i++) {
        reveals[i].style.transitionDelay = '0ms';
        reveals[i].classList.add('is-visible');
      }
    } else {
      var stagger = state.options.revealStagger || 60;
      for (var j = 0; j < len; j++) {
        reveals[j].style.transitionDelay = (j * stagger) + 'ms';
        reveals[j].classList.add('is-visible');
      }
    }
  }

  /**
   * Reset .reveal elements when slide is deactivated.
   */
  function resetReveal(slideEl) {
    if (!slideEl) return;
    var reveals = slideEl.querySelectorAll('.reveal');
    var len = reveals.length;
    for (var i = 0; i < len; i++) {
      reveals[i].classList.remove('is-visible');
      reveals[i].style.transitionDelay = '';
    }
  }

  /**
   * Synchronize slide states (.is-active, aria-hidden, data-visible, reveals, callback, URL).
   */
  function setActiveSlide(newIndex, updateUrl) {
    if (newIndex < 0 || newIndex >= state.slideCount) return;
    var prevIndex = state.currentIndex;
    state.currentIndex = newIndex;

    for (var i = 0; i < state.slideCount; i++) {
      var slide = state.slides[i];
      if (i === newIndex) {
        slide.classList.add('is-active');
        slide.removeAttribute('aria-hidden');
        slide.setAttribute('data-visible', 'true');
        slide.inert = false;
        applyReveal(slide);
      } else {
        slide.classList.remove('is-active');
        slide.setAttribute('aria-hidden', 'true');
        slide.setAttribute('data-visible', 'false');
        slide.inert = true;
        resetReveal(slide);
        // Pause any background media in inactive slides to save resources
        var mediaList = slide.querySelectorAll('video, audio');
        for (var m = 0; m < mediaList.length; m++) {
          if (!mediaList[m].paused) {
            mediaList[m].pause();
          }
        }
      }
    }

    if (updateUrl !== false) {
      updateHash(newIndex);
    }

    if (typeof state.options.onChange === 'function' && (newIndex !== prevIndex || !state.isInitialized)) {
      try {
        state.options.onChange(newIndex, state.slideCount, state.slides[newIndex]);
      } catch (err) {
        console.error('[Flip] onChange callback error:', err);
      }
    }
  }

  /**
   * Programmatically navigate to slide at index.
   * @param {number} index - 0-based slide index.
   * @param {Object} [navOpts] - Navigation options { instant: boolean, updateUrl: boolean }.
   */
  function goTo(index, navOpts) {
    if (!state.deckEl || state.slideCount === 0) return;
    if (index < 0) index = 0;
    if (index >= state.slideCount) index = state.slideCount - 1;

    var instant = (navOpts && navOpts.instant) || state.prefersReducedMotion;
    var updateUrl = (navOpts && typeof navOpts.updateUrl === 'boolean') ? navOpts.updateUrl : true;
    var targetSlide = state.slides[index];
    if (!targetSlide) return;

    
    state.isNavigating = true;
    state.targetIndex = index;

    if (state.navTimer) {
      clearTimeout(state.navTimer);
    }
    state.navTimer = setTimeout(function () {
      state.isNavigating = false;
      state.targetIndex = -1;
    }, 700);

    setActiveSlide(index, updateUrl);

    var targetLeft = Math.round(targetSlide.offsetLeft);
    if (instant) {
      state.deckEl.scrollLeft = targetLeft;
      state.isNavigating = false;
    } else {
      if (typeof state.deckEl.scrollTo === 'function') {
        state.deckEl.scrollTo({
          left: targetLeft,
          top: 0,
          behavior: 'smooth'
        });
      } else {
        state.deckEl.scrollLeft = targetLeft;
      }
    }
  }

  function next() {
    if (state.currentIndex < state.slideCount - 1) {
      goTo(state.currentIndex + 1);
    }
  }

  function prev() {
    if (state.currentIndex > 0) {
      goTo(state.currentIndex - 1);
    }
  }

  /**
   * Helper: check if an overlay (e.g. image lightbox) is open and slide
   * navigation should be suspended. Lightbox toggles .lightbox-open on <html>.
   */
  function isOverlayOpen() {
    return document.documentElement.classList.contains('lightbox-open');
  }

  // Wheel event listener (window capture layer, passive: true)
  function onWheel(e) {
    if (!state.isInitialized || state.slideCount === 0) return;
    if (isOverlayOpen()) return; // 灯箱打开期间不翻页
    var deltaY = e.deltaY;
    var minDelta = state.options.wheelThreshold || 20;
    if (Math.abs(deltaY) < minDelta) return;

    var now = (performance && performance.now) ? performance.now() : Date.now();
    var cooldown = state.options.wheelCooldown || 800;
    if (now - state.lastFlipTime < cooldown) {
      return;
    }

    if (canScrollVertically(e.target, deltaY)) {
      return; // Hand over to native vertical scrolling
    }

    state.lastFlipTime = now;
    if (deltaY > 0) {
      if (state.currentIndex < state.slideCount - 1) {
        goTo(state.currentIndex + 1);
      }
    } else if (deltaY < 0) {
      if (state.currentIndex > 0) {
        goTo(state.currentIndex - 1);
      }
    }
  }

  // Keyboard navigation handler
  function onKeyDown(e) {
    if (!state.isInitialized || state.slideCount === 0) return;
    if (isOverlayOpen()) return; // 灯箱打开期间不翻页（灯箱自身已接管按键）
    var target = e.target;
    var key = e.key;
    var code = e.code;

    if (key === ' ' || code === 'Space') {
      if (isInteractive(target)) {
        return; // Do not hijack space when interactive element has focus
      }
      e.preventDefault();
      next();
      return;
    }

    if (isTextInput(target)) {
      return; // Do not hijack arrow/nav keys inside text inputs
    }

    if (key === 'ArrowRight' || key === 'PageDown' || key === 'ArrowDown') {
      e.preventDefault();
      next();
    } else if (key === 'ArrowLeft' || key === 'PageUp' || key === 'ArrowUp') {
      e.preventDefault();
      prev();
    } else if (key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (key === 'End') {
      e.preventDefault();
      goTo(state.slideCount - 1);
    }
  }

  // History & hash change handler
  function onPopState() {
    if (!state.isInitialized) return;
    var hashIndex = getIndexFromHash();
    if (hashIndex !== state.currentIndex) {
      goTo(hashIndex, { updateUrl: false });
    }
  }

  // Reduced motion preference change handler
  function onMotionChange(e) {
    state.prefersReducedMotion = !!e.matches;
    if (state.slides[state.currentIndex]) {
      applyReveal(state.slides[state.currentIndex]);
    }
  }

  // Visibility change handler for energy conservation
  function onVisibilityChange() {
    if (document.hidden) {
      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    }
  }

  function onScrollEnd() {
    state.isNavigating = false;
    state.targetIndex = -1;
  }

  // IntersectionObserver to observe slide visibility and touch scroll snap changes
  function setupObserver() {
    if (typeof IntersectionObserver === 'undefined') return;
    var threshold = state.options.threshold || 0.6;

    state.observer = new IntersectionObserver(function (entries) {
      var highestRatio = 0;
      var bestIndex = -1;

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var idx = state.slides.indexOf(entry.target);
        if (idx !== -1 && entry.isIntersecting && entry.intersectionRatio >= threshold) {
          if (entry.intersectionRatio > highestRatio) {
            highestRatio = entry.intersectionRatio;
            bestIndex = idx;
          }
        }
      }

      if (bestIndex !== -1) {
        // If currently in programmatic navigation, only accept if target slide reached
        if (state.isNavigating) {
          if (bestIndex === state.targetIndex) {
            state.isNavigating = false;
            state.targetIndex = -1;
            if (bestIndex !== state.currentIndex) {
              setActiveSlide(bestIndex, true);
            }
          }
          return;
        }

        // Native touch or scroll snap change
        if (bestIndex !== state.currentIndex) {
          setActiveSlide(bestIndex, true);
        }
      }
    }, {
      root: state.deckEl,
      threshold: [threshold]
    });

    for (var j = 0; j < state.slideCount; j++) {
      state.observer.observe(state.slides[j]);
    }
  }

  /**
   * Initialize Flip engine.
   * @param {HTMLElement|string|Object} [deck] - Container element, CSS selector, or options if first arg.
   * @param {Object} [options] - Configuration options.
   * @returns {Object} Flip API.
   */
  function init(deck, options) {
    if (state.isInitialized) {
      destroy();
    }

    var targetDeck = deck;
    var opts = options || {};

    // Allow init({ options }) shorthand
    if (targetDeck && typeof targetDeck === 'object' && !targetDeck.nodeType && !(typeof Element !== 'undefined' && targetDeck instanceof Element)) {
      opts = targetDeck;
      targetDeck = null;
    }

    if (!targetDeck) {
      targetDeck = document.querySelector('#deck') || document.querySelector('.deck');
    } else if (typeof targetDeck === 'string') {
      targetDeck = document.querySelector(targetDeck);
    }

    if (!targetDeck) {
      console.warn('[Flip] Deck container not found');
      return null;
    }

    state.deckEl = targetDeck;
    
    // Normalize options (support alias names like cooldown / stagger / threshold)
    var merged = Object.assign({}, DEFAULT_OPTIONS);
    if (opts.wheelCooldown != null) merged.wheelCooldown = opts.wheelCooldown;
    else if (opts.cooldown != null) merged.wheelCooldown = opts.cooldown;

    if (opts.revealStagger != null) merged.revealStagger = opts.revealStagger;
    else if (opts.staggerDelay != null) merged.revealStagger = opts.staggerDelay;
    else if (opts.stagger != null) merged.revealStagger = opts.stagger;

    if (opts.threshold != null) merged.threshold = opts.threshold;
    else if (opts.observerThreshold != null) merged.threshold = opts.observerThreshold;

    if (opts.hashPrefix != null) merged.hashPrefix = opts.hashPrefix;
    if (opts.wheelThreshold != null) merged.wheelThreshold = opts.wheelThreshold;
    if (opts.onChange != null) merged.onChange = opts.onChange;

    state.options = merged;

    // Query slides
    var slideNodes = state.deckEl.querySelectorAll('.slide');
    if (slideNodes.length === 0) {
      slideNodes = state.deckEl.children;
    }
    state.slides = Array.prototype.slice.call(slideNodes);
    state.slideCount = state.slides.length;

    if (state.slideCount === 0) {
      console.warn('[Flip] No slides found in deck container');
      return null;
    }

    // Media query for reduced motion
    if (typeof window.matchMedia === 'function') {
      state.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      state.prefersReducedMotion = state.mediaQuery.matches;
      if (state.mediaQuery.addEventListener) {
        state.mediaQuery.addEventListener('change', onMotionChange);
      } else if (state.mediaQuery.addListener) {
        state.mediaQuery.addListener(onMotionChange);
      }
    }

    // Initial position from URL hash
    var initialIndex = getIndexFromHash();
    state.currentIndex = -1;

    // Register event listeners
    state.handlers.wheel = onWheel;
    state.handlers.keydown = onKeyDown;
    state.handlers.popstate = onPopState;
    state.handlers.hashchange = onPopState;
    state.handlers.visibilitychange = onVisibilityChange;
    state.handlers.scrollend = onScrollEnd;

    window.addEventListener('wheel', state.handlers.wheel, { capture: true, passive: true });
    window.addEventListener('keydown', state.handlers.keydown, { capture: false });
    window.addEventListener('popstate', state.handlers.popstate, { passive: true });
    window.addEventListener('hashchange', state.handlers.hashchange, { passive: true });
    document.addEventListener('visibilitychange', state.handlers.visibilitychange, { passive: true });
    if ('onscrollend' in window) {
      state.deckEl.addEventListener('scrollend', state.handlers.scrollend, { passive: true });
    }

    // Setup IntersectionObserver
    setupObserver();

    // Mark initialized and position immediately
    state.isInitialized = true;
    goTo(initialIndex, { instant: true, updateUrl: true });
    state.lastFlipTime = 0;

    return global.Flip;
  }

  /**
   * Clean up all event listeners, observers, and state.
   */
  function destroy() {
    if (!state.isInitialized) return;

    if (state.handlers.wheel) {
      window.removeEventListener('wheel', state.handlers.wheel, { capture: true });
    }
    if (state.handlers.keydown) {
      window.removeEventListener('keydown', state.handlers.keydown, { capture: false });
    }
    if (state.handlers.popstate) {
      window.removeEventListener('popstate', state.handlers.popstate);
    }
    if (state.handlers.hashchange) {
      window.removeEventListener('hashchange', state.handlers.hashchange);
    }
    if (state.handlers.visibilitychange) {
      document.removeEventListener('visibilitychange', state.handlers.visibilitychange);
    }
    if (state.handlers.scrollend && state.deckEl) {
      state.deckEl.removeEventListener('scrollend', state.handlers.scrollend);
    }

    if (state.mediaQuery) {
      if (state.mediaQuery.removeEventListener) {
        state.mediaQuery.removeEventListener('change', onMotionChange);
      } else if (state.mediaQuery.removeListener) {
        state.mediaQuery.removeListener(onMotionChange);
      }
    }

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.navTimer) {
      clearTimeout(state.navTimer);
      state.navTimer = null;
    }

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    for (var i = 0; i < state.slideCount; i++) {
      state.slides[i].classList.remove('is-active');
      state.slides[i].removeAttribute('aria-hidden');
      state.slides[i].removeAttribute('data-visible');
      resetReveal(state.slides[i]);
    }

    state.deckEl = null;
    state.slides = [];
    state.slideCount = 0;
    state.currentIndex = -1;
    state.targetIndex = -1;
    state.isNavigating = false;
    state.handlers = {};
    state.isInitialized = false;
  }

  // Public API definition
  var Flip = {
    version: '1.0.0',
    init: init,
    destroy: destroy,
    goTo: goTo,
    goto: goTo, // alias for lowercase convenience
    next: next,
    prev: prev,
    getCurrentIndex: function () { return state.currentIndex; },
    getSlideCount: function () { return state.slideCount; },
    getSlide: function (idx) { return state.slides[idx] || null; },
    getOptions: function () { return Object.assign({}, state.options); }
  };

  global.Flip = Flip;

})(typeof window !== 'undefined' ? window : this);
