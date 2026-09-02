// ============================================================================
// GitHoot Connected-Component Labeling (CCL) for Alpha Mask Analysis
// (src/server/services/image/connected-components.ts)
// ============================================================================

export interface ComponentRegion {
  id: number;
  area: number; // pixel count
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface CclResult {
  totalComponents: number;
  largeComponentsCount: number;
  components: ComponentRegion[];
  largestArea: number;
  secondLargestArea: number;
  dominanceRatio: number; // secondLargestArea / largestArea
}

/**
 * Performs 8-neighbour connected-component labeling on the alpha channel of an RGBA image.
 * Filters out tiny noise specs (area < minAreaRatio * totalPixels).
 */
export function analyzeConnectedComponents(
  rgbaData: Uint8Array,
  width: number,
  height: number,
  alphaThreshold = 24,
  minAreaRatio = 0.003
): CclResult {
  const totalPixels = width * height;
  const minAreaPixels = Math.max(1, Math.floor(totalPixels * minAreaRatio));
  const visited = new Uint8Array(totalPixels);
  const components: ComponentRegion[] = [];

  let nextId = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] === 1) continue;

      const alpha = rgbaData[idx * 4 + 3] ?? 0;
      if (alpha < alphaThreshold) {
        visited[idx] = 1;
        continue;
      }

      // BFS flood fill for this component
      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      const queueX: number[] = [x];
      const queueY: number[] = [y];
      visited[idx] = 1;

      while (queueX.length > 0) {
        const cx = queueX.pop()!;
        const cy = queueY.pop()!;
        area++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // 8-neighbour check
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (visited[nIdx] === 0) {
                const nAlpha = rgbaData[nIdx * 4 + 3] ?? 0;
                if (nAlpha >= alphaThreshold) {
                  visited[nIdx] = 1;
                  queueX.push(nx);
                  queueY.push(ny);
                } else {
                  visited[nIdx] = 1;
                }
              }
            }
          }
        }
      }

      if (area >= minAreaPixels) {
        components.push({
          id: nextId++,
          area,
          minX,
          minY,
          maxX,
          maxY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        });
      }
    }
  }

  // Sort components descending by area
  components.sort((a, b) => b.area - a.area);

  const largestArea = components[0]?.area || 0;
  const secondLargestArea = components[1]?.area || 0;
  const dominanceRatio = largestArea > 0 ? secondLargestArea / largestArea : 0;

  return {
    totalComponents: components.length,
    largeComponentsCount: components.length,
    components,
    largestArea,
    secondLargestArea,
    dominanceRatio
  };
}
