import { Link } from 'react-router-dom';

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
    <footer className="bg-wine-950 pb-[30px] pt-14">
      <div className="mx-auto w-full max-w-[1240px] px-8">
        <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] gap-10 border-b border-white/10 pb-10 max-lg:grid-cols-2 max-md:grid-cols-1">
          <div>
            <img
              src="/img/logo-mark-light.png"
              alt=""
              width={640}
              height={531}
              className="h-14 w-auto"
            />
            <span className="mt-3 block font-serif text-[22px] text-blush-100">Sakssesories PH</span>
            <p className="mt-2.5 max-w-[30ch] text-[11px] leading-[1.7] text-blush-100/65">
              A little style, a clearer day — handmade leather keychains with a microfiber pad,
              made in the Philippines.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3.5 text-[9.5px] font-medium uppercase tracking-[0.18em] text-blush-100/45">
                {col.title}
              </h4>
              <ul className="grid gap-[9px]">
                {col.links.map((link) => {
                  // "Track order" is the one entry here that is a real page
                  // rather than a placeholder for one.
                  const cls =
                    'text-[11.5px] text-blush-100/75 transition-colors hover:text-blush-100';
                  return (
                    <li key={link}>
                      {link === 'Track order' ? (
                        <Link to="/track" className={cls}>
                          {link}
                        </Link>
                      ) : (
                        <a href="#" className={cls}>
                          {link}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-5 pt-[22px] text-[10px] tracking-[0.04em] text-blush-100/45 max-md:flex-col max-md:items-start max-md:gap-2">
          <span>© 2026 Sakssesories PH · All rights reserved.</span>
          <span>Made with care in the Philippines</span>
        </div>
      </div>
    </footer>
  );
}
