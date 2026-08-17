# Framework philosophy

SANITIZE removes repetitive static-site build work without hiding HTML, browser behavior, or project ownership.

## Renderer-owned

- deterministic routes and component composition;
- TypeScript bundling and lifecycle registration;
- image processing and public media validation;
- SEO/AEO/GEO metadata and structured data;
- sitemap, feeds, manifests, route JSON, llms files, and AI discovery;
- CMS records, collections, tags, and collision checks;
- strict source errors and launch gates;
- lean navigation, focus, announcements, and activity management.

## Project-owned

- content and information architecture;
- visual design and CSS conventions;
- custom components and behavior;
- provider integrations and credentials;
- analytics consent and deployment decisions.

The starter should prove the renderer with the smallest useful source surface. Smart defaults are deterministic and replaceable. Missing production information fails loudly instead of being guessed.
