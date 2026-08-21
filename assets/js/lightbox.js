/**
 * lightbox.js - 全站图片点击放大查看器（仅线上交互，打印/PDF 由 print CSS 强制隐藏）
 * 吴宗河作品集 · Swiss International Style × Blueprint
 *
 * 职责：
 * 1. 收集全部 .fig__img img，运行时为容器挂 role="button"（键盘 Enter/Space 可打开）
 * 2. 点击图片弹出全屏灯箱：大图 + 图签说明 + 计数 + 前后翻页 + ESC/遮罩关闭
 * 3. 打开期间在 <html> 挂 .lightbox-open 类，flip.js 据此暂停滚轮/键盘翻页
 * 4. 焦点管理：打开时聚焦关闭按钮，关闭后还原因原焦点
 */
(function (global) {
  'use strict';

  var OPEN_CLASS = 'lightbox-open';
  var state = {
    items: [],        // { src, alt, no, desc, slideNo }
    index: -1,
    el: null,
    imgEl: null,
    noEl: null,
    descEl: null,
    countEl: null,
    navPrev: null,
    navNext: null,
    closeBtn: null,
    lastFocused: null,
    open: false
  };

  function html(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* 构建灯箱 DOM（懒创建，打印/PDF 流程永远不会生成） */
  function buildOverlay() {
    if (state.el) return;

    var root = html('div', 'lightbox');
    root.id = 'lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '图片放大查看器');
    root.hidden = true;

    state.closeBtn = html('button', 'lightbox__close', '× CLOSE');
    state.closeBtn.type = 'button';

    state.navPrev = html('button', 'lightbox__nav lightbox__nav--prev', '‹');
    state.navPrev.type = 'button';
    state.navPrev.setAttribute('aria-label', '上一张图片');

    state.navNext = html('button', 'lightbox__nav lightbox__nav--next', '›');
    state.navNext.type = 'button';
    state.navNext.setAttribute('aria-label', '下一张图片');

    var stage = html('figure', 'lightbox__stage');
    state.imgEl = html('img', 'lightbox__img');
    state.imgEl.alt = '';
    stage.appendChild(state.imgEl);

    var caption = html('div', 'lightbox__caption');
    state.noEl = html('span', 'lightbox__no');
    state.descEl = html('span', 'lightbox__desc');
    state.countEl = html('span', 'lightbox__count');
    caption.appendChild(state.noEl);
    caption.appendChild(state.descEl);
    caption.appendChild(state.countEl);

    root.appendChild(state.closeBtn);
    root.appendChild(state.navPrev);
    root.appendChild(stage);
    root.appendChild(state.navNext);
    root.appendChild(caption);

    state.el = root;
    document.body.appendChild(root);

    state.closeBtn.addEventListener('click', close);
    state.navPrev.addEventListener('click', function () { show(state.index - 1); });
    state.navNext.addEventListener('click', function () { show(state.index + 1); });

    /* 点击遮罩（非子元素）关闭 */
    root.addEventListener('click', function (e) {
      if (e.target === root) close();
    });

    /* 捕获阶段接管按键：ESC 关闭、方向键翻页，并阻断 flip.js 翻页 */
    global.addEventListener('keydown', function (e) {
      if (!state.open) return;
      var key = e.key;
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        show(state.index + 1);
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        show(state.index - 1);
      } else if (key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    /* 灯箱内滚动不穿透到底部幻灯片 */
    root.addEventListener('wheel', function (e) {
      e.stopPropagation();
    }, { passive: true });
  }

  function collectItems() {
    var imgs = document.querySelectorAll('.fig__img img');
    var items = [];
    imgs.forEach(function (img) {
      var fig = img.closest('.fig');
      var figBox = img.closest('.fig__img');
      var slide = img.closest('.slide');
      if (!fig || !figBox || !slide) return;

      var noText = '';
      var captionSpans = fig.querySelectorAll('.fig__caption span');
      if (captionSpans.length > 0) noText = captionSpans[0].textContent.trim();

      var m = slide.id && slide.id.match(/^s(\d+)$/);
      items.push({
        img: img,
        figBox: figBox,
        src: img.getAttribute('src'),
        no: noText,
        desc: img.alt || '',
        slideNo: m ? m[1] : ''
      });
    });
    return items;
  }

  /* 运行时增强：图框容器变为可聚焦按钮 */
  function enhance(items) {
    items.forEach(function (item, i) {
      var box = item.figBox;
      box.setAttribute('role', 'button');
      box.setAttribute('tabindex', '0');
      box.setAttribute('aria-label', '放大查看图片：' + (item.no || item.desc || '图片'));
      box.dataset.lightboxIndex = String(i);

      box.addEventListener('click', function () {
        open(i);
      });

      box.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          e.stopPropagation();
          open(i);
        }
      });
    });
  }

  function show(nextIndex) {
    var total = state.items.length;
    if (total === 0) return;
    /* 循环翻页 */
    var idx = ((nextIndex % total) + total) % total;
    state.index = idx;

    var item = state.items[idx];
    state.imgEl.src = item.src;
    state.imgEl.alt = item.desc || item.no || '作品集图片';
    state.noEl.textContent = item.no || ('FIG ' + (idx + 1));
    state.descEl.textContent = item.desc || '';
    state.countEl.textContent = (idx + 1) + ' / ' + total + (item.slideNo ? ' · SLIDE ' + item.slideNo : '');
  }

  function open(index) {
    buildOverlay();
    state.lastFocused = document.activeElement;
    show(index);
    state.el.hidden = false;
    /* 强制重排后添加过渡类，保证淡入生效 */
    void state.el.offsetWidth;
    state.el.classList.add('is-open');
    state.open = true;
    document.documentElement.classList.add(OPEN_CLASS);
    state.closeBtn.focus();
  }

  function close() {
    if (!state.open) return;
    state.el.classList.remove('is-open');
    state.open = false;
    document.documentElement.classList.remove(OPEN_CLASS);
    var wasFocused = state.lastFocused;
    /* 兼容 prefers-reduced-motion：过渡被压缩时立即隐藏 */
    global.setTimeout(function () {
      if (!state.open) state.el.hidden = true;
    }, 180);
    if (wasFocused && typeof wasFocused.focus === 'function') {
      wasFocused.focus();
    }
  }

  function init() {
    state.items = collectItems();
    if (state.items.length === 0) return;
    enhance(state.items);

    global.Lightbox = {
      version: '1.0.0',
      open: open,
      close: close,
      isOpen: function () { return state.open; },
      count: function () { return state.items.length; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : this);
