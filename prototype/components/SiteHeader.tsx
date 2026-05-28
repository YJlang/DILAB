import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/ask", label: "Ask", icon: "⚡" },
  { href: "/topics", label: "토픽", icon: "🧩" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-zinc-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-md"
          aria-label="DILAB 홈으로"
        >
          <span className="inline-flex w-8 h-8 rounded-md bg-indigo-600 text-white items-center justify-center font-bold">
            D
          </span>
          <span className="text-lg font-bold tracking-tight">DILAB</span>
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-0.5 sm:gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1 min-h-[44px] px-2.5 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span aria-hidden>{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
