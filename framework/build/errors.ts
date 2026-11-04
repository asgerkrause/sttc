// Loud, structured build errors. All build-time throws go through BuildError so
// dev.ts can render them as an in-page banner instead of a console log.

export type BuildErrorFrame = {
  file?: string
  line?: number
  label?: string
}

export type BuildErrorContext = {
  file?: string
  line?: number
  hint?: string
  cause?: unknown
  frames?: BuildErrorFrame[]
}

function formatWhere(frame: BuildErrorFrame) {
  if (!frame.file) return ''
  return frame.line ? `${frame.file}:${frame.line}` : frame.file
}

export class BuildError extends Error {
  file?: string
  line?: number
  hint?: string
  frames: BuildErrorFrame[]

  constructor(message: string, ctx: BuildErrorContext = {}) {
    super(message, { cause: ctx.cause })
    this.name = 'BuildError'
    this.file = ctx.file
    this.line = ctx.line
    this.hint = ctx.hint
    this.frames = ctx.frames ? [...ctx.frames] : []
  }

  addFrame(frame: BuildErrorFrame) {
    this.frames.push(frame)
    return this
  }

  toPretty(): string {
    const where = this.file
      ? this.line
        ? ` (${this.file}:${this.line})`
        : ` (${this.file})`
      : ''
    const stack = this.frames.length
      ? `\n  source stack:${this.frames.map((frame) => {
        const label = frame.label ? `${frame.label} ` : ''
        const where = formatWhere(frame)
        return `\n  - ${label}${where}`.trimEnd()
      }).join('')}`
      : ''
    const hint = this.hint ? `\n  hint: ${this.hint}` : ''
    return `BuildError: ${this.message}${where}${stack}${hint}`
  }

  toJSON() {
    return { name: this.name, message: this.message, file: this.file, line: this.line, hint: this.hint, frames: this.frames }
  }
}

export function lineOf(source: string, index: number) {
  let line = 1
  for (let i = 0; i < index && i < source.length; i++) if (source[i] === '\n') line++
  return line
}

export function buildErrorAt(
  message: string,
  source: string,
  index: number,
  ctx: Omit<BuildErrorContext, 'line'> = {},
) {
  return new BuildError(message, {
    ...ctx,
    line: lineOf(source, index),
  })
}

export function diagnostic(error: unknown) {
  return error instanceof BuildError
    ? error.toJSON()
    : { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) }
}

export function printJsonResult(command: 'build' | 'check', errors: ReturnType<typeof diagnostic>[], warnings: string[], profile?: { timings: Record<string, number>; totalMs: number }) {
  console.log(JSON.stringify({
    version: 1, command, outcome: errors.length ? 'failure' : 'success', errors,
    warnings: warnings.map(message => ({ message })),
    ...(profile ? { profile } : {}),
  }))
}
