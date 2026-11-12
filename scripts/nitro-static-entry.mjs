/**
 * Placeholder server entry for the GitHub Pages export (`PAGES_BUILD=1`).
 *
 * Nitro's `static` preset ships no server entry (`options.entry` stays
 * undefined), but the nitro/vite plugin still builds the `nitro` environment
 * once after prerendering — and with an undefined input, Vite falls back to
 * its default `index.html`, which fails with "rolldownOptions.input should
 * not be an html file when building for SSR". vite.config points this dummy
 * at that (discarded — static deploys only serve `.output/public`) server
 * build instead.
 */
export default {};
