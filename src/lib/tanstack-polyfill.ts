export function useServerFn(fnObj: any) {
  return async (args?: any) => {
    const { data } = args || {};
    const res = await fetch(fnObj.endpoint, {
      method: fnObj.method,
      headers: { 'Content-Type': 'application/json' },
      body: fnObj.method === 'POST' ? JSON.stringify(data || {}) : undefined
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };
}

export function createServerFn(opts: any) {
  // We don't use this on the client, but it's here just in case
  return opts;
}