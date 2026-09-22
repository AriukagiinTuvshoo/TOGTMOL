/** Decode and re-encode locally: no remote upload, SVG/HTML or embedded metadata. */
export async function prepareImage(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw Error("JPEG, PNG эсвэл WebP зураг сонгоно уу. Дээд хэмжээ 8 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 60_000_000
    )
      throw Error("Зургийн хэмжээ хэт том эсвэл зураг эвдэрсэн байна.");
    const scale = Math.min(
        1,
        1800 / Math.max(image.naturalWidth, image.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Зураг боловсруулах боломжгүй байна.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.82);
    if (data.length > 2 * 1024 * 1024)
      throw Error("Зургийг арай бага хэмжээгээр оруулна уу.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
