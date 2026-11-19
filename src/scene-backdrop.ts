type ImageBounds = { left: number; top: number; width: number; height: number };

export function drawSceneBackdrop(
  image: HTMLImageElement,
  bounds: ImageBounds,
) {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene-backdrop")!;
  const context = canvas.getContext("2d")!;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const { left, top, width: imageWidth, height: imageHeight } = bounds;
  const right = left + imageWidth;
  const bottom = top + imageHeight;

  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true })!;
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(
    0,
    0,
    source.width,
    source.height,
  ).data;

  function sample(x: number, y: number, horizontal: boolean) {
    const channels: number[][] = [[], [], []];
    // Median sampling removes texture noise and thin objects touching the edge.
    for (let offset = -40; offset <= 40; offset++) {
      const px = Math.max(
        0,
        Math.min(source.width - 1, Math.round(x + (horizontal ? offset : 0))),
      );
      const py = Math.max(
        0,
        Math.min(source.height - 1, Math.round(y + (horizontal ? 0 : offset))),
      );
      const index = (py * source.width + px) * 4;
      channels.forEach((values, channel) =>
        values.push(pixels[index + channel]),
      );
    }
    const rgb = channels.map((values) => values.sort((a, b) => a - b)[40]);
    return rgb;
  }

  const positions = Array.from({ length: 21 }, (_, index) => index / 20);
  const upper = positions.map((t) => sample(t * (source.width - 1), 0, true));
  const lower = positions.map((t) =>
    sample(t * (source.width - 1), source.height - 1, true),
  );
  const leftSide = positions.map((t) =>
    sample(0, t * (source.height - 1), false),
  );
  const rightSide = positions.map((t) =>
    sample(source.width - 1, t * (source.height - 1), false),
  );
  const corners = [upper[0], upper[20], lower[0], lower[20]];
  leftSide[0] = corners[0];
  rightSide[0] = corners[1];
  leftSide[20] = corners[2];
  rightSide[20] = corners[3];

  function interpolate(colors: number[][], position: number, channel: number) {
    const index = Math.min(19, Math.floor(position * 20));
    const fraction = position * 20 - index;
    return (
      colors[index][channel] * (1 - fraction) +
      colors[index + 1][channel] * fraction
    );
  }

  const field = document.createElement("canvas");
  field.width = Math.ceil(width / 12);
  field.height = Math.ceil(height / 12);
  const fieldContext = field.getContext("2d")!;
  const fieldPixels = fieldContext.createImageData(field.width, field.height);
  // Blend all four sampled edges into one continuous field, including the corners.
  for (let y = 0; y < field.height; y++) {
    const v = Math.max(
      0,
      Math.min(1, ((y / (field.height - 1)) * height - top) / imageHeight),
    );
    for (let x = 0; x < field.width; x++) {
      const u = Math.max(
        0,
        Math.min(1, ((x / (field.width - 1)) * width - left) / imageWidth),
      );
      const index = (y * field.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const cornerBlend =
          (1 - u) * (1 - v) * corners[0][channel] +
          u * (1 - v) * corners[1][channel] +
          (1 - u) * v * corners[2][channel] +
          u * v * corners[3][channel];
        fieldPixels.data[index + channel] =
          (1 - v) * interpolate(upper, u, channel) +
          v * interpolate(lower, u, channel) +
          (1 - u) * interpolate(leftSide, v, channel) +
          u * interpolate(rightSide, v, channel) -
          cornerBlend;
      }
      fieldPixels.data[index + 3] = 255;
    }
  }
  fieldContext.putImageData(fieldPixels, 0, 0);
  context.drawImage(field, 0, 0, width, height);

  const gameCanvas = document.querySelector<HTMLCanvasElement>("#game canvas")!;
  const feather = Math.max(8, Math.min(32, imageWidth * 0.025));
  gameCanvas.style.maskImage = [
    `linear-gradient(to right, transparent ${left}px, black ${left + feather}px, black ${right - feather}px, transparent ${right}px)`,
    `linear-gradient(to bottom, transparent ${top}px, black ${top + feather}px, black ${bottom - feather}px, transparent ${bottom}px)`,
  ].join(",");
  gameCanvas.style.maskComposite = "intersect";
}
