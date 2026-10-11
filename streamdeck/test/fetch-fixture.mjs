// Explicit test-only external service fixture; never packaged.
globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
