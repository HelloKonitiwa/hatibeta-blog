import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkAlerts from './src/plugins/remark-alerts.mjs';
import rehypeFootnoteTitle from './src/plugins/rehype-footnote-title.mjs';

const site =
  process.env.SITE_URL ||
  'https://HelloKonitiwa.github.io';

const base =
  process.env.BASE_PATH ||
  '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkMath, remarkAlerts],
    rehypePlugins: [rehypeKatex, rehypeFootnoteTitle],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
      wrap: true,
    },
  },
});