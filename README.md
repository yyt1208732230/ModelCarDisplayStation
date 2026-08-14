# Laurence Model World

A static, zero-backend model-car gallery inspired by a physical card deck. Images are loaded from `cards/`, shuffled on every page load, and each card receives exactly one randomly assigned holographic, shine, or cross-holographic effect. Browse with upper/lower clicks, touch swipes, arrow keys, pointer parallax, or mobile device tilt.

## Preview locally

From the project directory, start any static file server, for example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## GitHub Pages

The project has no build step. In the repository settings, choose **Deploy from a branch**, select the desired branch and the repository root (`/`). All asset paths are relative, so the site also works when published below a repository subpath.
