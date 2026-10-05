# muhdharris.github.io

Personal site — live at https://muhdharris.github.io

Hand-written HTML and CSS. No framework, no build step, no template.
Dark and light mode via `prefers-color-scheme`.

## Files

```
index.html             the whole site, single page
styles.css             all styling, CSS custom properties for theming
infra-topology.svg     homelab diagram, drawn in the dark palette
og-image.png           1200x630 share card for link previews
Muhd-Harris-CV.pdf     CV
```

## Sections

About · Experience · Infrastructure · Learning · Portfolio · Skills ·
Background · Contact

The Infrastructure section is the substantive one — a two-node Proxmox cluster
with sixteen containers, written up as a case study rather than a list of
software, including the fix that appeared to work and was still wrong.

## Notes

The site is static, so it deploys straight from `main`. There is no build step
and nothing to compile.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Licence

MIT — see [LICENSE](LICENSE).
