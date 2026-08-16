(async () => {
  "use strict";

  const DEFAULT_IMAGE_COUNT = 146;
  const MAX_IMAGE_COUNT = 500;
  const CARD_CACHE_RADIUS = 3;
  const EXTERNAL_URL = "https://diecast.ilovefuturemobility.org/";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const root = document.querySelector(".experience");
  const deck = document.querySelector(".deck");
  const template = document.querySelector("#card-template");
  const ambientLayers = [...document.querySelectorAll(".ambient")];
  const previousZone = document.querySelector(".nav-zone--previous");
  const nextZone = document.querySelector(".nav-zone--next");

  const imagePath = (index) => `./cards/model-car-${index}.webp`;

  const getDirectoryImageIndexes = async () => {
    try {
      const response = await fetch("./cards/", { cache: "no-store" });
      if (!response.ok) return [];

      const directoryHtml = await response.text();
      return [...new Set(
        [...directoryHtml.matchAll(/model-car-(\d+)\.webp/gi)]
          .map((match) => Number(match[1]))
          .filter((index) => Number.isInteger(index) && index > 0),
      )].sort((a, b) => a - b);
    } catch {
      return [];
    }
  };

  const imageExists = async (index) => {
    try {
      let response = await fetch(imagePath(index), { method: "HEAD", cache: "no-store" });
      if (response.status === 405) {
        response = await fetch(imagePath(index), {
          cache: "no-store",
          headers: { Range: "bytes=0-0" },
        });
      }
      return response.ok;
    } catch {
      return false;
    }
  };

  const getSequentialImageCount = async () => {
    if (!(await imageExists(1))) return 0;

    let lowerBound = 1;
    let upperBound = DEFAULT_IMAGE_COUNT;

    if (await imageExists(DEFAULT_IMAGE_COUNT)) {
      lowerBound = DEFAULT_IMAGE_COUNT;
      upperBound = DEFAULT_IMAGE_COUNT + 1;

      while (upperBound < MAX_IMAGE_COUNT && await imageExists(upperBound)) {
        lowerBound = upperBound;
        upperBound = Math.min(upperBound * 2, MAX_IMAGE_COUNT);
      }

      if (upperBound === MAX_IMAGE_COUNT && await imageExists(upperBound)) return upperBound;
    }

    while (upperBound - lowerBound > 1) {
      const middle = Math.floor((lowerBound + upperBound) / 2);
      if (await imageExists(middle)) {
        lowerBound = middle;
      } else {
        upperBound = middle;
      }
    }

    return lowerBound;
  };

  const discoverImageIndexes = async () => {
    const directoryIndexes = await getDirectoryImageIndexes();
    if (directoryIndexes.length) return directoryIndexes;

    const imageCount = await getSequentialImageCount();
    const resolvedCount = imageCount || DEFAULT_IMAGE_COUNT;
    return Array.from({ length: resolvedCount }, (_, index) => index + 1);
  };

  const imageIndexes = await discoverImageIndexes();
  const totalImages = imageIndexes.length;
  const sourceImages = imageIndexes.map((folderIndex) => ({
    folderIndex,
    src: imagePath(folderIndex),
  }));

  const shuffle = (items) => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const gallery = shuffle(sourceImages);
  const cards = gallery.map((item, orderIndex) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const image = card.querySelector("img");
    const tag = card.querySelector(".card__tag");
    const link = card.querySelector(".card__link");
    const foil = card.querySelector(".card__foil");
    const foilEffects = ["holographic", "shine", "cross-holographic"];
    const foilEffect = foilEffects[Math.floor(Math.random() * foilEffects.length)];

    image.dataset.src = item.src;
    if (orderIndex <= CARD_CACHE_RADIUS || orderIndex >= totalImages - CARD_CACHE_RADIUS) {
      image.src = item.src;
    }
    image.alt = `Car model photograph ${item.folderIndex} of ${totalImages}`;
    image.loading = "eager";
    image.decoding = "async";
    tag.textContent = `${item.folderIndex}/${totalImages}`;
    link.href = EXTERNAL_URL;
    foil.classList.add(`card__foil--${foilEffect}`);
    foil.style.animationDelay = `${-(Math.random() * 8).toFixed(2)}s`;
    card.style.setProperty("--foil-x", `${Math.round(Math.random() * 100)}%`);
    card.style.setProperty("--foil-y", `${Math.round(Math.random() * 100)}%`);
    card.dataset.foil = foilEffect;
    card.dataset.order = String(orderIndex);
    card.dataset.folderIndex = String(item.folderIndex);
    deck.appendChild(card);
    return card;
  });

  const state = {
    position: 0,
    target: 0,
    velocity: 0,
    dragging: false,
    pointerId: null,
    pointerStartY: 0,
    pointerLastY: 0,
    pointerLastTime: 0,
    dragStartPosition: 0,
    moved: false,
    currentIndex: -1,
    ambientLayer: 0,
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
    lastFrame: performance.now(),
  };

  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

  const wrappedDistance = (index, position) => {
    let distance = index - mod(position, totalImages);
    if (distance > totalImages / 2) distance -= totalImages;
    if (distance < -totalImages / 2) distance += totalImages;
    return distance;
  };

  const accentPalette = ["#aebbb0", "#a7bdc3", "#c7b48e", "#b9b1c8", "#c5afa5", "#a9b8a8"];

  const syncCachedImages = (galleryIndex) => {
    cards.forEach((card, index) => {
      const image = card.querySelector("img");
      const nearby = Math.abs(wrappedDistance(index, galleryIndex)) <= CARD_CACHE_RADIUS;

      if (nearby && !image.hasAttribute("src")) {
        image.src = image.dataset.src;
      } else if (!nearby && image.hasAttribute("src")) {
        image.removeAttribute("src");
      }
    });
  };

  const setAmbient = (galleryIndex) => {
    if (galleryIndex === state.currentIndex) return;
    state.currentIndex = galleryIndex;
    syncCachedImages(galleryIndex);
    state.ambientLayer = 1 - state.ambientLayer;
    const incoming = ambientLayers[state.ambientLayer];
    const outgoing = ambientLayers[1 - state.ambientLayer];
    incoming.style.setProperty("--ambient-image", `url("${gallery[galleryIndex].src}")`);
    incoming.classList.add("is-visible");
    outgoing.classList.remove("is-visible");
  };

  const getLayout = (distance) => {
    if (distance <= 0) {
      const depth = Math.min(Math.abs(distance), 2.4);
      return {
        y: -depth * 27,
        z: -depth * 95,
        scale: 1 - depth * 0.075,
        rotate: -depth * 3.6,
        opacity: Math.max(0, 1 - depth * 0.39),
        blur: Math.max(0, depth - 1.2) * 1.5,
      };
    }

    const approach = Math.min(distance, 1.2);
    return {
      y: approach * window.innerHeight * 0.58,
      z: -Math.min(distance, 1) * 20,
      scale: 1 - Math.min(distance, 1) * 0.055,
      rotate: Math.min(distance, 1) * 4.2,
      opacity: distance > 1.14 ? 0 : Math.max(0, 1 - Math.max(0, distance - 0.72) * 2),
      blur: Math.max(0, distance - 0.8) * 2,
    };
  };

  const render = () => {
    const selected = mod(Math.round(state.position), totalImages);
    setAmbient(selected);

    state.tiltX += (state.targetTiltX - state.tiltX) * 0.065;
    state.tiltY += (state.targetTiltY - state.tiltY) * 0.065;

    cards.forEach((card, index) => {
      const distance = wrappedDistance(index, state.position);
      if (Math.abs(distance) > CARD_CACHE_RADIUS) {
        card.style.visibility = "hidden";
        card.style.pointerEvents = "none";
        card.classList.remove("is-current");
        card.setAttribute("aria-hidden", "true");
        return;
      }

      card.style.visibility = "visible";
      const layout = getLayout(distance);
      const isCurrent = index === selected && Math.abs(distance) < 0.55;
      const interactive = Math.abs(distance) < 0.56;
      const parallaxStrength = Math.max(0, 1 - Math.abs(distance));
      const tiltX = state.tiltX * parallaxStrength;
      const tiltY = state.tiltY * parallaxStrength;
      const accent = accentPalette[(gallery[index].folderIndex - 1) % accentPalette.length];

      card.style.zIndex = String(1000 - Math.round(Math.abs(distance) * 100) + (distance > 0 ? 25 : 0));
      card.style.opacity = String(layout.opacity);
      card.style.filter = `blur(${layout.blur}px)`;
      card.style.pointerEvents = interactive ? "auto" : "none";
      card.style.setProperty("--accent", accent);
      card.style.setProperty("--shine-x", `${50 + state.tiltY * 7}%`);
      card.style.setProperty("--shine-y", `${46 - state.tiltX * 7}%`);
      card.style.setProperty("--foil-x", `${50 + state.tiltY * 12}%`);
      card.style.setProperty("--foil-y", `${48 - state.tiltX * 12}%`);
      card.style.transform = [
        `translate3d(${state.tiltY * 1.6 * parallaxStrength}px, ${layout.y + state.tiltX * 1.3 * parallaxStrength}px, ${layout.z}px)`,
        `rotateX(${tiltX}deg)`,
        `rotateY(${tiltY}deg)`,
        `rotateZ(${layout.rotate + state.tiltY * 0.12 * parallaxStrength}deg)`,
        `scale(${layout.scale})`,
      ].join(" ");
      card.classList.toggle("is-current", isCurrent);
      card.setAttribute("aria-hidden", isCurrent ? "false" : "true");
    });
  };

  const animate = (time) => {
    const dt = Math.min((time - state.lastFrame) / 16.667, 2);
    state.lastFrame = time;

    if (!state.dragging) {
      const delta = state.target - state.position;
      const spring = prefersReducedMotion ? 1 : 0.105;
      state.velocity += delta * spring * dt;
      state.velocity *= Math.pow(prefersReducedMotion ? 0 : 0.73, dt);
      state.position += state.velocity * dt;

      if (Math.abs(delta) < 0.0005 && Math.abs(state.velocity) < 0.0005) {
        state.position = state.target;
        state.velocity = 0;
      }
    }

    const needsRender =
      state.dragging ||
      Math.abs(state.target - state.position) > 0.0005 ||
      Math.abs(state.velocity) > 0.0005 ||
      Math.abs(state.targetTiltX - state.tiltX) > 0.001 ||
      Math.abs(state.targetTiltY - state.tiltY) > 0.001;

    if (needsRender) render();
    requestAnimationFrame(animate);
  };

  const markInteraction = () => root.classList.add("has-interacted");

  const goTo = (nextTarget) => {
    markInteraction();
    state.target = nextTarget;
    if (prefersReducedMotion) {
      state.position = nextTarget;
      state.velocity = 0;
    }
  };

  const step = (direction) => {
    const base = Math.round(state.target);
    goTo(base + direction);
  };

  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("a, .nav-zone")) return;
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.pointerStartY = event.clientY;
    state.pointerLastY = event.clientY;
    state.pointerLastTime = performance.now();
    state.dragStartPosition = state.position;
    state.velocity = 0;
    state.moved = false;
    root.classList.add("is-dragging");
    root.setPointerCapture?.(event.pointerId);
  });

  root.addEventListener("pointermove", (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    state.targetTiltX = Math.max(-2.2, Math.min(2.2, -y * 4.4));
    state.targetTiltY = Math.max(-2.5, Math.min(2.5, x * 5));

    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const now = performance.now();
    const deltaY = event.clientY - state.pointerStartY;
    const frameDelta = event.clientY - state.pointerLastY;
    const frameTime = Math.max(8, now - state.pointerLastTime);
    const travel = Math.max(390, deck.getBoundingClientRect().height * 0.86);
    state.position = state.dragStartPosition - deltaY / travel;
    state.target = state.position;
    state.velocity = (-frameDelta / travel) * (16.667 / frameTime);
    state.moved ||= Math.abs(deltaY) > 7;
    state.pointerLastY = event.clientY;
    state.pointerLastTime = now;
    markInteraction();
  });

  const finishPointer = (event) => {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const wasMoved = state.moved;
    const velocity = state.velocity;
    const y = event.clientY;
    state.dragging = false;
    state.pointerId = null;
    root.classList.remove("is-dragging");
    root.releasePointerCapture?.(event.pointerId);

    if (!wasMoved) {
      step(y < window.innerHeight / 2 ? -1 : 1);
      return;
    }

    const projected = state.position + velocity * 3.8;
    let destination = Math.round(projected);
    if (destination === Math.round(state.dragStartPosition) && Math.abs(state.position - state.dragStartPosition) > 0.12) {
      destination = Math.round(state.dragStartPosition) + Math.sign(state.position - state.dragStartPosition);
    }
    goTo(destination);
  };

  root.addEventListener("pointerup", finishPointer);
  root.addEventListener("pointercancel", finishPointer);
  root.addEventListener("pointerleave", () => {
    if (!state.dragging) {
      state.targetTiltX = 0;
      state.targetTiltY = 0;
    }
  });

  previousZone.addEventListener("click", (event) => {
    event.stopPropagation();
    step(-1);
  });
  nextZone.addEventListener("click", (event) => {
    event.stopPropagation();
    step(1);
  });

  document.addEventListener("keydown", (event) => {
    if (["ArrowDown", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      step(1);
    }
    if (["ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      step(-1);
    }
  });

  const handleOrientation = (event) => {
    if (event.beta == null || event.gamma == null) return;
    state.targetTiltX = Math.max(-2.2, Math.min(2.2, (event.beta - 45) / 18));
    state.targetTiltY = Math.max(-2.5, Math.min(2.5, event.gamma / 18));
  };

  const getOrientationEvent = () => {
    try {
      return window.DeviceOrientationEvent;
    } catch {
      return null;
    }
  };

  const orientationEvent = getOrientationEvent();
  if (orientationEvent && typeof orientationEvent.requestPermission !== "function") {
    window.addEventListener("deviceorientation", handleOrientation, { passive: true });
  }

  setAmbient(0);
  render();
  requestAnimationFrame(animate);
})();
