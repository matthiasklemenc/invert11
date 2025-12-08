// globalMotion.js
// Runs BEFORE React. Captures all motion events reliably on Android & iOS.

window._latestMotion = {
  acc: null,
  rot: null,
  timestamp: 0
};

window.addEventListener(
  "devicemotion",
  (e) => {
    const acc = e.accelerationIncludingGravity;
    const rot = e.rotationRate;

    window._latestMotion = {
      acc: acc
        ? {
            x: acc.x ?? 0,
            y: acc.y ?? 0,
            z: acc.z ?? 0
          }
        : null,
      rot: rot
        ? {
            alpha: rot.alpha ?? 0,
            beta: rot.beta ?? 0,
            gamma: rot.gamma ?? 0
          }
        : null,
      timestamp: Date.now()
    };
  },
  { passive: true }
);
