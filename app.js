(() => {
  "use strict";

  // Update this one value whenever the numbered images in /cards change.
  const IMAGE_COUNT = 245;
  const CARD_CACHE_RADIUS = 3;
  const DIAL_TO_CARD_DELAY = 190;
  const CARD_TO_DIAL_DELAY = 120;
  const EXTERNAL_URL = "https://diecast.ilovefuturemobility.org/";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const root = document.querySelector(".experience");
  const deck = document.querySelector(".deck");
  const template = document.querySelector("#card-template");
  const ambientLayers = [...document.querySelectorAll(".ambient")];
  const previousZone = document.querySelector(".nav-zone--previous");
  const nextZone = document.querySelector(".nav-zone--next");
  const indexControl = document.querySelector(".card-index-control");
  const indexDial = document.querySelector(".card-index-control__dial");
  const dialDisplay = document.querySelector(".card-index-control__number");
  const dialTotal = document.querySelector(".card-index-control__total");
  const dialPrevious = document.querySelector(".card-index-control__step--previous");
  const dialNext = document.querySelector(".card-index-control__step--next");

  const imagePath = (index) => `./cards/model-car-${index}.webp`;
  const totalImages = IMAGE_COUNT;
  const gallery = Array.from({ length: totalImages }, (_, index) => ({
    folderIndex: index + 1,
    src: imagePath(index + 1),
  }));
  const initialIndex = Math.floor(Math.random() * totalImages);

  const cards = gallery.map((item, orderIndex) => {
    const foilEffects = ["holographic", "shine", "cross-holographic"];
    const foilEffect = foilEffects[orderIndex % foilEffects.length];
    const foilSeed = orderIndex + 1;
    const foilX = (foilSeed * 37) % 101;
    const foilY = (foilSeed * 61) % 101;

    const card = template.content.firstElementChild.cloneNode(true);
    const image = card.querySelector("img");
    const tag = card.querySelector(".card__tag");
    const link = card.querySelector(".card__link");
    const foil = card.querySelector(".card__foil");

    image.dataset.src = item.src;
    image.alt = `Car model photograph ${item.folderIndex} of ${totalImages}`;
    image.loading = "eager";
    image.decoding = "async";
    tag.textContent = `${item.folderIndex}/${totalImages}`;
    link.href = EXTERNAL_URL;
    foil.classList.add(`card__foil--${foilEffect}`);
    foil.style.animationDelay = `${-((foilSeed * 1.37) % 8).toFixed(2)}s`;
    card.style.setProperty("--foil-x", `${foilX}%`);
    card.style.setProperty("--foil-y", `${foilY}%`);
    card.dataset.foil = foilEffect;
    card.dataset.order = String(orderIndex);
    card.dataset.folderIndex = String(item.folderIndex);
    deck.appendChild(card);
    return card;
  });

  const state = {
    position: initialIndex,
    target: initialIndex,
    velocity: 0,
    dragging: false,
    pointerId: null,
    pointerStartY: 0,
    pointerLastY: 0,
    pointerLastTime: 0,
    dragStartPosition: initialIndex,
    moved: false,
    currentIndex: -1,
    ambientLayer: 0,
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
    lastFrame: performance.now(),
  };

  const dialState = {
    value: initialIndex,
    pendingTarget: null,
    cardTimer: null,
    displayTimer: null,
    dragging: false,
    pointerId: null,
    pointerStartY: 0,
    dragStartValue: initialIndex,
    lastWheelTime: 0,
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
    const previousIndex = state.currentIndex;
    state.currentIndex = galleryIndex;
    syncCachedImages(galleryIndex);
    state.ambientLayer = 1 - state.ambientLayer;
    const incoming = ambientLayers[state.ambientLayer];
    const outgoing = ambientLayers[1 - state.ambientLayer];
    incoming.style.setProperty("--ambient-image", `url("${gallery[galleryIndex].src}")`);
    incoming.classList.add("is-visible");
    outgoing.classList.remove("is-visible");

    if (dialState.pendingTarget === galleryIndex) {
      dialState.pendingTarget = null;
    } else if (dialState.pendingTarget === null && previousIndex >= 0) {
      queueDialSync(galleryIndex, wrappedDistance(galleryIndex, previousIndex) >= 0 ? 1 : -1);
    }
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

  const cancelPendingDialJump = () => {
    window.clearTimeout(dialState.cardTimer);
    dialState.cardTimer = null;
    dialState.pendingTarget = null;
  };

  const renderDialValue = (nextValue, direction = 1, immediate = false) => {
    const normalizedValue = mod(nextValue, totalImages);
    const displayValue = String(normalizedValue + 1).padStart(3, "0");
    dialState.value = normalizedValue;
    indexDial.setAttribute("aria-valuenow", String(normalizedValue + 1));
    indexDial.setAttribute("aria-valuetext", `Card ${normalizedValue + 1} of ${totalImages}`);

    const currentNumber = dialDisplay.querySelector(".dial-number.is-current");
    if (immediate || prefersReducedMotion || !currentNumber) {
      const number = document.createElement("span");
      number.className = "dial-number is-current";
      number.textContent = displayValue;
      dialDisplay.replaceChildren(number);
      return;
    }

    [...dialDisplay.querySelectorAll(".dial-number:not(.is-current)")].forEach((number) => number.remove());
    if (currentNumber.textContent === displayValue) return;

    const incoming = document.createElement("span");
    const movement = direction >= 0 ? "up" : "down";
    incoming.className = `dial-number is-entering-${movement}`;
    incoming.textContent = displayValue;
    dialDisplay.appendChild(incoming);
    void incoming.offsetHeight;
    currentNumber.classList.remove("is-current");
    currentNumber.classList.add(`is-exiting-${movement}`);
    incoming.classList.add("is-current");

    window.setTimeout(() => {
      currentNumber.remove();
      incoming.classList.remove(`is-entering-${movement}`);
    }, 430);
  };

  const queueDialSync = (galleryIndex, direction) => {
    window.clearTimeout(dialState.displayTimer);
    dialState.displayTimer = window.setTimeout(() => {
      renderDialValue(galleryIndex, direction);
    }, CARD_TO_DIAL_DELAY);
  };

  const goToGalleryIndex = (galleryIndex) => {
    const nearestCycle = Math.round((state.target - galleryIndex) / totalImages);
    const destination = galleryIndex + nearestCycle * totalImages;
    const distance = destination - state.target;

    // A distant dial jump only stages the final neighbouring card instead of
    // racing through (and loading) every image between the two positions.
    if (!prefersReducedMotion && Math.abs(distance) > 2) {
      state.position = destination - Math.sign(distance) * 0.82;
      state.velocity = 0;
      render();
    }

    goTo(destination);
  };

  const selectDialValue = (nextValue, direction) => {
    const normalizedValue = mod(nextValue, totalImages);
    markInteraction();
    window.clearTimeout(dialState.displayTimer);
    dialState.pendingTarget = normalizedValue;
    renderDialValue(normalizedValue, direction);
    window.clearTimeout(dialState.cardTimer);
    dialState.cardTimer = window.setTimeout(() => {
      dialState.cardTimer = null;
      goToGalleryIndex(normalizedValue);
    }, DIAL_TO_CARD_DELAY);
  };

  const nudgeDial = (direction) => {
    selectDialValue(dialState.value + direction, direction);
  };

  const step = (direction) => {
    cancelPendingDialJump();
    const base = Math.round(state.target);
    goTo(base + direction);
  };

  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("a, .nav-zone, .card-index-control")) return;
    cancelPendingDialJump();
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

  indexControl.addEventListener("pointerdown", (event) => event.stopPropagation());

  dialPrevious.addEventListener("click", (event) => {
    event.stopPropagation();
    nudgeDial(-1);
  });

  dialNext.addEventListener("click", (event) => {
    event.stopPropagation();
    nudgeDial(1);
  });

  indexDial.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    if (Math.abs(event.deltaY) < 1 || now - dialState.lastWheelTime < 70) return;
    dialState.lastWheelTime = now;
    nudgeDial(event.deltaY >= 0 ? 1 : -1);
  }, { passive: false });

  indexDial.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dialState.dragging = true;
    dialState.pointerId = event.pointerId;
    dialState.pointerStartY = event.clientY;
    dialState.dragStartValue = dialState.value;
    indexDial.classList.add("is-dragging");
    indexDial.setPointerCapture?.(event.pointerId);
  });

  indexDial.addEventListener("pointermove", (event) => {
    if (!dialState.dragging || event.pointerId !== dialState.pointerId) return;
    event.preventDefault();
    const steps = Math.round((dialState.pointerStartY - event.clientY) / 24);
    const nextValue = mod(dialState.dragStartValue + steps, totalImages);
    if (nextValue === dialState.value) return;
    const direction = wrappedDistance(nextValue, dialState.value) >= 0 ? 1 : -1;
    selectDialValue(nextValue, direction);
  });

  const finishDialPointer = (event) => {
    if (!dialState.dragging || event.pointerId !== dialState.pointerId) return;
    dialState.dragging = false;
    dialState.pointerId = null;
    indexDial.classList.remove("is-dragging");
    indexDial.releasePointerCapture?.(event.pointerId);
  };

  indexDial.addEventListener("pointerup", finishDialPointer);
  indexDial.addEventListener("pointercancel", finishDialPointer);

  indexDial.addEventListener("keydown", (event) => {
    const keyDirections = {
      ArrowUp: -1,
      ArrowLeft: -1,
      ArrowDown: 1,
      ArrowRight: 1,
      PageUp: -10,
      PageDown: 10,
    };

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      const nextValue = event.key === "Home" ? 0 : totalImages - 1;
      selectDialValue(nextValue, nextValue >= dialState.value ? 1 : -1);
      return;
    }

    const direction = keyDirections[event.key];
    if (direction == null) return;
    event.preventDefault();
    event.stopPropagation();
    selectDialValue(dialState.value + direction, Math.sign(direction));
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

  indexDial.setAttribute("aria-valuemax", String(totalImages));
  dialTotal.textContent = `/ ${totalImages}`;
  renderDialValue(initialIndex, 1, true);
  setAmbient(initialIndex);
  render();
  requestAnimationFrame(animate);
})();
