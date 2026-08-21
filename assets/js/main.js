/**
 * main.js - 全局初始化与交互逻辑
 * 吴宗河作品集 · Swiss International Style × Blueprint
 * 
 * 职责：
 * 1. 动态生成底部刻度导航点 (.slide-nav__dots) 并绑定交互
 * 2. 初始化 Flip 引擎 (window.Flip.init) 并挂载 onChange 回调
 * 3. 实时联动刻度高亮、计数器 ('01 / 10') 与蓝图面板主题切换
 * 4. 自动同步当前版权年份
 * 5. 全站零控制台报错、零硬编码幻灯片总数
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var deck = document.getElementById('deck');
  if (!deck) {
    console.warn('[Portfolio] #deck container not found');
    return;
  }

  var slideNavCount = document.getElementById('slide-nav-count');
  var slideNavDots = document.getElementById('slide-nav-dots');
  var siteHeader = document.getElementById('site-header');

  // 获取所有 slide 元素（无硬编码数量）
  var slides = deck.querySelectorAll('.slide');
  var totalSlides = slides.length;

  if (totalSlides === 0) {
    console.warn('[Portfolio] No slides found');
    return;
  }

  // 1. 动态生成底部导航刻度条
  var dotElements = [];
  if (slideNavDots) {
    slideNavDots.innerHTML = '';
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < totalSlides; i++) {
      var slide = slides[i];
      var slideNum = i + 1;
      var slideNumStr = slideNum < 10 ? '0' + slideNum : '' + slideNum;
      var slideId = slide.id || ('s' + slideNum);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slide-nav__dot';
      dot.setAttribute('data-index', i);
      dot.setAttribute('data-target', slideId);
      dot.setAttribute('aria-label', '跳转至第 ' + slideNumStr + ' 页');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', 'false');

      // 绑定点击与键盘跳转
      (function (index) {
        dot.addEventListener('click', function (e) {
          e.preventDefault();
          if (window.Flip && typeof window.Flip.goTo === 'function') {
            window.Flip.goTo(index);
          }
        });
      })(i);

      fragment.appendChild(dot);
      dotElements.push(dot);
    }

    slideNavDots.appendChild(fragment);
  }

  /**
   * 状态更新函数：计数器、刻度条与暗色/蓝图主题同步
   * @param {number} currentIndex 0-based 当前幻灯片索引
   * @param {number} totalCount 幻灯片总数
   * @param {HTMLElement} activeSlide 当前活跃的 slide 元素
   */
  function handleSlideChange(currentIndex, totalCount, activeSlide) {
    var currentDisplay = currentIndex + 1;
    var currentStr = currentDisplay < 10 ? '0' + currentDisplay : '' + currentDisplay;
    var totalStr = totalCount < 10 ? '0' + totalCount : '' + totalCount;

    // 更新计数器文字
    if (slideNavCount) {
      slideNavCount.textContent = currentStr + ' / ' + totalStr;
    }

    // 更新刻度条高亮与无障碍属性
    for (var j = 0; j < dotElements.length; j++) {
      if (j === currentIndex) {
        dotElements[j].classList.add('is-active');
        dotElements[j].setAttribute('aria-selected', 'true');
      } else {
        dotElements[j].classList.remove('is-active');
        dotElements[j].setAttribute('aria-selected', 'false');
      }
    }

    // 蓝图面板主题切换（若是 blueprint-panel，添加 blueprint-active 类）
    var isBlueprint = activeSlide && activeSlide.classList.contains('blueprint-panel');
    if (isBlueprint) {
      document.body.classList.add('blueprint-active');
    } else {
      document.body.classList.remove('blueprint-active');
    }
  }

  // 2. 初始化 Flip 引擎
  if (window.Flip && typeof window.Flip.init === 'function') {
    window.Flip.init(deck, {
      wheelCooldown: 800,
      revealStagger: 60,
      threshold: 0.6,
      hashPrefix: 's',
      onChange: handleSlideChange
    });
  } else {
    console.warn('[Portfolio] Flip engine (window.Flip) not found');
  }

  // 3. 自动更新版权年份
  var currentYear = new Date().getFullYear();
  var copyrightElements = document.querySelectorAll('#copyright-text, .copyright');
  copyrightElements.forEach(function (el) {
    el.textContent = '© ' + currentYear + ' Zonghe Wu';
  });

});
