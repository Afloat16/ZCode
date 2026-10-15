import { MAX_CONTROL_FRAME_BYTES } from "../contracts.js";

export function encodeJsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export class JsonLineDecoder {
  private buffer = "";
  private readonly decoder = new TextDecoder();
  public constructor(private readonly options: { maxFrameBytes?: number } = {}) {}

  public push(chunk: string | Uint8Array): unknown[] {
    // 字节块可能截断 UTF-8 字符，必须保留解码状态，避免产生替换字符。
    // 字符串块已解码，先刷新挂起字节，保证混合输入的原始顺序。
    const text =
      typeof chunk === "string"
        ? this.decoder.decode() + chunk
        : this.decoder.decode(chunk, { stream: true });
    this.buffer += text;
    if (
      Buffer.byteLength(this.buffer, "utf8") >
        (this.options.maxFrameBytes ?? MAX_CONTROL_FRAME_BYTES) &&
      !this.buffer.includes("\n")
    ) {
      throw new Error("JSONL frame exceeds maximum size");
    }
    const frames: unknown[] = [];
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      newlineIndex = this.buffer.indexOf("\n");
      if (!line) continue;
      if (
        Buffer.byteLength(line, "utf8") > (this.options.maxFrameBytes ?? MAX_CONTROL_FRAME_BYTES)
      ) {
        throw new Error("JSONL frame exceeds maximum size");
      }
      try {
        frames.push(JSON.parse(line) as unknown);
      } catch (error) {
        throw new Error("Invalid JSONL frame", { cause: error });
      }
    }
    return frames;
  }

  public finish(): void {
    this.buffer += this.decoder.decode();
    if (this.buffer.trim()) throw new Error("Incomplete JSONL frame");
  }
}
