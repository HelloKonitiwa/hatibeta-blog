export const TAGS = {
  'エッセイ': 'essay',
  '心理学': 'psychology',
  '日記': 'diary',
  '読書': 'reading',
} as const;

export type TagName = keyof typeof TAGS;

export const tagEntries = Object.entries(TAGS).map(([name, slug]) => ({ name, slug }));

export function tagSlug(name: string): string {
  const slug = TAGS[name as TagName];
  if (!slug) throw new Error(`未登録のタグです: ${name}`);
  return slug;
}
