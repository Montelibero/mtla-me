// assets/app.js
(function () {
  // --- A) Auto-redirect to preferred language (root index.html only)
  var html = document.documentElement;
  if (!html.hasAttribute('data-no-redirect')) {
    try {
      var SUPPORTED = window.SUPPORTED_LANGS || ['en', 'ru', 'es', 'sr'];
      var url = new URL(location.href);
      var explicit = url.searchParams.get('lang') || localStorage.getItem('lang');
      var lang = null;

      function pickLang(langs) {
        for (var i = 0; i < langs.length; i++) {
          var v = (langs[i] || '').toLowerCase();
          var prefix = v.slice(0, 2);
          if (SUPPORTED.indexOf(v) >= 0) return v;
          if (SUPPORTED.indexOf(prefix) >= 0) return prefix;
        }
        return null;
      }

      lang = (explicit && SUPPORTED.indexOf(explicit) >= 0) 
        ? explicit 
        : pickLang(navigator.languages || [navigator.language]) || SUPPORTED[0];

      localStorage.setItem('lang', lang);

      var base = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/';
      if (!/\/(en|ru|es|sr)(\/|$)/.test(base)) {
        var norm = base.replace(/\/index\.html\/?$/, '/');
        location.replace((norm.endsWith('/') ? norm : norm + '/') + lang + '/');
      }
    } catch (e) { /* fallback to noscript */ }
  }

  // --- B) Load Markdown with minimal parser
  function parseMd(md, baseUrl) {
    var esc = function(s) { return s.replace(/[&<>]/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); };
    var resolveUrl = function(href) {
      if (href === 'Agreement.ru.md') return 'https://raw.githubusercontent.com/Montelibero/MTLA-Documents/refs/heads/main/Internal/Agreement/Agreement.ru.md';
      try { new URL(href); return href; } catch(_) {}
      try { return new URL(href, baseUrl || location.href).toString(); } catch(_) { return href; }
    };
    var linkify = function(s) { return s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, t, h) { return '<a href="'+esc(resolveUrl(h))+'">'+esc(t)+'</a>'; }); };

    var lines = md.replace(/\r\n/g, '\n').split('\n');
    var html = '', i = 0;

    // Skip leading title (first h1/h2), but NOT blockquotes
    var j = 0;
    while (j < lines.length && /^\s*$/.test(lines[j])) j++;
    if (j < lines.length && !/^>\s?/.test(lines[j])) {
      var next = (lines[j+1] || '').trim();
      if (/^#{1,6}\s+/.test(lines[j]) || /^=+$/.test(next) || /^-+$/.test(next)) {
        i = j + ((/^[=-]+$/.test(next)) ? 2 : 1);
      }
    }

    while (i < lines.length) {
      var line = lines[i], next = (lines[i+1] || '').trim();

      if (/^\s*$/.test(line)) { i++; continue; }

      // Headers
      if (/^=+$/.test(next)) { html += '<h1>'+esc(line.trim())+'</h1>'; i+=2; continue; }
      if (/^-+$/.test(next)) { html += '<h2>'+esc(line.trim())+'</h2>'; i+=2; continue; }
      var hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { html += '<h'+hm[1].length+'>'+esc(hm[2].trim())+'</h'+hm[1].length+'>'; i++; continue; }

      // Blockquotes
      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        html += '<blockquote><p>'+linkify(esc(q.join(' ').trim()))+'</p></blockquote>';
        continue;
      }

      // Lists (ordered) - with multiline support
      if (/^\s*\d+\.\s+/.test(line)) {
        var start = parseInt((line.match(/^\s*(\d+)\./) || [0,1])[1], 10);
        html += start > 1 ? '<ol start="'+start+'">' : '<ol>';
        while (i < lines.length) {
          if (/^\s*$/.test(lines[i])) { i++; continue; }
          if (!/^\s*\d+\.\s+/.test(lines[i])) break;
          var item = lines[i++].replace(/^\s*\d+\.\s+/, '').trim();
          var buf = [item];
          // Collect continuation lines (indented or starting with lowercase/punctuation)
          while (i < lines.length) {
            var cont = lines[i];
            if (/^\s*$/.test(cont)) { i++; continue; }
            if (/^\s*\d+\.\s+/.test(cont) || /^\s*[-*+]\s+/.test(cont) || /^#{1,6}\s/.test(cont)) break;
            if (/^\s{2,}/.test(cont) || !/^[A-Z0-9]/.test(cont.trim())) {
              buf.push(cont.trim());
              i++;
            } else break;
          }
          html += '<li>'+linkify(esc(buf.join(' ')))+'</li>';
        }
        html += '</ol>';
        continue;
      }

      // Lists (unordered) - with multiline support
      if (/^\s*[-*+]\s+/.test(line)) {
        html += '<ul>';
        while (i < lines.length) {
          if (/^\s*$/.test(lines[i])) { i++; continue; }
          if (!/^\s*[-*+]\s+/.test(lines[i])) break;
          var item2 = lines[i++].replace(/^\s*[-*+]\s+/, '').trim();
          var buf2 = [item2];
          // Collect continuation lines
          while (i < lines.length) {
            var cont2 = lines[i];
            if (/^\s*$/.test(cont2)) { i++; continue; }
            if (/^\s*\d+\.\s+/.test(cont2) || /^\s*[-*+]\s+/.test(cont2) || /^#{1,6}\s/.test(cont2)) break;
            if (/^\s{2,}/.test(cont2) || !/^[A-Z0-9]/.test(cont2.trim())) {
              buf2.push(cont2.trim());
              i++;
            } else break;
          }
          html += '<li>'+linkify(esc(buf2.join(' ')))+'</li>';
        }
        html += '</ul>';
        continue;
      }

      // Paragraph
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*[\d*+-]/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^>\s?/.test(lines[i])) {
        para.push(esc(lines[i++].trim()));
      }
      if (para.length) html += '<p>'+linkify(para.join(' '))+'</p>';
    }

    return html;
  }

  function loadMarkdown() {
    var nodes = document.querySelectorAll('[data-markdown]');
    nodes.forEach(function(el) {
      var file = el.getAttribute('data-markdown');
      if (!file) return;
      fetch(file, { credentials: 'same-origin' })
        .then(function(r) { return r.text(); })
        .then(function(text) {
          var base = (function(){ try { return new URL(file, location.href).toString(); } catch(_) { return null; } })();
          el.innerHTML = '<article class="markdown">'+parseMd(text, base)+'</article>';
        })
        .catch(function() { /* fallback */ });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMarkdown);
  } else {
    loadMarkdown();
  }
})();
