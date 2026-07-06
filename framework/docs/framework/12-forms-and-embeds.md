# Forms and embeds

SANITIZE Boilerplate stays static by default. Forms use native HTML semantics, small form primitives, or explicit third-party services. Embeds use platform iframes through `<Embed>`.

## Forms

There is no built-in backend form handler. Use one of these patterns:

- static HTML form that posts to a configured external endpoint
- Vercel/hosting integration wired by project code
- custom component wrapping provider-specific markup
- plain contact links when no form processing exists

Use built-in form primitives when form markup repeats or needs consistent local styling:

```html
<Form action="https://example.com/forms/contact" method="post">
  <div g="2">
    <Input name="name" label="Full Name" required autocomplete="name" placeholder="Jane Doe" />
    <Input name="company" label="Company Name" required autocomplete="organization" placeholder="Acme Corp" />
  </div>

  <div g="2">
    <Input type="email" name="email" label="Work Email" required autocomplete="email" placeholder="jane@acmecorp.com" />
    <Input type="tel" name="phone" label="Phone Number" autocomplete="tel" inputmode="tel" placeholder="+1 (555) 000-0000" />
  </div>

  <Fieldset legend="Company Size">
    <Radio name="size" value="1-10" label="1-10" required />
    <Radio name="size" value="11-50" label="11-50" required />
    <Radio name="size" value="50+" label="50+" required />
  </Fieldset>

  <Fieldset legend="Services Required">
    <Checkbox name="services" value="design" label="Design System" />
    <Checkbox name="services" value="dev" label="Web Development" />
    <Checkbox name="services" value="brand" label="Brand Strategy" />
  </Fieldset>

  <Textarea name="message" label="Message" required placeholder="Tell us what you need." />
  <Submit label="Submit Inquiry" variant="accent" />
  <FormStatus>Native browser validation handles required fields before submit.</FormStatus>
</Form>
```

The primitives render native markup:

- `<Form>` → `<form>`
- `<Input>` / `<Textarea>` / `<Select>` → `<label><span>Label</span><control></label>`
- `<Checkbox>` / `<Radio>` → `<label><control><span>Label</span></label>`
- `<Fieldset>` → `<fieldset><legend>Legend</legend><div>…</div></fieldset>`
- `<Submit>` → `<button class="btn" type="submit">…</button>`

Keep validation native first: `required`, `type`, `minlength`, `maxlength`, `pattern`, `min`, `max`, `step`, `inputmode`, `autocomplete`, and useful labels. `type="email"` handles email validation. For phone fields, prefer `type="tel"`, `inputmode="tel"`, and `autocomplete="tel"`; only add `pattern` when the project has an exact regional format requirement.

Radio groups are required by putting `required` on one radio in the shared `name` group. Checkbox groups have no pure-HTML “at least one checked” constraint; when `Fieldset required` wraps checkbox controls, the form component adds a small progressive `setCustomValidity()` check on the first checkbox.

`Button` renders a link CTA. Use `Submit` inside forms for real submit buttons.

## Form placement

Use route HTML or a component.

Use a component when form markup repeats, needs local CSS, or needs route-safe JavaScript:

```txt
src/components/ContactForm.html
```

Component CSS belongs in that component `<style>`. Shared submission logic belongs in `src/app.ts`.

Do not put form controls inside markdown. Markdown safety rules reject form tags and controls.

## Accessibility checklist

- every input has visible label or clear accessible name
- required fields use native `required`
- errors are text, not color alone
- submit button has clear action text
- success/failure state is announced or visible after submit
- do not trap focus in custom UI

## Submit handling

By default, forms submit natively to the configured `action`. The framework does not auto-create `/api/contact`, send email, add CAPTCHA, or load provider scripts. For email delivery later, use a server-side endpoint with a provider such as Resend, Postmark, or the hosting/provider form backend; never put provider API keys in frontend code.

If a project needs enhanced submit behavior later, keep it progressive:

- listen for form submit in `src/app.ts`
- use `FormData(form)` and `fetch(form.action, { method: form.method, body })`
- disable submit while pending
- update `FormStatus` via its `aria-live` region
- fall back to native submit if JavaScript fails

Do not expose private provider keys through frontend code.

## Embeds

Use built-in `<Embed>` for responsive iframe media:

```html
<Embed src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Product demo" />
```

Attributes:

| Attribute | Required | Notes |
| --- | --- | --- |
| `src` | yes | iframe URL |
| `title` | yes | accessible title |
| `ratio` | no | `16/9`, `4/3`, `1/1`, or `auto`; default `16/9` |

`<Embed>` renders an iframe with `loading="lazy"`, `allowfullscreen`, and `referrerpolicy="strict-origin-when-cross-origin"`.

## Embed safety

Use provider embed URLs, not arbitrary page URLs. Example: use YouTube `/embed/...`, not a normal watch URL.

If provider needs scripts, write explicit project code and document the dependency. The framework does not auto-load third-party scripts for embeds.

## Analytics on actions

Button and link components may use `track`:

```html
<Button href="/contact/" label="Start project" track="Contact CTA" />
```

`track` emits `data-snz-track`. Runtime calls Vercel Analytics only when `window.va` exists; otherwise it emits `snz:track`.

Analytics setup remains explicit per project.

## Next

[Scripts and interactivity](./11-scripts-and-interactivity.md) · [Docs home](./README.md) · [Deployment](./13-deployment.md)
