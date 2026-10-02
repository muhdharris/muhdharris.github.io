# muhdharris.github.io

Personal site — live at https://muhdharris.github.io

Hand-written HTML and CSS. No framework, no build step, no template.
Dark and light mode via `prefers-color-scheme`.

## Layout

```
index.html    single page, six sections
styles.css    all styling, CSS custom properties for theming
```

## Sections

Home · About · What I Run · Selected Work · Stack · Education · Contact

The "What I Run" section is the substantive one — a two-node Proxmox
cluster with sixteen containers, written up as a case study rather than a
list of software.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Licence

MIT — see [LICENSE](LICENSE).
