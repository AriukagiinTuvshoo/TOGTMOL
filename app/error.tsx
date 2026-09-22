"use client";
import { RecoveryPanel } from "@/components/settings/recovery";
export default function ErrorPage({
  reset,
  retry,
}: {
  reset?: () => void;
  retry?: () => void;
}) {
  return (
    <main className="fatal-error">
      <h1>Аппыг нээхэд алдаа гарлаа</h1>
      <p>
        Хадгалсан өгөгдлийг өөрчлөөгүй. Браузерын хадгалалтын зөвшөөрлийг
        шалгаад дахин оролдоно уу.
      </p>
      <RecoveryPanel
        onRecovered={() =>
          (retry ?? reset ?? (() => window.location.reload()))()
        }
      />
    </main>
  );
}
