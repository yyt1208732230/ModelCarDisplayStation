# Laurence Model World

A static, zero-backend model-car gallery inspired by a physical card deck. Cards always follow the numbered image order, while each page load starts on one randomly selected card. Only the current card and its nearest neighbours are loaded at once. Browse with upper/lower clicks, touch swipes, arrow keys, pointer parallax, mobile device tilt, or the delayed number dial.

Image files use the sequential `model-car-N.webp` naming scheme. The gallery intentionally does not inspect the directory or probe image URLs at startup. When the collection changes, update `IMAGE_COUNT` near the top of `app.js`; it is currently set to `146`.

## Preview locally

From the project directory, start any static file server, for example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## GitHub Pages

The project has no build step. In the repository settings, choose **Deploy from a branch**, select the desired branch and the repository root (`/`). All asset paths are relative, so the site also works when published below a repository subpath.
