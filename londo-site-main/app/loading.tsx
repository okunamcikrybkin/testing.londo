export default function Loading() {
  return (
    <main className="londo-loading" role="status" aria-live="polite" aria-label="Загрузка сайта">
      <span className="londo-loading-mark">LONDO</span>
      <span className="londo-loading-caption">Открываем пространство</span>
      <span className="londo-loading-track" aria-hidden="true" />
    </main>
  );
}
