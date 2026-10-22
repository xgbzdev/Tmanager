# ThemeManager for Firefox OS

Changes fonts, wallpaper and icons from per-theme folders.

```
ThemeManager/
  manifest.webapp          certified app manifest + permissions
  index.html, css/, js/    the app (permission gate runs first)
  themes/
    index.json             list of theme ids
    <id>/theme.json        colors, fonts, wallpapers, icon packs
    <id>/fonts/            .woff/.ttf files
    <id>/wallpapers/       wallpaper images
    <id>/icons/            icon images
  system-hook/theme-hook.js   include in Gaia System app (fonts + icons)
```

## Permissions ("root")
Firefox OS has no literal root user. The app is `"type": "certified"` and asks for
`settings` (readwrite), `themeable`, `permissions`, `webapps-manage` and
device storage. On launch a gate screen lists each capability and the main UI is
shown only after you tap **Allow & Continue**. Certified apps cannot come from the
Marketplace: install with WebIDE on a device in developer mode (enable
*Certified apps debugging*), or bake the app into a custom Gaia build.

## What changes system-wide
- **Wallpaper**: written to the standard `wallpaper.image` setting.
- **Fonts and icons**: written to `themeManager.font` / `themeManager.icons`.
  Include `system-hook/theme-hook.js` in the System app so it applies them.

## Adding a theme
Create `themes/<id>/`, add `theme.json` (copy an existing one), drop files into the
three folders, add the id to `themes/index.json`. Fonts missing from disk fall back
to the system font; add your own `.woff` files to `fonts/`.

## Package
`ThemeManager.zip` has `manifest.webapp` at its root.
