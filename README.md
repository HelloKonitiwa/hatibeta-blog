# Astro Blog

Astroブログ仕様書 v0.18 に基づく、外観確認用の実装です。サイト名と公開URLは仮設定です。

## ローカルで確認する

```bash
npm install
npm run dev
```

ターミナルに表示されるURLをブラウザで開きます。`draft: true` の記事も開発中だけ表示されます。

公開用と同じ条件を確認する場合は次を実行します。

```bash
npm run build
npm run preview
```

## 記事を書く

1. `src/content/blog/` に `my-article.md` を作ります。
2. frontmatterと本文を書きます。
3. 記事URLは `/posts/my-article/` になります。

```md
---
title: 記事タイトル
description: 任意の概要
publishedAt: 2026-08-30
tags:
  - 心理学
draft: true
---

ここから本文です。
```

タグを増やす場合は、先に `src/data/tags.ts` へ日本語名と英数字slugを登録します。未登録タグを記事に書くとビルドが失敗します。

## 記事画像

画像は `src/assets/posts/<記事slug>/` に置きます。たとえば `my-article.md` から `src/assets/posts/my-article/photo.jpg` を使う場合は次のように書きます。

```md
![画像の説明](../../assets/posts/my-article/photo.jpg)
```

ローカル画像はAstroの画像処理対象となり、寸法指定や最適化が行われます。

## 仮決定した項目

- サイト名: `8')β`
- 本文幅: 720px
- 初期テーマ: 保存済み設定を優先し、未保存ならOS設定に連動
- テーマボタン: ヘッダー右側、検索ボタンの右
- 角丸: なし
- ヘッダーナビゲーション: `tags` / `about`。サイト名をトップページへのリンクとする
- 背景色: ライト `#f4f4f4`、ダーク `#222129`
- 文字・罫線の基調色: ダーク `#ffa86a`
- 影: なし
- 検索: 依存ライブラリを使わないブラウザ内検索
- アラート: NOTE / TIP / IMPORTANT / WARNING / CAUTION
- ライト・ダークの具体色: `src/styles/global.css` のCSS変数

## 外部サービスに依存するため未設定の項目

- Cloudflare Web Analyticsの計測タグ
- 実在するGitHubユーザー名、リポジトリ名、Pages設定

公開前に `astro.config.mjs` の仮サイトURLと、必要に応じてサイト名を置き換えてください。
