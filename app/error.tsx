"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal-error">
      <h1>Аппыг нээхэд алдаа гарлаа</h1>
      <p>
        Хадгалсан өгөгдлийг өөрчлөөгүй. Браузерын хадгалалтын зөвшөөрлийг
        шалгаад дахин оролдоно уу.
      </p>
      <button className="button primary" onClick={reset}>
        Дахин оролдох
      </button>
    </main>
  );
}
