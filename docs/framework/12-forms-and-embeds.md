# Forms and embeds

SANITIZE Boilerplate stays static by default. Forms and embeds use platform HTML, components, or explicit third-party services.

## Forms

There is no built-in backend form handler. Use one of these patterns:

- static HTML form that posts to a configured external endpoint
- Vercel/hosting integration wired by project code
- custom component wrapping provider-specific markup
- plain contact links when no form processing exists

Example static form:

```html
<form action="https://example.com/forms/contact" method="post">
  <label>
    Name
    <input name="name" autocomplete="name" required>
  </label>
  <label>
    Email
    <input name="email" type="email" autocomplete="email" required>
  </label>
  <label>
    Message
    <textarea name="message" required></textarea>
  </label>
  <button type="submit">Send</button>
</form>
```

Keep validation native first: `required`, `type`, `minlength`, `maxlength`, `pattern`, and useful labels.

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
