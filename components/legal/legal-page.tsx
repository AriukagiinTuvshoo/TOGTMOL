import Link from "next/link";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export function LegalPage({
  kind,
  effectiveDate,
  sections,
}: {
  kind: "privacy" | "terms";
  effectiveDate: string;
  sections: LegalSection[];
}) {
  const title =
    kind === "privacy" ? "Нууцлалын бодлого" : "Үйлчилгээний нөхцөл";
  const intro =
    kind === "privacy"
      ? "Тогтмол нь суралцах тэмдэглэл, хичээл, зорилго, карт болон ахицыг төхөөрөмж дээрээ хадгалах, хүссэн үедээ бүртгэлтэй үүлэн синктэй ашиглах боломжийг олгодог."
      : "Тогтмол нь суралцах, тэмдэглэл хөтлөх, давтлага хийх, цаг хэмжих болон нэмэлтээр Бондоок AI туслах ашиглах зориулалттай.";
  const email = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();

  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-header">
          <Link className="legal-brand" href="/">
            тогтмол
          </Link>
          <nav aria-label="Хууль зүйн хуудас">
            <Link
              href="/privacy"
              className={kind === "privacy" ? "active" : ""}
            >
              Нууцлал
            </Link>
            <Link href="/terms" className={kind === "terms" ? "active" : ""}>
              Нөхцөл
            </Link>
          </nav>
        </header>

        <article className="legal-card">
          <div className="legal-eyebrow">TOGTMOL · STUDY WORLD</div>
          <h1>{title}</h1>
          <p className="legal-intro">{intro}</p>
          <p className="legal-meta">Хүчин төгөлдөр огноо: {effectiveDate}</p>

          {sections.map((section) => (
            <section key={section.title} className="legal-section">
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="legal-section">
            <h2>Холбоо барих</h2>
            <p>
              {email ? (
                <>
                  Нууцлал, өгөгдөл эсвэл үйлчилгээний талаар асуух зүйл байвал{" "}
                  <a href={`mailto:${email}`}>{email}</a>-ээр холбогдоно уу.
                </>
              ) : (
                <>
                  Нууцлал, өгөгдөл эсвэл үйлчилгээний талаар холбоо барих
                  мэдээллийг production deployment болон App Store / Google Play
                  listing-д тохируулж нийтэлнэ үү. Production-д{" "}
                  <code>NEXT_PUBLIC_LEGAL_CONTACT_EMAIL</code> environment
                  variable тохируулж болно.
                </>
              )}
            </p>
          </section>
        </article>

        <footer className="legal-footer">
          <Link href="/">Тогтмол руу буцах</Link>
          <span>© Тогтмол</span>
        </footer>
      </div>
    </main>
  );
}
