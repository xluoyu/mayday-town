type Snowflake = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
  opacity: number;
};

export function startSnowfall(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d")!;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let flakes: Snowflake[] = [];
  let animation = 0;
  let previousTime = 0;
  let elapsed = 0;

  function draw() {
    context.clearRect(0, 0, width, height);
    for (const flake of flakes) {
      context.beginPath();
      context.fillStyle = `rgba(245, 251, 255, ${flake.opacity})`;
      context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const count = Math.max(
      55,
      Math.min(220, Math.round((width * height) / 8000)),
    );
    flakes = Array.from({ length: count }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.6 + depth * 2.5,
        speed: 14 + depth * 38,
        drift: 3 + depth * 9,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.22 + depth * 0.52,
      };
    });
    draw();
  }

  function tick(time: number) {
    const delta = previousTime
      ? Math.min((time - previousTime) / 1000, 0.05)
      : 0;
    previousTime = time;
    elapsed += delta;
    for (const flake of flakes) {
      flake.y += flake.speed * delta;
      flake.x +=
        (4 + Math.sin(elapsed * 0.5 + flake.phase) * flake.drift) * delta;
      if (flake.y > height + flake.radius) {
        flake.y = -flake.radius;
        flake.x = Math.random() * width;
      }
      if (flake.x > width + flake.radius) flake.x = -flake.radius;
      if (flake.x < -flake.radius) flake.x = width + flake.radius;
    }
    draw();
    animation = requestAnimationFrame(tick);
  }

  function updateAnimation() {
    cancelAnimationFrame(animation);
    previousTime = 0;
    if (!document.hidden && !reducedMotion.matches)
      animation = requestAnimationFrame(tick);
    else draw();
  }

  resize();
  updateAnimation();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", updateAnimation);
  reducedMotion.addEventListener("change", updateAnimation);
  return () => {
    cancelAnimationFrame(animation);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", updateAnimation);
    reducedMotion.removeEventListener("change", updateAnimation);
  };
}
