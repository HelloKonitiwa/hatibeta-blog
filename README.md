# Hatibeta Blog

仕様書 v0.18 に基づくテスト版実装。

## ローカルで確認する

```bash
npm install
npm run dev
```
`draft: true` の記事も開発中だけ表示される。

公開用と同じ条件を確認する場合は次を実行する。

```bash
npm run build
npm run preview
```

## 記事を書く

1. `src/content/blog/` に `article.md` を作る。
2. frontmatterと本文を書く。
3. 記事URLは `/posts/my-article/` になる。

```md
---
title: 記事タイトル
description: 任意の概要
publishedAt: 2026-08-30
tags:
  - 心理学
draft: true
---

ここからす。
```

タグを増やす場合は、先に `src/data/tags.ts` へ日本語名と英数字slugを登録する。未登録タグを記事に書くとビルドが失敗するので注意。

## 記事画像

画像は `src/assets/posts/<記事slug>/` に置きます。たとえば `article.md` から `src/assets/posts/article/photo.jpg` を使う場合は次のように書く。

```md
![画像の説明](../../assets/posts/article/photo.jpg)
```

ローカル画像はAstroの画像処理対象となり、寸法指定や最適化が行われます。

## 仮決定した項目

- サイト名: `8`)β`
- 本文幅: 720px
- 初期テーマ: 保存済み設定を優先し、未保存ならOS設定に連動
- テーマボタン: ヘッダー右側、検索ボタンの右
- 角丸: なし
- ヘッダーナビゲーション: `tags` / `about`。サイト名をトップページへのリンクとする
- 検索: ブラウザ内検索
- アラート: NOTE / TIP / IMPORTANT / WARNING / CAUTION
- ライト・ダークの具体色: `src/styles/global.css` のCSS変数

## 外部サービスに依存するため未設定の項目

- Cloudflare Web Analyticsの計測タグ

公開前に `astro.config.mjs` の仮サイトURLと、必要に応じてサイト名を置き換えてください。
