import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { root } from './paths'

export type ComponentPresetName = 'hero' | 'logos' | 'pricing' | 'testimonial' | 'faq'

type ComponentPreset = {
  componentName: string
  fileName: string
  html: string
  demoHtml: string
}

async function exists(path: string) {
  try { await stat(path); return true } catch { return false }
}

async function writeIfMissing(path: string, content: string, force: boolean) {
  if (await exists(path) && !force) {
    console.error(`refusing to overwrite ${path} (pass --force to overwrite)`)
    process.exit(2)
  }
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content)
  console.log(`wrote ${path}`)
}

const componentPresets: Record<ComponentPresetName, ComponentPreset> = {
  hero: {
    componentName: 'HeroSection',
    fileName: 'HeroSection.html',
    demoHtml: '<HeroSection />',
    html: `<!--
  @desc Hero section preset with headline, supporting copy, and two actions.
-->
<Section>
  <div class="hero-section">
    <p class="hero-section-kicker">Launch-ready sites</p>
    <div class="w">
      <h1>Build sharp client sites without setup drag.</h1>
      <p>Start from clean HTML, durable tokens, and production checks that stay out of the way.</p>
    </div>
    <div class="hero-section-actions">
      <Button href="/" label="Start project" />
      <Link href="/" label="See how it works" />
    </div>
  </div>
</Section>

<style>
  .hero-section {
    display: grid;
    align-content: center;
    gap: var(--gp);
    min-height: 70svh;
    padding-block: var(--by);

    h1 {
      max-width: 12ch;
      font-size: clamp(var(--h2-fs), 12vw, var(--h0-fs));
      line-height: var(--h0-lh);
    }

    .w p {
      max-width: var(--fmw);
      color: var(--g);
    }
  }

  .hero-section-kicker {
    color: var(--a60);
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .hero-section-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gp);
  }
</style>
`,
  },
  logos: {
    componentName: 'LogoCloud',
    fileName: 'LogoCloud.html',
    demoHtml: '<LogoCloud />',
    html: `<!--
  @desc Logo cloud preset for partner, client, or press marks.
-->
<Section>
  <div class="logo-cloud">
    <p>Trusted by focused teams</p>
    <ul aria-label="Trusted organizations">
      <li>Northstar</li>
      <li>Fieldnote</li>
      <li>Signal Co.</li>
      <li>Brightline</li>
      <li>Orbit Labs</li>
    </ul>
  </div>
</Section>

<style>
  .logo-cloud {
    display: grid;
    gap: var(--gp);
    padding-block: var(--ss);
    border-block: var(--bw) solid var(--b);

    p {
      color: var(--g);
      font-size: var(--fs-sm);
    }

    ul {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
      gap: var(--gp);
      padding: 0;
      margin: 0;
      list-style: none;
    }

    li {
      display: grid;
      min-height: 5rem;
      place-items: center;
      padding: var(--pd-sm);
      border: var(--bw) solid var(--b);
      border-radius: var(--br);
      color: var(--g);
      text-align: center;
    }
  }
</style>
`,
  },
  pricing: {
    componentName: 'PricingSection',
    fileName: 'PricingSection.html',
    demoHtml: '<PricingSection />',
    html: `<!--
  @desc Pricing section preset with three plan cards and calls to action.
-->
<Section id="pricing">
  <div class="pricing-section w">
    <div class="pricing-section-head w">
      <p>Pricing</p>
      <h2>Pick the right starting lane.</h2>
    </div>
    <Grid cols="3-3">
      <Card title="Starter" body="A tight one-page site with essentials in place." variant="subtle">
        <p><strong>$2k+</strong></p>
        <Button href="/" label="Choose Starter" variant="ghost" />
      </Card>
      <Card title="Growth" body="A multi-page site with reusable sections and CMS-ready content." variant="elevated">
        <p><strong>$5k+</strong></p>
        <Button href="/" label="Choose Growth" />
      </Card>
      <Card title="Custom" body="A scoped build for deeper systems, content, or migration needs." variant="subtle">
        <p><strong>Scoped</strong></p>
        <Button href="/" label="Plan Custom" variant="ghost" />
      </Card>
    </Grid>
  </div>
</Section>

<style>
  .pricing-section {
    padding-block: var(--by);
  }

  .pricing-section-head {
    max-width: var(--fmw);

    p {
      color: var(--a60);
      font-size: var(--fs-sm);
      text-transform: uppercase;
      letter-spacing: .08em;
    }
  }
</style>
`,
  },
  testimonial: {
    componentName: 'TestimonialSection',
    fileName: 'TestimonialSection.html',
    demoHtml: '<TestimonialSection />',
    html: `<!--
  @desc Testimonial section preset with quote, attribution, and proof points.
-->
<Section>
  <figure class="testimonial-section">
    <blockquote>
      “We moved from rough idea to live site fast, with enough structure to keep improving after launch.”
    </blockquote>
    <figcaption>
      <strong>Jordan Lee</strong>
      <span>Founder, Fieldnote</span>
    </figcaption>
    <ul aria-label="Project outcomes">
      <li>Launched in 10 days</li>
      <li>Core Web Vitals ready</li>
      <li>CMS path planned</li>
    </ul>
  </figure>
</Section>

<style>
  .testimonial-section {
    display: grid;
    gap: var(--gp);
    padding: var(--pd-lg, var(--pd));
    margin: 0;
    background: var(--t);
    border-radius: var(--br);

    blockquote {
      max-width: 18ch;
      margin: 0;
      font-size: var(--h2-fs);
      line-height: var(--h2-lh);
    }

    figcaption {
      display: grid;
      gap: .25rem;
      color: var(--g);
    }

    figcaption strong {
      color: var(--i);
    }

    ul {
      display: flex;
      flex-wrap: wrap;
      gap: var(--gp);
      padding: 0;
      margin: var(--pd) 0 0;
      list-style: none;
      color: var(--g);
      font-size: var(--fs-sm);
    }
  }
</style>
`,
  },
  faq: {
    componentName: 'FAQSection',
    fileName: 'FAQSection.html',
    demoHtml: '<FAQSection />',
    html: `<!--
  @desc FAQ section preset built from Accordion primitives.
-->
<Section>
  <div class="faq-section w">
    <div class="faq-section-head w">
      <p>FAQ</p>
      <h2>Questions before kickoff.</h2>
    </div>
    <div class="faq-section-list">
      <Accordion group="preset-faq" summary="Can I edit this copy?" body="Yes. Change this component file or pass through your own authored section later." />
      <Accordion group="preset-faq" summary="Does this add a new framework?" body="No. Presets are normal HTML components that use existing built-ins." />
      <Accordion group="preset-faq" summary="Can I remove this section?" body="Yes. Delete the component file and remove any route invocation." />
    </div>
  </div>
</Section>

<style>
  .faq-section {
    padding-block: var(--by);
  }

  .faq-section-head {
    max-width: var(--fmw);

    p {
      color: var(--a60);
      font-size: var(--fs-sm);
      text-transform: uppercase;
      letter-spacing: .08em;
    }
  }

  .faq-section-list {
    display: grid;
    gap: var(--gp);
  }
</style>
`,
  },
}

export function availableComponentPresets() {
  return Object.keys(componentPresets).join(', ')
}

function componentPreset(name: string): ComponentPreset {
  if (name in componentPresets) return componentPresets[name as ComponentPresetName]
  console.error(`unknown component preset "${name}"`)
  console.error(`Available presets: ${availableComponentPresets()}`)
  process.exit(1)
}

async function appendDemo(preset: ComponentPreset) {
  const pagesStylesPath = join(root, 'src', 'pages', 'styles.html')
  const routesStylesPath = join(root, 'src', 'routes', 'styles.html')
  const stylesPath = (await exists(pagesStylesPath)) ? pagesStylesPath : routesStylesPath
  if (!(await exists(stylesPath))) return

  const append = `\n${preset.demoHtml}\n`
  await writeFile(stylesPath, (await readFile(stylesPath, 'utf8')) + append)
  console.log(`appended demo to ${stylesPath}`)
}

export async function addComponentPreset(name: string, options: { force?: boolean, demo?: boolean } = {}) {
  const preset = componentPreset(name)
  await writeIfMissing(join(root, 'src', 'components', preset.fileName), preset.html, options.force ?? false)
  if (options.demo) await appendDemo(preset)
  console.log(`\nAdded ${preset.componentName}.`)
  console.log(`Use it in a route with <${preset.componentName} />`)
}
