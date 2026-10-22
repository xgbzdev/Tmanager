/* ThemeManager main logic. Themes live in /themes/<id>/{fonts,wallpapers,icons}. */
(function () {
  'use strict';

  var state = { themes: [], tab: 'themes', system: false, active: {} };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- helpers ---------- */
  function xhr(url, type) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      if (type) { x.responseType = type; }
      x.onload = function () { (x.status === 200 || x.status === 0) ? res(x.response) : rej(new Error(url + ' ' + x.status)); };
      x.onerror = function () { rej(new Error('load failed: ' + url)); };
      x.send();
    });
  }
  function setStatus(msg) { $('status').textContent = msg; }

  function setSettings(obj) {
    return new Promise(function (res, rej) {
      if (!state.system || !navigator.mozSettings) { return res(false); }
      var req = navigator.mozSettings.createLock().set(obj);
      req.onsuccess = function () { res(true); };
      req.onerror = function () { rej(req.error); };
    });
  }
  function getSetting(key) {
    return new Promise(function (res) {
      if (!navigator.mozSettings) { return res(null); }
      var req = navigator.mozSettings.createLock().get(key);
      req.onsuccess = function () { res(req.result[key]); };
      req.onerror = function () { res(null); };
    });
  }

  /* ---------- loading themes ---------- */
  function loadThemes() {
    return xhr('themes/index.json', 'json').then(function (ids) {
      return Promise.all(ids.map(function (id) {
        return xhr('themes/' + id + '/theme.json', 'json').then(function (t) {
          t.id = id; t.base = 'themes/' + id + '/'; return t;
        });
      }));
    }).then(function (list) { state.themes = list; });
  }

  /* ---------- applying ---------- */
  function applyUI(colors, fontFamily) {
    var r = document.documentElement.style;
    if (colors) {
      if (colors.bg) { r.setProperty('--bg', colors.bg); }
      if (colors.fg) { r.setProperty('--fg', colors.fg); }
      if (colors.accent) { r.setProperty('--accent', colors.accent); }
      if (colors.card) { r.setProperty('--card', colors.card); }
    }
    if (fontFamily) { r.setProperty('--font', '"' + fontFamily + '", sans-serif'); }
  }

  function loadFontFace(theme, font) {
    if (!font.file) { return Promise.resolve(); }
    return xhr(theme.base + 'fonts/' + font.file, 'blob').then(function (blob) {
      var url = URL.createObjectURL(blob);
      var st = document.createElement('style');
      st.textContent = '@font-face{font-family:"' + font.family + '";src:url("' + url + '");}';
      document.head.appendChild(st);
    }).catch(function () { /* font file missing: fall back to the system font */ });
  }

  function applyFont(theme, font) {
    return loadFontFace(theme, font).then(function () {
      applyUI(null, font.family);
      state.active.font = { theme: theme.id, family: font.family, file: font.file || null };
      return setSettings({ 'themeManager.font': state.active.font });
    });
  }

  function applyWallpaper(theme, wp) {
    return xhr(theme.base + 'wallpapers/' + wp.file, 'blob').then(function (blob) {
      state.active.wallpaper = { theme: theme.id, file: wp.file };
      return setSettings({ 'wallpaper.image': blob, 'themeManager.wallpaper': state.active.wallpaper });
    });
  }

  function applyIconPack(theme, pack) {
    var map = {};
    Object.keys(pack.map).forEach(function (appName) {
      map[appName] = theme.base + 'icons/' + pack.map[appName];
    });
    state.active.icons = { theme: theme.id, pack: pack.name, map: map };
    return setSettings({ 'themeManager.icons': state.active.icons });
  }

  function applyTheme(theme) {
    applyUI(theme.colors);
    var jobs = [];
    if (theme.fonts && theme.fonts[0]) { jobs.push(applyFont(theme, theme.fonts[0])); }
    if (theme.wallpapers && theme.wallpapers[0]) { jobs.push(applyWallpaper(theme, theme.wallpapers[0])); }
    if (theme.iconPacks && theme.iconPacks[0]) { jobs.push(applyIconPack(theme, theme.iconPacks[0])); }
    return Promise.all(jobs).then(function () {
      state.active.theme = theme.id;
      $('active-name').textContent = theme.name;
      return setSettings({ 'themeManager.active': theme.id });
    });
  }

  function reset() {
    var r = document.documentElement.style;
    ['--bg', '--fg', '--accent', '--card', '--font'].forEach(function (k) { r.removeProperty(k); });
    state.active = {};
    $('active-name').textContent = 'No theme';
    return setSettings({
      'themeManager.active': null, 'themeManager.font': null,
      'themeManager.wallpaper': null, 'themeManager.icons': null
    });
  }

  /* ---------- rendering ---------- */
  function row(opts) {
    var el = document.createElement('div');
    el.className = 'item' + (opts.selected ? ' sel' : '');
    if (opts.thumb) {
      var img = document.createElement('img'); img.src = opts.thumb; el.appendChild(img);
    }
    var meta = document.createElement('div'); meta.className = 'meta';
    meta.textContent = opts.title;
    if (opts.sub) { var s = document.createElement('small'); s.textContent = opts.sub; meta.appendChild(s); }
    if (opts.extra) { meta.appendChild(opts.extra); }
    el.appendChild(meta);
    var b = document.createElement('button'); b.className = 'go'; b.textContent = 'Apply';
    b.onclick = function () {
      setStatus('Applying…');
      opts.onApply().then(function () {
        setStatus(state.system ? 'Applied to system' : 'Previewed (no system access)');
        render();
      }).catch(function (e) { setStatus('Failed: ' + e.message); });
    };
    el.appendChild(b);
    return el;
  }

  function render() {
    var p = $('panel'); p.innerHTML = '';
    state.themes.forEach(function (t) {
      if (state.tab === 'themes') {
        p.appendChild(row({
          title: t.name, sub: t.author || '', selected: state.active.theme === t.id,
          thumb: t.wallpapers && t.wallpapers[0] ? t.base + 'wallpapers/' + t.wallpapers[0].file : null,
          onApply: function () { return applyTheme(t); }
        }));
      } else if (state.tab === 'fonts') {
        (t.fonts || []).forEach(function (f) {
          var ex = document.createElement('small'); ex.textContent = 'The quick brown fox'; ex.style.fontFamily = '"' + f.family + '"';
          p.appendChild(row({
            title: f.family, sub: t.name, extra: ex,
            selected: state.active.font && state.active.font.family === f.family,
            onApply: function () { return applyFont(t, f); }
          }));
        });
      } else if (state.tab === 'wallpapers') {
        (t.wallpapers || []).forEach(function (w) {
          p.appendChild(row({
            title: w.name, sub: t.name, thumb: t.base + 'wallpapers/' + w.file,
            selected: state.active.wallpaper && state.active.wallpaper.file === w.file && state.active.wallpaper.theme === t.id,
            onApply: function () { return applyWallpaper(t, w); }
          }));
        });
      } else if (state.tab === 'icons') {
        (t.iconPacks || []).forEach(function (pk) {
          var g = document.createElement('div'); g.className = 'icongrid';
          Object.keys(pk.map).slice(0, 4).forEach(function (k) {
            var i = document.createElement('img'); i.src = t.base + 'icons/' + pk.map[k]; g.appendChild(i);
          });
          p.appendChild(row({
            title: pk.name, sub: t.name, extra: g,
            selected: state.active.icons && state.active.icons.pack === pk.name && state.active.icons.theme === t.id,
            onApply: function () { return applyIconPack(t, pk); }
          }));
        });
      }
    });
    if (!p.firstChild) { p.textContent = 'Nothing here yet. Drop files into the theme folders.'; }
  }

  /* ---------- boot ---------- */
  function boot() {
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); state.tab = b.getAttribute('data-tab'); render();
      };
    });
    $('reset').onclick = function () { reset().then(function () { setStatus('Reset'); render(); }); };

    TMPermissions.gate().then(function (g) {
      state.system = g.system;
      $('gate').hidden = true;
      $('main').hidden = false;
      return loadThemes();
    }).then(function () {
      return getSetting('themeManager.active');
    }).then(function (id) {
      var t = state.themes.filter(function (x) { return x.id === id; })[0];
      if (t) { applyUI(t.colors); state.active.theme = t.id; $('active-name').textContent = t.name; }
      render();
    }).catch(function (e) { setStatus('Error: ' + e.message); });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
