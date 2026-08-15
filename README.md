# Laurence Model World

A static, zero-backend model-car gallery inspired by a physical card deck. Images are discovered from `cards/` and shuffled on every page load, and each card receives exactly one randomly assigned holographic, shine, or cross-holographic effect. Only the current card and its nearest neighbours are loaded at once. Browse with upper/lower clicks, touch swipes, arrow keys, pointer parallax, or mobile device tilt.

Image files use the sequential `model-car-N.webp` naming scheme. The gallery reads a directory index when the host provides one, otherwise it detects the last sequential image with lightweight requests. `DEFAULT_IMAGE_COUNT` in `app.js` is used only when discovery is unavailable.

## Preview locally

From the project directory, start any static file server, for example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## GitHub Pages

The project has no build step. In the repository settings, choose **Deploy from a branch**, select the desired branch and the repository root (`/`). All asset paths are relative, so the site also works when published below a repository subpath.
