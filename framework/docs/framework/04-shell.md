# Shell

`src/shell.html` is the persistent document wrapper:

```html
<!doctype html>
<html lang="{{locale}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="/router.js" type="module"></script>
  <script src="/assets/js/app.js" type="module"></script>
</head>
<body>
  <Header />
  <main></main>
  <Footer />
  <div data-snz-announcer aria-live="polite" aria-atomic="true"></div>
</body>
</html>
```

The build expands shell components, substitutes locale and site name, replaces the app and router paths with hashed `/assets/js/` files, flattens `src/styles.css` into one hashed stylesheet, links component styles when present, and inserts route metadata for static public pages.

Keep one semantic `<main>` as a direct child of `<body>`. The router targets `body > main` and owns its contents, focus movement, route announcements, navigation, and route-head updates.

Shell inline scripts are bundled into the app asset. Use them sparingly; persistent project behavior normally belongs in `src/app.ts`.
