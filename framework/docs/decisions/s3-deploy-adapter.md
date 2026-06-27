# S3 deploy adapter

Date: 2026-06-18

## Status

Explored. Defer implementation until after private release surface is stable.

## Context

Bun ships native S3-compatible APIs. `Bun.s3` is equivalent to `new Bun.S3Client()` and reads credentials from environment variables. Explicit clients can set `accessKeyId`, `secretAccessKey`, `bucket`, `endpoint`, session token, and virtual-hosted-style behavior. Supported targets include AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO, Backblaze B2, and other S3-compatible services.

Bun upload APIs support `s3.file(path).write(...)`, `Bun.write(s3file, ...)`, and metadata options such as `type`, `contentEncoding`, and `contentDisposition`.

## Decision

Do not implement `snz-bp deploy s3` yet.

When implemented, shape should be:

```bash
snz-bp deploy s3 --dry-run
snz-bp deploy s3 --prefix site/
snz-bp deploy s3 --delete
```

Owner boundary:

- build remains responsible for `dist/` contents;
- deploy adapter reads `dist/` only;
- credentials stay environment-owned;
- adapter maps file extensions to content types and cache headers;
- dry run lists planned PUT/delete operations without touching remote storage.

## Required future behavior

- fail if `dist/` is missing; suggest `bun run build`;
- never print secret values;
- support S3-compatible `endpoint` for R2/Spaces/MinIO;
- support `virtualHostedStyle` where needed;
- set long cache for hashed assets and short/no cache for HTML/discovery files;
- default to dry-run or require explicit non-dry-run confirmation path;
- test with mocked adapter; real uploads only manual.

## Non-goals

- no credential storage;
- no real uploads in CI;
- no deploy before private release gates are decided;
- no dependency on AWS SDK.

## Evidence

Bun docs: `https://bun.com/docs/runtime/s3`.
