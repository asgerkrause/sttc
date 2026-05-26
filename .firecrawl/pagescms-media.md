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

# Media

Copy page

* * *

[View as Markdown](https://pagescms.org/docs/configuration/media.md) [Open in ChatGPT](https://chatgpt.com/?q=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fmedia%2F%20so%20I%20can%20ask%20questions%20about%20it.) [Open in Claude](https://claude.ai/new?q=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fmedia%2F%20so%20I%20can%20ask%20questions%20about%20it.) [Cursor\\
\\
Open in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fmedia%2F%20so%20I%20can%20ask%20questions%20about%20it.)

[Overview](https://pagescms.org/docs/configuration/)

* * *

[Overview](https://pagescms.org/docs/configuration/content/)

Configure where uploaded files are stored and what URLs are written.

## [What `media` does](https://pagescms.org/docs/configuration/media/\#what-media-does)

`media` defines file storage for:

- [image](https://pagescms.org/docs/configuration/fields/image/) fields,
- [file](https://pagescms.org/docs/configuration/fields/file/) fields,
- [rich-text](https://pagescms.org/docs/configuration/fields/rich-text/) image uploads.

Use it to answer two questions:

1. Where should uploaded files be saved in the repository?
2. What public path should be written into content?

Media sources can also define `actions`. See [`actions`](https://pagescms.org/docs/configuration/actions/).

## [Value](https://pagescms.org/docs/configuration/media/\#value)

You can define `media` as:

- a string,
- one object,
- an array of named media sources.

### [String form](https://pagescms.org/docs/configuration/media/\#string-form)

```yaml
media: media
```

Equivalent to:

```yaml
media:
  input: media
  output: /media
```

### [Single media object](https://pagescms.org/docs/configuration/media/\#single-media-object)

```yaml
media:
  input: src/media
  output: /media
  rename: random
  categories: [image]
```

### [Multiple media sources](https://pagescms.org/docs/configuration/media/\#multiple-media-sources)

Use an array when different field types should write to different folders.

```yaml
media:
  - name: images
    label: Images
    input: media/images
    output: /media/images
    rename: safe
    extensions: [png, jpg, webp]
    actions:
      - name: optimize-images
        label: Optimize images
        workflow: pages-cms-media-action.yml
  - name: docs
    label: Documents
    input: media/docs
    output: /media/docs
    categories: [document]
```

## [Keys](https://pagescms.org/docs/configuration/media/\#keys)

| Key | Description |
| --- | --- |
| `name`\*\* | Internal media source name. Required when using an array (e.g. `"images"`). |
| `label` | UI label for the media source (e.g. `"Product images"`). |
| `input`\* | Repository path where files are stored (e.g. `"src/media"`). |
| `output`\* | Public path written into content (e.g. `"/media"`). |
| `extensions` | Allowed extensions (e.g. `["png", "webp"]`). |
| `categories` | Category-based extension sets. Values: `image`, `document`, `video`, `audio`, `compressed`, `code`, `font`, `spreadsheet`. |
| `rename` | Controls upload renaming. Use `false` to keep the original filename (default behavior), `true` or `safe` to slugify it, or `random` for a generated name. |
| `commit` | Per-media commit settings. [See `settings.commit`](https://pagescms.org/docs/configuration/media/#/docs/configuration/settings/) . |
| `actions` | Adds media action buttons. [See `actions`](https://pagescms.org/docs/configuration/actions/). |

\*: Required

\*\*: Required with multiple sources

Field-level media options can override the media source defaults.

## [Commit templates](https://pagescms.org/docs/configuration/media/\#commit-templates)

`media[].commit.templates` overrides the global commit templates for that media source.

```yaml
media:
  - name: images
    input: media/images
    output: /media/images
    commit:
      templates:
        create: "chore(media): add {filename}"
        update: "chore(media): update {filename}"
        delete: "chore(media): remove {filename}"
        rename: "chore(media): rename {oldFilename} -> {newFilename}"
```

[Content](https://pagescms.org/docs/configuration/content/) [Actions](https://pagescms.org/docs/configuration/actions/) [Image field](https://pagescms.org/docs/configuration/fields/image/) [File field](https://pagescms.org/docs/configuration/fields/file/)

[Overview](https://pagescms.org/docs/configuration/) [Overview](https://pagescms.org/docs/configuration/content/)

## On this page

1. [What media does](https://pagescms.org/docs/configuration/media/#what-media-does)
2. [Value](https://pagescms.org/docs/configuration/media/#value)
1. [String form](https://pagescms.org/docs/configuration/media/#string-form)
2. [Single media object](https://pagescms.org/docs/configuration/media/#single-media-object)
3. [Multiple media sources](https://pagescms.org/docs/configuration/media/#multiple-media-sources)
3. [Keys](https://pagescms.org/docs/configuration/media/#keys)
4. [Commit templates](https://pagescms.org/docs/configuration/media/#commit-templates)