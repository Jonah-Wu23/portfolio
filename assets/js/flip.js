/**
 * Flip Engine (flip.js)
 * High-performance, zero-dependency horizontal slide flip engine.
 * 
 * Part of Wu Zonghe Portfolio (portfolio/site/assets/js/flip.js)
 * Compliant with Specification §3.4.4
 */
(function (global) {
  'use strict';

  var DEFAULT_OPTIONS = {
    wheelCooldown: 800,      // ms cooldown between wheel page turns (default: 800ms)
    revealStagger: 60,        // ms delay stagger between sequential .reveal elements (default: 60ms)
    threshold: 0.6,           // IntersectionObserver visibility threshold for slide detection (default: 0.6)
    hashPrefix: 's',          // URL hash prefix (#s1..#sN)
    wheelThreshold: 20,       // Minimum deltaY magnitude to trigger wheel flip
    onChange: null            // Callback function(slideIndex, totalCount)
  };

  // Engine state singleton
  var state = {
    deckEl: null,
    slides: [],
    slideCount: 0,
    currentIndex: -1,
    lastFlipTime: 0,
    observer: null,
    mediaQuery: null,
    prefersReducedMotion: false,
    options: Object.assign({}, DEFAULT_OPTIONS),
    isInitialized: false,
    handlers: {}
  };

  /**
   * Helper: check if element or any of its scrollable ancestors inside the current slide
   * has remaining vertical scroll space in the direction of scroll.
   */
  function canScrollVertically(target, deltaY) {
    if (!target || state.currentIndex < 0 || !state.slides[state.currentIndex]) return false;
    var currentSlide = state.slides[state.currentIndex];
    var node = target;

    while (node && node !== state.deckEl && node !== document.body && node !== document.documentElement) {
      if (currentSlide === node || currentSlide.contains(node)) {
        var style = window.getComputedStyle(node);
        var overflowY = style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') {
          var scrollHeight = node.scrollHeight;
          var clientHeight = node.clientHeight;
          if (scrollHeight > clientHeight) {
            var scrollTop = node.scrollTop;
            var maxScroll = scrollHeight - clientHeight;
            if (deltaY > 0) {
              // Scrolling down: can we scroll further down?
              if (scrollTop < maxScroll - 1.5) {
                return true;
              }
            } else if (deltaY < 0) {
              // Scrolling up: can we scroll further up?
              if (scrollTop > 1.5) {
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
   * Helper: check if target is an interactive element where Space should not flip.
   */
  function isInteractive(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a') {
      return true;
    }
    if (target.isContentEditable) return true;
    if (target.getAttribute && target.getAttribute('role') === 'button') return true;
    return false;
  }

  /**
   * Helper: check if target is a text editable input.
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
   * Helper: parse slide index from current URL hash (#s1..#sN).
   */
  function getIndexFromHash() {
    var hash = window.location.hash;
    if (!hash) return 0;
    var prefix = state.options.hashPrefix || 's';
    var regex = new RegExp('^#' + prefix + '([1-9]\\d*)$', 'i');
    var match = hash.match(regex);
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
    var prefix = state.options.hashPrefix || 's';
    var targetHash = '#' + prefix + (index + 1);
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
      }
    } else {
      var stagger = state.options.revealStagger || 60;
      for (var j = 0; j < len; j++) {
        reveals[j].style.transitionDelay = (j * stagger) + 'ms';
      }
    }
  }

  /**
   * Synchronize slide states (.is-active, aria-hidden, reveals, callback, URL).
   */
  function setActiveSlide(newIndex, updateUrl) {
    if (newIndex < 0 || newIndex >= state.slideCount) return;
    var prevIndex = state.currentIndex;
    state.currentIndex = newIndex;

    for (var i = 0; i < state.slideCount; i++) {
      var slide = state.slides[i];
      if (i === newIndex) {
        slide.classList.add('is-active');
        slide.setAttribute('aria-hidden', 'false');
        applyReveal(slide);
      } else {
        slide.classList.remove('is-active');
        slide.setAttribute('aria-hidden', 'true');
      }
    }

    if (updateUrl !== false) {
      updateHash(newIndex);
    }

    if (typeof state.options.onChange === 'function' && (newIndex !== prevIndex || !state.isInitialized)) {
      try {
        state.options.onChange(newIndex, state.slideCount);
      } catch (err) {
        console.error('[Flip] onChange callback error:', err);
      }
    }
  }

  /**
   * Programmatically navigate to slide at index.
   */
  function goTo(index, navOpts) {
    if (!state.deckEl || state.slideCount === 0) return;
    if (index < 0) index = 0;
    if (index >= state.slideCount) index = state.slideCount - 1;

    var instant = (navOpts && navOpts.instant) || state.prefersReducedMotion;
    var updateUrl = (navOpts && typeof navOpts.updateUrl === 'boolean') ? navOpts.updateUrl : true;
    var targetSlide = state.slides[index];
    if (!targetSlide) return;

    state.lastFlipTime = Date.now();
    setActiveSlide(index, updateUrl);

    var targetLeft = targetSlide.offsetLeft;
    if (instant) {
      state.deckEl.scrollLeft = targetLeft;
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

  // Wheel event listener (window capture layer, passive)
  function onWheel(e) {
    if (!state.isInitialized || state.slideCount === 0) return;
    var deltaY = e.deltaY;
    var minDelta = state.options.wheelThreshold || 20;
    if (Math.abs(deltaY) < minDelta) return;

    var now = Date.now();
    var cooldown = state.options.wheelCooldown || 800;
    if (now - state.lastFlipTime < cooldown) {
      return;
    }

    if (canScrollVertically(e.target, deltaY)) {
      return; // Hand over to native vertical scrolling
    }

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
    // When hidden, background activity is automatically suspended
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

      if (bestIndex !== -1 && bestIndex !== state.currentIndex) {
        setActiveSlide(bestIndex, true);
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
   * @param {HTMLElement|string} deck - Container element or CSS selector.
   * @param {Object} [options] - Configuration options.
   * @returns {Object} Flip API.
   */
  function init(deck, options) {
    if (state.isInitialized) {
      destroy();
    }

    var targetDeck = (typeof deck === 'string') ? document.querySelector(deck) : deck;
    if (!targetDeck) {
      console.warn('[Flip] Deck container not found:', deck);
      return null;
    }

    state.deckEl = targetDeck;
    state.options = Object.assign({}, DEFAULT_OPTIONS, options || {});

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

    window.addEventListener('wheel', state.handlers.wheel, { capture: true, passive: true });
    window.addEventListener('keydown', state.handlers.keydown, { capture: false });
    window.addEventListener('popstate', state.handlers.popstate, { passive: true });
    window.addEventListener('hashchange', state.handlers.hashchange, { passive: true });
    document.addEventListener('visibilitychange', state.handlers.visibilitychange, { passive: true });

    // Setup IntersectionObserver
    setupObserver();

    // Mark initialized and position immediately
    state.isInitialized = true;
    goTo(initialIndex, { instant: true, updateUrl: true });

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

    for (var i = 0; i < state.slideCount; i++) {
      state.slides[i].classList.remove('is-active');
      state.slides[i].removeAttribute('aria-hidden');
    }

    state.deckEl = null;
    state.slides = [];
    state.slideCount = 0;
    state.currentIndex = -1;
    state.handlers = {};
    state.isInitialized = false;
  }

  // Public API definition
  var Flip = {
    init: init,
    destroy: destroy,
    goTo: goTo,
    next: next,
    prev: prev,
    getCurrentIndex: function () { return state.currentIndex; },
    getSlideCount: function () { return state.slideCount; }
  };

  global.Flip = Flip;

})(typeof window !== 'undefined' ? window : this);
