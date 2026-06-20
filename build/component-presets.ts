import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { root } from './paths'

export type ComponentPresetName =
  | 'hero'
  | 'cta'
  | 'features'
  | 'partners'
  | 'pricing'
  | 'testimonials'
  | 'testimonial'
  | 'stats'
  | 'process'
  | 'faq'

type ComponentPresetFile = {
  componentName: string
  fileName: string
  html: string
}

type ComponentPreset = {
  name: string
  files: ComponentPresetFile[]
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

const hero: ComponentPreset = {
  name: 'Hero',
  demoHtml: '<Section><Hero /></Section>',
  files: [{
    componentName: 'Hero',
    fileName: 'Hero.html',
    html: `<!--
  @desc Slot-first hero preset with headline, supporting copy, and actions.
-->
<div class="hero">
  <p class="hero-kicker">Launch-ready sites</p>
  <div class="w">
    <h1>Build sharp client sites without setup drag.</h1>
    <p>Start from clean HTML, durable tokens, and production checks that stay out of the way.</p>
  </div>
  <div class="hero-actions">
    <Button href="/" label="Start project" />
    <Link href="/" label="See how it works" />
  </div>
</div>

<style>
  .hero {
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
      max-width: var(--md-mw);
      color: var(--g);
    }
  }

  .hero-kicker {
    color: var(--a60);
    font-size: var(--sm-fs);
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gp);
  }
</style>
`,
  }],
}

const cta: ComponentPreset = {
  name: 'CTA',
  demoHtml: '<Section theme="accent"><CTA /></Section>',
  files: [{
    componentName: 'CTA',
    fileName: 'CTA.html',
    html: `<!--
  @desc Slot-first call-to-action preset.
-->
<div class="cta w">
  <h2>Ready to launch?</h2>
  <p>Use this slot-first component as a focused end-of-page action.</p>
  <div class="btns">
    <Button href="/" label="Start project" />
    <Link href="/" label="Learn more" />
  </div>
</div>

<style>
  .cta {
    max-width: var(--lg-mw);
    padding-block: var(--by);
    text-align: center;
    align-items: center;
    margin-inline: auto;
  }
</style>
`,
  }],
}

const features: ComponentPreset = {
  name: 'Features',
  demoHtml: `<Section>
  <Features>
    <Feature><h3>Fast</h3><p>Static output and tiny runtime.</p></Feature>
    <Feature><h3>Flexible</h3><p>Slots keep content composable.</p></Feature>
    <Feature><h3>Checked</h3><p>Build errors stay loud and useful.</p></Feature>
  </Features>
</Section>`,
  files: [
    {
      componentName: 'Features',
      fileName: 'Features.html',
      html: `<!--
  @desc Feature collection wrapper. Put Feature items or Cards in the slot.
  @attr cols Grid column split. Defaults to 3-2.
-->
<div class="features">
  <Grid cols="{{cols}}">{{slot}}</Grid>
</div>

<style>
  .features { width: 100%; }
</style>
`,
    },
    {
      componentName: 'Feature',
      fileName: 'Feature.html',
      html: `<!--
  @desc Single feature item. Slot owns heading, copy, media, and actions.
  @attr variant=[default|outlined|ghost] :class Visual variant.
-->
<article class="feature {{variant}}">{{slot}}</article>

<style>
  .feature {
    display: grid;
    gap: var(--gp);
    padding: var(--pd);
    background: var(--t);
    border: var(--bw) solid transparent;
    border-radius: var(--br);

    &.outlined {
      background: transparent;
      border-color: var(--b);
    }

    &.ghost { background: transparent; }

    p { color: var(--g); }
  }
</style>
`,
    },
  ],
}

const partners: ComponentPreset = {
  name: 'Partners',
  demoHtml: `<Section>
  <Partners>
    <Partner>Northstar</Partner>
    <Partner>Fieldnote</Partner>
    <Partner>Orbit Labs</Partner>
  </Partners>
</Section>`,
  files: [
    {
      componentName: 'Partners',
      fileName: 'Partners.html',
      html: `<!--
  @desc Partner/client mark collection wrapper. Use Partner items in the slot.
  @attr label Accessible list label. Defaults to Trusted organizations.
-->
<div class="partners">
  <p>{{label}}</p>
  <ul aria-label="{{label}}">{{slot}}</ul>
</div>

<style>
  .partners {
    display: grid;
    gap: var(--gp);
    padding-block: var(--ss);
    border-block: var(--bw) solid var(--b);

    p {
      color: var(--g);
      font-size: var(--sm-fs);
    }

    ul {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
      gap: var(--gp);
      padding: 0;
      margin: 0;
      list-style: none;
    }
  }
</style>
`,
    },
    {
      componentName: 'Partner',
      fileName: 'Partner.html',
      html: `<!--
  @desc Single partner/client mark. Slot may contain text, SVG, or image.
-->
<li class="partner">{{slot}}</li>

<style>
  .partner {
    display: grid;
    min-height: 5rem;
    place-items: center;
    padding: var(--pd-sm);
    border: var(--bw) solid var(--b);
    border-radius: var(--br);
    color: var(--g);
    text-align: center;

    img,
    svg {
      display: block;
      max-width: 100%;
      max-height: 2rem;
      width: auto;
      height: auto;
    }
  }
</style>
`,
    },
  ],
}

const pricing: ComponentPreset = {
  name: 'Pricing',
  demoHtml: `<Section>
  <Pricing>
    <Plan><h3>Starter</h3><p>Essentials in place.</p><p><strong>$2k+</strong></p></Plan>
    <Plan><h3>Growth</h3><p>Reusable pages and CMS path.</p><p><strong>$5k+</strong></p></Plan>
    <Plan><h3>Custom</h3><p>Scoped build for deeper systems.</p><p><strong>Scoped</strong></p></Plan>
  </Pricing>
</Section>`,
  files: [
    {
      componentName: 'Pricing',
      fileName: 'Pricing.html',
      html: `<!--
  @desc Pricing collection wrapper. Put Plan items in the slot.
  @attr cols Grid column split. Defaults to 3-3.
-->
<div class="pricing">
  <Grid cols="{{cols}}">{{slot}}</Grid>
</div>

<style>
  .pricing { width: 100%; }
</style>
`,
    },
    {
      componentName: 'Plan',
      fileName: 'Plan.html',
      html: `<!--
  @desc Single pricing plan. Slot owns title, price, copy, and actions.
  @attr featured=[true|false] :class Highlight the plan. Defaults to false.
-->
<article class="plan {{featured}}">{{slot}}</article>

<style>
  .plan {
    display: grid;
    align-content: start;
    gap: var(--gp);
    padding: var(--pd);
    border: var(--bw) solid var(--b);
    border-radius: var(--br);

    &.true {
      background: var(--i);
      color: var(--s);
      border-color: transparent;

      p { color: var(--n40); }
    }

    p { color: var(--g); }

    .btns,
    .lnks { margin-top: auto; }
  }
</style>
`,
    },
  ],
}

const testimonials: ComponentPreset = {
  name: 'Testimonials',
  demoHtml: `<Section>
  <Testimonials>
    <Testimonial><blockquote>“Clear, fast, and easy to keep editing.”</blockquote><p>Jordan Lee</p></Testimonial>
  </Testimonials>
</Section>`,
  files: [
    {
      componentName: 'Testimonials',
      fileName: 'Testimonials.html',
      html: `<!--
  @desc Testimonial collection wrapper. Put Testimonial items in the slot.
  @attr cols Grid column split. Defaults to 2.
-->
<div class="testimonials">
  <Grid cols="{{cols}}">{{slot}}</Grid>
</div>

<style>
  .testimonials { width: 100%; }
</style>
`,
    },
    {
      componentName: 'Testimonial',
      fileName: 'Testimonial.html',
      html: `<!--
  @desc Single testimonial. Slot owns quote, attribution, and proof.
-->
<figure class="testimonial">{{slot}}</figure>

<style>
  .testimonial {
    display: grid;
    gap: var(--gp);
    padding: var(--pd);
    margin: 0;
    background: var(--t);
    border-radius: var(--br);

    blockquote {
      margin: 0;
      font-size: var(--lg-fs);
      line-height: var(--lg-lh);
    }

    p,
    figcaption { color: var(--g); }
  }
</style>
`,
    },
  ],
}

const stats: ComponentPreset = {
  name: 'Stats',
  demoHtml: `<Section>
  <Stats>
    <Stat><strong>10d</strong><span>Average launch</span></Stat>
    <Stat><strong>100</strong><span>Static score target</span></Stat>
    <Stat><strong>0</strong><span>Framework lock-in</span></Stat>
  </Stats>
</Section>`,
  files: [
    {
      componentName: 'Stats',
      fileName: 'Stats.html',
      html: `<!--
  @desc Stat collection wrapper. Put Stat items in the slot.
  @attr cols Grid column split. Defaults to 3-3.
-->
<div class="stats">
  <Grid cols="{{cols}}">{{slot}}</Grid>
</div>

<style>
  .stats { width: 100%; }
</style>
`,
    },
    {
      componentName: 'Stat',
      fileName: 'Stat.html',
      html: `<!--
  @desc Single stat item. Slot owns value and label.
-->
<div class="stat">{{slot}}</div>

<style>
  .stat {
    display: grid;
    gap: calc(var(--gp) / 2);
    padding-block: var(--pd);
    border-top: var(--bw) solid var(--b);

    strong {
      font-size: var(--h2-fs);
      line-height: var(--h2-lh);
    }

    span,
    p { color: var(--g); }
  }
</style>
`,
    },
  ],
}

const processPreset: ComponentPreset = {
  name: 'Process',
  demoHtml: `<Section>
  <Process>
    <Step><h3>Plan</h3><p>Define scope and content.</p></Step>
    <Step><h3>Build</h3><p>Compose pages from primitives.</p></Step>
    <Step><h3>Launch</h3><p>Verify and ship static output.</p></Step>
  </Process>
</Section>`,
  files: [
    {
      componentName: 'Process',
      fileName: 'Process.html',
      html: `<!--
  @desc Process/steps collection wrapper. Put Step items in the slot.
-->
<ol class="process">{{slot}}</ol>

<style>
  .process {
    display: grid;
    gap: var(--gp);
    padding: 0;
    margin: 0;
    list-style: none;
    counter-reset: steps;
  }
</style>
`,
    },
    {
      componentName: 'Step',
      fileName: 'Step.html',
      html: `<!--
  @desc Single process step. Slot owns heading and copy.
-->
<li class="stp">{{slot}}</li>

<style>
  .stp {
    counter-increment: steps;
    display: grid;
    gap: calc(var(--gp) / 2);
    padding: var(--pd);
    border-top: var(--bw) solid var(--b);

    &::before {
      content: counter(steps, decimal-leading-zero);
      color: var(--g);
      font-size: var(--sm-fs);
    }

    p { color: var(--g); }
  }
</style>
`,
    },
  ],
}

const questions: ComponentPreset = {
  name: 'Questions',
  demoHtml: `<Section>
  <Questions />
</Section>`,
  files: [{
    componentName: 'Questions',
    fileName: 'Questions.html',
    html: `<!--
  @desc FAQ-style questions preset built from Accordion primitives.
-->
<div class="questions w">
  <div class="questions-head w">
    <p>FAQ</p>
    <h2>Questions before kickoff.</h2>
  </div>
  <div class="questions-list">
    <Accordion group="preset-faq" summary="Can I edit this copy?" body="Yes. Change this component file or pass through your own authored section later." />
    <Accordion group="preset-faq" summary="Does this add a new framework?" body="No. Presets are normal HTML components that use existing built-ins." />
    <Accordion group="preset-faq" summary="Can I remove this section?" body="Yes. Delete the component file and remove any route invocation." />
  </div>
</div>

<style>
  .questions { padding-block: var(--by); }

  .questions-head {
    max-width: var(--md-mw);

    p {
      color: var(--a60);
      font-size: var(--sm-fs);
      text-transform: uppercase;
      letter-spacing: .08em;
    }
  }

  .questions-list {
    display: grid;
    gap: var(--gp);
  }
</style>
`,
  }],
}

const componentPresets: Record<ComponentPresetName, ComponentPreset> = {
  hero,
  cta,
  features,
  partners,
  pricing,
  testimonials,
  testimonial: testimonials,
  stats,
  process: processPreset,
  faq: questions,
}

export function availableComponentPresets() {
  return Object.keys(componentPresets).filter((name) => name !== 'testimonial').join(', ')
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
  for (const file of preset.files) {
    await writeIfMissing(join(root, 'src', 'components', file.fileName), file.html, options.force ?? false)
  }
  if (options.demo) await appendDemo(preset)
  console.log(`\nAdded ${preset.name}.`)
  console.log(`Use it in a route with ${preset.demoHtml.split('\n')[0]}`)
}
