export default function Hero({ title, subtitle, cta, onCta }) {
  return (
    <section className="border-b border-white/10 bg-white/5">
      <div className="container py-10 md:py-14">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-3 text-neutral-400">{subtitle}</p>}
        {cta && (
          <button onClick={onCta} className="btn mt-6">
            {cta}
          </button>
        )}
      </div>
    </section>
  );
}
