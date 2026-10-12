/**
 * High-performance scanline flood fill with morphological bleed / expand for HTML5 Canvas ImageData
 */

export function hexToRgba(hex: string, alpha = 1): [number, number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return [0, 0, 0, 255];
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const a = Math.round(alpha * 255);
  return [r, g, b, a];
}

export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  fillAlpha = 1.0,
  tolerance = 32,
  bleed = 2 // expand/bleed pixels under anti-aliased outlines (0 to 4)
): boolean {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  startX = Math.floor(startX);
  startY = Math.floor(startY);

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return false;
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const startIndex = (startY * width + startX) * 4;
  const targetR = data[startIndex];
  const targetG = data[startIndex + 1];
  const targetB = data[startIndex + 2];
  const targetA = data[startIndex + 3];

  const [fillR, fillG, fillB, fillA] = hexToRgba(fillColorHex, fillAlpha);

  // If already matches target color
  if (
    Math.abs(targetR - fillR) <= 2 &&
    Math.abs(targetG - fillG) <= 2 &&
    Math.abs(targetB - fillB) <= 2 &&
    Math.abs(targetA - fillA) <= 2
  ) {
    return false;
  }

  const tolSq = tolerance * tolerance * 4;

  function matchesTarget(x: number, y: number): boolean {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    const dr = r - targetR;
    const dg = g - targetG;
    const db = b - targetB;
    const da = a - targetA;
    return dr * dr + dg * dg + db * db + da * da <= tolSq;
  }

  function setPixel(x: number, y: number) {
    const idx = (y * width + x) * 4;
    data[idx] = fillR;
    data[idx + 1] = fillG;
    data[idx + 2] = fillB;
    data[idx + 3] = fillA;
  }

  // Scanline Flood Fill algorithm
  const visited = new Uint8Array(width * height);
  const stack: [number, number][] = [[startX, startY]];

  while (stack.length > 0) {
    const [curX, curY] = stack.pop()!;
    let lx = curX;

    while (lx >= 0 && matchesTarget(lx, curY) && !visited[curY * width + lx]) {
      lx--;
    }
    lx++;

    let rx = curX;
    while (rx < width && matchesTarget(rx, curY) && !visited[curY * width + rx]) {
      rx++;
    }
    rx--;

    let scanAbove = false;
    let scanBelow = false;

    for (let x = lx; x <= rx; x++) {
      const idx = curY * width + x;
      if (visited[idx]) continue;
      visited[idx] = 1;
      setPixel(x, curY);

      // Check row above
      if (curY > 0) {
        const aboveMatch = matchesTarget(x, curY - 1) && !visited[(curY - 1) * width + x];
        if (!scanAbove && aboveMatch) {
          stack.push([x, curY - 1]);
          scanAbove = true;
        } else if (scanAbove && !aboveMatch) {
          scanAbove = false;
        }
      }

      // Check row below
      if (curY < height - 1) {
        const belowMatch = matchesTarget(x, curY + 1) && !visited[(curY + 1) * width + x];
        if (!scanBelow && belowMatch) {
          stack.push([x, curY + 1]);
          scanBelow = true;
        } else if (scanBelow && !belowMatch) {
          scanBelow = false;
        }
      }
    }
  }

  // Morphological Bleed / Expand to eliminate boundary halo gaps
  if (bleed > 0) {
    const bleedRadius = Math.min(4, Math.max(1, bleed));
    // Find all perimeter pixels of the filled mask
    const perimeter: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visited[idx] === 1) {
          // Check 4-connectivity neighbors
          const isPerimeter =
            (x > 0 && visited[idx - 1] === 0) ||
            (x < width - 1 && visited[idx + 1] === 0) ||
            (y > 0 && visited[idx - width] === 0) ||
            (y < height - 1 && visited[idx + width] === 0);

          if (isPerimeter) {
            perimeter.push(x, y);
          }
        }
      }
    }

    // Expand perimeter outward by bleed radius
    const radSq = bleedRadius * bleedRadius;
    for (let p = 0; p < perimeter.length; p += 2) {
      const px = perimeter[p];
      const py = perimeter[p + 1];

      for (let dy = -bleedRadius; dy <= bleedRadius; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -bleedRadius; dx <= bleedRadius; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= width) continue;

          if (dx * dx + dy * dy <= radSq) {
            setPixel(nx, ny);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return true;
}
