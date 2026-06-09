/** Tło MŚ 2026 — ciemne, bez flag */
export function WcBackground() {
  return (
    <div className="wc-bg" aria-hidden>
      <div className="wc-bg__base" />
      <div className="wc-bg__image" />
      <div className="wc-bg__glow wc-bg__glow--usa" />
      <div className="wc-bg__glow wc-bg__glow--canada" />
      <div className="wc-bg__glow wc-bg__glow--gold" />
      <div className="wc-bg__pattern" />
    </div>
  );
}
