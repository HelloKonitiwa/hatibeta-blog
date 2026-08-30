import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { TAGS } from './data/tags';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    publishedAt: z.coerce.date(),
    tags: z.array(z.string().refine((tag) => tag in TAGS, {
      message: 'タグが src/data/tags.ts に登録されていません。',
    })).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
