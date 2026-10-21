import type { ShapeId } from '@/lib/data';

interface ChainProps {
  shape: ShapeId;
  colour: string;
  className?: string;
}

const PATHS: Record<ShapeId, { body: string; stitch: string }> = {
  heart: {
    body: 'M50 97C24 77 10 59 10 43c0-16 12-26 25-26 8 0 13 4 15 9 2-5 7-9 15-9 13 0 25 10 25 26 0 16-14 34-40 54Z',
    stitch:
      'M50 91C27.5 73 15.5 57 15.5 43c0-13.5 9.5-21.5 19.5-21.5 7 0 11.5 4 15 8.5 3.5-4.5 8-8.5 15-8.5 10 0 19.5 8 19.5 21.5 0 14-12 30-34.5 48Z',
  },
  teardrop: {
    body: 'M50 99C22 75 12 57 12 41c0-15 17-26 38-26s38 11 38 26c0 16-10 34-38 58Z',
    stitch:
      'M50 93C26 71 17 55 17 41c0-12 15-21.5 33-21.5S83 29 83 41c0 14-9 30-33 52Z',
  },
};

/**
 * A ClearChain piece — gold ring, leather body, dashed stitch line.
 * Drawn rather than photographed so it recolours with the variant.
 */
export default function Chain({ shape, colour, className }: ChainProps) {
  const { body, stitch } = PATHS[shape];

  return (
    <svg viewBox="0 0 100 112" className={className} role="img" aria-label={`${shape} ClearChain`}>
      <circle cx="50" cy="13" r="8.5" fill="none" stroke="#c6a15b" strokeWidth="3.2" />
      <rect x="47.6" y="19" width="4.8" height="8" rx="1.5" fill="#c6a15b" />
      <path d={body} fill={colour} stroke="rgba(0,0,0,.14)" strokeWidth="1.2" />
      <path
        d={stitch}
        fill="none"
        stroke="rgba(255,255,255,.38)"
        strokeWidth="1.1"
        strokeDasharray="3 3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
