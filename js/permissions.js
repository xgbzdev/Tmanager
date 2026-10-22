/* ThemeManager permission gate.
 * Runs before the main UI. Checks every capability the app needs, shows the
 * result to the person, and only unlocks the UI after they tap "Allow".
 *
 * Note: Firefox OS has no literal "root" user. The equivalent is a *certified*
 * app (see manifest.webapp "type": "certified"), which may use the privileged
 * settings / themeable / webapps-manage APIs checked below.
 */
(function (global) {
  'use strict';

  var CONSENT_KEY = 'themeManager.consent.v1';

  var CAPS = [
    { id: 'settings', label: 'System settings (read/write)', test: function () {
        return new Promise(function (res) {
          if (!navigator.mozSettings) { return res(false); }
          var lock = navigator.mozSettings.createLock();
          var req = lock.get('themeManager.active');
          req.onsuccess = function () { res(true); };
          req.onerror = function () { res(false); };
        });
    } },
    { id: 'apps', label: 'Installed apps (icon theming)', test: function () {
        return Promise.resolve(!!(navigator.mozApps && navigator.mozApps.mgmt));
    } },
    { id: 'pictures', label: 'Pictures storage (wallpapers)', test: function () {
        return Promise.resolve(!!(navigator.getDeviceStorage && navigator.getDeviceStorage('pictures')));
    } },
    { id: 'sdcard', label: 'SD card storage (fonts, icon packs)', test: function () {
        return Promise.resolve(!!(navigator.getDeviceStorage && navigator.getDeviceStorage('sdcard')));
    } },
    { id: 'permissions', label: 'Permission manager', test: function () {
        return Promise.resolve(!!navigator.mozPermissionSettings);
    } }
  ];

  function runChecks() {
    return Promise.all(CAPS.map(function (c) {
      return c.test().then(function (ok) { return { cap: c, ok: ok }; });
    }));
  }

  function render(results, listEl) {
    listEl.innerHTML = '';
    results.forEach(function (r) {
      var li = document.createElement('li');
      li.innerHTML = '<span></span><b class="' + (r.ok ? 'ok' : 'no') + '">' + (r.ok ? '✓' : '✗') + '</b>';
      li.firstChild.textContent = r.cap.label;
      listEl.appendChild(li);
    });
  }

  function hasConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch (e) { return false; }
  }
  function saveConsent() {
    try { localStorage.setItem(CONSENT_KEY, 'granted'); } catch (e) {}
  }
  function clearConsent() {
    try { localStorage.removeItem(CONSENT_KEY); } catch (e) {}
  }

  /** Shows the gate; resolves with the check results once the person allows. */
  function gate() {
    var screen = document.getElementById('gate');
    var list = document.getElementById('gate-list');
    var note = document.getElementById('gate-note');
    var allow = document.getElementById('gate-allow');
    var deny = document.getElementById('gate-deny');

    return new Promise(function (resolve) {
      runChecks().then(function (results) {
        render(results, list);
        var settingsOk = results[0].ok;

        if (!settingsOk) {
          note.textContent = 'System settings are not accessible. Install ThemeManager as a certified app (see README) to enable system-wide changes. You can still preview themes inside this app.';
        }

        if (hasConsent() && settingsOk) { return resolve({ results: results, system: true }); }

        allow.onclick = function () {
          saveConsent();
          resolve({ results: results, system: settingsOk });
        };
        deny.onclick = function () {
          clearConsent();
          note.textContent = 'Access is required to change the system theme. Close the app or tap Allow when you are ready.';
        };
        screen.hidden = false;
      });
    });
  }

  global.TMPermissions = { gate: gate, clearConsent: clearConsent };
})(window);
