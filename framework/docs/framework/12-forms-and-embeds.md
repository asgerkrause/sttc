# Forms and embeds

SANITIZE ships no form or embed component library. Use native HTML or create project-owned components when markup repeats.

```html
<form action="https://example.com/contact" method="post">
  <label>
    Email
    <input type="email" name="email" required autocomplete="email">
  </label>
  <button type="submit">Send</button>
</form>
```

Keep provider endpoints explicit and secrets out of frontend source. Native validation owns required, type, pattern, length, and autocomplete behavior unless a real product requirement needs more.

For embeds, use a titled iframe with an explicit referrer and permissions policy:

```html
<iframe
  src="https://www.youtube.com/embed/example"
  title="Product demonstration"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>
```

Create a component when semantics, policy, behavior, or presentation repeat. Component scripts must clean up and optional styles follow the project's system.
