const TYPES = new Set(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']);

export default function remarkAlerts() {
  return (tree) => {
    walk(tree);
  };
}

function walk(node) {
  if (!node?.children) return;
  for (const child of node.children) {
    if (child.type === 'blockquote') transform(child);
    walk(child);
  }
}

function transform(node) {
  const paragraph = node.children?.[0];
  const first = paragraph?.children?.[0];
  if (paragraph?.type !== 'paragraph' || first?.type !== 'text') return;
  const match = first.value.match(/^\[!([A-Z]+)\]\s*/);
  if (!match || !TYPES.has(match[1])) return;
  first.value = first.value.slice(match[0].length);
  node.data = node.data || {};
  node.data.hName = 'aside';
  node.data.hProperties = {
    className: ['markdown-alert', `markdown-alert-${match[1].toLowerCase()}`],
    'data-alert': match[1],
  };
}
