// Hand-drawn frame from the Baja Crossing race manual: a slightly crooked box
// with two little strokes in opposite corners. Drop it inside any element with
// class "hb"; it only shows under the .bx theme.
export function HandFrame({ seed = 0 }: { seed?: number }) {
  const r = (a: number) => Math.sin(seed * 7.3 + a) * 0.5 + 0.5;
  const j = (a: number, m: number) => +(r(a) * m).toFixed(1);
  const d = `M${j(1, 2)} ${2 + j(2, 3)} L${98 - j(3, 1)} ${j(4, 2)} L${100 - j(5, 2)} ${97 + j(6, 2)} L${1 + j(7, 2)} ${100 - j(8, 2)} Z`;
  return (
    <>
      <svg className="hb-f" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={d} /></svg>
      <svg className="hb-t hb-tl" viewBox="0 0 20 13" aria-hidden="true"><path d="M1 8 L11 1 M3 13 L15 4" /></svg>
      <svg className="hb-t hb-br" viewBox="0 0 20 13" aria-hidden="true"><path d="M5 9 L17 0 M9 13 L19 6" /></svg>
    </>
  );
}
