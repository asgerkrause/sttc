import { describe, expect, test } from 'bun:test'
import { BuildError } from '../build/errors'
import { detectLowercaseComponentLike, nextComponent, parseAttrs } from '../build/tags'

describe('component tag parser', () => {
  test('parses attrs including boolean flags', () => {
    expect(parseAttrs(' title="Hello" disabled data-id="x"')).toEqual({
      title: 'Hello',
      disabled: '1',
      'data-id': 'x',
    })
  })

  test('finds self-closing component tags', () => {
    const match = nextComponent('<section><Image src="hero" /></section>')

    expect(match?.name).toBe('Image')
    expect(match?.attrs).toEqual({ src: 'hero' })
    expect(match?.selfClosing).toBe(true)
    expect(match?.children).toBe('')
  })

  test('finds paired tags with children', () => {
    const match = nextComponent('<Card title="One"><p>Body</p></Card>')

    expect(match?.name).toBe('Card')
    expect(match?.selfClosing).toBe(false)
    expect(match?.children).toBe('<p>Body</p>')
    expect(match?.full).toBe('<Card title="One"><p>Body</p></Card>')
  })

  test('handles nested same-name component pairs', () => {
    const match = nextComponent('<Card><Card>Inner</Card><p>Outer</p></Card>')

    expect(match?.children).toBe('<Card>Inner</Card><p>Outer</p>')
    expect(match?.full).toBe('<Card><Card>Inner</Card><p>Outer</p></Card>')
  })

  test('throws on missing close tag', () => {
    expect(() => nextComponent('<Card>Missing close')).toThrow(BuildError)
  })

  test('detects lowercase component-like self-closing tags', () => {
    expect(detectLowercaseComponentLike('<card />')).toEqual({ name: 'card', index: 0 })
    expect(detectLowercaseComponentLike('<br />')).toBeNull()
  })
})
