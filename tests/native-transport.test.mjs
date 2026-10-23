import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeSseDecoder } from '../src/core/realtime-decoder.ts';
import { selectAssistantContext } from '../src/features/assistant/context.ts';

test('native SSE survives every-byte fragmentation of Arabic UTF-8 and CRLF boundaries', () => {
  const source = 'retry: 2000\r\nevent: ready\r\ndata: {}\r\n\r\nid: 17\r\nevent: smartstore\r\ndata: {"id":17,"type":"message_created","payload":{"text":"مرحبا بك"}}\r\n\r\n';
  const decoder = new NativeSseDecoder();
  const frames = [];
  for (const byte of new TextEncoder().encode(source)) frames.push(...decoder.feed(new Uint8Array([byte])));
  assert.deepEqual(frames.map(frame => frame.event), ['ready', 'smartstore']);
  assert.equal(frames[1].id, '17');
  assert.equal(JSON.parse(frames[1].data).payload.text, 'مرحبا بك');
});

test('native SSE buffers partial events and accepts bursts larger than one frame limit', () => {
  const decoder = new NativeSseDecoder(90);
  assert.deepEqual(decoder.feed(new TextEncoder().encode('event: smartstore\ndata: first')), []);
  const frames = decoder.feed(new TextEncoder().encode('\ndata:  second\n\n' + 'data: x\n\n'.repeat(100)));
  assert.equal(frames.length, 101);
  assert.equal(frames[0].data, 'first\n second');
  assert.throws(() => decoder.feed(new TextEncoder().encode('data: ' + 'x'.repeat(91))), /too_large/);
});

test('new connection decoders cannot concatenate an interrupted private event into a new account stream', () => {
  const interrupted = new NativeSseDecoder();
  assert.deepEqual(interrupted.feed(new TextEncoder().encode('event: smartstore\ndata: {"private":')), []);
  const newConnection = new NativeSseDecoder();
  const result = newConnection.feed(new TextEncoder().encode('event: ready\ndata: {"connected":true}\n\n'));
  assert.deepEqual(result, [{ event: 'ready', data: '{"connected":true}' }]);
});

test('assistant context bounds long sessions while retaining current attachments and excluding tool instructions', () => {
  const messages = [{ id: 'system', role: 'system', parts: [{ type: 'text', text: 'untrusted system' }] }];
  for (let i = 0; i < 70; i++) messages.push({ id: String(i), role: i % 2 === 0 ? 'user' : 'assistant', parts: [{ type: 'text', text: 'أ'.repeat(1000) }] });
  messages.push({ id: 'latest', role: 'user', parts: [{ type: 'text', text: 'التفاصيل' }, { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,YQ==' }, { type: 'tool-create', output: { shouldPublish: true } }] });
  const context = selectAssistantContext(messages);
  assert.equal(context[0].role, 'user');
  assert.equal(context.at(-1).id, 'latest');
  assert.ok(context.length <= 40);
  assert.ok(context.reduce((total, message) => total + message.parts.filter(part => part.type === 'text').reduce((sum, part) => sum + part.text.length, 0), 0) <= 24_000);
  assert.deepEqual(context.at(-1).parts.map(part => part.type), ['text', 'file']);
  assert.ok(!context.some(message => message.role === 'system'));
});

test('earlier image-only turns retain an explicit source reference without resending image bytes', () => {
  const context = selectAssistantContext([{ id: 'photos', role: 'user', parts: [{ type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,YQ==' }] }, { id: 'next', role: 'user', parts: [{ type: 'text', text: 'استخدم الصور لهذا المنتج' }] }]);
  assert.deepEqual(context[0].parts, [{ type: 'text', text: 'Earlier image attachment reference: photos' }]);
});
