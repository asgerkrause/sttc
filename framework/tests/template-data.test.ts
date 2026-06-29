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
})
