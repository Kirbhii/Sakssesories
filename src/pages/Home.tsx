import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { COLOURS, VARIANTS, peso } from '@/lib/data';
import type { ShapeId } from '@/lib/data';

// ─── Small inline icons ─────────────────────────────────────────────────────

const Icon = ({ d, className = 'h-3.5 w-3.5' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className={className}>
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowRight = ({ className = 'h-3 w-3' }: { className?: string }) => (
  <svg viewBox="0 0 12 12" fill="none" className={className}>
    <path
      d="M1 6h9M6.4 2.2 10.2 6l-3.8 3.8"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FAQS = [
  {
    q: 'What is ClearChain?',
    a: 'A leather keychain with a microfiber pad stitched into it. It hangs with your keys and cleans your glasses, phone, or screen whenever you need it.',
  },
  {
    q: 'What shapes and colours are there?',
    a: 'Two shapes — the heart and the teardrop — in six colours: navy blue, tan, pink, maroon, purple, and black.',
  },
  {
    q: 'Can I add engraving?',
    a: 'Yes. Two letters are free, each extra letter is ₱2, up to six letters.',
  },
  {
    q: 'How do I get my order?',
    a: 'Pickup from our studio or delivery within Metro Manila. We confirm the details with you before making your piece.',
  },
];

const GIFTS = [
  {
    icon: 'M4 6.5h12l-1 10.5H5L4 6.5ZM7.2 6.5V5a2.8 2.8 0 0 1 5.6 0v1.5',
    title: 'Everyday accessories',
    body: 'For the person who already carries everything — and would rather carry one thing that does more.',
  },
  {
    icon: 'M3.2 7.6h13.6v9.4H3.2V7.6ZM2.6 7.6h14.8M10 7.6v9.4',
    title: 'Little gifts, big thought',
    body: 'Add engraving with initials, wrapped and ready. Two letters are free, and every extra letter is ₱2.',
  },
  {
    icon: 'M10 2.8 17 6.2v7.6L10 17.2 3 13.8V6.2L10 2.8ZM3 6.2 10 9.6l7-3.4M10 9.6v7.6',
    title: 'Bulk & corporate orders',
    body: 'Wedding giveaways, team gifts, client tokens — tell us the quantity and we will make it work.',
  },
];

const FEATURES = [
  {
    icon: 'M8 2.6 13.4 5.5 8 8.4 2.6 5.5 8 2.6ZM2.6 8.9 8 11.8 13.4 8.9M2.6 11.6 8 14.5 13.4 11.6',
    title: 'Removable microfiber pad',
    body: 'Swap it, wash it, keep it working.',
  },
  {
    icon: 'M2.6 13.4 9.6 6.4M9.1 5.9a1.9 1.9 0 1 0 2.7 2.7 1.9 1.9 0 0 0-2.7-2.7Z',
    title: 'Hand-stitched leather',
    body: 'Cut and stitched by hand in small batches.',
  },
  {
    icon: 'M8 14.2s4.2-4.1 4.2-6.9a4.2 4.2 0 1 0-8.4 0c0 2.8 4.2 6.9 4.2 6.9ZM8 5.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z',
    title: 'Made in the Philippines',
    body: 'Designed, made, and finished locally.',
  },
];

// Copy for the collection cards. The photo is not here any more — it is chosen
// by the colour the visitor taps, from /img/product-<shape>-<colour>.webp.
const CARD_META: Record<ShapeId, { alt: string; line: string }> = {
  heart: {
    alt: 'heart ClearChain, microfiber side facing out',
    line: 'A playful detail with a little extra love.',
  },
  teardrop: {
    alt: 'teardrop ClearChain, microfiber side facing out',
    line: 'A simple silhouette for your everyday carry.',
  },
};

const STEPS = [
  {
    n: '01',
    title: 'Clip it on',
    body: 'Hook it to your keys, your bag, or your lanyard. It rides along without asking for space.',
  },
  {
    n: '02',
    title: 'Wipe it clean',
    body: 'The microfiber pad clears fingerprints, smudges, and dust in one pass — no cloth to hunt for.',
  },
  {
    n: '03',
    title: 'Carry on',
    body: 'Back to your day. Clearer lenses, a tidier kit, one less thing to think about.',
  },
];

const DAYS = [
  {
    img: '/img/everyday-bag.jpg',
    alt: 'The heart keychain clipped to a black leather bag beside a set of keys',
    title: 'A little love on your bag.',
    body: 'Clipped where you can reach it',
    focus: '50% 50%',
  },
  {
    img: '/img/everyday-leather.jpg',
    alt: 'Close-up of the red leather heart keychain resting on blush satin',
    title: 'Real leather, cut by hand.',
    body: 'It softens and darkens with use',
    focus: '50% 46%',
  },
  {
    img: '/img/everyday-carry.jpg',
    alt: 'Flat lay of a phone, earphones, keys, a pen, a wallet and the heart keychain',
    title: 'Phone, keys, wallet — and this.',
    body: 'One small thing that does more',
    focus: '50% 38%',
  },
];

// ─── Hero slider ────────────────────────────────────────────────────────────
// Lifestyle shots of the keychain on real people, not on a white table. The
// photo fills the whole hero, words included, so `focus` matters: the hero is
// much wider than it is tall, and object-cover takes a horizontal band out of
// each photo. These values keep the person's face and the bag in that band.
// Each photo ships twice: a 960px file for phones and the full-width one for
// a desktop. Without that split a phone would pull a megabyte of hero before
// it drew anything, and a desktop would be stuck with a soft, upscaled image.
const SLIDES = [
  {
    src: '/img/hero-1-wide.webp',
    small: '/img/hero-1-960.webp',
    wide: 1920,
    alt: 'A man carrying a brown shoulder bag with the tan teardrop keychain clipped to the strap',
    label: 'The teardrop chain',
    caption: 'Clean, carry, close.',
    focus: '50% 10%',
  },
  {
    src: '/img/hero-2-wide.webp',
    small: '/img/hero-2-960.webp',
    wide: 1920,
    alt: 'A woman on an escalator with a black shoulder bag and the red heart keychain',
    label: 'The heart chain',
    caption: 'Every day, on her bag.',
    focus: '46% 10%',
  },
  {
    src: '/img/hero-3-wide.webp',
    small: '/img/hero-3-960.webp',
    wide: 1632,
    alt: 'A woman in a pink shirt carrying a white shoulder bag with the red heart keychain',
    label: 'The heart chain',
    caption: 'Colour on the way out.',
    focus: '48% 10%',
  },
  {
    src: '/img/hero-4-wide.webp',
    small: '/img/hero-4-960.webp',
    wide: 1920,
    alt: 'A woman in a brown top with the black heart keychain clipped at her waist',
    label: 'The black heart',
    caption: 'Not just for keys.',
    focus: '48% 10%',
  },
];

export default function Home() {
  const [open, setOpen] = useState(0);

  // Which colour each collection card is showing. It starts on the colour that
  // card is actually photographed in, so the page opens on the real photo and
  // nothing moves until someone taps a swatch.
  const [picked, setPicked] = useState<Record<ShapeId, string>>({
    heart: 'maroon',
    teardrop: 'black',
  });

  // ── Hero slider ─────────────────────────────────────────────────────────
  // Four lifestyle photos cross-fading behind the caption card. It advances on
  // its own, stops while the pointer or keyboard focus is on it, and stays put
  // entirely for anyone who has asked their system to reduce motion.
  const [hero, setHero] = useState(0);
  const [hold, setHold] = useState(false);

  // Only the first photo holds up the first paint. The other three are added a
  // beat later — they are opaque and stacked anyway, so nothing on screen
  // changes when they arrive, and the slider never runs out of runway.
  const [rest, setRest] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setRest(true), 700);
    return () => window.clearTimeout(t);
  }, []);

  // ── Scroll-in reveals ───────────────────────────────────────────────────
  // Every section marked `data-reveal` fades up the first time it reaches the
  // screen, then is left alone — scrolling back up should not replay it. If the
  // visitor has asked for reduced motion, or the browser is too old to know what
  // an IntersectionObserver is, everything is simply shown: content must never
  // be left sitting at opacity 0 waiting for a script that will not run.
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!nodes.length) return;

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.classList.add('is-in'));
      return;
    }

    const show = (n: HTMLElement) => {
      n.classList.add('is-in');
      io.unobserve(n);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) show(entry.target as HTMLElement);
        });
      },
      // Fire as soon as the top edge crosses into the lower nine-tenths of the
      // window, so the movement finishes while the block is being read rather
      // than starting once it is already halfway up the screen.
      { rootMargin: '0px 0px -10% 0px', threshold: 0 },
    );

    // A jump — the End key, a hash link, a restored scroll position — can put a
    // block above the window without it ever intersecting. Nothing should be
    // left invisible because it was skipped over, so anything already at or
    // above the fold is shown on the spot.
    const sweep = () => {
      const fold = window.innerHeight * 0.9;
      nodes.forEach((n) => {
        if (!n.classList.contains('is-in') && n.getBoundingClientRect().top < fold) show(n);
      });
    };

    nodes.forEach((n) => io.observe(n));
    sweep();
    window.addEventListener('scroll', sweep, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', sweep);
    };
  }, []);

  useEffect(() => {
    if (hold) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setHero((i) => (i + 1) % SLIDES.length), 5600);
    return () => window.clearInterval(timer);
  }, [hold]);

  const nextHero = () => setHero((i) => (i + 1) % SLIDES.length);

  // ── The everyday edit rail ──────────────────────────────────────────────
  // Three photos side by side on a desktop; one at a time on a phone. No arrow
  // buttons: on a wide screen all three already fit, and on a narrow one the
  // photos are swiped. The thin bar underneath is what says "there is more",
  // and it moves with the swipe.
  const railRef = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState(0);

  const stepOf = (el: HTMLDivElement) => {
    const card = el.firstElementChild as HTMLElement | null;
    return card ? card.offsetWidth + 22 : el.clientWidth;
  };

  function trackScroll() {
    const el = railRef.current;
    if (!el) return;
    setShot(Math.min(DAYS.length - 1, Math.max(0, Math.round(el.scrollLeft / stepOf(el)))));
  }

  const heart = VARIANTS.find((v) => v.key === 'heart-maroon')!;
  const drop = VARIANTS.find((v) => v.key === 'teardrop-black')!;

  return (
    <div className="bg-white">
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-[760px] flex-col overflow-hidden bg-blush-100 max-lg:min-h-0"
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
      >
        {(rest || hero > 0 ? SLIDES : SLIDES.slice(0, 1)).map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            srcSet={`${s.small} 960w, ${s.src} ${s.wide}w`}
            sizes="100vw"
            alt={i === hero ? s.alt : ''}
            aria-hidden={i !== hero}
            draggable={false}
            style={{ objectPosition: s.focus }}
            className={[
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-[1100ms] ease-out',
              i === hero ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          />
        ))}

        {/* The words sit straight on the photo, so the photo has to step back
            behind them — nearly opaque on the left where the copy is, clearing
            to nothing on the right where the person is. On a phone the copy
            runs full width, so the veil turns and works from the bottom up. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(249,239,241,0.95)_0%,rgba(249,239,241,0.90)_26%,rgba(249,239,241,0.62)_42%,rgba(249,239,241,0.22)_60%,rgba(249,239,241,0.04)_78%,rgba(249,239,241,0)_92%)] max-lg:bg-[linear-gradient(to_bottom,rgba(249,239,241,0.88)_0%,rgba(249,239,241,0.82)_36%,rgba(249,239,241,0.66)_64%,rgba(249,239,241,0.46)_100%)]"
        />

        {/* On a phone the caption and pager land on the busiest part of the
            photo, so they get a soft wash that fades into the image. It has no
            edge, which is the whole point — a card was what we just removed. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[168px] bg-[linear-gradient(to_top,rgba(249,239,241,0.95)_0%,rgba(249,239,241,0.80)_40%,rgba(249,239,241,0.34)_74%,rgba(249,239,241,0)_100%)] lg:hidden"
        />

        <div className="relative z-10 flex flex-1 flex-col justify-center py-16 pr-14 pl-[max(2rem,calc((100vw-1240px)/2+2rem))] max-lg:px-8 max-md:px-5">
          <p className="eyebrow hero-in [--reveal-delay:80ms]">
            <span className="h-[5px] w-[5px] rounded-full bg-current" />
            Handmade in the Philippines
          </p>
          <h1 className="hero-in max-w-[14ch] text-[clamp(40px,4.4vw,58px)] leading-[1.06] text-wine-700 [--reveal-delay:180ms]">
            A little style.
            <br />A clearer day.
          </h1>
          <p className="hero-in mt-6 max-w-[38ch] text-[14.5px] leading-[1.75] text-ink-900/85 [--reveal-delay:300ms]">
            Meet ClearChain — a leather keychain with a microfiber pad, so your glasses and screens
            stay clean all day.
          </p>

          <div className="hero-in mt-7 [--reveal-delay:400ms]">
            <Link
              to="/pos"
              className="inline-flex items-center gap-2.5 rounded-pill bg-crimson-600 px-[22px] py-3 text-[12px] font-medium text-white transition-colors hover:bg-wine-800"
            >
              Shop the Collection <ArrowRight />
            </Link>
          </div>

          {/* Photo label, caption and pager — straight on the image, no card.
              They sit in the same column as the words above rather than pinned
              to the bottom corner, so the whole hero reads down one axis
              instead of leaving a lonely control floating in the dead space.
              The active slide is a maroon bar rather than a dot, so the eye
              reads "one of four" without a counter doing the talking. */}
          <div className="hero-in mt-11 w-full max-w-[440px] [--reveal-delay:520ms]">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-crimson-600">
              {SLIDES[hero].label}
            </p>
            <p className="mt-2.5 max-w-[26ch] font-serif text-[24px] leading-[1.2] text-wine-700 max-md:text-[21px]">
              {SLIDES[hero].caption}
            </p>

            <div className="mt-5 flex items-center gap-5">
              {/* Pulled left by the dots' own padding, so the bar starts on the
                  same edge as the label and the caption above it. */}
              <div className="-ml-[4px] flex items-center">
                {SLIDES.map((s, i) => (
                  <button
                    key={s.src}
                    onClick={() => setHero(i)}
                    aria-label={`Photo ${i + 1} of ${SLIDES.length}`}
                    aria-current={i === hero}
                    className="group grid h-7 place-items-center px-[4px]"
                  >
                    <span
                      className={[
                        'block rounded-full transition-all duration-300',
                        i === hero
                          ? 'h-[4px] w-10 bg-crimson-600'
                          : 'h-[5px] w-[5px] bg-wine-800/40 group-hover:bg-wine-800/70',
                      ].join(' ')}
                    />
                  </button>
                ))}
              </div>

              <button
                onClick={nextHero}
                aria-label="Next photo"
                className="grid h-9 w-9 flex-none place-items-center rounded-full border border-wine-800/25 text-wine-800 transition-colors hover:border-wine-800 hover:bg-wine-800 hover:text-white"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                  <path
                    d="M4.2 2.4 7.8 6l-3.6 3.6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden bg-wine-800 py-[13px]" aria-hidden="true">
        <div className="marquee-track">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="whitespace-nowrap px-[26px] text-[9.5px] uppercase tracking-[0.26em] text-white/85"
            >
              Sakses anytime, Style anytime
              <span className="ml-[26px] opacity-45">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Why ──────────────────────────────────────────────────────────── */}
      <section id="story" className="py-[82px] max-md:py-14">
        <div data-reveal className="reveal mx-auto grid w-full max-w-[1240px] grid-cols-[40fr_60fr] items-start gap-14 px-8 max-lg:grid-cols-1 max-lg:gap-7">
          <div>
            <p className="eyebrow">
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              Why Saksesories PH
            </p>
            <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
              Thoughtful details for your everyday.
            </h2>
          </div>
          <div className="space-y-3.5">
            <p className="text-[14.5px] leading-[1.75] text-ink-500">
              We keep the details small on purpose. A keychain is the one thing you already carry
              everywhere — so we made it useful: a soft microfiber pad stitched into real leather,
              ready to wipe your lenses clean whenever the world gets smudged.
            </p>
            <p className="text-[14.5px] leading-[1.75] text-ink-500">
              Every piece is cut, stitched, and finished by hand in small batches. No two are
              perfectly identical, and that is exactly the point.
            </p>
            <p className="pt-1 font-serif text-[17px] italic text-wine-700">
              Sakses anytime, Style anytime.
            </p>
          </div>
        </div>
      </section>

      {/* ── More than a keychain ─────────────────────────────────────────── */}
      <section className="bg-blush-100 py-[82px] max-md:py-14">
        <div data-reveal className="reveal mx-auto grid w-full max-w-[1240px] grid-cols-[46fr_54fr] items-center gap-14 px-8 max-lg:grid-cols-1 max-lg:gap-9">
          <div className="group overflow-hidden rounded-[14px] bg-blush-200">
            <img
              src="/img/meet-clearchain.webp"
              alt="A brown leather bag with keys and the black heart ClearChain clipped to the zip"
              width={1100}
              height={1375}
              className="aspect-[4/5] w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]"
            />
          </div>

          <div>
            <p className="eyebrow">
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              Meet ClearChain
            </p>
            <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
              More than a keychain.
              <br />A handy little habit.
            </h2>
            <p className="mt-5 max-w-[46ch] text-[14.5px] leading-[1.75] text-ink-500">
              A compact accessory that keeps a microfiber cleaning surface at hand — for your
              glasses, your phone, and every other screen you touch all day.
            </p>

            <div className="mt-7 grid gap-[22px]">
              {FEATURES.map((f) => (
                <div key={f.title} className="grid grid-cols-[26px_1fr] gap-3.5">
                  <Icon d={f.icon} className="mt-1 h-4 w-4 text-crimson-600" />
                  <div>
                    <h3 className="text-[12.5px] font-medium">{f.title}</h3>
                    <p className="mt-1 text-[12px] leading-[1.6] text-ink-500">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Steps ────────────────────────────────────────────────────────── */}
      <section className="py-[82px] max-md:py-14">
        <div data-reveal className="reveal mx-auto grid w-full max-w-[1240px] grid-cols-[32fr_68fr] items-start gap-10 px-8 max-lg:grid-cols-1">
          <div>
            <p className="eyebrow">
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              How it works
            </p>
            <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
              Clip. Wipe.
              <br />
              Carry on.
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-10 max-lg:grid-cols-1 max-lg:gap-7">
            {STEPS.map((s) => (
              <div key={s.n}>
                <p className="num font-serif text-[12px] tracking-[0.1em] text-crimson-600">{s.n}</p>
                <h3 className="mt-3 text-[13px] font-medium">{s.title}</h3>
                <p className="mt-2 text-[12px] leading-[1.65] text-ink-500">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Collection ───────────────────────────────────────────────────── */}
      <section id="collection" className="bg-blush-100 py-[82px] max-md:py-14">
        <div data-reveal className="reveal mx-auto w-full max-w-[1240px] px-8">
          <div className="mb-[34px] flex items-end justify-between gap-8 max-md:flex-col max-md:items-start max-md:gap-3.5">
            <div>
              <p className="eyebrow">
                <span className="h-[5px] w-[5px] rounded-full bg-current" />
                Choose your little detail
              </p>
              <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
                Two shapes. Your kind of style.
              </h2>
            </div>
            <p className="max-w-[32ch] text-right text-[10.5px] uppercase leading-[1.6] tracking-[0.12em] text-ink-300 max-md:text-left">
              Concept collection · Prices in Philippine pesos
            </p>
          </div>

          <div className="grid grid-cols-2 gap-[26px] max-md:grid-cols-1">
            {[heart, drop].map((v) => {
              const meta = CARD_META[v.shape];
              const colour = picked[v.shape];
              const swatch = COLOURS.find((c) => c.id === colour)!;
              return (
                <article
                  key={v.key}
                  className="group overflow-hidden rounded bg-white transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(74,17,26,0.4)]"
                >
                  {/* Keyed on the colour so the photo is remounted, not just
                      re-sourced: that is what replays the fade underneath. */}
                  <img
                    key={colour}
                    src={`/img/product-${v.shape}-${colour}.webp`}
                    alt={`The ${swatch.name.toLowerCase()} ${meta.alt}`}
                    width={1600}
                    height={1000}
                    className="swap-in aspect-[16/10] w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.035]"
                  />

                  <div className="px-5 pb-5 pt-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="font-serif text-[15px] text-ink-900">
                        ClearChain <em className="italic">/ The {v.shapeName}</em>
                      </p>
                      <span className="num whitespace-nowrap text-[13.5px] font-medium text-wine-800">
                        {peso(v.price)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[11.5px] leading-[1.6] text-ink-500">{meta.line}</p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                      <div className="flex items-center gap-2.5">
                        {/* Real buttons, not dots: tapping one is the whole
                            point, so it needs a target big enough to hit and a
                            name a screen reader can read out. */}
                        <div className="flex items-center">
                          {COLOURS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setPicked((p) => ({ ...p, [v.shape]: c.id }))}
                              aria-label={`Show the ${v.shapeName} in ${c.name}`}
                              aria-pressed={c.id === colour}
                              title={c.name}
                              className="grid h-[22px] w-[22px] place-items-center rounded-full transition-transform hover:scale-110"
                            >
                              <span
                                className={[
                                  'h-[11px] w-[11px] rounded-full border border-black/10',
                                  c.id === colour
                                    ? 'outline outline-1 outline-offset-2 outline-wine-800'
                                    : '',
                                ].join(' ')}
                                style={{ background: c.hex }}
                              />
                            </button>
                          ))}
                        </div>
                        <span className="whitespace-nowrap text-[9px] uppercase tracking-[0.14em] text-ink-300 max-md:text-[8px] max-md:tracking-[0.07em]">
                          {swatch.name} · Leather · Microfiber
                        </span>
                      </div>

                      <Link
                        to="/pos"
                        className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-wine-800/25 px-3.5 py-2 text-[10.5px] font-medium text-wine-800 transition-colors hover:border-wine-800 hover:bg-wine-800 hover:text-white"
                      >
                        Make it yours
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                          <path
                            d="M3.4 8.6 8.6 3.4M4.9 3.4h3.7v3.7"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Goes where your day goes ─────────────────────────────────────── */}
      <section className="bg-blush-50 py-[82px] max-md:py-14">
        <div data-reveal className="reveal mx-auto w-full max-w-[1240px] px-8">
          <div className="mb-[30px] flex flex-wrap items-end justify-between gap-8 max-md:gap-4">
            <div className="max-md:w-full">
              <p className="eyebrow">
                <span className="h-[5px] w-[5px] rounded-full bg-current" />
                The everyday edit
              </p>
              <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
                Goes where your day goes.
              </h2>
            </div>
          </div>

          <div
            ref={railRef}
            onScroll={trackScroll}
            className="no-scrollbar flex snap-x snap-mandatory gap-[22px] overflow-x-auto"
          >
            {DAYS.map((d) => (
              <article
                key={d.title}
                className="group w-full flex-none snap-start md:w-[calc((100%-22px)/2)] lg:w-[calc((100%-44px)/3)]"
              >
                <div className="aspect-square overflow-hidden bg-blush-200">
                  <img
                    src={d.img}
                    alt={d.alt}
                    loading="lazy"
                    style={{ objectPosition: d.focus }}
                    className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <h3 className="mt-3.5 font-serif text-[14px] leading-[1.3] text-ink-900">{d.title}</h3>
                <p className="mt-1.5 text-[8.5px] uppercase tracking-[0.16em] text-ink-300">{d.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-blush-300 pt-3.5">
            <div className="flex items-center gap-1.5">
              {DAYS.map((d, i) => (
                <span
                  key={d.title}
                  className={[
                    'h-[2px] rounded-full transition-all',
                    i === shot ? 'w-6 bg-crimson-600' : 'w-3 bg-blush-300',
                  ].join(' ')}
                />
              ))}
            </div>
            <p className="num text-[8.5px] uppercase tracking-[0.18em] text-ink-300">
              {String(shot + 1).padStart(2, '0')} / {String(DAYS.length).padStart(2, '0')} — The
              everyday edit
            </p>
          </div>
        </div>
      </section>

      {/* ── Gifts ────────────────────────────────────────────────────────── */}
      <section className="bg-blush-100 py-[82px] max-md:py-14">
        <div data-reveal className="reveal mx-auto w-full max-w-[1240px] px-8">
          <p className="eyebrow">
            <span className="h-[5px] w-[5px] rounded-full bg-current" />
            The little things
          </p>
          <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
            From your daily carry to a thoughtful gift.
          </h2>

          <div className="mt-[34px] grid grid-cols-3 gap-5 max-md:grid-cols-1">
            {GIFTS.map((g) => (
              <article
                key={g.title}
                className="rounded border border-blush-300 bg-white px-6 pb-[22px] pt-[26px] transition-colors hover:border-blush-200"
              >
                <Icon d={g.icon} className="h-[17px] w-[17px] text-crimson-600" />
                <h3 className="mt-4 font-serif text-[15px]">{g.title}</h3>
                <p className="mt-2 text-[11.5px] leading-[1.7] text-ink-500">{g.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-[82px] max-md:py-14">
        <div data-reveal className="reveal mx-auto grid w-full max-w-[1240px] grid-cols-[40fr_60fr] items-start gap-14 px-8 max-lg:grid-cols-1 max-lg:gap-7">
          <div>
            <p className="eyebrow">
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              FAQ
            </p>
            <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
              A few little
              <br />
              answers.
            </h2>
            <p className="mt-[18px] text-[12px] text-ink-500">
              Anything else? Message us and we will reply personally.
            </p>
          </div>

          <div className="border-t border-blush-300">
            {FAQS.map((item, i) => (
              <div key={item.q} className="border-b border-blush-300">
                <button
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="flex w-full items-center justify-between gap-5 py-[19px] text-left text-[12.5px] font-medium text-ink-900"
                >
                  {item.q}
                  <span className={open === i ? 'text-[15px] text-crimson-600' : 'text-[15px] text-ink-500'}>
                    {open === i ? '−' : '+'}
                  </span>
                </button>
                {open === i && (
                  <p className="pb-5 pr-10 text-[12px] leading-[1.75] text-ink-500">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-wine-800 py-[62px] text-center">
        <div data-reveal className="reveal mx-auto w-full max-w-[1240px] px-8">
          <h2 className="font-serif text-[clamp(26px,3vw,38px)] italic text-white">
            Sakses anytime, Style everyday
          </h2>
          <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-white/60">
            only here at Saksesories PH
          </p>
          <Link
            to="/pos"
            className="mt-6 inline-flex items-center gap-2.5 rounded-pill bg-white px-[22px] py-3 text-[12px] font-medium text-wine-800 transition-colors hover:bg-blush-100"
          >
            Shop the Collection <ArrowRight />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
