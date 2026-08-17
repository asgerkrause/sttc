# Glossary

## authored route
An HTML file under `src/pages/` that owns a public URL.

## component
One PascalCase HTML file compiled at build time with schema, attrs, slots, optional script, optional style, and optional structured data.

## content route
A route compiled from an optional markdown record and source-owned template.

## discovery
Machine-readable output: sitemap, feeds, route Markdown/JSON, site manifest, llms files, and connected JSON-LD.

## global CSS
Project-owned `src/styles.css`. The starter version only registers two fonts and a responsive root scale; no CSS framework ships.

## renderer directive
Build syntax handled directly by the renderer rather than loaded from `src/components`; currently `SEO` is the primary directive.

## route fragment
Body-oriented HTML under `dist/routes/` fetched by the client router.

## shell
Persistent `src/shell.html` containing document structure, route root, and shell components.

## source root
A project-owned directory such as `src/images`, `src/videos`, or `src/files` whose public outputs are built or copied.

## static public page
A complete HTML document emitted for direct navigation and static hosting.

## starter component
A small replaceable source file. The starter components are Header, Footer, Section, Logo, Image, Video, and Grid.
