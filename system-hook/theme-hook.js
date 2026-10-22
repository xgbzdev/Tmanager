/* system-hook/theme-hook.js
 *
 * Include this file from Gaia's System app (e.g. <script defer src="js/theme-hook.js">)
 * so fonts and icons chosen in ThemeManager are applied system-wide.
 * ThemeManager itself can write the settings below, but only the system app
 * can restyle its own UI and the homescreen, so this small hook is required for
 * fonts and icons. Wallpaper uses the standard 'wallpaper.image' setting and
 * needs no hook.
 *
 * Settings read:
 *   themeManager.font  -> { theme, family, file }
 *   themeManager.icons -> { theme, pack, map: { "<App name>": "<icon url>" } }
 */
(function () {
  'use strict';
  if (!navigator.mozSettings) { return; }

  var style = document.createElement('style');
  style.id = 'themeManagerFont';
  document.head.appendChild(style);

  function applyFont(f) {
    if (!f) { style.textContent = ''; return; }
    var face = '';
    if (f.file) {
      face = '@font-face{font-family:"' + f.family + '";src:url("app://thememanager.gaiamobile.org/themes/' +
             f.theme + '/fonts/' + f.file + '");}';
    }
    style.textContent = face + 'html,body,*{font-family:"' + f.family + '",sans-serif !important;}';
  }

  function applyIcons(pack) {
    window.dispatchEvent(new CustomEvent('thememanager-icons', { detail: pack }));
    // The homescreen listens for this event and swaps the icon for each app
    // whose name appears in pack.map.
  }

  function watch(key, cb) {
    var s = navigator.mozSettings;
    s.createLock().get(key).onsuccess = function () { cb(this.result[key]); };
    s.addObserver(key, function (e) { cb(e.settingValue); });
  }

  watch('themeManager.font', applyFont);
  watch('themeManager.icons', applyIcons);
})();
