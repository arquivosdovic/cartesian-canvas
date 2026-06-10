# cartesian-canvas

Interactive Cartesian plane builder — place, score, and visualize elements across any two-axis framework.

Define your own axes, add elements with photos, score them in each direction, and watch them land exactly where they belong on the plane. Export and import your work as JSON to keep everything safe between sessions.

---

## What it does

- **Custom axis labels** — name each end of each axis however you want (e.g. *Introvertido ↔ Extrovertido*, *Iniciante ↔ Especialista*). Labels update live and never get clipped, even long ones.
- **Elements with photos** — add any number of elements, optionally uploading a photo for each. Falls back to initials if no photo is provided.
- **Score-based positioning** — assign a score from −10 to 10 for each direction. The plane calculates X/Y coordinates automatically from the difference between opposing scores.
- **Export & import** — save your entire project as a `.json` file (labels, elements, scores, and photos) and reload it at any time, on any machine.
- **Dark mode** — adapts automatically to the system preference.

---

## Getting started

No build step, no dependencies to install. It runs entirely in the browser using native ES Modules.

### Running locally

Because the project uses ES Modules (`type="module"`), it needs to be served over HTTP rather than opened directly as a `file://` URL — except in Firefox, which allows modules from `file://`.

The quickest options:

```bash
# Python (comes pre-installed on most systems)
python3 -m http.server 8080

# Node.js (npx, no install needed)
npx serve .

# VS Code
# Install the "Live Server" extension, then click "Go Live" in the status bar
```

Then open `http://localhost:8080` in your browser.

### Deploying to Netlify

1. Push the repository to GitHub.
2. In Netlify, click **Add new site → Import an existing project**.
3. Select the GitHub repository.
4. Leave build command and publish directory blank — the project is static, `index.html` is at the root.
5. Click **Deploy**. Done.

---

## Project structure

```
cartesian-canvas/
├── index.html
├── css/
│   ├── reset.css        # Base normalization
│   ├── variables.css    # Design tokens and dark mode
│   ├── layout.css       # App shell, sidebar, main area
│   ├── components.css   # Reusable UI components
│   ├── sidebar.css      # Sidebar-specific styles
│   ├── canvas.css       # Canvas wrapper
│   └── toolbar.css      # Toolbar and toast notification
└── js/
    ├── main.js          # Entry point — wires everything together
    ├── store.js         # Central state with observer pattern
    ├── renderer.js      # Canvas 2D drawing engine
    ├── sidebar.js       # Sidebar UI and interactions
    ├── persistence.js   # Export / import logic
    └── toast.js         # Toast notification utility
```

---

## How scoring works

Each element has four independent scores (top, bottom, left, right), each ranging from −10 to 10.

The plane position is derived from the **net difference** between opposing directions:

```
X position = score(right) − score(left)
Y position = score(top)   − score(bottom)
```

A score of 0 on both axes places the element at the center. Maximum values push it to the edges.

---

## Export format

Projects are saved as plain `.json` files:

```json
{
  "version": 1,
  "exportedAt": "2026-06-10T14:30:00.000Z",
  "labels": {
    "top": "Alto",
    "bottom": "Baixo",
    "left": "Esquerda",
    "right": "Direita"
  },
  "elements": [
    {
      "id": 1749560123456,
      "name": "Exemplo",
      "photo": null,
      "scores": { "top": 7, "bottom": 2, "left": 1, "right": 8 }
    }
  ]
}
```

Photos are stored as Base64 strings inside the `photo` field. Keep this in mind for file size — a project with many high-resolution photos will produce a large JSON.

---

## Browser support

Works in any modern browser that supports ES Modules and Canvas 2D. Chrome, Firefox, Safari, and Edge are all fine.

---

## License

MIT
