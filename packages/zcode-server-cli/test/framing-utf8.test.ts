import assert from "node:assert/strict";
import { test } from "node:test";
import { JsonLineDecoder } from "../src/ipc/framing.js";

test("JSONL decoding is invariant to every UTF-8 byte split", () => {
  const messages = [{ path: "/tmp/中文😀𠀀.txt", text: "�" }, { id: 2 }];
  const bytes = new TextEncoder().encode(messages.map((x) => JSON.stringify(x) + "\n").join(""));
  for (let i = 0; i <= bytes.length; i++) {
    const decoder = new JsonLineDecoder();
    const actual = [...decoder.push(bytes.slice(0, i)), ...decoder.push(bytes.slice(i))];
    decoder.finish();
    assert.deepEqual(actual, messages);
  }
});

test("truncated trailing UTF-8 is not silently accepted at finish", () => {
  const decoder = new JsonLineDecoder();
  decoder.push(Uint8Array.of(0xe4));
  assert.throws(() => decoder.finish(), /Incomplete JSONL/);
});

test("string chunks follow a flushed byte prefix in order", () => {
  const decoder = new JsonLineDecoder();
  decoder.push(new TextEncoder().encode('{"x":"'));
  decoder.push(Uint8Array.of(0xe4));
  assert.deepEqual(decoder.push('x"}\n'), [{ x: "�x" }]);
  decoder.finish();
});
