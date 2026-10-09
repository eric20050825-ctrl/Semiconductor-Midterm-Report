# Strain-Engineered Bands

Interactive midterm report for Introduction to Semiconductors:
*"Mechanical strain changes the atomic spacing and electronic structure of
semiconductors. Show how tensile and compressive strain affect the relevant ttt
band edges."*

Live structure:

- `index.html` — page markup and all written content (Part 1 physics explainer, Part 2 controls, Part 3 graphs, appendix)
- `style.css` — design tokens, layout, light/dark theme
- `script.js` — the strain → band/valley/phonon model and all SVG rendering (lattice sketch, band diagram, 4 charts)

No build step, no dependencies. Open `index.html` directly in a browser, or
serve the folder with any static server.

## Viewing it locally

```bash
# from inside this folder
open index.html                 # macOS, opens in default browser
# or, for a local server (needed by some browsers for relative-path assets):
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Publishing to GitHub (so you can co-edit with your teammate)

1. **Create an empty repo on GitHub** (github.com → New repository). Do **not**
   initialize it with a README/license — this folder already has one.
2. Push this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```
3. **Add your teammate as a collaborator**: GitHub repo → *Settings* →
   *Collaborators* → *Add people* → their GitHub username.
4. **Turn on GitHub Pages**: repo → *Settings* → *Pages* → under *Build and
   deployment*, set Source = `Deploy from a branch`, Branch = `main`, folder =
   `/ (root)` → Save. After a minute the page is live at
   `https://<your-username>.github.io/<repo-name>/` — share that link with
   your teammate and TA/professor.

## Collaborating day-to-day

Two people editing the same three files works fine as long as you don't both
edit the same section at once:

- Create a branch per change: `git checkout -b yourname/section-name`
- Commit, push, open a Pull Request on GitHub, and merge into `main` (even
  solo-approved PRs give you a diff to review before it goes live).
- Pull before you start a new session: `git pull origin main`.
- Because content, style, and behavior live in separate files
  (`index.html` / `style.css` / `script.js`), you can usually divide work by
  file — one person writing Part 1's text in `index.html` while the other
  tunes `script.js` — without stepping on each other.

## Editing the physics model

Everything numeric lives in the `MATERIALS` object at the top of `script.js`:
gap energies, deformation potentials (`aGap`, `xiU`, `bVB`), and phonon
constants. To add a material, copy one of the existing entries and fill in
its constants; the controls, graphs, and legends pick it up automatically.
The parameter table and the "On the numbers" note in `index.html`'s appendix
section explain which constants are literature values vs. illustrative
teaching values — update that note if you change what's rigorous vs.
representative.
