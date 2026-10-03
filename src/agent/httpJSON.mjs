/** Bounded JSON decoding on browsers, native fetch and Node; never log a body. */
export async function readBoundedJSON(response, maximum = 256 * 1024) {
  if (Number(response.headers.get('content-length')) > maximum) throw Error('Response too large');
  let content;
  if (response.body?.getReader && typeof TextDecoder !== 'undefined') {
    const reader = response.body.getReader(), decoder = new TextDecoder(); let size = 0; content = '';
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > maximum) { await reader.cancel(); throw Error('Response too large'); }
        content += decoder.decode(value, { stream: true });
      }
      content += decoder.decode();
    } finally { reader.releaseLock(); }
  } else {
    // Native fetch may not expose a stream. Check both header and decoded body.
    content = await response.text();
    if (content.length > maximum || encodeURIComponent(content).replace(/%[A-F\d]{2}/g, 'x').length > maximum) throw Error('Response too large');
  }
  return JSON.parse(content);
}
