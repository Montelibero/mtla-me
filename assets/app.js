// assets/app.js
(function () {
  // --- Load Markdown with minimal parser
  function parseMd(md, baseUrl) {
    var esc = function(s) {
      return String(s).replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    };
    var escAttr = esc;
    var resolveUrl = function(href) {
      href = (href || '').trim();
      if (!href) return null;
      if (href === 'Agreement.ru.md') return 'https://docs.mtla.me/Agreement/Agreement.ru.html';
      if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^#/.test(href) || /^\/(?!\/)/.test(href) || /^\.\.?\//.test(href)) {
        return href;
      }
      if (/^\/\//.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
      try {
        var resolved = new URL(href, baseUrl || location.href);
        if (!/^https?:$/.test(resolved.protocol)) return null;
        return href;
      } catch(_) {
        return null;
      }
    };
    var isExternalUrl = function(href) {
      try {
        var resolved = new URL(href, baseUrl || location.href);
        return /^https?:$/.test(resolved.protocol) && resolved.origin !== location.origin;
      } catch(_) {
        return false;
      }
    };
    var linkify = function(s) {
      var linkPattern = /\[([^\]]+)\]\(((?:[^()]|\([^)]*\))+)\)/g;
      var out = '';
      var last = 0;
      s.replace(linkPattern, function(match, t, h, offset) {
        out += esc(s.slice(last, offset));
        var resolved = resolveUrl(h);
        if (!resolved) {
          out += esc(match);
        } else {
          var externalAttrs = isExternalUrl(resolved) ? ' target="_blank" rel="noopener noreferrer"' : '';
          out += '<a href="' + escAttr(resolved) + '"' + externalAttrs + '>' + esc(t) + '</a>';
        }
        last = offset + match.length;
        return match;
      });
      out += esc(s.slice(last));
      return out;
    };

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
      if (/^=+$/.test(next)) { html += '<h1>'+linkify(line.trim())+'</h1>'; i+=2; continue; }
      if (/^-+$/.test(next)) { html += '<h2>'+linkify(line.trim())+'</h2>'; i+=2; continue; }
      var hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { html += '<h'+hm[1].length+'>'+linkify(hm[2].trim())+'</h'+hm[1].length+'>'; i++; continue; }

      // Blockquotes
      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        html += '<blockquote><p>'+linkify(q.join(' ').trim())+'</p></blockquote>';
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
          html += '<li>'+linkify(buf.join(' '))+'</li>';
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
          html += '<li>'+linkify(buf2.join(' '))+'</li>';
        }
        html += '</ul>';
        continue;
      }

      // Paragraph
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*[\d*+-]/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^>\s?/.test(lines[i])) {
        para.push(lines[i++].trim());
      }
      if (para.length) html += '<p>'+linkify(para.join(' '))+'</p>';
    }

    return html;
  }

  function loadMarkdown() {
    function showMarkdownError(el, err) {
      var notice = el.querySelector('.md-error');
      var fallbackText = el.getAttribute('data-fallback-text');

      if (!notice && fallbackText) {
        notice = document.createElement('p');
        notice.className = 'md-error';
        notice.hidden = true;
        notice.textContent = fallbackText;
        el.insertBefore(notice, el.firstChild);
      }

      if (notice) {
        if (!notice.textContent && fallbackText) notice.textContent = fallbackText;
        if (el.firstChild !== notice) el.insertBefore(notice, el.firstChild);
        notice.hidden = false;
      }

      console.warn('agreement load failed:', err);
    }

    var nodes = document.querySelectorAll('[data-markdown]');
    nodes.forEach(function(el) {
      var file = el.getAttribute('data-markdown');
      if (!file) return;
      fetch(file, { credentials: 'same-origin' })
        .then(function(response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          var contentType = (response.headers.get('content-type') || '').toLowerCase();
          if (contentType && contentType.indexOf('text/') !== 0) {
            throw new Error('Unexpected content type: ' + contentType);
          }
          return response.text();
        })
        .then(function(text) {
          var base = (function(){ try { return new URL(file, location.href).toString(); } catch(_) { return null; } })();
          el.innerHTML = '<article class="markdown">'+parseMd(text, base)+'</article>';
        })
        .catch(function(err) {
          showMarkdownError(el, err);
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMarkdown);
  } else {
    loadMarkdown();
  }
})();
