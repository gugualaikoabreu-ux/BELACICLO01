"use client";

type GuideMode = "both" | "approved";

const guides = [
  {
    id: "payment",
    title: "Como pagar com Pix",
    description: "Veja como usar o QR Code ou o código Pix e conferir o recebedor e o valor no aplicativo do seu banco.",
    video: "/guides/payment.video.webm",
    poster: "/guides/payment.poster.png?v=2",
  },
  {
    id: "after-approval",
    title: "O que acontece após a aprovação",
    description: "Entenda a conferência do pagamento, a preparação das peças e onde acompanhar o envio do pedido.",
    video: "/guides/after-approval.video.webm",
    poster: "/guides/after-approval.poster.png?v=2",
  },
] as const;

export function PaymentGuides({ mode = "both" }: { mode?: GuideMode }) {
  const visibleGuides = mode === "approved" ? guides.filter((guide) => guide.id === "after-approval") : guides;

  return (
    <section className="payment-guides" aria-labelledby="payment-guides-title">
      <div className="payment-guides-heading">
        <span className="eyebrow">GUIAS RÁPIDOS</span>
        <h2 id="payment-guides-title">Precisa de uma ajuda?</h2>
        <p>Assista aos passos no seu tempo. Os vídeos só carregam quando você iniciar a reprodução.</p>
      </div>
      <div className="payment-guides-grid">
        {visibleGuides.map((guide) => (
          <article className="payment-guide-card" key={guide.id}>
            <video
              className="payment-guide-video"
              controls
              playsInline
              preload="none"
              poster={guide.poster}
              aria-label={guide.title}
              onPlay={(event) => {
                document.querySelectorAll<HTMLVideoElement>(".payment-guide-video").forEach((video) => {
                  if (video !== event.currentTarget) video.pause();
                });
              }}
            >
              <source src={guide.video} type="video/webm" />
              Seu navegador não conseguiu reproduzir este vídeo. Atualize o navegador ou tente outro dispositivo.
            </video>
            <div className="payment-guide-copy">
              <h3>{guide.title}</h3>
              <p>{guide.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
