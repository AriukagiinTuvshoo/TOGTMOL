const TARGET_SAMPLE_RATE = 16000;

export function encodePcm16Wav(
  samples: Float32Array,
  sampleRate = TARGET_SAMPLE_RATE,
) {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function recordedAudioToWav(blob: Blob, maxSeconds = 60) {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass || !window.OfflineAudioContext)
    throw new Error(
      "Энэ хөтөч аудио хөрвүүлэлтийг дэмжихгүй байна. Хөтөчөө шинэчлээд үзнэ үү.",
    );

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (!decoded.duration || decoded.duration > maxSeconds + 0.5)
      throw new Error(
        "Бичлэг 60 секундээс урт байна. Богино бичлэгээр дахин оролдоно уу.",
      );

    const frames = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const mono = await offline.startRendering();
    return encodePcm16Wav(mono.getChannelData(0), TARGET_SAMPLE_RATE);
  } finally {
    await context.close().catch(() => undefined);
  }
}
