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

[View as Markdown](https://pagescms.org/docs/configuration/content.md) [Open in ChatGPT](https://chatgpt.com/?q=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fcontent%2F%20so%20I%20can%20ask%20questions%20about%20it.) [Open in Claude](https://claude.ai/new?q=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fcontent%2F%20so%20I%20can%20ask%20questions%20about%20it.) [Cursor\\
\\
Open in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fcontent%2F%20so%20I%20can%20ask%20questions%20about%20it.)

[Media](https://pagescms.org/docs/configuration/media/)

* * *

[Editors](https://pagescms.org/docs/configuration/content/editors/)

Define editable collections and files in your repository.

## [Overview](https://pagescms.org/docs/configuration/content/\#overview)

`content` defines what editors can edit.

Each entry is either:

- a `collection` for many files with the same schema
- a `file` for one file with its own schema
- a `group` for organizing files and collections in the sidebar

`group` is navigation-only. It can contain nested `group`, `collection`, and `file` entries, but it does not create its own editor route.

Collections and files can also define `actions`. See [`actions`](https://pagescms.org/docs/configuration/actions/).

## [Keys](https://pagescms.org/docs/configuration/content/\#keys)

Each `content` entry may use the following keys:

| Key | Description |
| --- | --- |
| `name`\* | Unique internal name (e.g. `"posts"`). |
| `label` | UI label (e.g. `"Blog posts"`). |
| `type`\* | Values: `collection`, `file`, `group`. |
| `path`\* | Folder for collections or file path for single files (e.g. `"content/posts"`, `"data/site.yml"`). Not used by `group`. |
| `fields` | Field definitions shown in the editor (e.g. `[{ name: "title", type: "string" }]`). Fields support options like `required`, `hidden`, and `readonly`. Read more about: [`fields`](https://pagescms.org/docs/configuration/content/fields/), [editors](https://pagescms.org/docs/configuration/content/editors/) |
| `filename` | Collection filename template or object config (e.g. `"{primary}.md"` or `{ template: "{year}-{month}-{day}-{primary}.md", field: create }`). [Read more about `filename`](https://pagescms.org/docs/configuration/content/filename/) |
| `exclude` | Files to ignore in a collection (e.g. `["README.md"]`). |
| `format` | File format. Values include `yaml-frontmatter`, `json-frontmatter`, `toml-frontmatter`, `yaml`, `json`, `toml`, `datagrid`, `code`, `raw`. [Read more about editors](https://pagescms.org/docs/configuration/content/editors/) |
| `delimiters` | Custom frontmatter delimiters (e.g. `"+++"`, `["<!--", "-->"]`). |
| `subfolders` | Values: `true`, `false`. Enables or disables nested folders in collections. |
| `list` | Repeat a field as an array, or for `type: file`, store the whole file as a top-level array. [Read more about `list`](https://pagescms.org/docs/configuration/content/list/) |
| `view` | Collection list settings for fields, sorting, search, and tree mode (e.g. `{ primary: "title", sort: "date", order: "desc" }`). [Read more about `view`](https://pagescms.org/docs/configuration/content/view/) |
| `operations` | Per-entry create/rename/delete controls (e.g. `{ delete: false }`). [Read more about `operations`](https://pagescms.org/docs/configuration/content/operations/). |
| `commit` | Per-entry commit settings (e.g. `{ identity: "user" }`). [See `settings`](https://pagescms.org/docs/configuration/settings/). |
| `actions` | Adds collection or file action buttons (e.g. `[{ name: "preview", label: "Preview", workflow: "pages-cms-file-action.yml" }]`). [See `actions`](https://pagescms.org/docs/configuration/actions/). |
| `items` | Child entries inside a `group` (e.g. nested `group`, `collection`, or `file` entries). |

\*: Required

## [Examples](https://pagescms.org/docs/configuration/content/\#examples)

### [Collection](https://pagescms.org/docs/configuration/content/\#collection)

```yaml
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
    actions:
      - name: rebuild-posts
        label: Rebuild posts
        scope: collection
        workflow: pages-cms-collection-action.yml

      - name: preview-post
        label: Preview
        scope: entry
        workflow: pages-cms-entry-action.yml
```

### [Single file](https://pagescms.org/docs/configuration/content/\#single-file)

```yaml
content:
  - name: site
    label: Site settings
    type: file
    path: data/site.yml
    fields:
      - name: title
        type: string
      - name: description
        type: text
    actions:
      - name: validate-config
        label: Validate config
        workflow: pages-cms-file-action.yml
```

### [Nested groups](https://pagescms.org/docs/configuration/content/\#nested-groups)

Use `type: group` to organize large content menus without changing how content is stored internally.

```yaml
content:
  - name: docs
    label: Docs
    type: group
    items:
      - name: pages
        label: Pages
        type: collection
        path: content/pages
        fields:
          - name: title
            type: string

      - name: references
        label: References
        type: group
        items:
          - name: publications
            label: Publications
            type: file
            path: data/publications.json
            format: json
            list: true
            fields:
              - name: title
                type: string
```

[Media](https://pagescms.org/docs/configuration/media/) [Editors](https://pagescms.org/docs/configuration/content/editors/)

## On this page

1. [Overview](https://pagescms.org/docs/configuration/content/#overview)
2. [Keys](https://pagescms.org/docs/configuration/content/#keys)
3. [Examples](https://pagescms.org/docs/configuration/content/#examples)
1. [Collection](https://pagescms.org/docs/configuration/content/#collection)
2. [Single file](https://pagescms.org/docs/configuration/content/#single-file)
3. [Nested groups](https://pagescms.org/docs/configuration/content/#nested-groups)