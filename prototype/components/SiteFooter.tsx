export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-zinc-200 bg-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-zinc-500 flex flex-col sm:flex-row sm:justify-between gap-1 text-center sm:text-left">
        <span>© {year} DILAB · 임상순 교수님 연구실</span>
        <span>BGE-M3 + DeepSeek + Modal · AS_OF 2026-05-28</span>
      </div>
    </footer>
  );
}
