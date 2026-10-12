// Explicit test-only service fixture; never packaged or presented as physical verification.
globalThis.fetch = async (input) => {
  process.send?.({
    fixture: "http",
    status: new URL(input).searchParams.get("status"),
  });
  await new Promise((resolve) => setTimeout(resolve, 35));
  return { ok: true, json: async () => ({ ok: true }) };
};
