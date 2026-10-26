import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import Chain from '@/components/Chain';
import { COLOURS, VARIANTS, peso } from '@/lib/data';

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
    link: 'Shop the collection',
  },
  {
    icon: 'M3.2 7.6h13.6v9.4H3.2V7.6ZM2.6 7.6h14.8M10 7.6v9.4',
    title: 'Little gifts, big thought',
    body: 'Add engraving with initials, wrapped and ready. Two letters are free, and every extra letter is ₱2.',
    link: 'Add engraving',
  },
  {
    icon: 'M10 2.8 17 6.2v7.6L10 17.2 3 13.8V6.2L10 2.8ZM3 6.2 10 9.6l7-3.4M10 9.6v7.6',
    title: 'Bulk & corporate orders',
    body: 'Wedding giveaways, team gifts, client tokens — tell us the quantity and we will make it work.',
    link: 'Request a quote',
  },
];

const FEATURES = [
  {
    icon: 'M3.2 3.2h13.6v13.6H3.2V3.2Z',
    title: 'Removable microfiber pad',
    body: 'Swap it, wash it, keep it working — the cleaning pad lifts smudges without scratching your lenses.',
  },
  {
    icon: 'M3 14.5 14.5 3',
    title: 'Hand-stitched leather',
    body: 'Real leather, cut and stitched by hand in small batches. It softens and darkens beautifully with use.',
  },
  {
    icon: 'M5 17V3.5M5 4.2c2.6-1.5 4.6 1.2 7 .2 1.2-.5 2-.4 3 0v6.2c-1-.4-1.8-.5-3 0-2.4 1-4.4-1.7-7-.2',
    title: 'Made in the Philippines',
    body: 'Designed, made, and finished locally — from a small studio to your pocket.',
  },
];

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
    src: '/img/hero-1.webp',
    small: '/img/hero-1-960.webp',
    wide: 1920,
    alt: 'A man carrying a brown shoulder bag with the tan teardrop keychain clipped to the strap',
    label: 'The teardrop chain',
    caption: 'Clean, carry, keep close.',
    focus: '50% 10%',
  },
  {
    src: '/img/hero-2.webp',
    small: '/img/hero-2-960.webp',
    wide: 1920,
    alt: 'A woman on an escalator with a black shoulder bag and the red heart keychain',
    label: 'The heart chain',
    caption: 'On the bag she carries every day.',
    focus: '46% 10%',
  },
  {
    src: '/img/hero-3.webp',
    small: '/img/hero-3-960.webp',
    wide: 1651,
    alt: 'A woman in a pink shirt carrying a white shoulder bag with the red heart keychain',
    label: 'The heart chain',
    caption: 'A little colour on the way out.',
    focus: '48% 10%',
  },
  {
    src: '/img/hero-4.webp',
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

  // ── Hero slider ─────────────────────────────────────────────────────────
  // Four lifestyle photos cross-fading behind the caption card. It advances on
  // its own, stops while the pointer or keyboard focus is on it, and stays put
  // entirely for anyone who has asked their system to reduce motion.
  const [hero, setHero] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (hold) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setHero((i) => (i + 1) % SLIDES.length), 5600);
    return () => window.clearInterval(timer);
  }, [hold]);

  const nextHero = () => setHero((i) => (i + 1) % SLIDES.length);

  // ── The everyday edit rail ──────────────────────────────────────────────
  // Three photos side by side on a desktop; one at a time on a phone. The
  // arrows scroll the rail, and they switch off when everything already fits
  // — a disabled control is honest, a button that does nothing is not.
  const railRef = useRef<HTMLDivElement>(null);
  const [shot, setShot] = useState(0);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const measure = () => setCanScroll(el.scrollWidth > el.clientWidth + 4);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stepOf = (el: HTMLDivElement) => {
    const card = el.firstElementChild as HTMLElement | null;
    return card ? card.offsetWidth + 22 : el.clientWidth;
  };

  function page(dir: number) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * stepOf(el), behavior: 'smooth' });
  }

  function trackScroll() {
    const el = railRef.current;
    if (!el) return;
    setShot(Math.min(DAYS.length - 1, Math.max(0, Math.round(el.scrollLeft / stepOf(el)))));
  }

  const heart = VARIANTS.find((v) => v.key === 'heart-maroon')!;
  const drop = VARIANTS.find((v) => v.key === 'teardrop-tan')!;

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
        {SLIDES.map((s, i) => (
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
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(249,239,241,0.93)_0%,rgba(249,239,241,0.87)_28%,rgba(249,239,241,0.62)_44%,rgba(249,239,241,0.22)_62%,rgba(249,239,241,0.04)_78%,rgba(249,239,241,0)_92%)] max-lg:bg-[linear-gradient(to_bottom,rgba(249,239,241,0.86)_0%,rgba(249,239,241,0.78)_38%,rgba(249,239,241,0.58)_66%,rgba(249,239,241,0.34)_88%,rgba(249,239,241,0.26)_100%)]"
        />

        <div className="relative z-10 flex flex-1 flex-col justify-center py-16 pr-14 pl-[max(2rem,calc((100vw-1240px)/2+2rem))] max-lg:px-8 max-md:px-5">
          <p className="eyebrow">
            <span className="h-[5px] w-[5px] rounded-full bg-current" />
            Handmade in the Philippines
          </p>
          <h1 className="max-w-[12ch] text-[clamp(38px,4.1vw,54px)] leading-[1.08]">
            A little style.
            <br />A clearer day.
          </h1>
          <p className="mt-5 max-w-[40ch] text-[13.5px] leading-[1.75] text-ink-700">
            Meet ClearChain — a leather keychain with a microfiber pad, made to keep your glasses,
            screens, and everyday lenses clean, clear, and close at hand.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link
              to="/pos"
              className="inline-flex items-center gap-2.5 rounded-pill bg-crimson-600 px-[22px] py-3 text-[12px] font-medium text-white transition-colors hover:bg-wine-800"
            >
              Shop the Collection <ArrowRight />
            </Link>
            <a
              href="#story"
              className="inline-flex items-center rounded-pill border border-blush-300 px-[22px] py-3 text-[12px] font-medium text-ink-900 transition-colors hover:border-wine-800 hover:text-wine-800"
            >
              Our Story
            </a>
          </div>

          <div className="mt-9 flex gap-[26px]">
            {['Find your shape', 'See the colours'].map((label) => (
              <a
                key={label}
                href="#collection"
                className="inline-flex items-center gap-2 border-b border-transparent pb-0.5 text-[11px] text-ink-700 transition-colors hover:border-crimson-600 hover:text-crimson-600"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-crimson-600/60" />
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Caption card: part of the flow on a phone, pinned bottom-right on a
            desktop where there is room for it to float over the photo. */}
        <div className="relative z-10 mx-7 mb-7 flex items-center justify-between gap-4 rounded bg-white/95 py-4 pr-4 pl-[22px] backdrop-blur max-md:mx-3.5 max-md:mb-3.5 lg:absolute lg:bottom-7 lg:left-[max(2rem,calc((100vw-1240px)/2+2rem))] lg:mx-0 lg:mb-0 lg:w-[420px]">
          <div className="min-w-0">
            <p className="text-[8.5px] uppercase tracking-[0.2em] text-crimson-600">
              {SLIDES[hero].label}
            </p>
            <p className="mt-1 font-serif text-[15px] leading-[1.3] text-ink-900">
              {SLIDES[hero].caption}
            </p>
          </div>

          <div className="flex flex-none items-center gap-3">
            <div className="flex items-center">
              {SLIDES.map((s, i) => (
                <button
                  key={s.src}
                  onClick={() => setHero(i)}
                  aria-label={`Photo ${i + 1} of ${SLIDES.length}`}
                  aria-current={i === hero}
                  className="grid place-items-center p-[7px]"
                >
                  <span
                    className={[
                      'block h-[3px] rounded-full transition-all',
                      i === hero ? 'w-4 bg-crimson-600' : 'w-[3px] bg-blush-400',
                    ].join(' ')}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={nextHero}
              aria-label="Next photo"
              className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border border-blush-300 bg-white text-wine-800 transition-colors hover:bg-wine-800 hover:text-white"
            >
              <ArrowRight />
            </button>
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
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[40fr_60fr] items-start gap-14 px-8 max-lg:grid-cols-1 max-lg:gap-7">
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
            <p className="pt-1 font-serif text-[17px] italic text-wine-800">
              Sakses anytime, Style anytime.
            </p>
          </div>
        </div>
      </section>

      {/* ── More than a keychain ─────────────────────────────────────────── */}
      <section className="bg-blush-100 py-[82px] max-md:py-14">
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[40fr_60fr] items-center gap-14 px-8 max-lg:grid-cols-1 max-lg:gap-7">
          <div className="flex flex-wrap justify-center gap-x-14 gap-y-7 rounded-[14px] bg-white/70 px-8 pb-6 pt-10">
            <div className="text-center">
              <Chain shape="heart" colour="#6b1f2a" className="mx-auto w-[84px] max-md:w-[66px]" />
              <p className="mt-3.5 font-serif text-[13px] text-ink-900">The heart</p>
            </div>
            <div className="text-center">
              <Chain shape="teardrop" colour="#b9855a" className="mx-auto w-[84px] max-md:w-[66px]" />
              <p className="mt-3.5 font-serif text-[13px] text-ink-900">The teardrop</p>
            </div>
            <p className="basis-full border-t border-blush-300 pt-[18px] text-center text-[9px] uppercase tracking-[0.18em] text-ink-300">
              Two shapes · six colours · one little habit
            </p>
          </div>

          <div>
            <p className="eyebrow">
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              The ClearChain
            </p>
            <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
              More than a keychain.
              <br />A handy little habit.
            </h2>

            <div className="mt-7 grid gap-[26px]">
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
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[32fr_68fr] items-start gap-10 px-8 max-lg:grid-cols-1">
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
        <div className="mx-auto w-full max-w-[1240px] px-8">
          <div className="mb-[34px] flex items-end justify-between gap-8 max-md:flex-col max-md:items-start max-md:gap-3.5">
            <div>
              <p className="eyebrow">
                <span className="h-[5px] w-[5px] rounded-full bg-current" />
                Shop the collection
              </p>
              <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
                Two shapes. Your kind of style.
              </h2>
            </div>
            <p className="max-w-[32ch] text-right text-[10.5px] uppercase leading-[1.6] tracking-[0.12em] text-ink-300 max-md:text-left">
              Every piece is hand-cut, stitched, and finished in small batches.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-[26px] max-md:grid-cols-1">
            {[heart, drop].map((v) => (
              <article
                key={v.key}
                className="overflow-hidden rounded bg-white transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(74,17,26,0.4)]"
              >
                <div className="grid aspect-[4/3] place-items-center bg-blush-200 p-[30px]">
                  <Chain shape={v.shape} colour={v.hex} className="w-[152px]" />
                </div>
                <div className="flex items-start justify-between gap-4 bg-white px-5 pb-5 pt-4">
                  <div>
                    <p className="font-serif text-[14px] text-ink-900">
                      ClearChain <em className="italic">/ The {v.shapeName}</em>
                    </p>
                    <p className="mt-1.5 text-[10px] tracking-[0.03em] text-ink-300">
                      Leather · microfiber pad
                    </p>
                    <div className="mt-3 flex gap-1.5">
                      {COLOURS.map((c) => (
                        <span
                          key={c.id}
                          title={c.name}
                          className={[
                            'h-[11px] w-[11px] rounded-full border border-black/10',
                            c.id === v.key.split('-')[1] ? 'outline outline-1 outline-offset-2 outline-wine-800' : '',
                          ].join(' ')}
                          style={{ background: c.hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="num whitespace-nowrap text-[13px] font-medium">{peso(v.price)}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Goes where your day goes ─────────────────────────────────────── */}
      <section className="bg-blush-50 py-[82px] max-md:py-14">
        <div className="mx-auto w-full max-w-[1240px] px-8">
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
            <div className="flex flex-none gap-2 max-md:ml-auto">
              {[-1, 1].map((dir) => (
                <button
                  key={dir}
                  onClick={() => page(dir)}
                  disabled={!canScroll || (dir < 0 ? shot === 0 : shot === DAYS.length - 1)}
                  aria-label={dir < 0 ? 'Previous photo' : 'Next photo'}
                  className="grid h-[34px] w-[34px] place-items-center rounded-[3px] border border-blush-300 bg-white text-ink-700 transition-colors hover:border-wine-800 hover:bg-wine-800 hover:text-white disabled:pointer-events-none disabled:opacity-55"
                >
                  <ArrowRight className={dir < 0 ? 'h-3 w-3 rotate-180' : 'h-3 w-3'} />
                </button>
              ))}
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
                className="w-full flex-none snap-start md:w-[calc((100%-22px)/2)] lg:w-[calc((100%-44px)/3)]"
              >
                <div className="aspect-square overflow-hidden bg-blush-200">
                  <img
                    src={d.img}
                    alt={d.alt}
                    loading="lazy"
                    style={{ objectPosition: d.focus }}
                    className="h-full w-full object-cover"
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
        <div className="mx-auto w-full max-w-[1240px] px-8">
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
                <a
                  href="#collection"
                  className="mt-3.5 inline-block border-b border-crimson-600 pb-0.5 text-[10px] uppercase tracking-[0.1em] text-crimson-600"
                >
                  {g.link}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Care ─────────────────────────────────────────────────────────── */}
      <section className="py-[62px] max-md:py-14">
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[40fr_60fr] items-start gap-14 px-8 max-lg:grid-cols-1 max-lg:gap-7">
          <div>
            <p className="eyebrow">
              <span className="h-[5px] w-[5px] rounded-full bg-current" />
              Care
            </p>
            <h2 className="text-[clamp(28px,2.7vw,37px)] leading-[1.14]">
              Keep your little
              <br />
              companion lovely.
            </h2>
          </div>
          <div className="space-y-3.5">
            <p className="text-[14.5px] leading-[1.75] text-ink-500">
              Wipe the leather with a dry cloth and keep it away from long soaks. The microfiber pad
              can be lifted out, rinsed in cool water, and left to air dry — it will be ready again
              by morning.
            </p>
            <p className="text-[14.5px] leading-[1.75] text-ink-500">
              Leather darkens and softens with use. That is not wear, that is character.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-[82px] max-md:py-14">
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[40fr_60fr] items-start gap-14 px-8 max-lg:grid-cols-1 max-lg:gap-7">
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
        <div className="mx-auto w-full max-w-[1240px] px-8">
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
