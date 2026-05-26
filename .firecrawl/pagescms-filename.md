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

# Filename

Copy page

* * *

[View as Markdown](https://pagescms.org/docs/configuration/content/filename.md) [Open in ChatGPT](https://chatgpt.com/?q=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fcontent%2Ffilename%2F%20so%20I%20can%20ask%20questions%20about%20it.) [Open in Claude](https://claude.ai/new?q=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fcontent%2Ffilename%2F%20so%20I%20can%20ask%20questions%20about%20it.) [Cursor\\
\\
Open in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=Read%20from%20https%3A%2F%2Fpagescms.org%2Fdocs%2Fconfiguration%2Fcontent%2Ffilename%2F%20so%20I%20can%20ask%20questions%20about%20it.)

[Editors](https://pagescms.org/docs/configuration/content/editors/)

* * *

[List](https://pagescms.org/docs/configuration/content/list/)

Control how new collection entries are named.

`filename` only applies to collections.

Use it to control how new files are named.

## [Value](https://pagescms.org/docs/configuration/content/filename/\#value)

You can either use a string:

```yaml
filename: "{primary}.md"
```

Or use the object form when you also want a filename field in the editor:

```yaml
filename:
  template: "{year}-{month}-{day}-{primary}.md"
  field: create
```

`filename.field` can be:

- `false`: Hide the filename input.
- `create`: Show it only when creating a new entry.
- `true`: Show it when creating and editing.

## [Tokens](https://pagescms.org/docs/configuration/content/filename/\#tokens)

| Token | Description |
| --- | --- |
| `{primary}` | Primary field from `view.primary`, or `title`, or the first field. |
| `{slug}` | Alias for `{primary}`. |
| `{year}` | Current year. |
| `{month}` | Current month, zero-padded. |
| `{day}` | Current day, zero-padded. |
| `{hour}` | Current hour, zero-padded. |
| `{minute}` | Current minute, zero-padded. |
| `{second}` | Current second, zero-padded. |
| `{fields.<name>}` | Field value from the current entry, slugified. |
| `{<name>}` | Shorthand for `{fields.<name>}`. |

## [Examples](https://pagescms.org/docs/configuration/content/filename/\#examples)

### [Date-based post filenames](https://pagescms.org/docs/configuration/content/filename/\#date-based-post-filenames)

```yaml
filename: "{year}-{month}-{day}-{title}.md"
```

### [Editable filename on create](https://pagescms.org/docs/configuration/content/filename/\#editable-filename-on-create)

```yaml
filename:
  template: "{primary}.md"
  field: create
```

[Editors](https://pagescms.org/docs/configuration/content/editors/) [List](https://pagescms.org/docs/configuration/content/list/)

## On this page

1. [Value](https://pagescms.org/docs/configuration/content/filename/#value)
2. [Tokens](https://pagescms.org/docs/configuration/content/filename/#tokens)
3. [Examples](https://pagescms.org/docs/configuration/content/filename/#examples)
1. [Date-based post filenames](https://pagescms.org/docs/configuration/content/filename/#date-based-post-filenames)
2. [Editable filename on create](https://pagescms.org/docs/configuration/content/filename/#editable-filename-on-create)