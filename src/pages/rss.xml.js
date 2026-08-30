import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { descriptionFor, isVisible, postSlug, sortPosts } from '../utils/blog';

export async function GET(context) {
  const posts = sortPosts((await getCollection('blog')).filter(isVisible));
  const basePath = context.site.pathname.replace(/\/?$/, '/');
  return rss({
    title: '8`(β',
    description: '気が向いたときに書いていきます。',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: descriptionFor(post),
      pubDate: post.data.publishedAt,
      link: `${basePath}posts/${postSlug(post)}/`,
      categories: post.data.tags,
    })),
  });
}
