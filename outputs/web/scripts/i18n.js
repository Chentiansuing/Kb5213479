/* 语言包加载器 v4.0 —— 依赖外部 locales/index.json + locales/<code>.json
 * 必须通过 http/https 访问（file:// 下 fetch 会被浏览器拦截）。
 */
(function () {
  'use strict';

  var MANIFEST = 'locales/index.json';
  var FALLBACK = 'zh-CN';
  var dict = {};
  var failed = [];
  var langs = [];          // [{code,label}]
  var current = FALLBACK;

  try {
    var saved = localStorage.getItem('windows11_setup_lang');
    if (saved) current = saved;
  } catch (e) { /* localStorage 不可用则用默认 */ }

  // 支持 ?lang=ko-KR 直接以指定语言打开（便于分享与截图验证）
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q) current = q;
  } catch (e) { /* 老浏览器忽略 */ }

  function lookup(code, k) {
    var pack = dict[code];
    return pack && Object.prototype.hasOwnProperty.call(pack, k) ? pack[k] : null;
  }

  function t(k, ctx) {
    var v = lookup(current, k);
    if (v === null) v = lookup(FALLBACK, k);
    if (v === null) v = k;
    if (ctx) {
      Object.keys(ctx).forEach(function (m) {
        v = v.split('{' + m + '}').join(ctx[m]);
      });
    }
    return v;
  }

  function apply() {
    if (!dict[current]) return;
    var map = [
      ['[data-i18n]', 'textContent'],
      ['[data-i18n-html]', 'innerHTML'],
      ['[data-i18n-ph]', 'placeholder'],
      ['[data-i18n-title]', 'title']
    ];
    map.forEach(function (pair) {
      document.querySelectorAll(pair[0]).forEach(function (el) {
        var key = el.dataset.i18n || el.dataset.i18nHtml || el.dataset.i18nPh || el.dataset.i18nTitle;
        if (key) el[pair[1]] = t(key);
      });
    });
    document.querySelectorAll('.lang-switch button[data-lang]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lang === current);
    });
    document.documentElement.lang = current;
    document.title = t('setup_title');
  }

  function switchTo(code) {
    if (!dict[code]) return false;
    current = code;
    try { localStorage.setItem('windows11_setup_lang', code); } catch (e) {}
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: code } }));
    return true;
  }

  // 顶部语言按钮完全由清单驱动
  function renderButtons() {
    var host = document.getElementById('langSwitch');
    if (!host) return;
    host.innerHTML = '';
    langs.forEach(function (item, i) {
      if (i) {
        var sep = document.createElement('div');
        sep.className = 'sep';
        host.appendChild(sep);
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.lang = item.code;
      b.textContent = item.label;
      host.appendChild(b);
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.lang-switch button[data-lang]');
    if (btn) switchTo(btn.dataset.lang);
  });

  window.__i18n = {
    t: t,
    apply: function () {},
    switch: switchTo,
    langs: dict,
    supported: [],
    failed: failed,
    get current() { return current; },
    ready: null
  };

  var ready = fetch(MANIFEST, { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (list) {
      if (!Array.isArray(list) || !list.length) throw new Error('清单为空');
      langs = list;
    })
    .catch(function (err) {
      failed.push('index.json');
      console.error('[i18n] 语言清单加载失败：' + MANIFEST + ' —', err.message);
      langs = [{ code: 'zh-CN', label: '简体中文' }];
    })
    .then(function () {
      var codes = langs.map(function (x) { return x.code; });
      if (codes.indexOf(current) < 0) current = codes.indexOf(FALLBACK) >= 0 ? FALLBACK : codes[0];
      window.__i18n.supported = codes;
      window.__i18n.meta = langs;
      renderButtons();
      return Promise.all(langs.map(function (item) {
        return fetch('locales/' + item.code + '.json', { cache: 'no-cache' })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (json) { dict[item.code] = json; })
          .catch(function (err) {
            failed.push(item.code);
            console.error('[i18n] 语言包加载失败：locales/' + item.code + '.json —', err.message);
          });
      }));
    })
    .then(function () {
      if (!dict[current]) {
        var ok = window.__i18n.supported.filter(function (c) { return dict[c]; });
        current = ok.indexOf(FALLBACK) >= 0 ? FALLBACK : (ok[0] || FALLBACK);
      }
      window.__i18n.apply = apply;
      window.__i18n.langs = dict;
      apply();
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current, initial: true } }));
      return true;
    });

  window.__i18n.ready = ready;
})();
