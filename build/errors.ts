// Loud, structured build errors. All build-time throws go through BuildError so
// dev.ts can render them as an in-page banner instead of a console log.

export type BuildErrorContext = {
  file?: string
  line?: number
  hint?: string
}

export class BuildError extends Error {
  file?: string
  line?: number
  hint?: string

  constructor(message: string, ctx: BuildErrorContext = {}) {
    super(message)
    this.name = 'BuildError'
    this.file = ctx.file
    this.line = ctx.line
    this.hint = ctx.hint
  }

  toPretty(): string {
    const where = this.file
      ? this.line
        ? ` (${this.file}:${this.line})`
        : ` (${this.file})`
      : ''
    const hint = this.hint ? `\n  hint: ${this.hint}` : ''
    return `BuildError: ${this.message}${where}${hint}`
  }

  toJSON() {
    return { name: this.name, message: this.message, file: this.file, line: this.line, hint: this.hint }
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
