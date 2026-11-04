# JSON command output, version 1

`sttc build --json` and `sttc check --json` write exactly one JSON object and a newline to stdout on successful completion or caught failure. Human output remains the default. No global console methods are replaced.

```json
{"version":1,"command":"build","outcome":"success","errors":[],"warnings":[]}
```

Required fields are `version` (integer `1`), `command` (`build` or `check`), `outcome` (`success` or `failure`), and arrays `errors` and `warnings`. Each diagnostic has a string `message`. Errors also have a string `name`. Known build errors use `BuildError.toJSON()` and may include `file`, `line`, `hint`, and `frames` (objects with optional `file`, `line`, `label`). Unknown coordinates are omitted. Existing check messages remain messages; their text is not parsed into invented locations. Unexpected caught errors include name and message, not stacks or arbitrary internal properties.

Additional fields are compatible within version 1. Consumers must ignore them. Removing fields or changing their types or meanings requires a new protocol version. Consumers must reject unsupported versions, malformed required fields, absent output, multiple results, or truncated JSON. Accept success only with both exit status zero and a valid success result with no errors. Keep the last successful result if validation fails.

Warnings do not change the exit status. Caught build/check failures exit 1. Image progress and build summaries are suppressed in JSON mode; image and check warnings appear in `warnings`. `--profile` adds `profile: {timings, totalMs}` on a successful build, with phase durations in milliseconds. There is no profile for a failed build or `check --skip-build`, which performs no build.

`check --json` performs its usual build and final checks but emits a single result with `command: "check"`. `--skip-build` checks existing output. `--launch` retains production gates and warnings. `--allow-broken-links` skips only existing broken route/link checks; it does not bypass other validation. These flags compose with `--json` and `--profile`.

`sttc doctor --json` forwards to check and returns the check envelope. The repository's `bun run doctor` wrapper first invokes TypeScript: its compiler output and failures are **not** covered by this protocol. Use `sttc check --json` for a machine-readable check result and run typechecking separately.

Caught build failures retain existing rollback and diagnostic-page behavior: previous site artifacts survive; `dist/__build-error.html` may be added or updated. A subsequent successful CLI build removes that page. This is not crash durability. SIGKILL, OOM, startup/import failures, and broken output pipes may produce no complete result. Stderr is not part of the JSON protocol.

Regression coverage lives in `framework/tests/cli-json.test.ts`, `build-api.test.ts`, and `build-atomic.test.ts`: cold images, warnings, profile, nested and skip-build checks, launch/link flags, malformed configuration, unexpected filesystem errors, consumer rejection cases, and caught rollback.
