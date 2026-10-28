// ─── Mock QR ────────────────────────────────────────────────────────────────
// A QR-looking block for the GCash step, drawn from a fixed seed so it is
// identical on every render and needs no library. It is NOT scannable and pays
// nobody — the label under it says so. Swap this for the real payment
// provider's QR when the shop has one.

const MODULES = 21; // version 1 QR is 21×21
const FINDER = 7; // 7×7 finder squares, one per corner except bottom-right
const QUIET = 2; // white margin a real scanner needs to find the edges
const TOTAL = MODULES + QUIET * 2;

/** Deterministic 0–1 stream. Same seed, same pattern, every time. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** True where a finder square (or its quiet ring) lives. */
function inFinder(x: number, y: number): boolean {
  const near = (ox: number, oy: number) =>
    x >= ox && x < ox + FINDER && y >= oy && y < oy + FINDER;
  return near(0, 0) || near(MODULES - FINDER, 0) || near(0, MODULES - FINDER);
}

function build(): boolean[][] {
  const rnd = seeded(20261028);
  const grid: boolean[][] = [];
  for (let y = 0; y < MODULES; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < MODULES; x += 1) {
      row.push(inFinder(x, y) ? false : rnd() > 0.52);
    }
    grid.push(row);
  }
  return grid;
}

const GRID = build();

/** One finder square: 7×7 ring, 5×5 gap, 3×3 core. */
function Finder({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </>
  );
}

export default function MockQr({
  size = 104,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  // Snap to a whole number of pixels per module, or the blocks go soft.
  const px = Math.max(TOTAL, Math.round(size / TOTAL) * TOTAL);

  return (
    <svg
      viewBox={`${-QUIET} ${-QUIET} ${TOTAL} ${TOTAL}`}
      width={px}
      height={px}
      role="img"
      aria-label="Sample GCash QR code"
      className={['flex-none rounded-[3px] bg-white text-ink-900', className].join(' ')}
      shapeRendering="crispEdges"
    >
      {GRID.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null,
        ),
      )}
      <Finder x={0} y={0} />
      <Finder x={MODULES - FINDER} y={0} />
      <Finder x={0} y={MODULES - FINDER} />
    </svg>
  );
}
