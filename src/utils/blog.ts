import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export function isVisible(post: Post): boolean {
  return import.meta.env.DEV || !post.data.draft;
}

export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function postSlug(post: Post): string {
  return post.id.replace(/\.(md|mdx)$/, '');
}

export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function descriptionFor(post: Post, length = 120): string {
  return post.data.description || plainText(post.body ?? '').slice(0, length);
}
