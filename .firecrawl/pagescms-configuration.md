[Pages CMS](https://pagescms.org/)

- [GitHubGitHub](https://github.com/pages-cms/pages-cms)
- [DiscordDiscord](https://pagescms.org/chat)

### Getting started

- [Introduction](https://pagescms.org/docs/)
- [Quick start](https://pagescms.org/docs/quick-start/)

### Configuration

- [Overview](https://pagescms.org/docs/configuration/)
- [Media](https://pagescms.org/docs/configuration/media/)
-
Content


  - [Overview](https://pagescms.org/docs/configuration/content/)
  - [Editors](https://pagescms.org/docs/configuration/content/editors/)
  - [Filename](https://pagescms.org/docs/configuration/content/filename/)
  - [List](https://pagescms.org/docs/configuration/content/list/)
  - [Operations](https://pagescms.org/docs/configuration/content/operations/)
  - [Fields](https://pagescms.org/docs/configuration/content/fields/)
  - [View](https://pagescms.org/docs/configuration/content/view/)

- [Components](https://pagescms.org/docs/configuration/components/)
- [Actions](https://pagescms.org/docs/configuration/actions/)
- [Collaborators](https://pagescms.org/docs/configuration/collaborators/)
- [Settings](https://pagescms.org/docs/configuration/settings/)

### Fields

- [Block field](https://pagescms.org/docs/configuration/fields/block/)
- [Boolean field](https://pagescms.org/docs/configuration/fields/boolean/)
- [Code field](https://pagescms.org/docs/configuration/fields/code/)
- [Date field](https://pagescms.org/docs/configuration/fields/date/)
- [File field](https://pagescms.org/docs/configuration/fields/file/)
- [Image field](https://pagescms.org/docs/configuration/fields/image/)
- [Number field](https://pagescms.org/docs/configuration/fields/number/)
- [Object field](https://pagescms.org/docs/configuration/fields/object/)
- [Reference field](https://pagescms.org/docs/configuration/fields/reference/)
- [Rich-text field](https://pagescms.org/docs/configuration/fields/rich-text/)
- [Select field](https://pagescms.org/docs/configuration/fields/select/)
- [String field](https://pagescms.org/docs/configuration/fields/string/)
- [Text field](https://pagescms.org/docs/configuration/fields/text/)
- [UUID field](https://pagescms.org/docs/configuration/fields/uuid/)

### Guides

-
Installing


  - [Install locally](https://pagescms.org/docs/guides/installing/)
  - [Deploy on Vercel](https://pagescms.org/docs/guides/installing/vercel/)
  - [Self-host](https://pagescms.org/docs/guides/installing/self-host/)
  - [GitHub App](https://pagescms.org/docs/guides/installing/github-app/)

- [Upgrading to 2.x](https://pagescms.org/docs/guides/upgrading-to-2/)
- [Migrating collaborators](https://pagescms.org/docs/guides/migrating-collaborators/)
- [Creating a custom field](https://pagescms.org/docs/guides/creating-custom-field/)

### Development

- [Authentication](https://pagescms.org/docs/development/authentication/)
- [Caching](https://pagescms.org/docs/development/caching/)
- [Database](https://pagescms.org/docs/development/database/)
- [Fields](https://pagescms.org/docs/development/fields/)
- [Environment variables](https://pagescms.org/docs/development/environment-variables/)

GitHubGitHub

DiscordDiscord

Getting started

Introduction

Quick start

Configuration

Overview

Media

Content

Overview

Editors

Filename

List

Operations

Fields

View

Components

Actions

Collaborators

Settings

Fields

Block field

Boolean field

Code field

Date field

File field

Image field

Number field

Object field

Reference field

Rich-text field

Select field

String field

Text field

UUID field

Guides

Installing

Install locally

Deploy on Vercel

Self-host

GitHub App

Upgrading to 2.x

Migrating collaborators

Creating a custom field

Development

Authentication

Caching

Database

Fields

Environment variables

Search the docs...
`⌘K`

# Overview

Copy page

* * *

[View as Markdown](https://pagescms.org/docs/configuration.md) [Open in ChatGPT](https://chatgpt.com/?q=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2F%20so%20I%20can%20ask%20questions%20about%20it.) [Open in Claude](https://claude.ai/new?q=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2F%20so%20I%20can%20ask%20questions%20about%20it.) [Cursor\\
\\
Open in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2F%20so%20I%20can%20ask%20questions%20about%20it.)

[Quick start](https://pagescms.org/docs/quick-start/)

* * *

[Media](https://pagescms.org/docs/configuration/media/)

Understand the structure of the \`.pages.yml\` file.

## [What `.pages.yml` does](https://pagescms.org/docs/configuration/\#what-.pages.yml-does)

`.pages.yml` is the single source of truth for Pages CMS configuration.

Place it at the repository root.

Pages CMS reads it per repository and per branch.

## [Top-level keys](https://pagescms.org/docs/configuration/\#top-level-keys)

| Key | Description |
| --- | --- |
| `media` | Defines where uploaded files are stored and what URLs are written. [See `media`](https://pagescms.org/docs/configuration/media/). |
| `content` | Defines editable collections and files. [See `content`](https://pagescms.org/docs/configuration/content/). |
| `components` | Reuses shared field definitions. [See `components`](https://pagescms.org/docs/configuration/components/). |
| `settings` | Sets repository-wide behavior such as merge mode and commit templates. [See `settings`](https://pagescms.org/docs/configuration/settings/). |
| `actions` | Adds repository-level GitHub Actions buttons. [See `actions`](https://pagescms.org/docs/configuration/actions/). |

## [Read order](https://pagescms.org/docs/configuration/\#read-order)

Start with this order:

1. Define `media`.
2. Define `content`.
3. Add `components` if fields repeat.
4. Add `settings` if you need global behavior.
5. Add `actions` if you want custom workflow buttons.

## [Minimal example](https://pagescms.org/docs/configuration/\#minimal-example)

```yaml
media: media
content:
  - name: posts
    label: Posts
    type: collection
    path: content/posts
    fields:
      - name: title
        type: string
      - name: body
        type: rich-text
```

## [Example with a collection and a single file](https://pagescms.org/docs/configuration/\#example-with-a-collection-and-a-single-file)

```yaml
media:
  input: src/media
  output: /media
content:
  - name: posts
    label: Posts
    type: collection
    path: src/posts
    fields:
      - name: title
        type: string
      - name: body
        type: rich-text
  - name: site
    label: Site settings
    type: file
    path: src/_data/site.json
    fields:
      - name: title
        type: string
      - name: description
        type: text
      - name: url
        type: string
actions:
  - name: deploy-site
    label: Deploy site
    workflow: pages-cms-action.yml
```

[Quick start](https://pagescms.org/docs/quick-start/) [Media](https://pagescms.org/docs/configuration/media/)

## On this page

1. [What .pages.yml does](https://pagescms.org/docs/configuration/#what-.pages.yml-does)
2. [Top-level keys](https://pagescms.org/docs/configuration/#top-level-keys)
3. [Read order](https://pagescms.org/docs/configuration/#read-order)
4. [Minimal example](https://pagescms.org/docs/configuration/#minimal-example)
5. [Example with a collection and a single file](https://pagescms.org/docs/configuration/#example-with-a-collection-and-a-single-file)