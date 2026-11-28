export default function rehypeFootnoteTitle() {
  return (tree, file) => {
    const specifiedTitle = file.data.astro?.frontmatter?.footnoteTitle;

    // 記事で指定されていなければ「脚注」にする
    const title =
      typeof specifiedTitle === 'string' && specifiedTitle.trim()
        ? specifiedTitle.trim()
        : '脚注';

    function visit(node) {
      // 自動生成される脚注見出しを探す
      if (
        node.type === 'element' &&
        node.tagName === 'h2' &&
        node.properties?.id === 'footnote-label'
      ) {
        node.children = [{ type: 'text', value: title }];
        return;
      }

      for (const child of node.children ?? []) {
        visit(child);
      }
    }

    visit(tree);
  };
}