# Google Material Icons

The inline SVG paths in `pixai-web-queue.user.js` are from Google's Material Design Icons repository:
https://github.com/google/material-design-icons

Copyright Google LLC. Licensed under Apache License 2.0; the full license is included in `MATERIAL-ICONS-LICENSE.txt`.

Icons: folder, folder_open, create_new_folder, content_copy, delete, add, close, drag_indicator, play_arrow, stop, settings, person, layers, view_module, playlist_add, tune, save, search, chevron_left, chevron_right, open_in_full, download, upload.

Source: `src/<category>/<icon>/materialicons/24px.svg`. The transparent canvas paths were omitted. The open_in_full polygon was converted to an equivalent SVG path. Icons use currentColor and are embedded directly; no remote fonts, scripts, or icon requests are needed when the userscript runs.

# PixaiClackHelper / NAIS3

The 0.10.0 browser port, modified on 2026-10-13 by cotton100, adapts library,
common preset, scene, cast, batch reservation, public link and image metadata
contracts from [cotton100/PixaiClackHelper](https://github.com/cotton100/PixaiClackHelper),
version 0.1.11, commit a23b9da36f2c24db03cf2d9f3b8a13dc4d74d2f8.
That project is based on [sunanakgo/NAIS3](https://github.com/sunanakgo/NAIS3),
whose original author credit is retained. PixaiClackHelper's package author is
also sunanakgo. These portions and this derivative userscript are licensed
under GPL version 3. The full license is provided in `LICENSE` and embedded in
the installable userscript. No warranty is provided.

Changes include browser byte/stream processing instead of Node/sharp,
per-field image option merging, local transaction recovery, explicit compatible
backup conversion, DOM-based editors, metadata failure warnings with original
image fallback, and browser-local bounded thumbnail caching. No Electron or
native app runtime is redistributed. The `modules/` sources and
`tools/build-userscript.cjs` reproduce the bundled additions without fetching
code from a CDN. Material Icons retain their separate Apache 2.0 license above.

The 0.10.3 backup interoperability update adapts `backup-transfer.ts` and the
bounded JSON-size calculation from PixaiClackHelper 0.1.18, commit
be258addbb29ad0aa171d627db4ac26add950b27, under the same GPL-3.0 license.
Changes include browser validators, JSON copying without native dependencies,
safe partial import controls, and app-compatible inner v1 exports. Synthetic
fixtures record that source revision; no user data or credentials are included.
