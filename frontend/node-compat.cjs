const crypto = require('node:crypto');
if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || crypto;
}
if (typeof crypto.hash !== 'function') {
  crypto.hash = (algorithm, data, outputEncoding) => {
    const hash = crypto.createHash(algorithm).update(data);
    return outputEncoding ? hash.digest(outputEncoding) : hash.digest();
  };
}
const diagnosticsChannel = require('node:diagnostics_channel');
if (typeof diagnosticsChannel.tracingChannel !== 'function') {
  diagnosticsChannel.tracingChannel = () => ({
    start: { publish() {} },
    end: { publish() {} },
    asyncStart: { publish() {} },
    asyncEnd: { publish() {} },
    error: { publish() {} },
    hasSubscribers: false,
    subscribe() {},
    unsubscribe() {},
    traceSync: (fn, ctx, thisArg, ...args) => fn.apply(thisArg, args),
    tracePromise: (fn, ctx, thisArg, ...args) => fn.apply(thisArg, args),
    traceCallback: (fn, pos, ctx, thisArg, ...args) => fn.apply(thisArg, args),
  });
}
