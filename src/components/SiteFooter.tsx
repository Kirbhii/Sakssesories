const COLUMNS = [
  {
    title: 'Explore',
    links: ['Our story', 'What we make', 'The collection', 'Shop'],
  },
  {
    title: 'Useful info',
    links: ['Care guide', 'Engraving', 'FAQ', 'Contact'],
  },
  {
    title: 'Support',
    links: ['Delivery', 'Returns', 'Track order', 'Wholesale'],
  },
];

export default function SiteFooter() {
  return (
    <footer className="bg-white pb-[30px] pt-14">
      <div className="mx-auto w-full max-w-[1240px] px-8">
        <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] gap-10 border-b border-blush-300/60 pb-10 max-lg:grid-cols-2 max-md:grid-cols-1">
          <div>
            <span className="font-serif text-[22px] text-ink-900">Saksesories PH</span>
            <p className="mt-2.5 max-w-[30ch] text-[11px] leading-[1.7] text-ink-500">
              A little style, a clearer day — handmade leather keychains with a microfiber pad,
              made in the Philippines.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3.5 text-[9.5px] font-medium uppercase tracking-[0.18em] text-ink-300">
                {col.title}
              </h4>
              <ul className="grid gap-[9px]">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-[11.5px] text-ink-500 transition-colors hover:text-crimson-600"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-5 pt-[22px] text-[10px] tracking-[0.04em] text-ink-300 max-md:flex-col max-md:items-start max-md:gap-2">
          <span>© 2026 Saksesories PH · All rights reserved.</span>
          <span>Made with care in the Philippines</span>
        </div>
      </div>
    </footer>
  );
}
