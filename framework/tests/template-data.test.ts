import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createComposer } from '../build/compose'
import { extractTemplateData } from '../build/template-data'

async function withProject(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'snz-data-'))
  try {
    await mkdir(join(dir, 'src', 'data'), { recursive: true })
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('build-time JSON template data', () => {
  test('extracts inline JSON data and strips the script', async () => {
    const result = await extractTemplateData('<script type="application/json" data-snz>{"title":"Services"}</script><h1>{{title}}</h1>', {
      file: 'src/pages/services.html',
      projectRoot: process.cwd(),
    })

    expect(result.html).toBe('<h1>{{title}}</h1>')
    expect(result.data.title).toBe('Services')
  })

  test('loads external JSON data from src/data', async () => {
    await withProject(async (dir) => {
      await writeFile(join(dir, 'src', 'data', 'services.json'), '{"services":[{"title":"Strategy"}]}')
      const result = await extractTemplateData('<script type="application/json" data-snz src="services.json"></script>', {
        file: 'src/pages/services.html',
        projectRoot: dir,
      })

      expect(result.data.services).toEqual([{ title: 'Strategy' }])
    })
  })

  test('rejects external data outside src/data', async () => {
    await expect(extractTemplateData('<script type="application/json" data-snz src="../secret.json"></script>', {
      file: 'src/pages/services.html',
      projectRoot: process.cwd(),
    })).rejects.toThrow('SNZ data src must point to a JSON file under src/data/')
  })

  test('renders page each blocks with JSON data', async () => {
    const composer = createComposer(
      new Map([
        ['SEO', '<title>{{title}}</title>'],
        ['Card', '<article>{{slot}}</article>'],
      ]),
      new Map(),
      () => ({}),
    )
    const html = await composer.prepareRouteSource('<Card>{#each services as service, i}<h2>{{i}} {{service.title}}</h2>{/each}</Card>', {
      slug: 'services',
      fileHint: 'src/pages/services.html',
      data: { services: [{ title: 'Strategy' }, { title: 'Build' }] },
    })

    expect(html).toContain('<h2>0 Strategy</h2>')
    expect(html).toContain('<h2>1 Build</h2>')
  })

  test('renders component each blocks with component JSON data', async () => {
    const composer = createComposer(
      new Map([
        ['SEO', '<title>{{title}}</title>'],
        ['List', '<ul>{#each items as item}<li>{{item.label}}</li>{/each}</ul>'],
      ]),
      new Map(),
      () => ({}),
      undefined,
      undefined,
      new Map([['List', { items: [{ label: 'Fast' }, { label: 'Static' }] }]]),
    )
    const html = await composer.prepareRouteSource('<List />', {
      slug: 'page',
      fileHint: 'src/pages/page.html',
    })

    expect(html).toContain('<li>Fast</li>')
    expect(html).toContain('<li>Static</li>')
  })

  test('sorts each blocks by multiple item-relative keys without mutating source order', async () => {
    const composer = createComposer(
      new Map([
        ['SEO', '<title>{{title}}</title>'],
        ['Cases', '<ol>{#each items sort featured desc, date desc as item, i}<li data-i="{{i}}">{{item.title}}</li>{/each}</ol>'],
      ]),
      new Map(),
      () => ({}),
      undefined,
      undefined,
      new Map([['Cases', {
        items: [
          { title: 'Older featured', featured: true, date: '2024-01-01' },
          { title: 'Newest unfeatured', featured: false, date: '2026-01-01' },
          { title: 'Newest featured', featured: true, date: '2025-01-01' },
        ],
      }]]),
    )
    const html = await composer.prepareRouteSource('<Cases />', {
      slug: 'page',
      fileHint: 'src/pages/page.html',
    })

    expect(html).toContain('<li data-i="0">Newest featured</li><li data-i="1">Older featured</li><li data-i="2">Newest unfeatured</li>')
  })

  test('sorts each blocks by dotted paths and leaves missing values last', async () => {
    const composer = createComposer(
      new Map([
        ['SEO', '<title>{{title}}</title>'],
        ['Clients', '<ol>{#each items sort location.city asc, name asc as item}<li>{{item.name}}</li>{/each}</ol>'],
      ]),
      new Map(),
      () => ({}),
      undefined,
      undefined,
      new Map([['Clients', {
        items: [
          { name: 'Zulu' },
          { name: 'Bravo', location: { city: 'Zurich' } },
          { name: 'Alpha', location: { city: 'Amsterdam' } },
        ],
      }]]),
    )
    const html = await composer.prepareRouteSource('<Clients />', {
      slug: 'page',
      fileHint: 'src/pages/page.html',
    })

    expect(html).toContain('<li>Alpha</li><li>Bravo</li><li>Zulu</li>')
  })

  test('renders lower and slug placeholder filters', async () => {
    const composer = createComposer(
      new Map([
        ['SEO', '<title>{{title}}</title>'],
        ['Card', '<p>In need of {{name | lower}}?</p><a href="#{{name | slug}}">{{name}}</a>'],
      ]),
      new Map(),
      () => ({}),
    )
    const html = await composer.prepareRouteSource('<Card name="Brand Strategy" />', {
      slug: 'page',
      fileHint: 'src/pages/page.html',
    })

    expect(html).toContain('<p>In need of brand strategy?</p>')
    expect(html).toContain('<a href="#brand-strategy">Brand Strategy</a>')
  })
})
