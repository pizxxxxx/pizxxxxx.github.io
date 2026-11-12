import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
// Self-hosted (OFL): no external font CDN — works offline, on Pages and
// on networks where Google Fonts is unreachable.
// Unbounded — дисплейный, Manrope — текст, Jost italic — выкрики-адлибы.
import "@fontsource-variable/unbounded";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jost";
import "@fontsource-variable/jost/wght-italic.css";
import "@fontsource-variable/jetbrains-mono";
import appCss from "../styles.css?url";

const APP_NAME = "Lomify";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "LomifyNEXT — эстетичный плеер для Яндекс Музыки, SoundCloud и своей медиатеки. Синхронный текст по буквам.",
      },
      { name: "theme-color", content: "#07060b" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: () => (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
