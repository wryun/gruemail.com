var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var _c, _d;
export function __vite_legacy_guard() {
  import("data:text/javascript,");
}
;
function createEnum(...values) {
  const obj = {};
  for (const value of values) {
    obj[value] = value;
  }
  return Object.freeze(obj);
}
function normalizeHomeserver(homeserver) {
  try {
    return new URL(homeserver).origin;
  } catch (err) {
    return new URL(`https://${homeserver}`).origin;
  }
}
async function getWellKnownResponse(homeserver, request) {
  const requestOptions = { format: "json", timeout: 3e4, method: "GET" };
  try {
    const wellKnownUrl = `${homeserver}/.well-known/matrix/client`;
    return await request(wellKnownUrl, requestOptions).response();
  } catch (err) {
    if (err.name === "ConnectionError") {
      return null;
    } else {
      throw err;
    }
  }
}
async function lookupHomeserver(homeserver, request) {
  var _a;
  homeserver = normalizeHomeserver(homeserver);
  const wellKnownResponse = await getWellKnownResponse(homeserver, request);
  if (wellKnownResponse && wellKnownResponse.status === 200) {
    const { body } = wellKnownResponse;
    const wellKnownHomeserver = (_a = body["m.homeserver"]) == null ? void 0 : _a["base_url"];
    if (typeof wellKnownHomeserver === "string") {
      homeserver = normalizeHomeserver(wellKnownHomeserver);
    }
  }
  return homeserver;
}
class AbortError extends Error {
  get name() {
    return "AbortError";
  }
}
class BaseObservable {
  constructor() {
    this._handlers = /* @__PURE__ */ new Set();
  }
  onSubscribeFirst() {
  }
  onUnsubscribeLast() {
  }
  subscribe(handler) {
    this._handlers.add(handler);
    if (this._handlers.size === 1) {
      this.onSubscribeFirst();
    }
    return () => {
      return this.unsubscribe(handler);
    };
  }
  unsubscribe(handler) {
    if (handler) {
      this._handlers.delete(handler);
      if (this._handlers.size === 0) {
        this.onUnsubscribeLast();
      }
    }
    return void 0;
  }
  unsubscribeAll() {
    if (this._handlers.size !== 0) {
      this._handlers.clear();
      this.onUnsubscribeLast();
    }
  }
  get hasSubscriptions() {
    return this._handlers.size !== 0;
  }
}
class BaseObservableValue extends BaseObservable {
  emit(argument) {
    for (const h of this._handlers) {
      h(argument);
    }
  }
  waitFor(predicate) {
    if (predicate(this.get())) {
      return new ResolvedWaitForHandle(Promise.resolve(this.get()));
    } else {
      return new WaitForHandle(this, predicate);
    }
  }
  flatMap(mapper) {
    return new FlatMapObservableValue(this, mapper);
  }
}
class WaitForHandle {
  constructor(observable, predicate) {
    this._promise = new Promise((resolve, reject) => {
      this._reject = reject;
      this._subscription = observable.subscribe((v) => {
        if (predicate(v)) {
          this._reject = null;
          resolve(v);
          this.dispose();
        }
      });
    });
  }
  get promise() {
    return this._promise;
  }
  dispose() {
    if (this._subscription) {
      this._subscription();
      this._subscription = null;
    }
    if (this._reject) {
      this._reject(new AbortError());
      this._reject = null;
    }
  }
}
class ResolvedWaitForHandle {
  constructor(promise) {
    this.promise = promise;
  }
  dispose() {
  }
}
class ObservableValue extends BaseObservableValue {
  constructor(initialValue) {
    super();
    this._value = initialValue;
  }
  get() {
    return this._value;
  }
  set(value) {
    if (value !== this._value) {
      this._value = value;
      this.emit(this._value);
    }
  }
}
class RetainedObservableValue extends ObservableValue {
  constructor(initialValue, freeCallback) {
    super(initialValue);
    this._freeCallback = freeCallback;
  }
  onUnsubscribeLast() {
    super.onUnsubscribeLast();
    this._freeCallback();
  }
}
class FlatMapObservableValue extends BaseObservableValue {
  constructor(source, mapper) {
    super();
    this.source = source;
    this.mapper = mapper;
  }
  onUnsubscribeLast() {
    super.onUnsubscribeLast();
    this.sourceSubscription = this.sourceSubscription();
    if (this.targetSubscription) {
      this.targetSubscription = this.targetSubscription();
    }
  }
  onSubscribeFirst() {
    super.onSubscribeFirst();
    this.sourceSubscription = this.source.subscribe(() => {
      this.updateTargetSubscription();
      this.emit(this.get());
    });
    this.updateTargetSubscription();
  }
  updateTargetSubscription() {
    const sourceValue = this.source.get();
    if (sourceValue) {
      const target = this.mapper(sourceValue);
      if (target) {
        if (!this.targetSubscription) {
          this.targetSubscription = target.subscribe(() => this.emit(this.get()));
        }
        return;
      }
    }
    if (this.targetSubscription) {
      this.targetSubscription = this.targetSubscription();
    }
  }
  get() {
    const sourceValue = this.source.get();
    if (!sourceValue) {
      return void 0;
    }
    const mapped = this.mapper(sourceValue);
    return mapped == null ? void 0 : mapped.get();
  }
}
class AbortableOperation {
  constructor(run) {
    this._abortable = void 0;
    const setAbortable = (abortable) => {
      this._abortable = abortable;
      return abortable;
    };
    this._progress = new ObservableValue(void 0);
    const setProgress = (progress) => {
      this._progress.set(progress);
    };
    this.result = run(setAbortable, setProgress);
  }
  get progress() {
    return this._progress;
  }
  abort() {
    var _a;
    (_a = this._abortable) == null ? void 0 : _a.abort();
    this._abortable = void 0;
  }
}
const ALLOWED_BLOB_MIMETYPES = {
  "image/jpeg": true,
  "image/gif": true,
  "image/png": true,
  "video/mp4": true,
  "video/webm": true,
  "video/ogg": true,
  "video/quicktime": true,
  "video/VP8": true,
  "audio/mp4": true,
  "audio/webm": true,
  "audio/aac": true,
  "audio/mpeg": true,
  "audio/ogg": true,
  "audio/wave": true,
  "audio/wav": true,
  "audio/x-wav": true,
  "audio/x-pn-wav": true,
  "audio/flac": true,
  "audio/x-flac": true
};
const DEFAULT_MIMETYPE = "application/octet-stream";
class BlobHandle {
  constructor(blob, buffer = null) {
    this._blob = blob;
    this._buffer = buffer;
    this._url = null;
  }
  static fromBuffer(buffer, mimetype) {
    mimetype = mimetype ? mimetype.split(";")[0].trim() : "";
    if (!ALLOWED_BLOB_MIMETYPES[mimetype]) {
      mimetype = DEFAULT_MIMETYPE;
    }
    return new BlobHandle(new Blob([buffer], { type: mimetype }), buffer);
  }
  static fromBlob(blob) {
    return new BlobHandle(blob);
  }
  get nativeBlob() {
    return this._blob;
  }
  async readAsBuffer() {
    if (this._buffer) {
      return this._buffer;
    } else {
      const reader = new FileReader();
      const promise = new Promise((resolve, reject) => {
        reader.addEventListener("load", (evt) => resolve(evt.target.result));
        reader.addEventListener("error", (evt) => reject(evt.target.error));
      });
      reader.readAsArrayBuffer(this._blob);
      return promise;
    }
  }
  get url() {
    if (!this._url) {
      this._url = URL.createObjectURL(this._blob);
    }
    return this._url;
  }
  get size() {
    return this._blob.size;
  }
  get mimeType() {
    return this._blob.type || DEFAULT_MIMETYPE;
  }
  dispose() {
    if (this._url) {
      URL.revokeObjectURL(this._url);
      this._url = null;
    }
  }
}
function encodeQueryParams(queryParams) {
  return Object.entries(queryParams || {}).filter(([, value]) => value !== void 0).map(([name, value]) => {
    if (typeof value === "object") {
      value = JSON.stringify(value);
    }
    return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  }).join("&");
}
function encodeBody(body) {
  if (body instanceof BlobHandle) {
    const blob = body;
    return {
      mimeType: blob.mimeType,
      body: blob
    };
  } else if (body instanceof Map) {
    return {
      mimeType: "multipart/form-data",
      body
    };
  } else if (typeof body === "object") {
    const json = JSON.stringify(body);
    return {
      mimeType: "application/json",
      body: json
    };
  } else {
    throw new Error("Unknown body type: " + body);
  }
}
class WrappedError extends Error {
  constructor(message, cause) {
    super(`${message}: ${cause.message}`);
    this.cause = cause;
  }
  get name() {
    return "WrappedError";
  }
}
class HomeServerError extends Error {
  constructor(method, url, body, status) {
    super(`${body ? body.error : status} on ${method} ${url}`);
    this.errcode = body ? body.errcode : null;
    this.retry_after_ms = body ? body.retry_after_ms : 0;
    this.statusCode = status;
  }
  get name() {
    return "HomeServerError";
  }
}
class ConnectionError extends Error {
  constructor(message, isTimeout) {
    super(message || "ConnectionError");
    this.isTimeout = isTimeout;
  }
  get name() {
    return "ConnectionError";
  }
}
class HomeServerRequest {
  constructor(method, url, sourceRequest, options) {
    let log;
    if (options == null ? void 0 : options.log) {
      const parent = options == null ? void 0 : options.log;
      log = parent.child({ t: "network", url, method }, parent.level.Info);
    }
    this._log = log;
    this._sourceRequest = sourceRequest;
    this._promise = sourceRequest.response().then((response) => {
      var _a, _b;
      log == null ? void 0 : log.set("status", response.status);
      if (response.status >= 200 && response.status < 300 || ((_a = options == null ? void 0 : options.allowedStatusCodes) == null ? void 0 : _a.includes(response.status))) {
        log == null ? void 0 : log.finish();
        return response.body;
      } else {
        if (response.status >= 500) {
          const err = new ConnectionError(`Internal Server Error`);
          log == null ? void 0 : log.catch(err);
          throw err;
        } else if (response.status >= 400 && !((_b = response.body) == null ? void 0 : _b.errcode)) {
          const err = new ConnectionError(`HTTP error status ${response.status} without errcode in body, assume this is a load balancer complaining the server is offline.`);
          log == null ? void 0 : log.catch(err);
          throw err;
        } else {
          const err = new HomeServerError(method, url, response.body, response.status);
          log == null ? void 0 : log.set("errcode", err.errcode);
          log == null ? void 0 : log.catch(err);
          throw err;
        }
      }
    }, (err) => {
      if (err.name === "AbortError" && this._sourceRequest) {
        const err2 = new ConnectionError(`Service worker aborted, either updating or hit #187.`);
        log == null ? void 0 : log.catch(err2);
        throw err2;
      } else {
        if (err.name === "ConnectionError") {
          log == null ? void 0 : log.set("timeout", err.isTimeout);
        }
        log == null ? void 0 : log.catch(err);
        throw err;
      }
    });
  }
  abort() {
    var _a;
    if (this._sourceRequest) {
      (_a = this._log) == null ? void 0 : _a.set("aborted", true);
      this._sourceRequest.abort();
      this._sourceRequest = void 0;
    }
  }
  response() {
    return this._promise;
  }
  async responseCode() {
    const response = await this._sourceRequest.response();
    return response.status;
  }
}
const CS_R0_PREFIX = "/_matrix/client/r0";
const CS_V3_PREFIX = "/_matrix/client/v3";
const DEHYDRATION_PREFIX = "/_matrix/client/unstable/org.matrix.msc2697.v2";
class HomeServerApi {
  constructor({ homeserver, accessToken, request, reconnector }) {
    this._homeserver = homeserver;
    this._accessToken = accessToken;
    this._requestFn = request;
    this._reconnector = reconnector;
  }
  _url(csPath, prefix = CS_R0_PREFIX) {
    return this._homeserver + prefix + csPath;
  }
  _baseRequest(method, url, queryParams, body, options, accessToken) {
    const queryString = encodeQueryParams(queryParams);
    url = `${url}?${queryString}`;
    let encodedBody;
    const headers = /* @__PURE__ */ new Map();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    headers.set("Accept", "application/json");
    if (body) {
      const encoded = encodeBody(body);
      headers.set("Content-Type", encoded.mimeType);
      encodedBody = encoded.body;
    }
    const requestResult = this._requestFn(url, {
      method,
      headers,
      body: encodedBody,
      timeout: options == null ? void 0 : options.timeout,
      uploadProgress: options == null ? void 0 : options.uploadProgress,
      format: "json",
      cache: method !== "GET"
    });
    const hsRequest = new HomeServerRequest(method, url, requestResult, options);
    if (this._reconnector) {
      hsRequest.response().catch((err) => {
        if (err.name === "ConnectionError") {
          this._reconnector.onRequestFailed(this);
        }
      });
    }
    return hsRequest;
  }
  _unauthedRequest(method, url, queryParams, body, options) {
    return this._baseRequest(method, url, queryParams, body, options);
  }
  _authedRequest(method, url, queryParams, body, options) {
    return this._baseRequest(method, url, queryParams, body, options, this._accessToken);
  }
  _post(csPath, queryParams, body, options) {
    return this._authedRequest("POST", this._url(csPath, (options == null ? void 0 : options.prefix) || CS_R0_PREFIX), queryParams, body, options);
  }
  _put(csPath, queryParams, body, options) {
    return this._authedRequest("PUT", this._url(csPath, (options == null ? void 0 : options.prefix) || CS_R0_PREFIX), queryParams, body, options);
  }
  _get(csPath, queryParams, body, options) {
    return this._authedRequest("GET", this._url(csPath, (options == null ? void 0 : options.prefix) || CS_R0_PREFIX), queryParams, body, options);
  }
  sync(since, filter, timeout, options) {
    return this._get("/sync", { since, timeout, filter }, void 0, options);
  }
  context(roomId, eventId, limit, filter) {
    return this._get(`/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}`, { filter, limit });
  }
  messages(roomId, params, options) {
    return this._get(`/rooms/${encodeURIComponent(roomId)}/messages`, params, void 0, options);
  }
  members(roomId, params, options) {
    return this._get(`/rooms/${encodeURIComponent(roomId)}/members`, params, void 0, options);
  }
  send(roomId, eventType, txnId, content, options) {
    return this._put(`/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`, {}, content, options);
  }
  redact(roomId, eventId, txnId, content, options) {
    return this._put(`/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(eventId)}/${encodeURIComponent(txnId)}`, {}, content, options);
  }
  receipt(roomId, receiptType, eventId, options) {
    return this._post(`/rooms/${encodeURIComponent(roomId)}/receipt/${encodeURIComponent(receiptType)}/${encodeURIComponent(eventId)}`, {}, {}, options);
  }
  state(roomId, eventType, stateKey, options) {
    return this._get(`/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(eventType)}/${encodeURIComponent(stateKey)}`, {}, void 0, options);
  }
  getLoginFlows() {
    return this._unauthedRequest("GET", this._url("/login"));
  }
  register(username, password, initialDeviceDisplayName, auth, inhibitLogin = false, options = {}) {
    options.allowedStatusCodes = [401];
    const body = {
      auth,
      password,
      initial_device_displayname: initialDeviceDisplayName,
      inhibit_login: inhibitLogin
    };
    if (username) {
      body.username = username;
    }
    return this._unauthedRequest("POST", this._url("/register", CS_V3_PREFIX), void 0, body, options);
  }
  passwordLogin(username, password, initialDeviceDisplayName, options) {
    return this._unauthedRequest("POST", this._url("/login"), void 0, {
      "type": "m.login.password",
      "identifier": {
        "type": "m.id.user",
        "user": username
      },
      "password": password,
      "initial_device_display_name": initialDeviceDisplayName
    }, options);
  }
  tokenLogin(loginToken, txnId, initialDeviceDisplayName, options) {
    return this._unauthedRequest("POST", this._url("/login"), void 0, {
      "type": "m.login.token",
      "identifier": {
        "type": "m.id.user"
      },
      "token": loginToken,
      "txn_id": txnId,
      "initial_device_display_name": initialDeviceDisplayName
    }, options);
  }
  createFilter(userId, filter, options) {
    return this._post(`/user/${encodeURIComponent(userId)}/filter`, {}, filter, options);
  }
  versions(options) {
    return this._unauthedRequest("GET", `${this._homeserver}/_matrix/client/versions`, void 0, void 0, options);
  }
  uploadKeys(dehydratedDeviceId, payload, options) {
    let path = "/keys/upload";
    if (dehydratedDeviceId) {
      path = path + `/${encodeURIComponent(dehydratedDeviceId)}`;
    }
    return this._post(path, {}, payload, options);
  }
  queryKeys(queryRequest, options) {
    return this._post("/keys/query", {}, queryRequest, options);
  }
  claimKeys(payload, options) {
    return this._post("/keys/claim", {}, payload, options);
  }
  sendToDevice(type, payload, txnId, options) {
    return this._put(`/sendToDevice/${encodeURIComponent(type)}/${encodeURIComponent(txnId)}`, {}, payload, options);
  }
  roomKeysVersion(version, options) {
    let versionPart = "";
    if (version) {
      versionPart = `/${encodeURIComponent(version)}`;
    }
    return this._get(`/room_keys/version${versionPart}`, void 0, void 0, options);
  }
  roomKeyForRoomAndSession(version, roomId, sessionId, options) {
    return this._get(`/room_keys/keys/${encodeURIComponent(roomId)}/${encodeURIComponent(sessionId)}`, { version }, void 0, options);
  }
  uploadRoomKeysToBackup(version, payload, options) {
    return this._put(`/room_keys/keys`, { version }, payload, options);
  }
  uploadAttachment(blob, filename, options) {
    return this._authedRequest("POST", `${this._homeserver}/_matrix/media/r0/upload`, { filename }, blob, options);
  }
  setPusher(pusher, options) {
    return this._post("/pushers/set", {}, pusher, options);
  }
  getPushers(options) {
    return this._get("/pushers", void 0, void 0, options);
  }
  join(roomId, options) {
    return this._post(`/rooms/${encodeURIComponent(roomId)}/join`, {}, {}, options);
  }
  joinIdOrAlias(roomIdOrAlias, options) {
    return this._post(`/join/${encodeURIComponent(roomIdOrAlias)}`, {}, {}, options);
  }
  leave(roomId, options) {
    return this._post(`/rooms/${encodeURIComponent(roomId)}/leave`, {}, {}, options);
  }
  forget(roomId, options) {
    return this._post(`/rooms/${encodeURIComponent(roomId)}/forget`, {}, {}, options);
  }
  logout(options) {
    return this._post(`/logout`, {}, {}, options);
  }
  getDehydratedDevice(options = {}) {
    options.prefix = DEHYDRATION_PREFIX;
    return this._get(`/dehydrated_device`, void 0, void 0, options);
  }
  createDehydratedDevice(payload, options = {}) {
    options.prefix = DEHYDRATION_PREFIX;
    return this._put(`/dehydrated_device`, {}, payload, options);
  }
  claimDehydratedDevice(deviceId, options = {}) {
    options.prefix = DEHYDRATION_PREFIX;
    return this._post(`/dehydrated_device/claim`, {}, { device_id: deviceId }, options);
  }
  profile(userId, options) {
    return this._get(`/profile/${encodeURIComponent(userId)}`);
  }
  createRoom(payload, options) {
    return this._post(`/createRoom`, {}, payload, options);
  }
  setAccountData(ownUserId, type, content, options) {
    return this._put(`/user/${encodeURIComponent(ownUserId)}/account_data/${encodeURIComponent(type)}`, {}, content, options);
  }
}
class ExponentialRetryDelay {
  constructor(createTimeout) {
    this._start = 2e3;
    this._current = 2e3;
    const start = 2e3;
    this._start = start;
    this._current = start;
    this._createTimeout = createTimeout;
    this._max = 60 * 5 * 1e3;
  }
  async waitForRetry() {
    this._timeout = this._createTimeout(this._current);
    try {
      await this._timeout.elapsed();
      const next = 2 * this._current;
      this._current = Math.min(this._max, next);
    } catch (err) {
      if (!(err instanceof AbortError)) {
        throw err;
      }
    } finally {
      this._timeout = void 0;
    }
  }
  abort() {
    if (this._timeout) {
      this._timeout.abort();
    }
  }
  reset() {
    this._current = this._start;
    this.abort();
  }
  get nextValue() {
    return this._current;
  }
}
var ConnectionStatus = /* @__PURE__ */ ((ConnectionStatus2) => {
  ConnectionStatus2[ConnectionStatus2["Waiting"] = 0] = "Waiting";
  ConnectionStatus2[ConnectionStatus2["Reconnecting"] = 1] = "Reconnecting";
  ConnectionStatus2[ConnectionStatus2["Online"] = 2] = "Online";
  return ConnectionStatus2;
})(ConnectionStatus || {});
class Reconnector {
  constructor({ retryDelay, createMeasure, onlineStatus }) {
    this._onlineStatus = onlineStatus;
    this._retryDelay = retryDelay;
    this._createTimeMeasure = createMeasure;
    this._state = new ObservableValue(2);
    this._isReconnecting = false;
  }
  get lastVersionsResponse() {
    return this._versionsResponse;
  }
  get connectionStatus() {
    return this._state;
  }
  get retryIn() {
    if (this._state.get() === 0) {
      return this._retryDelay.nextValue - this._stateSince.measure();
    }
    return 0;
  }
  async onRequestFailed(hsApi) {
    if (!this._isReconnecting) {
      this._isReconnecting = true;
      const onlineStatusSubscription = this._onlineStatus && this._onlineStatus.subscribe((online) => {
        if (online) {
          this.tryNow();
        }
      });
      try {
        await this._reconnectLoop(hsApi);
      } catch (err) {
        console.error(err);
      } finally {
        if (onlineStatusSubscription) {
          onlineStatusSubscription();
        }
        this._isReconnecting = false;
      }
    }
  }
  tryNow() {
    if (this._retryDelay) {
      this._retryDelay.abort();
    }
  }
  _setState(state) {
    if (state !== this._state.get()) {
      if (state === 0) {
        this._stateSince = this._createTimeMeasure();
      } else {
        this._stateSince = null;
      }
      this._state.set(state);
    }
  }
  async _reconnectLoop(hsApi) {
    this._versionsResponse = void 0;
    this._retryDelay.reset();
    while (!this._versionsResponse) {
      try {
        this._setState(1);
        const versionsRequest = hsApi.versions({ timeout: 3e4 });
        this._versionsResponse = await versionsRequest.response();
        this._setState(2);
      } catch (err) {
        if (err.name === "ConnectionError") {
          this._setState(0);
          await this._retryDelay.waitForRetry();
        } else {
          throw err;
        }
      }
    }
  }
}
async function decryptAttachment(platform2, ciphertextBuffer, info) {
  if (info === void 0 || info.key === void 0 || info.iv === void 0 || info.hashes === void 0 || info.hashes.sha256 === void 0) {
    throw new Error("Invalid info. Missing info.key, info.iv or info.hashes.sha256 key");
  }
  const { crypto: crypto2 } = platform2;
  const { base64 } = platform2.encoding;
  var ivArray = base64.decode(info.iv);
  var expectedSha256base64 = base64.encode(base64.decode(info.hashes.sha256));
  const digestResult = await crypto2.digest("SHA-256", ciphertextBuffer);
  if (base64.encode(new Uint8Array(digestResult)) != expectedSha256base64) {
    throw new Error("Mismatched SHA-256 digest");
  }
  var counterLength;
  if (info.v == "v1" || info.v == "v2") {
    counterLength = 64;
  } else {
    counterLength = 128;
  }
  const decryptedBuffer = await crypto2.aes.decryptCTR({
    jwkKey: info.key,
    iv: ivArray,
    data: ciphertextBuffer,
    counterLength
  });
  return decryptedBuffer;
}
async function encryptAttachment(platform2, blob) {
  const { crypto: crypto2 } = platform2;
  const { base64 } = platform2.encoding;
  const iv = await crypto2.aes.generateIV();
  const key = await crypto2.aes.generateKey("jwk", 256);
  const buffer = await blob.readAsBuffer();
  const ciphertext = await crypto2.aes.encryptCTR({ jwkKey: key, iv, data: buffer });
  const digest = await crypto2.digest("SHA-256", ciphertext);
  return {
    blob: platform2.createBlob(ciphertext, "application/octet-stream"),
    info: {
      v: "v2",
      key,
      iv: base64.encodeUnpadded(iv),
      hashes: {
        sha256: base64.encodeUnpadded(digest)
      }
    }
  };
}
class MediaRepository {
  constructor({ homeserver, platform: platform2 }) {
    this._homeserver = homeserver;
    this._platform = platform2;
  }
  mxcUrlThumbnail(url, width, height, method) {
    const parts = this._parseMxcUrl(url);
    if (parts) {
      const [serverName, mediaId] = parts;
      const httpUrl = `${this._homeserver}/_matrix/media/r0/thumbnail/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
      return httpUrl + "?" + encodeQueryParams({ width: Math.round(width), height: Math.round(height), method });
    }
    return null;
  }
  mxcUrl(url) {
    const parts = this._parseMxcUrl(url);
    if (parts) {
      const [serverName, mediaId] = parts;
      return `${this._homeserver}/_matrix/media/r0/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
    } else {
      return null;
    }
  }
  _parseMxcUrl(url) {
    const prefix = "mxc://";
    if (url.startsWith(prefix)) {
      return url.substr(prefix.length).split("/", 2);
    } else {
      return null;
    }
  }
  async downloadEncryptedFile(fileEntry, cache = false) {
    const url = this.mxcUrl(fileEntry.url);
    const { body: encryptedBuffer } = await this._platform.request(url, { method: "GET", format: "buffer", cache }).response();
    const decryptedBuffer = await decryptAttachment(this._platform, encryptedBuffer, fileEntry);
    return this._platform.createBlob(decryptedBuffer, fileEntry.mimetype);
  }
  async downloadPlaintextFile(mxcUrl, mimetype, cache = false) {
    const url = this.mxcUrl(mxcUrl);
    const { body: buffer } = await this._platform.request(url, { method: "GET", format: "buffer", cache }).response();
    return this._platform.createBlob(buffer, mimetype);
  }
  async downloadAttachment(content, cache = false) {
    var _a;
    if (content.file) {
      return this.downloadEncryptedFile(content.file, cache);
    } else {
      return this.downloadPlaintextFile(content.url, (_a = content.info) == null ? void 0 : _a.mimetype, cache);
    }
  }
}
class Request$1 {
  constructor(methodName, args) {
    this.methodName = methodName;
    this.args = args;
    this._responsePromise = new Promise((resolve, reject) => {
      this.responseResolve = resolve;
      this.responseReject = reject;
    });
  }
  abort() {
    var _a;
    if (this._requestResult) {
      this._requestResult.abort();
    } else {
      this.responseReject(new AbortError());
      (_a = this.responseCodeReject) == null ? void 0 : _a.call(this, new AbortError());
    }
  }
  response() {
    return this._responsePromise;
  }
  responseCode() {
    if (this.requestResult) {
      return this.requestResult.responseCode();
    }
    if (!this._responseCodePromise) {
      this._responseCodePromise = new Promise((resolve, reject) => {
        this.responseCodeResolve = resolve;
        this.responseCodeReject = reject;
      });
    }
    return this._responseCodePromise;
  }
  async setRequestResult(result) {
    var _a, _b, _c2;
    this._requestResult = result;
    const response = await ((_a = this._requestResult) == null ? void 0 : _a.response());
    this.responseResolve(response);
    const responseCode = await ((_b = this._requestResult) == null ? void 0 : _b.responseCode());
    (_c2 = this.responseCodeResolve) == null ? void 0 : _c2.call(this, responseCode);
  }
  get requestResult() {
    return this._requestResult;
  }
}
class HomeServerApiWrapper {
  constructor(scheduler) {
    this._scheduler = scheduler;
  }
}
for (const methodName of Object.getOwnPropertyNames(HomeServerApi.prototype)) {
  if (methodName !== "constructor" && !methodName.startsWith("_")) {
    HomeServerApiWrapper.prototype[methodName] = function(...args) {
      return this._scheduler._hsApiRequest(methodName, args);
    };
  }
}
class RequestScheduler {
  constructor({ hsApi, clock }) {
    this._requests = /* @__PURE__ */ new Set();
    this._stopped = false;
    this._wrapper = new HomeServerApiWrapper(this);
    this._hsApi = hsApi;
    this._clock = clock;
  }
  get hsApi() {
    return this._wrapper;
  }
  stop() {
    this._stopped = true;
    for (const request of this._requests) {
      request.abort();
    }
    this._requests.clear();
  }
  start() {
    this._stopped = false;
  }
  _hsApiRequest(name, args) {
    const request = new Request$1(name, args);
    this._doSend(request);
    return request;
  }
  async _doSend(request) {
    this._requests.add(request);
    try {
      let retryDelay;
      while (!this._stopped) {
        try {
          const requestResult = this._hsApi[request.methodName].apply(this._hsApi, request.args);
          await request.setRequestResult(requestResult);
          return;
        } catch (err) {
          if (err instanceof HomeServerError && err.errcode === "M_LIMIT_EXCEEDED") {
            if (Number.isSafeInteger(err.retry_after_ms)) {
              await this._clock.createTimeout(err.retry_after_ms).elapsed();
            } else {
              if (!retryDelay) {
                retryDelay = new ExponentialRetryDelay(this._clock.createTimeout);
              }
              await retryDelay.waitForRetry();
            }
          } else {
            request.responseReject(err);
            return;
          }
        }
      }
      if (this._stopped) {
        request.abort();
      }
    } finally {
      this._requests.delete(request);
    }
  }
}
const INCREMENTAL_TIMEOUT = 3e4;
const SyncStatus = createEnum("InitialSync", "CatchupSync", "Syncing", "Stopped");
function timelineIsEmpty(roomResponse) {
  var _a;
  try {
    const events = (_a = roomResponse == null ? void 0 : roomResponse.timeline) == null ? void 0 : _a.events;
    return Array.isArray(events) && events.length === 0;
  } catch (err) {
    return true;
  }
}
class Sync {
  constructor({ hsApi, session, storage, logger }) {
    this._hsApi = hsApi;
    this._logger = logger;
    this._session = session;
    this._storage = storage;
    this._currentRequest = null;
    this._status = new ObservableValue(SyncStatus.Stopped);
    this._error = null;
  }
  get status() {
    return this._status;
  }
  get error() {
    return this._error;
  }
  start() {
    if (this._status.get() !== SyncStatus.Stopped) {
      return;
    }
    this._error = null;
    let syncToken = this._session.syncToken;
    if (syncToken) {
      this._status.set(SyncStatus.CatchupSync);
    } else {
      this._status.set(SyncStatus.InitialSync);
    }
    this._syncLoop(syncToken);
  }
  async _syncLoop(syncToken) {
    while (this._status.get() !== SyncStatus.Stopped) {
      let roomStates;
      let sessionChanges;
      let wasCatchupOrInitial = this._status.get() === SyncStatus.CatchupSync || this._status.get() === SyncStatus.InitialSync;
      await this._logger.run("sync", async (log) => {
        log.set("token", syncToken);
        log.set("status", this._status.get());
        try {
          const timeout = this._status.get() === SyncStatus.Syncing ? INCREMENTAL_TIMEOUT : 0;
          const syncResult = await this._syncRequest(syncToken, timeout, log);
          syncToken = syncResult.syncToken;
          roomStates = syncResult.roomStates;
          sessionChanges = syncResult.sessionChanges;
          if (this._status.get() !== SyncStatus.Syncing && syncResult.hadToDeviceMessages) {
            this._status.set(SyncStatus.CatchupSync);
          } else {
            this._status.set(SyncStatus.Syncing);
          }
        } catch (err) {
          if (err.name === "ConnectionError" && err.isTimeout) {
            return;
          }
          this._error = err;
          if (err.name !== "AbortError") {
            log.error = err;
            log.logLevel = log.level.Fatal;
          }
          log.set("stopping", true);
          this._status.set(SyncStatus.Stopped);
        }
        if (this._status.get() !== SyncStatus.Stopped) {
          await log.wrap("afterSyncCompleted", (log2) => this._runAfterSyncCompleted(sessionChanges, roomStates, log2));
        }
      }, this._logger.level.Info, (filter, log) => {
        if (log.durationWithoutType("network") >= 2e3 || log.error || wasCatchupOrInitial) {
          return filter.minLevel(log.level.Detail);
        } else {
          return filter.minLevel(log.level.Info);
        }
      });
    }
  }
  async _runAfterSyncCompleted(sessionChanges, roomStates, log) {
    const isCatchupSync = this._status.get() === SyncStatus.CatchupSync;
    const sessionPromise = (async () => {
      try {
        await log.wrap("session", (log2) => this._session.afterSyncCompleted(sessionChanges, isCatchupSync, log2), log.level.Detail);
      } catch (err) {
      }
    })();
    const roomsPromises = roomStates.map(async (rs) => {
      try {
        await rs.room.afterSyncCompleted(rs.changes, log);
      } catch (err) {
      }
    });
    await Promise.all(roomsPromises.concat(sessionPromise));
  }
  async _syncRequest(syncToken, timeout, log) {
    var _a;
    let { syncFilterId } = this._session;
    if (typeof syncFilterId !== "string") {
      this._currentRequest = this._hsApi.createFilter(this._session.user.id, { room: { state: { lazy_load_members: true } } }, { log });
      syncFilterId = (await this._currentRequest.response()).filter_id;
    }
    const totalRequestTimeout = timeout + 80 * 1e3;
    this._currentRequest = this._hsApi.sync(syncToken, syncFilterId, timeout, { timeout: totalRequestTimeout, log });
    const response = await this._currentRequest.response();
    const isInitialSync = !syncToken;
    const sessionState = new SessionSyncProcessState();
    const inviteStates = this._parseInvites(response.rooms);
    const { roomStates, archivedRoomStates } = await this._parseRoomsResponse(response.rooms, inviteStates, isInitialSync, log);
    try {
      sessionState.lock = await log.wrap("obtainSyncLock", () => this._session.obtainSyncLock(response));
      await log.wrap("prepare", (log2) => this._prepareSync(sessionState, roomStates, response, log2));
      await log.wrap("afterPrepareSync", (log2) => Promise.all(roomStates.map((rs) => {
        return rs.room.afterPrepareSync(rs.preparation, log2);
      })));
      await log.wrap("write", async (log2) => this._writeSync(sessionState, inviteStates, roomStates, archivedRoomStates, response, syncFilterId, isInitialSync, log2));
    } finally {
      sessionState.dispose();
    }
    log.wrap("after", (log2) => this._afterSync(sessionState, inviteStates, roomStates, archivedRoomStates, log2));
    const toDeviceEvents = (_a = response.to_device) == null ? void 0 : _a.events;
    return {
      syncToken: response.next_batch,
      roomStates,
      sessionChanges: sessionState.changes,
      hadToDeviceMessages: Array.isArray(toDeviceEvents) && toDeviceEvents.length > 0
    };
  }
  _openPrepareSyncTxn() {
    const storeNames = this._storage.storeNames;
    return this._storage.readTxn([
      storeNames.olmSessions,
      storeNames.inboundGroupSessions,
      storeNames.timelineFragments,
      storeNames.timelineEvents
    ]);
  }
  async _prepareSync(sessionState, roomStates, response, log) {
    var _a, _b;
    const prepareTxn = await this._openPrepareSyncTxn();
    sessionState.preparation = await log.wrap("session", (log2) => this._session.prepareSync(response, sessionState.lock, prepareTxn, log2));
    const newKeysByRoom = (_a = sessionState.preparation) == null ? void 0 : _a.newKeysByRoom;
    if (newKeysByRoom) {
      const { hasOwnProperty: hasOwnProperty2 } = Object.prototype;
      for (const roomId of newKeysByRoom.keys()) {
        const isRoomInResponse = ((_b = response.rooms) == null ? void 0 : _b.join) && hasOwnProperty2.call(response.rooms.join, roomId);
        if (!isRoomInResponse) {
          let room = this._session.rooms.get(roomId);
          if (room) {
            roomStates.push(new RoomSyncProcessState(room, false, {}, room.membership));
          }
        }
      }
    }
    await Promise.all(roomStates.map(async (rs) => {
      const newKeys = newKeysByRoom == null ? void 0 : newKeysByRoom.get(rs.room.id);
      rs.preparation = await log.wrap("room", async (log2) => {
        if (rs.isNewRoom) {
          await rs.room.load(null, prepareTxn, log2);
        }
        return rs.room.prepareSync(rs.roomResponse, rs.membership, newKeys, prepareTxn, log2);
      }, log.level.Detail);
    }));
    await prepareTxn.complete();
  }
  async _writeSync(sessionState, inviteStates, roomStates, archivedRoomStates, response, syncFilterId, isInitialSync, log) {
    const syncTxn = await this._openSyncTxn();
    try {
      sessionState.changes = await log.wrap("session", (log2) => this._session.writeSync(response, syncFilterId, sessionState.preparation, syncTxn, log2));
      await Promise.all(inviteStates.map(async (is) => {
        is.changes = await log.wrap("invite", (log2) => is.invite.writeSync(is.membership, is.roomResponse, syncTxn, log2));
      }));
      await Promise.all(roomStates.map(async (rs) => {
        rs.changes = await log.wrap("room", (log2) => rs.room.writeSync(rs.roomResponse, isInitialSync, rs.preparation, syncTxn, log2));
      }));
      await Promise.all(archivedRoomStates.map(async (ars) => {
        var _a;
        const summaryChanges = (_a = ars.roomState) == null ? void 0 : _a.summaryChanges;
        ars.changes = await log.wrap("archivedRoom", (log2) => ars.archivedRoom.writeSync(summaryChanges, ars.roomResponse, ars.membership, syncTxn, log2));
      }));
    } catch (err) {
      syncTxn.abort(log);
      throw syncTxn.getCause(err);
    }
    await syncTxn.complete(log);
  }
  _afterSync(sessionState, inviteStates, roomStates, archivedRoomStates, log) {
    log.wrap("session", (log2) => this._session.afterSync(sessionState.changes, log2), log.level.Detail);
    for (let ars of archivedRoomStates) {
      log.wrap("archivedRoom", (log2) => {
        ars.archivedRoom.afterSync(ars.changes, log2);
        ars.archivedRoom.release();
      }, log.level.Detail);
    }
    for (let rs of roomStates) {
      log.wrap("room", (log2) => rs.room.afterSync(rs.changes, log2), log.level.Detail);
    }
    for (let is of inviteStates) {
      log.wrap("invite", (log2) => is.invite.afterSync(is.changes, log2), log.level.Detail);
    }
    this._session.applyRoomCollectionChangesAfterSync(inviteStates, roomStates, archivedRoomStates, log);
  }
  _openSyncTxn() {
    const storeNames = this._storage.storeNames;
    return this._storage.readWriteTxn([
      storeNames.session,
      storeNames.roomSummary,
      storeNames.archivedRoomSummary,
      storeNames.invites,
      storeNames.roomState,
      storeNames.roomMembers,
      storeNames.timelineEvents,
      storeNames.timelineRelations,
      storeNames.timelineFragments,
      storeNames.pendingEvents,
      storeNames.userIdentities,
      storeNames.groupSessionDecryptions,
      storeNames.deviceIdentities,
      storeNames.outboundGroupSessions,
      storeNames.operations,
      storeNames.accountData,
      storeNames.olmSessions,
      storeNames.inboundGroupSessions
    ]);
  }
  async _parseRoomsResponse(roomsSection, inviteStates, isInitialSync, log) {
    const roomStates = [];
    const archivedRoomStates = [];
    if (roomsSection) {
      const allMemberships = ["join", "leave"];
      for (const membership of allMemberships) {
        const membershipSection = roomsSection[membership];
        if (membershipSection) {
          for (const [roomId, roomResponse] of Object.entries(membershipSection)) {
            if (isInitialSync && timelineIsEmpty(roomResponse)) {
              continue;
            }
            const invite = this._session.invites.get(roomId);
            if (invite) {
              inviteStates.push(new InviteSyncProcessState(invite, false, null, membership));
            }
            const roomState = this._createRoomSyncState(roomId, roomResponse, membership, isInitialSync);
            if (roomState) {
              roomStates.push(roomState);
            }
            const ars = await this._createArchivedRoomSyncState(roomId, roomState, roomResponse, membership, isInitialSync, log);
            if (ars) {
              archivedRoomStates.push(ars);
            }
          }
        }
      }
    }
    return { roomStates, archivedRoomStates };
  }
  _createRoomSyncState(roomId, roomResponse, membership, isInitialSync) {
    let isNewRoom = false;
    let room = this._session.rooms.get(roomId);
    if (!room && (membership === "join" || isInitialSync && membership === "leave")) {
      room = this._session.createJoinedRoom(roomId);
      isNewRoom = true;
    }
    if (room) {
      return new RoomSyncProcessState(room, isNewRoom, roomResponse, membership);
    }
  }
  async _createArchivedRoomSyncState(roomId, roomState, roomResponse, membership, isInitialSync, log) {
    let archivedRoom;
    if ((roomState == null ? void 0 : roomState.shouldAdd) && !isInitialSync) {
      archivedRoom = this._session.createOrGetArchivedRoomForSync(roomId);
    } else if (membership === "leave") {
      if (roomState) {
        archivedRoom = this._session.createOrGetArchivedRoomForSync(roomId);
      } else {
        archivedRoom = await this._session.loadArchivedRoom(roomId, log);
      }
    }
    if (archivedRoom) {
      return new ArchivedRoomSyncProcessState(archivedRoom, roomState, roomResponse, membership);
    }
  }
  _parseInvites(roomsSection) {
    const inviteStates = [];
    if (roomsSection == null ? void 0 : roomsSection.invite) {
      for (const [roomId, roomResponse] of Object.entries(roomsSection.invite)) {
        let invite = this._session.invites.get(roomId);
        let isNewInvite = false;
        if (!invite) {
          invite = this._session.createInvite(roomId);
          isNewInvite = true;
        }
        inviteStates.push(new InviteSyncProcessState(invite, isNewInvite, roomResponse, "invite"));
      }
    }
    return inviteStates;
  }
  stop() {
    if (this._status.get() === SyncStatus.Stopped) {
      return;
    }
    this._status.set(SyncStatus.Stopped);
    if (this._currentRequest) {
      this._currentRequest.abort();
      this._currentRequest = null;
    }
  }
}
class SessionSyncProcessState {
  constructor() {
    this.lock = null;
    this.preparation = null;
    this.changes = null;
  }
  dispose() {
    var _a;
    (_a = this.lock) == null ? void 0 : _a.release();
  }
}
class RoomSyncProcessState {
  constructor(room, isNewRoom, roomResponse, membership) {
    this.room = room;
    this.isNewRoom = isNewRoom;
    this.roomResponse = roomResponse;
    this.membership = membership;
    this.preparation = null;
    this.changes = null;
  }
  get id() {
    return this.room.id;
  }
  get shouldAdd() {
    return this.isNewRoom && this.membership === "join";
  }
  get shouldRemove() {
    return !this.isNewRoom && this.membership !== "join";
  }
  get summaryChanges() {
    var _a;
    return (_a = this.changes) == null ? void 0 : _a.summaryChanges;
  }
}
class ArchivedRoomSyncProcessState {
  constructor(archivedRoom, roomState, roomResponse, membership, isInitialSync) {
    this.archivedRoom = archivedRoom;
    this.roomState = roomState;
    this.roomResponse = roomResponse;
    this.membership = membership;
    this.isInitialSync = isInitialSync;
    this.changes = null;
  }
  get id() {
    return this.archivedRoom.id;
  }
  get shouldAdd() {
    return (this.roomState || this.isInitialSync) && this.membership === "leave";
  }
  get shouldRemove() {
    return this.membership === "join";
  }
}
class InviteSyncProcessState {
  constructor(invite, isNewInvite, roomResponse, membership) {
    this.invite = invite;
    this.isNewInvite = isNewInvite;
    this.membership = membership;
    this.roomResponse = roomResponse;
    this.changes = null;
  }
  get id() {
    return this.invite.id;
  }
  get shouldAdd() {
    return this.isNewInvite;
  }
  get shouldRemove() {
    return this.membership !== "invite";
  }
}
class EventEmitter {
  constructor() {
    this._handlersByName = {};
  }
  emit(name, value) {
    const handlers = this._handlersByName[name];
    if (handlers) {
      handlers.forEach((h) => h(value));
    }
  }
  disposableOn(name, callback) {
    this.on(name, callback);
    return () => {
      this.off(name, callback);
    };
  }
  on(name, callback) {
    let handlers = this._handlersByName[name];
    if (!handlers) {
      this.onFirstSubscriptionAdded(name);
      this._handlersByName[name] = handlers = /* @__PURE__ */ new Set();
    }
    handlers.add(callback);
  }
  off(name, callback) {
    const handlers = this._handlersByName[name];
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        delete this._handlersByName[name];
        this.onLastSubscriptionRemoved(name);
      }
    }
  }
  onFirstSubscriptionAdded(name) {
  }
  onLastSubscriptionRemoved(name) {
  }
}
function getAugmentedNamespace(n) {
  if (n.__esModule)
    return n;
  var a = Object.defineProperty({}, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
var escaped = /[\\\"\x00-\x1F]/g;
var escapes = {};
for (var i = 0; i < 32; ++i) {
  escapes[String.fromCharCode(i)] = "\\U" + ("0000" + i.toString(16)).slice(-4).toUpperCase();
}
escapes["\b"] = "\\b";
escapes["	"] = "\\t";
escapes["\n"] = "\\n";
escapes["\f"] = "\\f";
escapes["\r"] = "\\r";
escapes['"'] = '\\"';
escapes["\\"] = "\\\\";
function escapeString(value) {
  escaped.lastIndex = 0;
  return value.replace(escaped, function(c) {
    return escapes[c];
  });
}
function stringify$1(value) {
  switch (typeof value) {
    case "string":
      return '"' + escapeString(value) + '"';
    case "number":
      return isFinite(value) ? value : "null";
    case "boolean":
      return value;
    case "object":
      if (value === null) {
        return "null";
      }
      if (Array.isArray(value)) {
        return stringifyArray(value);
      }
      return stringifyObject(value);
    default:
      throw new Error("Cannot stringify: " + typeof value);
  }
}
function stringifyArray(array) {
  var sep = "[";
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    result += sep;
    sep = ",";
    result += stringify$1(array[i]);
  }
  if (sep != ",") {
    return "[]";
  } else {
    return result + "]";
  }
}
function stringifyObject(object) {
  var sep = "{";
  var result = "";
  var keys = Object.keys(object);
  keys.sort();
  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i];
    result += sep + '"' + escapeString(key) + '":';
    sep = ",";
    result += stringify$1(object[key]);
  }
  if (sep != ",") {
    return "{}";
  } else {
    return result + "}";
  }
}
var anotherJson = { stringify: stringify$1 };
const DecryptionSource = createEnum("Sync", "Timeline", "Retry");
const SESSION_E2EE_KEY_PREFIX = "e2ee:";
const OLM_ALGORITHM = "m.olm.v1.curve25519-aes-sha2";
const MEGOLM_ALGORITHM = "m.megolm.v1.aes-sha2";
class DecryptionError extends Error {
  constructor(code, event2, detailsObj = null) {
    super(`Decryption error ${code}${detailsObj ? ": " + JSON.stringify(detailsObj) : ""}`);
    this.code = code;
    this.event = event2;
    this.details = detailsObj;
  }
}
const SIGNATURE_ALGORITHM = "ed25519";
function verifyEd25519Signature(olmUtil, userId, deviceOrKeyId, ed25519Key, value, log = void 0) {
  var _a, _b;
  const clone2 = Object.assign({}, value);
  delete clone2.unsigned;
  delete clone2.signatures;
  const canonicalJson = anotherJson.stringify(clone2);
  const signature = (_b = (_a = value == null ? void 0 : value.signatures) == null ? void 0 : _a[userId]) == null ? void 0 : _b[`${SIGNATURE_ALGORITHM}:${deviceOrKeyId}`];
  try {
    if (!signature) {
      throw new Error("no signature");
    }
    olmUtil.ed25519_verify(ed25519Key, canonicalJson, signature);
    return true;
  } catch (err) {
    if (log) {
      const logItem = log.log({ l: "Invalid signature, ignoring.", ed25519Key, canonicalJson, signature });
      logItem.error = err;
      logItem.logLevel = log.level.Warn;
    }
    return false;
  }
}
function createRoomEncryptionEvent() {
  return {
    "type": "m.room.encryption",
    "state_key": "",
    "content": {
      "algorithm": MEGOLM_ALGORITHM,
      "rotation_period_ms": 6048e5,
      "rotation_period_msgs": 100
    }
  };
}
const HistoryVisibility = Object.freeze({
  Joined: "joined",
  Invited: "invited",
  WorldReadable: "world_readable",
  Shared: "shared"
});
function shouldShareKey(membership, historyVisibility) {
  switch (historyVisibility) {
    case HistoryVisibility.WorldReadable:
      return true;
    case HistoryVisibility.Shared:
      return membership !== void 0;
    case HistoryVisibility.Joined:
      return membership === "join";
    case HistoryVisibility.Invited:
      return membership === "invite" || membership === "join";
    default:
      return false;
  }
}
function applyTimelineEntries(data, timelineEntries, isInitialSync, canMarkUnread, ownUserId) {
  if (timelineEntries.length) {
    data = timelineEntries.reduce((data2, entry) => {
      return processTimelineEvent(data2, entry, isInitialSync, canMarkUnread, ownUserId);
    }, data);
  }
  return data;
}
function reduceStateEvents(roomResponse, callback, value) {
  var _a, _b;
  const stateEvents = (_a = roomResponse == null ? void 0 : roomResponse.state) == null ? void 0 : _a.events;
  if (Array.isArray(stateEvents)) {
    value = stateEvents.reduce(callback, value);
  }
  const timelineEvents = (_b = roomResponse == null ? void 0 : roomResponse.timeline) == null ? void 0 : _b.events;
  if (Array.isArray(timelineEvents)) {
    value = timelineEvents.reduce((data, event2) => {
      if (typeof event2.state_key === "string") {
        value = callback(value, event2);
      }
      return value;
    }, value);
  }
  return value;
}
function applySyncResponse(data, roomResponse, membership, ownUserId) {
  if (roomResponse.summary) {
    data = updateSummary(data, roomResponse.summary);
  }
  if (membership !== data.membership) {
    data = data.cloneIfNeeded();
    data.membership = membership;
  }
  if (roomResponse.account_data) {
    data = roomResponse.account_data.events.reduce(processRoomAccountData, data);
  }
  data = reduceStateEvents(roomResponse, (data2, event2) => processStateEvent(data2, event2, ownUserId), data);
  const unreadNotifications = roomResponse.unread_notifications;
  if (unreadNotifications) {
    data = processNotificationCounts(data, unreadNotifications);
  }
  return data;
}
function processNotificationCounts(data, unreadNotifications) {
  const highlightCount = unreadNotifications.highlight_count || 0;
  if (highlightCount !== data.highlightCount) {
    data = data.cloneIfNeeded();
    data.highlightCount = highlightCount;
  }
  const notificationCount = unreadNotifications.notification_count;
  if (notificationCount !== data.notificationCount) {
    data = data.cloneIfNeeded();
    data.notificationCount = notificationCount;
  }
  return data;
}
function processRoomAccountData(data, event2) {
  var _a;
  if ((event2 == null ? void 0 : event2.type) === "m.tag") {
    let tags = (_a = event2 == null ? void 0 : event2.content) == null ? void 0 : _a.tags;
    if (!tags || Array.isArray(tags) || typeof tags !== "object") {
      tags = null;
    }
    data = data.cloneIfNeeded();
    data.tags = tags;
  }
  return data;
}
function processStateEvent(data, event2, ownUserId) {
  var _a, _b, _c2;
  if (event2.type === "m.room.create") {
    data = data.cloneIfNeeded();
    data.lastMessageTimestamp = event2.origin_server_ts;
  } else if (event2.type === "m.room.encryption") {
    const algorithm = (_a = event2.content) == null ? void 0 : _a.algorithm;
    if (!data.encryption && algorithm === MEGOLM_ALGORITHM) {
      data = data.cloneIfNeeded();
      data.encryption = event2.content;
    }
  } else if (event2.type === "m.room.name") {
    const newName = (_b = event2.content) == null ? void 0 : _b.name;
    if (newName !== data.name) {
      data = data.cloneIfNeeded();
      data.name = newName;
    }
  } else if (event2.type === "m.room.avatar") {
    const newUrl = (_c2 = event2.content) == null ? void 0 : _c2.url;
    if (newUrl !== data.avatarUrl) {
      data = data.cloneIfNeeded();
      data.avatarUrl = newUrl;
    }
  } else if (event2.type === "m.room.canonical_alias") {
    const content = event2.content;
    data = data.cloneIfNeeded();
    data.canonicalAlias = content.alias;
  } else if (event2.type === "m.room.member") {
    const content = event2.content;
    if (content.is_direct === true && content.membership === "invite" && !data.isDirectMessage) {
      let other;
      if (event2.sender === ownUserId) {
        other = event2.state_key;
      } else if (event2.state_key === ownUserId) {
        other = event2.sender;
      }
      if (other) {
        data = data.cloneIfNeeded();
        data.isDirectMessage = true;
        data.dmUserId = other;
      }
    } else if (content.membership === "leave" && data.isDirectMessage && data.dmUserId === event2.state_key) {
      data = data.cloneIfNeeded();
      data.isDirectMessage = false;
      data.dmUserId = null;
    }
  }
  return data;
}
function processTimelineEvent(data, eventEntry, isInitialSync, canMarkUnread, ownUserId) {
  if (eventEntry.eventType === "m.room.message") {
    if (!data.lastMessageTimestamp || eventEntry.timestamp > data.lastMessageTimestamp) {
      data = data.cloneIfNeeded();
      data.lastMessageTimestamp = eventEntry.timestamp;
    }
    if (!isInitialSync && eventEntry.sender !== ownUserId && canMarkUnread) {
      data = data.cloneIfNeeded();
      data.isUnread = true;
    }
  }
  return data;
}
function updateSummary(data, summary) {
  const heroes = summary["m.heroes"];
  const joinCount = summary["m.joined_member_count"];
  const inviteCount = summary["m.invited_member_count"];
  if (heroes && Array.isArray(heroes)) {
    data = data.cloneIfNeeded();
    data.heroes = heroes;
  }
  if (Number.isInteger(inviteCount)) {
    data = data.cloneIfNeeded();
    data.inviteCount = inviteCount;
  }
  if (Number.isInteger(joinCount)) {
    data = data.cloneIfNeeded();
    data.joinCount = joinCount;
  }
  return data;
}
class SummaryData {
  constructor(copy, roomId) {
    this.roomId = copy ? copy.roomId : roomId;
    this.name = copy ? copy.name : null;
    this.lastMessageTimestamp = copy ? copy.lastMessageTimestamp : null;
    this.isUnread = copy ? copy.isUnread : false;
    this.encryption = copy ? copy.encryption : null;
    this.membership = copy ? copy.membership : null;
    this.inviteCount = copy ? copy.inviteCount : 0;
    this.joinCount = copy ? copy.joinCount : 0;
    this.heroes = copy ? copy.heroes : null;
    this.canonicalAlias = copy ? copy.canonicalAlias : null;
    this.hasFetchedMembers = copy ? copy.hasFetchedMembers : false;
    this.isTrackingMembers = copy ? copy.isTrackingMembers : false;
    this.avatarUrl = copy ? copy.avatarUrl : null;
    this.notificationCount = copy ? copy.notificationCount : 0;
    this.highlightCount = copy ? copy.highlightCount : 0;
    this.tags = copy ? copy.tags : null;
    this.isDirectMessage = copy ? copy.isDirectMessage : false;
    this.dmUserId = copy ? copy.dmUserId : null;
    this.cloned = copy ? true : false;
  }
  changedKeys(other) {
    const props = Object.getOwnPropertyNames(this);
    return props.filter((prop) => {
      return prop !== "cloned" && this[prop] !== other[prop];
    });
  }
  cloneIfNeeded() {
    if (this.cloned) {
      return this;
    } else {
      return new SummaryData(this);
    }
  }
  serialize() {
    return Object.entries(this).reduce((obj, [key, value]) => {
      if (key !== "cloned" && value !== null) {
        obj[key] = value;
      }
      return obj;
    }, {});
  }
  applyTimelineEntries(timelineEntries, isInitialSync, canMarkUnread, ownUserId) {
    return applyTimelineEntries(this, timelineEntries, isInitialSync, canMarkUnread, ownUserId);
  }
  applySyncResponse(roomResponse, membership, ownUserId) {
    return applySyncResponse(this, roomResponse, membership, ownUserId);
  }
  get needsHeroes() {
    return !this.name && !this.canonicalAlias && this.heroes && this.heroes.length > 0;
  }
  isNewJoin(oldData) {
    return this.membership === "join" && oldData.membership !== "join";
  }
}
class RoomSummary {
  constructor(roomId) {
    this._data = null;
    this.applyChanges(new SummaryData(null, roomId));
  }
  get data() {
    return this._data;
  }
  writeClearUnread(txn) {
    const data = new SummaryData(this._data);
    data.isUnread = false;
    data.notificationCount = 0;
    data.highlightCount = 0;
    txn.roomSummary.set(data.serialize());
    return data;
  }
  writeHasFetchedMembers(value, txn) {
    const data = new SummaryData(this._data);
    data.hasFetchedMembers = value;
    txn.roomSummary.set(data.serialize());
    return data;
  }
  writeIsTrackingMembers(value, txn) {
    const data = new SummaryData(this._data);
    data.isTrackingMembers = value;
    txn.roomSummary.set(data.serialize());
    return data;
  }
  writeData(data, txn) {
    if (data !== this._data) {
      txn.roomSummary.set(data.serialize());
      return data;
    }
  }
  writeArchivedData(data, txn) {
    if (data !== this._data) {
      txn.archivedRoomSummary.set(data.serialize());
      return data;
    }
  }
  async writeAndApplyData(data, storage) {
    if (data === this._data) {
      return false;
    }
    const txn = await storage.readWriteTxn([
      storage.storeNames.roomSummary
    ]);
    try {
      txn.roomSummary.set(data.serialize());
    } catch (err) {
      txn.abort();
      throw err;
    }
    await txn.complete();
    this.applyChanges(data);
    return true;
  }
  applyChanges(data) {
    this._data = data;
    this._data.cloned = false;
  }
  async load(summary) {
    this.applyChanges(new SummaryData(summary));
  }
}
var StoreNames = /* @__PURE__ */ ((StoreNames2) => {
  StoreNames2["session"] = "session";
  StoreNames2["roomState"] = "roomState";
  StoreNames2["roomSummary"] = "roomSummary";
  StoreNames2["archivedRoomSummary"] = "archivedRoomSummary";
  StoreNames2["invites"] = "invites";
  StoreNames2["roomMembers"] = "roomMembers";
  StoreNames2["timelineEvents"] = "timelineEvents";
  StoreNames2["timelineRelations"] = "timelineRelations";
  StoreNames2["timelineFragments"] = "timelineFragments";
  StoreNames2["pendingEvents"] = "pendingEvents";
  StoreNames2["userIdentities"] = "userIdentities";
  StoreNames2["deviceIdentities"] = "deviceIdentities";
  StoreNames2["olmSessions"] = "olmSessions";
  StoreNames2["inboundGroupSessions"] = "inboundGroupSessions";
  StoreNames2["outboundGroupSessions"] = "outboundGroupSessions";
  StoreNames2["groupSessionDecryptions"] = "groupSessionDecryptions";
  StoreNames2["operations"] = "operations";
  StoreNames2["accountData"] = "accountData";
  return StoreNames2;
})(StoreNames || {});
const STORE_NAMES = Object.values(StoreNames);
class StorageError extends Error {
  constructor(message, cause = null) {
    super(message);
    if (cause) {
      this.errcode = cause.name;
    }
    this.cause = cause;
  }
  get name() {
    return "StorageError";
  }
}
const KeyLimits = {
  get minStorageKey() {
    return 0;
  },
  get middleStorageKey() {
    return 2147483647;
  },
  get maxStorageKey() {
    return 4294967295;
  }
};
class EventKey {
  constructor(fragmentId, eventIndex) {
    this.fragmentId = fragmentId;
    this.eventIndex = eventIndex;
  }
  nextFragmentKey() {
    return new EventKey(this.fragmentId + 1, KeyLimits.middleStorageKey);
  }
  nextKeyForDirection(direction) {
    if (direction.isForward) {
      return this.nextKey();
    } else {
      return this.previousKey();
    }
  }
  previousKey() {
    return new EventKey(this.fragmentId, this.eventIndex - 1);
  }
  nextKey() {
    return new EventKey(this.fragmentId, this.eventIndex + 1);
  }
  static get maxKey() {
    return new EventKey(KeyLimits.maxStorageKey, KeyLimits.maxStorageKey);
  }
  static get minKey() {
    return new EventKey(KeyLimits.minStorageKey, KeyLimits.minStorageKey);
  }
  static get defaultLiveKey() {
    return EventKey.defaultFragmentKey(KeyLimits.minStorageKey);
  }
  static defaultFragmentKey(fragmentId) {
    return new EventKey(fragmentId, KeyLimits.middleStorageKey);
  }
  toString() {
    return `[${this.fragmentId}/${this.eventIndex}]`;
  }
  equals(other) {
    return this.fragmentId === (other == null ? void 0 : other.fragmentId) && this.eventIndex === (other == null ? void 0 : other.eventIndex);
  }
}
const PENDING_FRAGMENT_ID = Number.MAX_SAFE_INTEGER;
class BaseEntry {
  constructor(_fragmentIdComparer) {
    this._fragmentIdComparer = _fragmentIdComparer;
  }
  compare(otherEntry) {
    if (this.fragmentId === otherEntry.fragmentId) {
      return this.entryIndex - otherEntry.entryIndex;
    } else if (this.fragmentId === PENDING_FRAGMENT_ID) {
      return 1;
    } else if (otherEntry.fragmentId === PENDING_FRAGMENT_ID) {
      return -1;
    } else {
      return this._fragmentIdComparer.compare(this.fragmentId, otherEntry.fragmentId);
    }
  }
  asEventKey() {
    return new EventKey(this.fragmentId, this.entryIndex);
  }
}
function getPrevContentFromStateEvent(event2) {
  var _a;
  return ((_a = event2.unsigned) == null ? void 0 : _a.prev_content) || event2.prev_content;
}
const REDACTION_TYPE = "m.room.redaction";
function isRedacted(event2) {
  var _a;
  return !!((_a = event2 == null ? void 0 : event2.unsigned) == null ? void 0 : _a.redacted_because);
}
var RoomStatus = /* @__PURE__ */ ((RoomStatus2) => {
  RoomStatus2[RoomStatus2["None"] = 1] = "None";
  RoomStatus2[RoomStatus2["BeingCreated"] = 2] = "BeingCreated";
  RoomStatus2[RoomStatus2["Invited"] = 4] = "Invited";
  RoomStatus2[RoomStatus2["Joined"] = 8] = "Joined";
  RoomStatus2[RoomStatus2["Replaced"] = 16] = "Replaced";
  RoomStatus2[RoomStatus2["Archived"] = 32] = "Archived";
  return RoomStatus2;
})(RoomStatus || {});
var RoomType = /* @__PURE__ */ ((RoomType2) => {
  RoomType2[RoomType2["DirectMessage"] = 0] = "DirectMessage";
  RoomType2[RoomType2["Private"] = 1] = "Private";
  RoomType2[RoomType2["Public"] = 2] = "Public";
  return RoomType2;
})(RoomType || {});
function iterateResponseStateEvents(roomResponse, callback) {
  var _a, _b;
  let promises = void 0;
  const callCallback = (stateEvent) => {
    const result = callback(stateEvent);
    if (result instanceof Promise) {
      promises = promises != null ? promises : [];
      promises.push(result);
    }
  };
  const stateEvents = (_a = roomResponse.state) == null ? void 0 : _a.events;
  if (stateEvents) {
    for (let i = 0; i < stateEvents.length; i++) {
      callCallback(stateEvents[i]);
    }
  }
  let timelineEvents = (_b = roomResponse.timeline) == null ? void 0 : _b.events;
  if (timelineEvents) {
    for (let i = 0; i < timelineEvents.length; i++) {
      const event2 = timelineEvents[i];
      if (typeof event2.state_key === "string") {
        callCallback(event2);
      }
    }
  }
  if (promises) {
    return Promise.all(promises).then(() => void 0);
  }
}
const REACTION_TYPE = "m.reaction";
const ANNOTATION_RELATION_TYPE = "m.annotation";
function createAnnotation(targetId, key) {
  return {
    "m.relates_to": {
      "event_id": targetId,
      key,
      "rel_type": ANNOTATION_RELATION_TYPE
    }
  };
}
function getRelationTarget(relation) {
  var _a;
  return relation.event_id || ((_a = relation["m.in_reply_to"]) == null ? void 0 : _a.event_id);
}
function setRelationTarget(relation, target) {
  if (relation.event_id !== void 0) {
    relation.event_id = target;
  } else if (relation["m.in_reply_to"]) {
    relation["m.in_reply_to"].event_id = target;
  }
}
function getRelatedEventId(event2) {
  if (event2.type === REDACTION_TYPE) {
    return event2.redacts;
  } else {
    const relation = getRelation(event2);
    if (relation) {
      return getRelationTarget(relation);
    }
  }
  return null;
}
function getRelationFromContent(content) {
  return content == null ? void 0 : content["m.relates_to"];
}
function getRelation(event2) {
  return getRelationFromContent(event2.content);
}
class PendingAnnotation {
  constructor() {
    this._entries = [];
  }
  get firstTimestamp() {
    return this._entries.reduce((ts, e) => {
      if (e.isRedaction) {
        return ts;
      }
      return Math.min(e.timestamp, ts);
    }, Number.MAX_SAFE_INTEGER);
  }
  get annotationEntry() {
    return this._entries.find((e) => !e.isRedaction);
  }
  get redactionEntry() {
    return this._entries.find((e) => e.isRedaction);
  }
  get count() {
    return this._entries.reduce((count, e) => {
      return count + (e.isRedaction ? -1 : 1);
    }, 0);
  }
  add(entry) {
    this._entries.push(entry);
  }
  remove(entry) {
    const idx = this._entries.indexOf(entry);
    if (idx === -1) {
      return false;
    }
    this._entries.splice(idx, 1);
    return true;
  }
  get willAnnotate() {
    const lastEntry = this._entries.reduce((lastEntry2, e) => {
      if (!lastEntry2 || e.pendingEvent.queueIndex > lastEntry2.pendingEvent.queueIndex) {
        return e;
      }
      return lastEntry2;
    }, null);
    if (lastEntry) {
      return !lastEntry.isRedaction;
    }
    return false;
  }
  get isEmpty() {
    return this._entries.length === 0;
  }
}
function htmlEscape(string) {
  return string.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fallbackForNonTextualMessage(msgtype) {
  switch (msgtype) {
    case "m.file":
      return "sent a file.";
    case "m.image":
      return "sent an image.";
    case "m.video":
      return "sent a video.";
    case "m.audio":
      return "sent an audio file.";
  }
  return null;
}
function fallbackPrefix(msgtype) {
  return msgtype === "m.emote" ? "* " : "";
}
function _createReplyContent(targetId, msgtype, body, formattedBody) {
  return {
    msgtype,
    body,
    "format": "org.matrix.custom.html",
    "formatted_body": formattedBody,
    "m.relates_to": {
      "m.in_reply_to": {
        "event_id": targetId
      }
    }
  };
}
function createReplyContent(entry, msgtype, body) {
  const nonTextual = fallbackForNonTextualMessage(entry.content.msgtype);
  const prefix = fallbackPrefix(entry.content.msgtype);
  const sender = entry.sender;
  const name = entry.displayName || sender;
  const formattedBody = nonTextual || entry.content.formatted_body || entry.content.body && htmlEscape(entry.content.body) || "";
  const formattedFallback = `<mx-reply><blockquote>In reply to ${prefix}<a href="https://matrix.to/#/${sender}">${name}</a><br />${formattedBody}</blockquote></mx-reply>`;
  const plainBody = nonTextual || entry.content.body || "";
  const bodyLines = plainBody.split("\n");
  bodyLines[0] = `> ${prefix}<${sender}> ${bodyLines[0]}`;
  const plainFallback = bodyLines.join("\n> ");
  const newBody = plainFallback + "\n\n" + body;
  const newFormattedBody = formattedFallback + htmlEscape(body);
  return _createReplyContent(entry.id, msgtype, newBody, newFormattedBody);
}
class BaseEventEntry extends BaseEntry {
  constructor(fragmentIdComparer) {
    super(fragmentIdComparer);
    this._pendingRedactions = null;
    this._pendingAnnotations = null;
    this._contextEntry = null;
    this._contextForEntries = null;
  }
  get isReply() {
    var _a;
    return !!((_a = this.relation) == null ? void 0 : _a["m.in_reply_to"]);
  }
  get isRedacting() {
    return !!this._pendingRedactions;
  }
  get isRedacted() {
    return this.isRedacting;
  }
  get isRedaction() {
    return this.eventType === REDACTION_TYPE;
  }
  get redactionReason() {
    var _a;
    if (this._pendingRedactions) {
      return (_a = this._pendingRedactions[0].content) == null ? void 0 : _a.reason;
    }
    return null;
  }
  setContextEntry(entry) {
    this._contextEntry = entry;
    entry._setAsContextOf(this);
  }
  _setAsContextOf(entry) {
    if (!this._contextForEntries) {
      this._contextForEntries = [];
    }
    this._contextForEntries.push(entry);
  }
  get contextForEntries() {
    return this._contextForEntries;
  }
  get contextEntry() {
    return this._contextEntry;
  }
  addLocalRelation(entry) {
    if (entry.eventType === REDACTION_TYPE && entry.isRelatedToId(this.id)) {
      if (!this._pendingRedactions) {
        this._pendingRedactions = [];
      }
      this._pendingRedactions.push(entry);
      if (this._pendingRedactions.length === 1) {
        return "isRedacted";
      }
    } else {
      const relationEntry = entry.redactingEntry || entry;
      if (relationEntry.isRelatedToId(this.id)) {
        if (relationEntry.relation.rel_type === ANNOTATION_RELATION_TYPE) {
          if (this._addPendingAnnotation(entry)) {
            return "pendingAnnotations";
          }
        }
      }
    }
  }
  removeLocalRelation(entry) {
    var _a;
    if (entry.eventType === REDACTION_TYPE && entry.isRelatedToId(this.id) && this._pendingRedactions) {
      const countBefore = this._pendingRedactions.length;
      this._pendingRedactions = this._pendingRedactions.filter((e) => e !== entry);
      if (this._pendingRedactions.length === 0) {
        this._pendingRedactions = null;
        if (countBefore !== 0) {
          return "isRedacted";
        }
      }
    } else {
      const relationEntry = entry.redactingEntry || entry;
      if (relationEntry.isRelatedToId(this.id)) {
        if (((_a = relationEntry.relation) == null ? void 0 : _a.rel_type) === ANNOTATION_RELATION_TYPE && this._pendingAnnotations) {
          if (this._removePendingAnnotation(entry)) {
            return "pendingAnnotations";
          }
        }
      }
    }
  }
  _addPendingAnnotation(entry) {
    if (!this._pendingAnnotations) {
      this._pendingAnnotations = /* @__PURE__ */ new Map();
    }
    const { key } = (entry.redactingEntry || entry).relation;
    if (key) {
      let annotation = this._pendingAnnotations.get(key);
      if (!annotation) {
        annotation = new PendingAnnotation();
        this._pendingAnnotations.set(key, annotation);
      }
      annotation.add(entry);
      return true;
    }
    return false;
  }
  _removePendingAnnotation(entry) {
    const { key } = (entry.redactingEntry || entry).relation;
    if (key) {
      let annotation = this._pendingAnnotations.get(key);
      if (annotation.remove(entry) && annotation.isEmpty) {
        this._pendingAnnotations.delete(key);
      }
      if (this._pendingAnnotations.size === 0) {
        this._pendingAnnotations = null;
      }
      return true;
    }
    return false;
  }
  async abortPendingRedaction() {
    if (this._pendingRedactions) {
      for (const pee of this._pendingRedactions) {
        await pee.pendingEvent.abort();
      }
    }
  }
  get pendingRedaction() {
    if (this._pendingRedactions) {
      return this._pendingRedactions[0];
    }
    return null;
  }
  annotate(key) {
    return createAnnotation(this.id, key);
  }
  reply(msgtype, body) {
    return createReplyContent(this, msgtype, body);
  }
  isRelatedToId(id) {
    return id && this.relatedEventId === id;
  }
  haveAnnotation(key) {
    var _a, _b, _c2;
    const haveRemoteReaction = ((_b = (_a = this.annotations) == null ? void 0 : _a[key]) == null ? void 0 : _b.me) || false;
    const pendingAnnotation = (_c2 = this.pendingAnnotations) == null ? void 0 : _c2.get(key);
    const willAnnotate = (pendingAnnotation == null ? void 0 : pendingAnnotation.willAnnotate) || false;
    return haveRemoteReaction && (!pendingAnnotation || willAnnotate) || !haveRemoteReaction && willAnnotate;
  }
  get relation() {
    return getRelationFromContent(this.content);
  }
  get pendingAnnotations() {
    return this._pendingAnnotations;
  }
  get annotations() {
    return null;
  }
}
class PendingEventEntry extends BaseEventEntry {
  constructor({ pendingEvent, member, clock, redactingEntry }) {
    super(null);
    this._pendingEvent = pendingEvent;
    this._member = member;
    this._timestamp = clock.now() - (100 - pendingEvent.queueIndex);
    this._redactingEntry = redactingEntry;
  }
  get fragmentId() {
    return PENDING_FRAGMENT_ID;
  }
  get entryIndex() {
    return this._pendingEvent.queueIndex;
  }
  get content() {
    return this._pendingEvent.content;
  }
  get event() {
    return null;
  }
  get eventType() {
    return this._pendingEvent.eventType;
  }
  get stateKey() {
    return null;
  }
  get sender() {
    var _a;
    return (_a = this._member) == null ? void 0 : _a.userId;
  }
  get displayName() {
    var _a;
    return (_a = this._member) == null ? void 0 : _a.name;
  }
  get avatarUrl() {
    var _a;
    return (_a = this._member) == null ? void 0 : _a.avatarUrl;
  }
  get timestamp() {
    return this._timestamp;
  }
  get isPending() {
    return true;
  }
  get id() {
    return this._pendingEvent.txnId;
  }
  get pendingEvent() {
    return this._pendingEvent;
  }
  notifyUpdate() {
  }
  isRelatedToId(id) {
    if (id && id === this._pendingEvent.relatedTxnId) {
      return true;
    }
    return super.isRelatedToId(id);
  }
  get relatedEventId() {
    return this._pendingEvent.relatedEventId;
  }
  get redactingEntry() {
    return this._redactingEntry;
  }
  get contextEventId() {
    var _a;
    if (this.isReply) {
      return (_a = this._pendingEvent.relatedEventId) != null ? _a : this._pendingEvent.relatedTxnId;
    }
    return null;
  }
}
const SendStatus = createEnum("Waiting", "EncryptingAttachments", "UploadingAttachments", "Encrypting", "Sending", "Sent", "Error");
const unencryptedContentFields = ["m.relates_to"];
class PendingEvent {
  constructor({ data, remove, emitUpdate, attachments }) {
    this._data = data;
    this._attachments = attachments;
    this._emitUpdate = emitUpdate;
    this._removeFromQueueCallback = remove;
    this._aborted = false;
    this._status = SendStatus.Waiting;
    this._sendRequest = null;
    this._attachmentsTotalBytes = 0;
    if (this._attachments) {
      this._attachmentsTotalBytes = Object.values(this._attachments).reduce((t, a) => t + a.size, 0);
    }
  }
  get roomId() {
    return this._data.roomId;
  }
  get queueIndex() {
    return this._data.queueIndex;
  }
  get eventType() {
    return this._data.eventType;
  }
  get txnId() {
    return this._data.txnId;
  }
  get remoteId() {
    return this._data.remoteId;
  }
  get content() {
    return this._data.content;
  }
  get relatedTxnId() {
    return this._data.relatedTxnId;
  }
  get relatedEventId() {
    const relation = getRelationFromContent(this.content);
    if (relation) {
      return getRelationTarget(relation);
    } else {
      return this._data.relatedEventId;
    }
  }
  setRelatedEventId(eventId) {
    const relation = getRelationFromContent(this.content);
    if (relation) {
      setRelationTarget(relation, eventId);
    } else {
      this._data.relatedEventId = eventId;
    }
  }
  get data() {
    return this._data;
  }
  getAttachment(key) {
    return this._attachments && this._attachments[key];
  }
  get needsSending() {
    return !this.remoteId && !this.aborted;
  }
  get needsEncryption() {
    return this._data.needsEncryption && !this.aborted;
  }
  get needsUpload() {
    return this._data.needsUpload && !this.aborted;
  }
  get isMissingAttachments() {
    return this.needsUpload && !this._attachments;
  }
  setEncrypting() {
    this._status = SendStatus.Encrypting;
    this._emitUpdate("status");
  }
  get contentForEncryption() {
    const content = Object.assign({}, this._data.content);
    for (const field of unencryptedContentFields) {
      delete content[field];
    }
    return content;
  }
  _preserveContentFields(into) {
    const content = this._data.content;
    for (const field of unencryptedContentFields) {
      if (content[field] !== void 0) {
        into[field] = content[field];
      }
    }
  }
  setEncrypted(type, content) {
    this._preserveContentFields(content);
    this._data.encryptedEventType = type;
    this._data.encryptedContent = content;
    this._data.needsEncryption = false;
  }
  setError(error) {
    this._status = SendStatus.Error;
    this._error = error;
    this._emitUpdate("status");
  }
  setWaiting() {
    this._status = SendStatus.Waiting;
    this._emitUpdate("status");
  }
  get status() {
    return this._status;
  }
  get error() {
    return this._error;
  }
  get hasStartedSending() {
    return this._status === SendStatus.Sending || this._status === SendStatus.Sent;
  }
  get attachmentsTotalBytes() {
    return this._attachmentsTotalBytes;
  }
  get attachmentsSentBytes() {
    return this._attachments && Object.values(this._attachments).reduce((t, a) => t + a.sentBytes, 0);
  }
  async uploadAttachments(hsApi, log) {
    if (!this.needsUpload) {
      return;
    }
    if (!this._attachments) {
      throw new Error("attachments missing");
    }
    if (this.needsEncryption) {
      this._status = SendStatus.EncryptingAttachments;
      this._emitUpdate("status");
      for (const attachment of Object.values(this._attachments)) {
        await log.wrap("encrypt", () => {
          log.set("size", attachment.size);
          return attachment.encrypt();
        });
        if (this.aborted) {
          throw new AbortError();
        }
      }
    }
    this._status = SendStatus.UploadingAttachments;
    this._emitUpdate("status");
    const entries = Object.entries(this._attachments);
    entries.sort(([, a1], [, a2]) => a1.size - a2.size);
    for (const [urlPath, attachment] of entries) {
      await log.wrap("upload", (log2) => {
        log2.set("size", attachment.size);
        return attachment.upload(hsApi, () => {
          this._emitUpdate("attachmentsSentBytes");
        }, log2);
      });
      attachment.applyToContent(urlPath, this.content);
    }
    this._data.needsUpload = false;
  }
  async abort() {
    var _a;
    if (!this._aborted) {
      this._aborted = true;
      if (this._attachments) {
        for (const attachment of Object.values(this._attachments)) {
          attachment.abort();
        }
      }
      (_a = this._sendRequest) == null ? void 0 : _a.abort();
      await this._removeFromQueueCallback();
    }
  }
  get aborted() {
    return this._aborted;
  }
  async send(hsApi, log) {
    this._status = SendStatus.Sending;
    this._emitUpdate("status");
    const eventType = this._data.encryptedEventType || this._data.eventType;
    const content = this._data.encryptedContent || this._data.content;
    if (eventType === REDACTION_TYPE) {
      this._sendRequest = hsApi.redact(this.roomId, this._data.relatedEventId, this.txnId, content, { log });
    } else {
      this._sendRequest = hsApi.send(this.roomId, eventType, this.txnId, content, { log });
    }
    const response = await this._sendRequest.response();
    this._sendRequest = null;
    this._data.remoteId = response.event_id;
    log.set("id", this._data.remoteId);
    this._status = SendStatus.Sent;
    this._emitUpdate("status");
  }
  dispose() {
    if (this._attachments) {
      for (const attachment of Object.values(this._attachments)) {
        attachment.dispose();
      }
    }
  }
}
class EventEntry extends BaseEventEntry {
  constructor(eventEntry, fragmentIdComparer) {
    super(fragmentIdComparer);
    this._eventEntry = eventEntry;
    this._decryptionError = null;
    this._decryptionResult = null;
  }
  clone() {
    const clone2 = new EventEntry(this._eventEntry, this._fragmentIdComparer);
    clone2.updateFrom(this);
    return clone2;
  }
  updateFrom(other) {
    if (other._decryptionResult) {
      this._decryptionResult = other._decryptionResult;
    }
    if (other._decryptionError) {
      this._decryptionError = other._decryptionError;
    }
    this._contextForEntries = other.contextForEntries;
    this._contextEntry = other.contextEntry;
  }
  get event() {
    return this._eventEntry.event;
  }
  get fragmentId() {
    return this._eventEntry.fragmentId;
  }
  get entryIndex() {
    return this._eventEntry.eventIndex;
  }
  get content() {
    var _a, _b;
    return ((_b = (_a = this._decryptionResult) == null ? void 0 : _a.event) == null ? void 0 : _b.content) || this._eventEntry.event.content;
  }
  get prevContent() {
    return getPrevContentFromStateEvent(this._eventEntry.event);
  }
  get eventType() {
    var _a, _b;
    return ((_b = (_a = this._decryptionResult) == null ? void 0 : _a.event) == null ? void 0 : _b.type) || this._eventEntry.event.type;
  }
  get stateKey() {
    return this._eventEntry.event.state_key;
  }
  get sender() {
    return this._eventEntry.event.sender;
  }
  get displayName() {
    return this._eventEntry.displayName;
  }
  get avatarUrl() {
    return this._eventEntry.avatarUrl;
  }
  get timestamp() {
    return this._eventEntry.event.origin_server_ts;
  }
  get id() {
    return this._eventEntry.event.event_id;
  }
  setDecryptionResult(result) {
    this._decryptionResult = result;
  }
  get isEncrypted() {
    return this._eventEntry.event.type === "m.room.encrypted";
  }
  get isDecrypted() {
    var _a;
    return !!((_a = this._decryptionResult) == null ? void 0 : _a.event);
  }
  get isVerified() {
    var _a;
    return this.isEncrypted && ((_a = this._decryptionResult) == null ? void 0 : _a.isVerified);
  }
  get isUnverified() {
    var _a;
    return this.isEncrypted && ((_a = this._decryptionResult) == null ? void 0 : _a.isUnverified);
  }
  setDecryptionError(err) {
    this._decryptionError = err;
  }
  get decryptionError() {
    return this._decryptionError;
  }
  get relatedEventId() {
    return getRelatedEventId(this.event);
  }
  get isRedacted() {
    return super.isRedacted || isRedacted(this._eventEntry.event);
  }
  get redactionReason() {
    var _a, _b;
    const redactionEvent = (_a = this._eventEntry.event.unsigned) == null ? void 0 : _a.redacted_because;
    if (redactionEvent) {
      return (_b = redactionEvent.content) == null ? void 0 : _b.reason;
    }
    return super.redactionReason;
  }
  get annotations() {
    return this._eventEntry.annotations;
  }
  get relation() {
    const originalContent = this._eventEntry.event.content;
    const originalRelation = originalContent && getRelationFromContent(originalContent);
    return originalRelation || getRelationFromContent(this.content);
  }
  get contextEventId() {
    if (this.isReply) {
      return this.relatedEventId;
    }
    return null;
  }
}
function createEventEntry(key, roomId, event2) {
  return {
    fragmentId: key.fragmentId,
    eventIndex: key.eventIndex,
    roomId,
    event: event2
  };
}
function directionalAppend(array, value, direction) {
  if (direction.isForward) {
    array.push(value);
  } else {
    array.unshift(value);
  }
}
function directionalConcat(array, otherArray, direction) {
  if (direction.isForward) {
    return array.concat(otherArray);
  } else {
    return otherArray.concat(array);
  }
}
const EVENT_TYPE$1 = "m.room.member";
class RoomMember {
  constructor(data) {
    this._data = data;
  }
  static fromUserId(roomId, userId, membership) {
    return new RoomMember({ roomId, userId, membership });
  }
  static fromMemberEvent(roomId, memberEvent) {
    const userId = memberEvent == null ? void 0 : memberEvent.state_key;
    if (typeof userId !== "string") {
      return;
    }
    const content = memberEvent.content;
    const prevContent = getPrevContentFromStateEvent(memberEvent);
    const membership = content == null ? void 0 : content.membership;
    const displayName = (content == null ? void 0 : content.displayname) || (prevContent == null ? void 0 : prevContent.displayname);
    const avatarUrl = (content == null ? void 0 : content.avatar_url) || (prevContent == null ? void 0 : prevContent.avatar_url);
    return this._validateAndCreateMember(roomId, userId, membership, displayName, avatarUrl);
  }
  static fromReplacingMemberEvent(roomId, memberEvent) {
    const userId = memberEvent && memberEvent.state_key;
    if (typeof userId !== "string") {
      return;
    }
    const content = getPrevContentFromStateEvent(memberEvent);
    return this._validateAndCreateMember(roomId, userId, content == null ? void 0 : content.membership, content == null ? void 0 : content.displayname, content == null ? void 0 : content.avatar_url);
  }
  static _validateAndCreateMember(roomId, userId, membership, displayName, avatarUrl) {
    if (typeof membership !== "string") {
      return;
    }
    return new RoomMember({
      roomId,
      userId,
      membership,
      avatarUrl,
      displayName
    });
  }
  get membership() {
    return this._data.membership;
  }
  get displayName() {
    return this._data.displayName;
  }
  get name() {
    return this._data.displayName || this._data.userId;
  }
  get avatarUrl() {
    return this._data.avatarUrl;
  }
  get roomId() {
    return this._data.roomId;
  }
  get userId() {
    return this._data.userId;
  }
  serialize() {
    return this._data;
  }
  equals(other) {
    const data = this._data;
    const otherData = other._data;
    return data.roomId === otherData.roomId && data.userId === otherData.userId && data.membership === otherData.membership && data.displayName === otherData.displayName && data.avatarUrl === otherData.avatarUrl;
  }
}
class MemberChange {
  constructor(member, previousMembership) {
    this.member = member;
    this.previousMembership = previousMembership;
  }
  get roomId() {
    return this.member.roomId;
  }
  get userId() {
    return this.member.userId;
  }
  get membership() {
    return this.member.membership;
  }
  get wasInvited() {
    return this.previousMembership === "invite" && this.membership !== "invite";
  }
  get hasLeft() {
    return this.previousMembership === "join" && this.membership !== "join";
  }
  get hasJoined() {
    return this.previousMembership !== "join" && this.membership === "join";
  }
}
function isValidFragmentId(id) {
  return typeof id === "number";
}
const _REDACT_KEEP_KEY_MAP = [
  "event_id",
  "type",
  "room_id",
  "user_id",
  "sender",
  "state_key",
  "prev_state",
  "content",
  "unsigned",
  "origin_server_ts"
].reduce(function(ret, val) {
  ret[val] = 1;
  return ret;
}, {});
const _REDACT_KEEP_CONTENT_MAP = {
  "m.room.member": { "membership": 1 },
  "m.room.create": { "creator": 1 },
  "m.room.join_rules": { "join_rule": 1 },
  "m.room.power_levels": {
    "ban": 1,
    "events": 1,
    "events_default": 1,
    "kick": 1,
    "redact": 1,
    "state_default": 1,
    "users": 1,
    "users_default": 1
  },
  "m.room.aliases": { "aliases": 1 }
};
function redactEvent(redactionEvent, redactedEvent) {
  for (const key of Object.keys(redactedEvent)) {
    if (!_REDACT_KEEP_KEY_MAP[key]) {
      delete redactedEvent[key];
    }
  }
  const { content } = redactedEvent;
  const keepMap = _REDACT_KEEP_CONTENT_MAP[redactedEvent.type];
  for (const key of Object.keys(content)) {
    if (!(keepMap == null ? void 0 : keepMap[key])) {
      delete content[key];
    }
  }
  redactedEvent.unsigned = redactedEvent.unsigned || {};
  redactedEvent.unsigned.redacted_because = redactionEvent;
}
function findBackwardSiblingFragments(current, byId) {
  const sortedSiblings = [];
  while (isValidFragmentId(current.previousId)) {
    const previous = byId.get(current.previousId);
    if (!previous) {
      break;
    }
    if (previous.nextId !== current.id) {
      throw new Error(`Previous fragment ${previous.id} doesn't point back to ${current.id}`);
    }
    byId.delete(current.previousId);
    sortedSiblings.unshift(previous);
    current = previous;
  }
  return sortedSiblings;
}
function findForwardSiblingFragments(current, byId) {
  const sortedSiblings = [];
  while (isValidFragmentId(current.nextId)) {
    const next = byId.get(current.nextId);
    if (!next) {
      break;
    }
    if (next.previousId !== current.id) {
      throw new Error(`Next fragment ${next.id} doesn't point back to ${current.id}`);
    }
    byId.delete(current.nextId);
    sortedSiblings.push(next);
    current = next;
  }
  return sortedSiblings;
}
function createIslands(fragments) {
  const byId = /* @__PURE__ */ new Map();
  for (let f of fragments) {
    byId.set(f.id, f);
  }
  const islands = [];
  while (byId.size) {
    const current = byId.values().next().value;
    byId.delete(current.id);
    const previousSiblings = findBackwardSiblingFragments(current, byId);
    const nextSiblings = findForwardSiblingFragments(current, byId);
    const island = previousSiblings.concat(current, nextSiblings);
    islands.push(island);
  }
  return islands.map((a) => new Island(a));
}
class Fragment {
  constructor(id, previousId, nextId) {
    this.id = id;
    this.previousId = previousId;
    this.nextId = nextId;
  }
}
class Island {
  constructor(sortedFragments) {
    this._idToSortIndex = /* @__PURE__ */ new Map();
    sortedFragments.forEach((f, i) => {
      this._idToSortIndex.set(f.id, i);
    });
  }
  compare(idA, idB) {
    const sortIndexA = this._idToSortIndex.get(idA);
    if (sortIndexA === void 0) {
      throw new Error(`first id ${idA} isn't part of this island`);
    }
    const sortIndexB = this._idToSortIndex.get(idB);
    if (sortIndexB === void 0) {
      throw new Error(`second id ${idB} isn't part of this island`);
    }
    return sortIndexA - sortIndexB;
  }
  get fragmentIds() {
    return this._idToSortIndex.keys();
  }
}
class CompareError extends Error {
  get name() {
    return "CompareError";
  }
}
class FragmentIdComparer {
  constructor(fragments) {
    this._fragmentsById = fragments.reduce((map, f) => {
      map.set(f.id, f);
      return map;
    }, /* @__PURE__ */ new Map());
    this.rebuild(fragments);
  }
  _getIsland(id) {
    const island = this._idToIsland.get(id);
    if (island === void 0) {
      throw new CompareError(`Unknown fragment id ${id}`);
    }
    return island;
  }
  compare(idA, idB) {
    if (idA === idB) {
      return 0;
    }
    const islandA = this._getIsland(idA);
    const islandB = this._getIsland(idB);
    if (islandA !== islandB) {
      throw new CompareError(`${idA} and ${idB} are on different islands, can't tell order`);
    }
    return islandA.compare(idA, idB);
  }
  rebuild(fragments) {
    const islands = createIslands(fragments);
    this._idToIsland = /* @__PURE__ */ new Map();
    for (let island of islands) {
      for (let id of island.fragmentIds) {
        this._idToIsland.set(id, island);
      }
    }
  }
  add(fragment) {
    const copy = new Fragment(fragment.id, fragment.previousId, fragment.nextId);
    this._fragmentsById.set(fragment.id, copy);
    this.rebuild(this._fragmentsById.values());
  }
  append(id, previousId) {
    const fragment = new Fragment(id, previousId, null);
    const prevFragment = this._fragmentsById.get(previousId);
    if (prevFragment) {
      prevFragment.nextId = id;
    }
    this._fragmentsById.set(id, fragment);
    this.rebuild(this._fragmentsById.values());
  }
  prepend(id, nextId) {
    const fragment = new Fragment(id, null, nextId);
    const nextFragment = this._fragmentsById.get(nextId);
    if (nextFragment) {
      nextFragment.previousId = id;
    }
    this._fragmentsById.set(id, fragment);
    this.rebuild(this._fragmentsById.values());
  }
}
(function detectScriptRel() {
  const relList = document.createElement("link").relList;
  return relList && relList.supports && relList.supports("modulepreload") ? "modulepreload" : "preload";
})();
function _sourceName(source) {
  return "objectStore" in source ? `${source.objectStore.name}.${source.name}` : source.name;
}
function _sourceDatabase(source) {
  var _a, _b, _c2, _d2, _e;
  return "objectStore" in source ? (_c2 = (_b = (_a = source.objectStore) == null ? void 0 : _a.transaction) == null ? void 0 : _b.db) == null ? void 0 : _c2.name : (_e = (_d2 = source.transaction) == null ? void 0 : _d2.db) == null ? void 0 : _e.name;
}
class IDBError extends StorageError {
  constructor(message, sourceOrCursor, cause = null) {
    const source = sourceOrCursor && "source" in sourceOrCursor ? sourceOrCursor.source : sourceOrCursor;
    const storeName = source ? _sourceName(source) : "";
    const databaseName = source ? _sourceDatabase(source) : "";
    let fullMessage = `${message} on ${databaseName}.${storeName}`;
    if (cause) {
      fullMessage += ": ";
      if (typeof cause.name === "string") {
        fullMessage += `(name: ${cause.name}) `;
      }
      if (typeof cause.code === "number") {
        fullMessage += `(code: ${cause.code}) `;
      }
    }
    if (cause) {
      fullMessage += cause.message;
    }
    super(fullMessage, cause);
    this.storeName = storeName;
    this.databaseName = databaseName;
  }
}
class IDBRequestError extends IDBError {
  constructor(errorEvent) {
    const request = errorEvent.target;
    const source = request.source;
    const cause = request.error;
    super("IDBRequest failed", source, cause);
    this.errorEvent = errorEvent;
  }
  preventTransactionAbort() {
    this.errorEvent.preventDefault();
  }
}
class IDBRequestAttemptError extends IDBError {
  constructor(method, source, cause, params) {
    super(`${method}(${params.map((p) => JSON.stringify(p)).join(", ")}) failed`, source, cause);
  }
}
const DONE = { done: true };
const NOT_DONE = { done: false };
function encodeUint32(n) {
  const hex = n.toString(16);
  return "0".repeat(8 - hex.length) + hex;
}
function decodeUint32(str) {
  return parseInt(str, 16);
}
function openDatabase(name, createObjectStore, version, idbFactory = window.indexedDB) {
  const req = idbFactory.open(name, version);
  req.onupgradeneeded = async (ev) => {
    const req2 = ev.target;
    const db = req2.result;
    const txn = req2.transaction;
    const oldVersion = ev.oldVersion;
    try {
      await createObjectStore(db, txn, oldVersion, version);
    } catch (err) {
      try {
        txn.abort();
      } catch (err2) {
      }
    }
  };
  return reqAsPromise(req);
}
function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.addEventListener("success", (event2) => {
      resolve(event2.target.result);
    });
    req.addEventListener("error", (event2) => {
      const error = new IDBRequestError(event2);
      reject(error);
    });
  });
}
function txnAsPromise(txn) {
  return new Promise((resolve, reject) => {
    txn.addEventListener("complete", () => {
      resolve();
    });
    txn.addEventListener("abort", (event2) => {
      reject(new AbortError());
    });
  });
}
function iterateCursor(cursorRequest, processValue) {
  return new Promise((resolve, reject) => {
    cursorRequest.onerror = (event2) => {
      reject(new IDBRequestError(event2));
    };
    cursorRequest.onsuccess = (event2) => {
      const cursor = event2.target.result;
      if (!cursor) {
        resolve(false);
        return;
      }
      const result = processValue(cursor["value"], cursor.key, cursor);
      const done = result == null ? void 0 : result.done;
      const jumpTo = result == null ? void 0 : result.jumpTo;
      if (done) {
        resolve(true);
      } else if (jumpTo) {
        cursor.continue(jumpTo);
      } else {
        cursor.continue();
      }
    };
  }).catch((err) => {
    throw new StorageError("iterateCursor failed", err);
  });
}
async function fetchResults(cursor, isDone) {
  const results = [];
  await iterateCursor(cursor, (value) => {
    results.push(value);
    return { done: isDone(results) };
  });
  return results;
}
class QueryTarget {
  constructor(target, transaction) {
    this._target = target;
    this._transaction = transaction;
  }
  get idbFactory() {
    return this._transaction.idbFactory;
  }
  get IDBKeyRange() {
    return this._transaction.IDBKeyRange;
  }
  get databaseName() {
    return this._transaction.databaseName;
  }
  _openCursor(range, direction) {
    if (range && direction) {
      return this._target.openCursor(range, direction);
    } else if (range) {
      return this._target.openCursor(range);
    } else if (direction) {
      return this._target.openCursor(null, direction);
    } else {
      return this._target.openCursor();
    }
  }
  supports(methodName) {
    return this._target.supports(methodName);
  }
  count(keyRange) {
    return reqAsPromise(this._target.count(keyRange));
  }
  get(key) {
    return reqAsPromise(this._target.get(key));
  }
  getKey(key) {
    if (this._target.supports("getKey")) {
      return reqAsPromise(this._target.getKey(key));
    } else {
      return reqAsPromise(this._target.get(key)).then((value) => {
        if (value) {
          let keyPath = this._target.keyPath;
          if (typeof keyPath === "string") {
            keyPath = [keyPath];
          }
          return keyPath.reduce((obj, key2) => obj[key2], value);
        }
      });
    }
  }
  reduce(range, reducer, initialValue) {
    return this._reduce(range, reducer, initialValue, "next");
  }
  reduceReverse(range, reducer, initialValue) {
    return this._reduce(range, reducer, initialValue, "prev");
  }
  selectLimit(range, amount) {
    return this._selectLimit(range, amount, "next");
  }
  selectLimitReverse(range, amount) {
    return this._selectLimit(range, amount, "prev");
  }
  selectWhile(range, predicate) {
    return this._selectWhile(range, predicate, "next");
  }
  selectWhileReverse(range, predicate) {
    return this._selectWhile(range, predicate, "prev");
  }
  async selectAll(range, direction) {
    const cursor = this._openCursor(range, direction);
    const results = [];
    await iterateCursor(cursor, (value) => {
      results.push(value);
      return NOT_DONE;
    });
    return results;
  }
  selectFirst(range) {
    return this._find(range, () => true, "next");
  }
  selectLast(range) {
    return this._find(range, () => true, "prev");
  }
  find(range, predicate) {
    return this._find(range, predicate, "next");
  }
  findReverse(range, predicate) {
    return this._find(range, predicate, "prev");
  }
  async findMaxKey(range) {
    const cursor = this._target.openKeyCursor(range, "prev");
    let maxKey;
    await iterateCursor(cursor, (_, key) => {
      maxKey = key;
      return DONE;
    });
    return maxKey;
  }
  async iterateValues(range, callback) {
    const cursor = this._target.openCursor(range, "next");
    await iterateCursor(cursor, (value, key, cur) => {
      return { done: callback(value, key, cur) };
    });
  }
  async iterateKeys(range, callback) {
    const cursor = this._target.openKeyCursor(range, "next");
    await iterateCursor(cursor, (_, key, cur) => {
      return { done: callback(key, cur) };
    });
  }
  async findExistingKeys(keys, backwards, callback) {
    const compareKeys = (a, b) => backwards ? -this.idbFactory.cmp(a, b) : this.idbFactory.cmp(a, b);
    const sortedKeys = keys.slice().sort(compareKeys);
    const firstKey = sortedKeys[0];
    const lastKey = sortedKeys[sortedKeys.length - 1];
    const direction = backwards ? "prev" : "next";
    const cursor = this._target.openKeyCursor(this.IDBKeyRange.bound(firstKey, lastKey), direction);
    let index = 0;
    await iterateCursor(cursor, (value, key, cursor2) => {
      while (index < sortedKeys.length && compareKeys(sortedKeys[index], key) < 0) {
        index += 1;
      }
      let done = false;
      if (sortedKeys[index] === key) {
        const pk = cursor2.primaryKey;
        done = callback(key, pk);
        index += 1;
      }
      if (done || index >= sortedKeys.length) {
        return DONE;
      } else {
        return {
          done: false,
          jumpTo: sortedKeys[index]
        };
      }
    });
  }
  _reduce(range, reducer, initialValue, direction) {
    let reducedValue = initialValue;
    const cursor = this._openCursor(range, direction);
    return iterateCursor(cursor, (value) => {
      reducedValue = reducer(reducedValue, value);
      return NOT_DONE;
    });
  }
  _selectLimit(range, amount, direction) {
    return this._selectUntil(range, (results) => {
      return results.length === amount;
    }, direction);
  }
  async _selectUntil(range, predicate, direction) {
    const cursor = this._openCursor(range, direction);
    const results = [];
    await iterateCursor(cursor, (value) => {
      results.push(value);
      return { done: predicate(results, value) };
    });
    return results;
  }
  async _selectWhile(range, predicate, direction) {
    const cursor = this._openCursor(range, direction);
    const results = [];
    await iterateCursor(cursor, (value) => {
      const passesPredicate = predicate(value);
      if (passesPredicate) {
        results.push(value);
      }
      return { done: !passesPredicate };
    });
    return results;
  }
  async iterateWhile(range, predicate) {
    const cursor = this._openCursor(range, "next");
    await iterateCursor(cursor, (value) => {
      const passesPredicate = predicate(value);
      return { done: !passesPredicate };
    });
  }
  async _find(range, predicate, direction) {
    const cursor = this._openCursor(range, direction);
    let result;
    const found = await iterateCursor(cursor, (value) => {
      const found2 = predicate(value);
      if (found2) {
        result = value;
      }
      return { done: found2 };
    });
    if (found) {
      return result;
    }
  }
}
const LOG_REQUESTS = false;
function logRequest(method, params, source) {
  var _a, _b;
  const storeName = source == null ? void 0 : source.name;
  const databaseName = (_b = (_a = source == null ? void 0 : source.transaction) == null ? void 0 : _a.db) == null ? void 0 : _b.name;
  console.info(`${databaseName}.${storeName}.${method}(${params.map((p) => JSON.stringify(p)).join(", ")})`);
}
class QueryTargetWrapper {
  constructor(qt) {
    this._qt = qt;
  }
  get keyPath() {
    return this._qtStore.keyPath;
  }
  get _qtStore() {
    if ("objectStore" in this._qt) {
      return this._qt.objectStore;
    }
    return this._qt;
  }
  supports(methodName) {
    return !!this._qt[methodName];
  }
  openKeyCursor(range, direction) {
    try {
      if (!this._qt.openKeyCursor) {
        LOG_REQUESTS && logRequest("openCursor", [range, direction], this._qt);
        return this.openCursor(range, direction);
      }
      LOG_REQUESTS && logRequest("openKeyCursor", [range, direction], this._qt);
      return this._qt.openKeyCursor(range, direction);
    } catch (err) {
      throw new IDBRequestAttemptError("openKeyCursor", this._qt, err, [range, direction]);
    }
  }
  openCursor(range, direction) {
    try {
      LOG_REQUESTS && logRequest("openCursor", [], this._qt);
      if (range && direction) {
        return this._qt.openCursor(range, direction);
      } else if (range) {
        return this._qt.openCursor(range);
      } else if (direction) {
        return this._qt.openCursor(null, direction);
      } else {
        return this._qt.openCursor();
      }
    } catch (err) {
      throw new IDBRequestAttemptError("openCursor", this._qt, err, [range, direction]);
    }
  }
  put(item, key) {
    try {
      LOG_REQUESTS && logRequest("put", [item, key], this._qt);
      if (key) {
        return this._qtStore.put(item, key);
      } else {
        return this._qtStore.put(item);
      }
    } catch (err) {
      throw new IDBRequestAttemptError("put", this._qt, err, [item, key]);
    }
  }
  add(item, key) {
    try {
      LOG_REQUESTS && logRequest("add", [item, key], this._qt);
      if (key) {
        return this._qtStore.add(item, key);
      } else {
        return this._qtStore.add(item);
      }
    } catch (err) {
      throw new IDBRequestAttemptError("add", this._qt, err, [item, key]);
    }
  }
  get(key) {
    try {
      LOG_REQUESTS && logRequest("get", [key], this._qt);
      return this._qt.get(key);
    } catch (err) {
      throw new IDBRequestAttemptError("get", this._qt, err, [key]);
    }
  }
  getKey(key) {
    try {
      LOG_REQUESTS && logRequest("getKey", [key], this._qt);
      return this._qt.getKey(key);
    } catch (err) {
      throw new IDBRequestAttemptError("getKey", this._qt, err, [key]);
    }
  }
  delete(key) {
    try {
      LOG_REQUESTS && logRequest("delete", [key], this._qt);
      return this._qtStore.delete(key);
    } catch (err) {
      throw new IDBRequestAttemptError("delete", this._qt, err, [key]);
    }
  }
  count(keyRange) {
    try {
      if (keyRange) {
        return this._qt.count(keyRange);
      } else {
        return this._qt.count();
      }
    } catch (err) {
      throw new IDBRequestAttemptError("count", this._qt, err, [keyRange]);
    }
  }
  index(name) {
    try {
      return this._qtStore.index(name);
    } catch (err) {
      throw new IDBRequestAttemptError("index", this._qt, err, [name]);
    }
  }
  get indexNames() {
    return Array.from(this._qtStore.indexNames);
  }
}
class Store extends QueryTarget {
  constructor(idbStore, transaction) {
    super(new QueryTargetWrapper(idbStore), transaction);
  }
  get _idbStore() {
    return this._target;
  }
  index(indexName) {
    return new QueryTarget(new QueryTargetWrapper(this._idbStore.index(indexName)), this._transaction);
  }
  put(value, log) {
    const request = this._idbStore.put(value);
    this._prepareErrorLog(request, log, "put", void 0, value);
  }
  add(value, log) {
    const request = this._idbStore.add(value);
    this._prepareErrorLog(request, log, "add", void 0, value);
  }
  async tryAdd(value, log) {
    try {
      await reqAsPromise(this._idbStore.add(value));
      return true;
    } catch (err) {
      if (err instanceof IDBRequestError) {
        log.log({ l: "could not write", id: this._getKeys(value), e: err }, log.level.Warn);
        err.preventTransactionAbort();
        return false;
      } else {
        throw err;
      }
    }
  }
  delete(keyOrKeyRange, log) {
    const request = this._idbStore.delete(keyOrKeyRange);
    this._prepareErrorLog(request, log, "delete", keyOrKeyRange, void 0);
  }
  _prepareErrorLog(request, log, operationName, key, value) {
    if (log) {
      log.ensureRefId();
    }
    reqAsPromise(request).catch((err) => {
      let keys = void 0;
      if (value) {
        keys = this._getKeys(value);
      } else if (key) {
        keys = [key];
      }
      this._transaction.addWriteError(err, log, operationName, keys);
    });
  }
  _getKeys(value) {
    const keys = [];
    const { keyPath } = this._idbStore;
    try {
      keys.push(this._readKeyPath(value, keyPath));
    } catch (err) {
      console.warn("could not read keyPath", keyPath);
    }
    for (const indexName of this._idbStore.indexNames) {
      try {
        const index = this._idbStore.index(indexName);
        keys.push(this._readKeyPath(value, index.keyPath));
      } catch (err) {
        console.warn("could not read index", indexName);
      }
    }
    return keys;
  }
  _readKeyPath(value, keyPath) {
    if (Array.isArray(keyPath)) {
      let field = value;
      for (const part of keyPath) {
        if (typeof field === "object") {
          field = field[part];
        } else {
          break;
        }
      }
      return field;
    } else {
      return value[keyPath];
    }
  }
}
function stringify(value) {
  return JSON.stringify(encodeValue(value));
}
function parse(value) {
  return decodeValue(JSON.parse(value));
}
function encodeValue(value) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    if (value.byteLength) {
      return { _type: value.constructor.name, value: Array.from(value) };
    }
    let newObj = {};
    for (const prop in value) {
      if (value.hasOwnProperty(prop)) {
        newObj[prop] = encodeValue(value[prop]);
      }
    }
    return newObj;
  } else {
    return value;
  }
}
function decodeValue(value) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    if (typeof value._type === "string") {
      switch (value._type) {
        case "Int8Array":
          return Int8Array.from(value.value);
        case "Uint8Array":
          return Uint8Array.from(value.value);
        case "Uint8ClampedArray":
          return Uint8ClampedArray.from(value.value);
        case "Int16Array":
          return Int16Array.from(value.value);
        case "Uint16Array":
          return Uint16Array.from(value.value);
        case "Int32Array":
          return Int32Array.from(value.value);
        case "Uint32Array":
          return Uint32Array.from(value.value);
        case "Float32Array":
          return Float32Array.from(value.value);
        case "Float64Array":
          return Float64Array.from(value.value);
        case "BigInt64Array":
          return BigInt64Array.from(value.value);
        case "BigUint64Array":
          return BigUint64Array.from(value.value);
        default:
          return value.value;
      }
    }
    let newObj = {};
    for (const prop in value) {
      if (value.hasOwnProperty(prop)) {
        newObj[prop] = decodeValue(value[prop]);
      }
    }
    return newObj;
  } else {
    return value;
  }
}
function getLocalStorageKeyPrefix(databaseName) {
  return `${databaseName}.session.`;
}
function clearKeysFromLocalStorage(localStorage2, databaseName) {
  const keys = [];
  for (let i = 0; i < localStorage2.length; i++) {
    const key = localStorage2.key(i);
    if (key == null ? void 0 : key.startsWith(getLocalStorageKeyPrefix(databaseName))) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    localStorage2.removeItem(key);
  }
}
class SessionStore {
  constructor(sessionStore, localStorage2) {
    this._sessionStore = sessionStore;
    this._localStorage = localStorage2;
  }
  get _localStorageKeyPrefix() {
    return getLocalStorageKeyPrefix(this._sessionStore.databaseName);
  }
  async get(key) {
    const entry = await this._sessionStore.get(key);
    if (entry) {
      return entry.value;
    }
  }
  _writeKeyToLocalStorage(key, value) {
    try {
      const lsKey = this._localStorageKeyPrefix + key;
      const lsValue = stringify(value);
      this._localStorage.setItem(lsKey, lsValue);
    } catch (err) {
      console.error("could not write to localStorage", err);
    }
  }
  writeE2EEIdentityToLocalStorage() {
    this._sessionStore.iterateValues(void 0, (entry, key) => {
      if (key.startsWith(SESSION_E2EE_KEY_PREFIX)) {
        this._writeKeyToLocalStorage(key, entry.value);
      }
      return false;
    });
  }
  async tryRestoreE2EEIdentityFromLocalStorage(log) {
    let success = false;
    const lsPrefix = this._localStorageKeyPrefix;
    const prefix = lsPrefix + SESSION_E2EE_KEY_PREFIX;
    for (let i = 0; i < this._localStorage.length; i += 1) {
      const lsKey = this._localStorage.key(i);
      if (lsKey.startsWith(prefix)) {
        const value = parse(this._localStorage.getItem(lsKey));
        const key = lsKey.substr(lsPrefix.length);
        const hasKey = await this._sessionStore.getKey(key) === key;
        log.set(key, !hasKey);
        if (!hasKey) {
          this._sessionStore.put({ key, value });
          success = true;
        }
      }
    }
    return success;
  }
  set(key, value) {
    if (key.startsWith(SESSION_E2EE_KEY_PREFIX)) {
      this._writeKeyToLocalStorage(key, value);
    }
    this._sessionStore.put({ key, value });
  }
  add(key, value) {
    if (key.startsWith(SESSION_E2EE_KEY_PREFIX)) {
      this._writeKeyToLocalStorage(key, value);
    }
    this._sessionStore.add({ key, value });
  }
  remove(key) {
    if (key.startsWith(SESSION_E2EE_KEY_PREFIX)) {
      this._localStorage.removeItem(this._localStorageKeyPrefix + key);
    }
    this._sessionStore.delete(key);
  }
}
class RoomSummaryStore {
  constructor(summaryStore) {
    this._summaryStore = summaryStore;
  }
  getAll() {
    return this._summaryStore.selectAll();
  }
  set(summary) {
    this._summaryStore.put(summary);
  }
  get(roomId) {
    return this._summaryStore.get(roomId);
  }
  async has(roomId) {
    const fetchedKey = await this._summaryStore.getKey(roomId);
    return roomId === fetchedKey;
  }
  remove(roomId) {
    this._summaryStore.delete(roomId);
  }
}
class InviteStore {
  constructor(inviteStore) {
    this._inviteStore = inviteStore;
  }
  getAll() {
    return this._inviteStore.selectAll();
  }
  set(invite) {
    this._inviteStore.put(invite);
  }
  remove(roomId) {
    this._inviteStore.delete(roomId);
  }
}
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["All"] = 1] = "All";
  LogLevel2[LogLevel2["Debug"] = 2] = "Debug";
  LogLevel2[LogLevel2["Detail"] = 3] = "Detail";
  LogLevel2[LogLevel2["Info"] = 4] = "Info";
  LogLevel2[LogLevel2["Warn"] = 5] = "Warn";
  LogLevel2[LogLevel2["Error"] = 6] = "Error";
  LogLevel2[LogLevel2["Fatal"] = 7] = "Fatal";
  LogLevel2[LogLevel2["Off"] = 8] = "Off";
  return LogLevel2;
})(LogLevel || {});
class LogFilter {
  constructor(parentFilter) {
    this._parentFilter = parentFilter;
  }
  filter(item, children) {
    if (this._parentFilter) {
      if (!this._parentFilter.filter(item, children)) {
        return false;
      }
    }
    if (this._min !== void 0 && !Array.isArray(children) && item.logLevel < this._min) {
      return false;
    } else {
      return true;
    }
  }
  minLevel(logLevel) {
    this._min = logLevel;
    return this;
  }
}
function noop() {
}
class NullLogger {
  constructor() {
    this.item = new NullLogItem(this);
  }
  log() {
  }
  run(_, callback) {
    return callback(this.item);
  }
  wrapOrRun(item, _, callback) {
    if (item) {
      return item.wrap(_, callback);
    } else {
      return this.run(_, callback);
    }
  }
  runDetached(_, callback) {
    new Promise((r) => r(callback(this.item))).then(noop, noop);
    return this.item;
  }
  async export() {
    return void 0;
  }
  get level() {
    return LogLevel;
  }
}
class NullLogItem {
  constructor(logger) {
    this.logger = logger;
  }
  wrap(_, callback) {
    return callback(this);
  }
  log() {
    return this;
  }
  set() {
    return this;
  }
  runDetached(_, callback) {
    new Promise((r) => r(callback(this))).then(noop, noop);
    return this;
  }
  wrapDetached(_, _callback) {
    return this.refDetached();
  }
  refDetached() {
  }
  ensureRefId() {
  }
  get level() {
    return LogLevel;
  }
  get duration() {
    return 0;
  }
  catch(err) {
    return err;
  }
  child() {
    return this;
  }
  finish() {
  }
  serialize() {
    return void 0;
  }
}
const Instance = new NullLogger();
function encodeKey$9(roomId, fragmentId, eventIndex) {
  return `${roomId}|${encodeUint32(fragmentId)}|${encodeUint32(eventIndex)}`;
}
function decodeKey$5(key) {
  const [roomId, fragmentId, eventIndex] = key.split("|");
  return { roomId, eventKey: new EventKey(decodeUint32(fragmentId), decodeUint32(eventIndex)) };
}
function encodeEventIdKey(roomId, eventId) {
  return `${roomId}|${eventId}`;
}
function decodeEventIdKey(eventIdKey) {
  const [roomId, eventId] = eventIdKey.split("|");
  return { roomId, eventId };
}
class Range$1 {
  constructor(_IDBKeyRange, only, lower, upper, lowerOpen = false, upperOpen = false) {
    this._IDBKeyRange = _IDBKeyRange;
    this._only = only;
    this._lower = lower;
    this._upper = upper;
    this._lowerOpen = lowerOpen;
    this._upperOpen = upperOpen;
  }
  asIDBKeyRange(roomId) {
    try {
      if (this._only) {
        return this._IDBKeyRange.only(encodeKey$9(roomId, this._only.fragmentId, this._only.eventIndex));
      }
      if (this._lower && !this._upper) {
        return this._IDBKeyRange.bound(encodeKey$9(roomId, this._lower.fragmentId, this._lower.eventIndex), encodeKey$9(roomId, this._lower.fragmentId, KeyLimits.maxStorageKey), this._lowerOpen, false);
      }
      if (!this._lower && this._upper) {
        return this._IDBKeyRange.bound(encodeKey$9(roomId, this._upper.fragmentId, KeyLimits.minStorageKey), encodeKey$9(roomId, this._upper.fragmentId, this._upper.eventIndex), false, this._upperOpen);
      }
      if (this._lower && this._upper) {
        return this._IDBKeyRange.bound(encodeKey$9(roomId, this._lower.fragmentId, this._lower.eventIndex), encodeKey$9(roomId, this._upper.fragmentId, this._upper.eventIndex), this._lowerOpen, this._upperOpen);
      }
    } catch (err) {
      throw new StorageError(`IDBKeyRange failed with data: ` + JSON.stringify(this), err);
    }
  }
}
class TimelineEventStore {
  constructor(timelineStore) {
    this._timelineStore = timelineStore;
  }
  onlyRange(eventKey) {
    return new Range$1(this._timelineStore.IDBKeyRange, eventKey);
  }
  upperBoundRange(eventKey, open = false) {
    return new Range$1(this._timelineStore.IDBKeyRange, void 0, void 0, eventKey, void 0, open);
  }
  lowerBoundRange(eventKey, open = false) {
    return new Range$1(this._timelineStore.IDBKeyRange, void 0, eventKey, void 0, open);
  }
  boundRange(lower, upper, lowerOpen = false, upperOpen = false) {
    return new Range$1(this._timelineStore.IDBKeyRange, void 0, lower, upper, lowerOpen, upperOpen);
  }
  async lastEvents(roomId, fragmentId, amount) {
    const eventKey = EventKey.maxKey;
    eventKey.fragmentId = fragmentId;
    return this.eventsBefore(roomId, eventKey, amount);
  }
  async firstEvents(roomId, fragmentId, amount) {
    const eventKey = EventKey.minKey;
    eventKey.fragmentId = fragmentId;
    return this.eventsAfter(roomId, eventKey, amount);
  }
  eventsAfter(roomId, eventKey, amount) {
    const idbRange = this.lowerBoundRange(eventKey, true).asIDBKeyRange(roomId);
    return this._timelineStore.selectLimit(idbRange, amount);
  }
  async eventsBefore(roomId, eventKey, amount) {
    const range = this.upperBoundRange(eventKey, true).asIDBKeyRange(roomId);
    const events = await this._timelineStore.selectLimitReverse(range, amount);
    events.reverse();
    return events;
  }
  async getEventKeysForIds(roomId, eventIds) {
    const byEventId = this._timelineStore.index("byEventId");
    const keys = eventIds.map((eventId) => encodeEventIdKey(roomId, eventId));
    const results = /* @__PURE__ */ new Map();
    await byEventId.findExistingKeys(keys, false, (indexKey, pk) => {
      const { eventId } = decodeEventIdKey(indexKey);
      const { eventKey } = decodeKey$5(pk);
      results.set(eventId, eventKey);
      return false;
    });
    return results;
  }
  async findFirstOccurringEventId(roomId, eventIds) {
    const byEventId = this._timelineStore.index("byEventId");
    const keys = eventIds.map((eventId) => encodeEventIdKey(roomId, eventId));
    const results = new Array(keys.length);
    let firstFoundKey;
    function firstFoundAndPrecedingResolved() {
      for (let i = 0; i < results.length; ++i) {
        if (results[i] === void 0) {
          return;
        } else if (results[i] === true) {
          return keys[i];
        }
      }
    }
    await byEventId.findExistingKeys(keys, false, (key, found) => {
      const index = keys.indexOf(key);
      results[index] = found;
      firstFoundKey = firstFoundAndPrecedingResolved();
      return !!firstFoundKey;
    });
    return firstFoundKey && decodeEventIdKey(firstFoundKey).eventId;
  }
  tryInsert(entry, log) {
    entry.key = encodeKey$9(entry.roomId, entry.fragmentId, entry.eventIndex);
    entry.eventIdKey = encodeEventIdKey(entry.roomId, entry.event.event_id);
    return this._timelineStore.tryAdd(entry, log);
  }
  update(entry) {
    this._timelineStore.put(entry);
  }
  get(roomId, eventKey) {
    return this._timelineStore.get(encodeKey$9(roomId, eventKey.fragmentId, eventKey.eventIndex));
  }
  getByEventId(roomId, eventId) {
    return this._timelineStore.index("byEventId").get(encodeEventIdKey(roomId, eventId));
  }
  removeAllForRoom(roomId) {
    const minKey = encodeKey$9(roomId, KeyLimits.minStorageKey, KeyLimits.minStorageKey);
    const maxKey = encodeKey$9(roomId, KeyLimits.maxStorageKey, KeyLimits.maxStorageKey);
    const range = this._timelineStore.IDBKeyRange.bound(minKey, maxKey);
    this._timelineStore.delete(range);
  }
}
const MIN_UNICODE = "\0";
const MAX_UNICODE = "\u{10FFFF}";
function encodeKey$8(roomId, targetEventId, relType, sourceEventId) {
  return `${roomId}|${targetEventId}|${relType}|${sourceEventId}`;
}
function decodeKey$4(key) {
  const [roomId, targetEventId, relType, sourceEventId] = key.split("|");
  return { roomId, targetEventId, relType, sourceEventId };
}
class TimelineRelationStore {
  constructor(store) {
    this._store = store;
  }
  add(roomId, targetEventId, relType, sourceEventId) {
    this._store.add({ key: encodeKey$8(roomId, targetEventId, relType, sourceEventId) });
  }
  remove(roomId, targetEventId, relType, sourceEventId) {
    this._store.delete(encodeKey$8(roomId, targetEventId, relType, sourceEventId));
  }
  removeAllForTarget(roomId, targetId) {
    const range = this._store.IDBKeyRange.bound(encodeKey$8(roomId, targetId, MIN_UNICODE, MIN_UNICODE), encodeKey$8(roomId, targetId, MAX_UNICODE, MAX_UNICODE), true, true);
    this._store.delete(range);
  }
  removeAllForRoom(roomId) {
    const range = this._store.IDBKeyRange.bound(encodeKey$8(roomId, MIN_UNICODE, MIN_UNICODE, MIN_UNICODE), encodeKey$8(roomId, MAX_UNICODE, MAX_UNICODE, MAX_UNICODE), true, true);
    this._store.delete(range);
  }
  async getForTargetAndType(roomId, targetId, relType) {
    const range = this._store.IDBKeyRange.bound(encodeKey$8(roomId, targetId, relType, MIN_UNICODE), encodeKey$8(roomId, targetId, relType, MAX_UNICODE), true, true);
    const items = await this._store.selectAll(range);
    return items.map((i) => decodeKey$4(i.key));
  }
  async getAllForTarget(roomId, targetId) {
    const range = this._store.IDBKeyRange.bound(encodeKey$8(roomId, targetId, MIN_UNICODE, MIN_UNICODE), encodeKey$8(roomId, targetId, MAX_UNICODE, MAX_UNICODE), true, true);
    const items = await this._store.selectAll(range);
    return items.map((i) => decodeKey$4(i.key));
  }
}
function encodeKey$7(roomId, eventType, stateKey) {
  return `${roomId}|${eventType}|${stateKey}`;
}
class RoomStateStore {
  constructor(idbStore) {
    this._roomStateStore = idbStore;
  }
  get(roomId, type, stateKey) {
    const key = encodeKey$7(roomId, type, stateKey);
    return this._roomStateStore.get(key);
  }
  set(roomId, event2) {
    const key = encodeKey$7(roomId, event2.type, event2.state_key);
    const entry = { roomId, event: event2, key };
    this._roomStateStore.put(entry);
  }
  removeAllForRoom(roomId) {
    const range = this._roomStateStore.IDBKeyRange.bound(roomId, `${roomId}|${MAX_UNICODE}`, true, true);
    this._roomStateStore.delete(range);
  }
}
function encodeKey$6(roomId, userId) {
  return `${roomId}|${userId}`;
}
function decodeKey$3(key) {
  const [roomId, userId] = key.split("|");
  return { roomId, userId };
}
class RoomMemberStore {
  constructor(roomMembersStore) {
    this._roomMembersStore = roomMembersStore;
  }
  get(roomId, userId) {
    return this._roomMembersStore.get(encodeKey$6(roomId, userId));
  }
  set(member) {
    member.key = encodeKey$6(member.roomId, member.userId);
    this._roomMembersStore.put(member);
  }
  getAll(roomId) {
    const range = this._roomMembersStore.IDBKeyRange.lowerBound(encodeKey$6(roomId, ""));
    return this._roomMembersStore.selectWhile(range, (member) => {
      return member.roomId === roomId;
    });
  }
  async getAllUserIds(roomId) {
    const userIds = [];
    const range = this._roomMembersStore.IDBKeyRange.lowerBound(encodeKey$6(roomId, ""));
    await this._roomMembersStore.iterateKeys(range, (key) => {
      const decodedKey = decodeKey$3(key);
      if (decodedKey.roomId === roomId) {
        userIds.push(decodedKey.userId);
        return false;
      }
      return true;
    });
    return userIds;
  }
  removeAllForRoom(roomId) {
    const range = this._roomMembersStore.IDBKeyRange.bound(roomId, `${roomId}|${MAX_UNICODE}`, true, true);
    this._roomMembersStore.delete(range);
  }
}
function encodeKey$5(roomId, fragmentId) {
  return `${roomId}|${encodeUint32(fragmentId)}`;
}
class TimelineFragmentStore {
  constructor(store) {
    this._store = store;
  }
  _allRange(roomId) {
    try {
      return this._store.IDBKeyRange.bound(encodeKey$5(roomId, KeyLimits.minStorageKey), encodeKey$5(roomId, KeyLimits.maxStorageKey));
    } catch (err) {
      throw new StorageError(`error from IDBKeyRange with roomId ${roomId}`, err);
    }
  }
  all(roomId) {
    return this._store.selectAll(this._allRange(roomId));
  }
  liveFragment(roomId) {
    return this._store.findReverse(this._allRange(roomId), (fragment) => {
      return typeof fragment.nextId !== "number" && typeof fragment.nextToken !== "string";
    });
  }
  add(fragment) {
    fragment.key = encodeKey$5(fragment.roomId, fragment.id);
    this._store.add(fragment);
  }
  update(fragment) {
    this._store.put(fragment);
  }
  get(roomId, fragmentId) {
    return this._store.get(encodeKey$5(roomId, fragmentId));
  }
  removeAllForRoom(roomId) {
    this._store.delete(this._allRange(roomId));
  }
}
function encodeKey$4(roomId, queueIndex) {
  return `${roomId}|${encodeUint32(queueIndex)}`;
}
function decodeKey$2(key) {
  const [roomId, encodedQueueIndex] = key.split("|");
  const queueIndex = decodeUint32(encodedQueueIndex);
  return { roomId, queueIndex };
}
class PendingEventStore {
  constructor(eventStore) {
    this._eventStore = eventStore;
  }
  async getMaxQueueIndex(roomId) {
    const range = this._eventStore.IDBKeyRange.bound(encodeKey$4(roomId, KeyLimits.minStorageKey), encodeKey$4(roomId, KeyLimits.maxStorageKey), false, false);
    const maxKey = await this._eventStore.findMaxKey(range);
    if (maxKey) {
      return decodeKey$2(maxKey).queueIndex;
    }
  }
  remove(roomId, queueIndex) {
    const keyRange = this._eventStore.IDBKeyRange.only(encodeKey$4(roomId, queueIndex));
    this._eventStore.delete(keyRange);
  }
  async exists(roomId, queueIndex) {
    const keyRange = this._eventStore.IDBKeyRange.only(encodeKey$4(roomId, queueIndex));
    const key = await this._eventStore.getKey(keyRange);
    return !!key;
  }
  add(pendingEvent) {
    pendingEvent.key = encodeKey$4(pendingEvent.roomId, pendingEvent.queueIndex);
    this._eventStore.add(pendingEvent);
  }
  update(pendingEvent) {
    this._eventStore.put(pendingEvent);
  }
  getAll() {
    return this._eventStore.selectAll();
  }
  removeAllForRoom(roomId) {
    const minKey = encodeKey$4(roomId, KeyLimits.minStorageKey);
    const maxKey = encodeKey$4(roomId, KeyLimits.maxStorageKey);
    const range = this._eventStore.IDBKeyRange.bound(minKey, maxKey);
    this._eventStore.delete(range);
  }
}
class UserIdentityStore {
  constructor(store) {
    this._store = store;
  }
  get(userId) {
    return this._store.get(userId);
  }
  set(userIdentity) {
    this._store.put(userIdentity);
  }
  remove(userId) {
    this._store.delete(userId);
  }
}
function encodeKey$3(userId, deviceId) {
  return `${userId}|${deviceId}`;
}
function decodeKey$1(key) {
  const [userId, deviceId] = key.split("|");
  return { userId, deviceId };
}
class DeviceIdentityStore {
  constructor(store) {
    this._store = store;
  }
  getAllForUserId(userId) {
    const range = this._store.IDBKeyRange.lowerBound(encodeKey$3(userId, ""));
    return this._store.selectWhile(range, (device) => {
      return device.userId === userId;
    });
  }
  async getAllDeviceIds(userId) {
    const deviceIds = [];
    const range = this._store.IDBKeyRange.lowerBound(encodeKey$3(userId, ""));
    await this._store.iterateKeys(range, (key) => {
      const decodedKey = decodeKey$1(key);
      if (decodedKey.userId === userId) {
        deviceIds.push(decodedKey.deviceId);
        return false;
      }
      return true;
    });
    return deviceIds;
  }
  get(userId, deviceId) {
    return this._store.get(encodeKey$3(userId, deviceId));
  }
  set(deviceIdentity) {
    deviceIdentity.key = encodeKey$3(deviceIdentity.userId, deviceIdentity.deviceId);
    this._store.put(deviceIdentity);
  }
  getByCurve25519Key(curve25519Key) {
    return this._store.index("byCurve25519Key").get(curve25519Key);
  }
  remove(userId, deviceId) {
    this._store.delete(encodeKey$3(userId, deviceId));
  }
  removeAllForUser(userId) {
    const range = this._store.IDBKeyRange.bound(encodeKey$3(userId, MIN_UNICODE), encodeKey$3(userId, MAX_UNICODE), true, true);
    this._store.delete(range);
  }
}
function encodeKey$2(senderKey, sessionId) {
  return `${senderKey}|${sessionId}`;
}
function decodeKey(key) {
  const [senderKey, sessionId] = key.split("|");
  return { senderKey, sessionId };
}
class OlmSessionStore {
  constructor(store) {
    this._store = store;
  }
  async getSessionIds(senderKey) {
    const sessionIds = [];
    const range = this._store.IDBKeyRange.lowerBound(encodeKey$2(senderKey, ""));
    await this._store.iterateKeys(range, (key) => {
      const decodedKey = decodeKey(key);
      if (decodedKey.senderKey === senderKey) {
        sessionIds.push(decodedKey.sessionId);
        return false;
      }
      return true;
    });
    return sessionIds;
  }
  getAll(senderKey) {
    const range = this._store.IDBKeyRange.lowerBound(encodeKey$2(senderKey, ""));
    return this._store.selectWhile(range, (session) => {
      return session.senderKey === senderKey;
    });
  }
  get(senderKey, sessionId) {
    return this._store.get(encodeKey$2(senderKey, sessionId));
  }
  set(session) {
    session.key = encodeKey$2(session.senderKey, session.sessionId);
    this._store.put(session);
  }
  remove(senderKey, sessionId) {
    this._store.delete(encodeKey$2(senderKey, sessionId));
  }
}
var BackupStatus = /* @__PURE__ */ ((BackupStatus2) => {
  BackupStatus2[BackupStatus2["NotBackedUp"] = 0] = "NotBackedUp";
  BackupStatus2[BackupStatus2["BackedUp"] = 1] = "BackedUp";
  return BackupStatus2;
})(BackupStatus || {});
var KeySource = /* @__PURE__ */ ((KeySource2) => {
  KeySource2[KeySource2["DeviceMessage"] = 1] = "DeviceMessage";
  KeySource2[KeySource2["Backup"] = 2] = "Backup";
  KeySource2[KeySource2["Outbound"] = 3] = "Outbound";
  return KeySource2;
})(KeySource || {});
function encodeKey$1(roomId, senderKey, sessionId) {
  return `${roomId}|${senderKey}|${sessionId}`;
}
class InboundGroupSessionStore {
  constructor(store) {
    this._store = store;
  }
  async has(roomId, senderKey, sessionId) {
    const key = encodeKey$1(roomId, senderKey, sessionId);
    const fetchedKey = await this._store.getKey(key);
    return key === fetchedKey;
  }
  get(roomId, senderKey, sessionId) {
    return this._store.get(encodeKey$1(roomId, senderKey, sessionId));
  }
  set(session) {
    const storageEntry = session;
    storageEntry.key = encodeKey$1(session.roomId, session.senderKey, session.sessionId);
    this._store.put(storageEntry);
  }
  removeAllForRoom(roomId) {
    const range = this._store.IDBKeyRange.bound(encodeKey$1(roomId, MIN_UNICODE, MIN_UNICODE), encodeKey$1(roomId, MAX_UNICODE, MAX_UNICODE));
    this._store.delete(range);
  }
  countNonBackedUpSessions() {
    return this._store.index("byBackup").count(this._store.IDBKeyRange.only(0));
  }
  getFirstNonBackedUpSessions(amount) {
    return this._store.index("byBackup").selectLimit(this._store.IDBKeyRange.only(0), amount);
  }
  async markAsBackedUp(roomId, senderKey, sessionId) {
    const entry = await this._store.get(encodeKey$1(roomId, senderKey, sessionId));
    if (entry) {
      entry.backup = 1;
      this._store.put(entry);
    }
  }
  async markAllAsNotBackedUp() {
    const backedUpKey = this._store.IDBKeyRange.only(1);
    let count = 0;
    await this._store.index("byBackup").iterateValues(backedUpKey, (val, key, cur) => {
      val.backup = 0;
      cur.update(val);
      count += 1;
      return false;
    });
    return count;
  }
}
class OutboundGroupSessionStore {
  constructor(store) {
    this._store = store;
  }
  remove(roomId) {
    this._store.delete(roomId);
  }
  get(roomId) {
    return this._store.get(roomId);
  }
  set(session) {
    this._store.put(session);
  }
}
function encodeKey(roomId, sessionId, messageIndex) {
  return `${roomId}|${sessionId}|${messageIndex}`;
}
class GroupSessionDecryptionStore {
  constructor(store) {
    this._store = store;
  }
  get(roomId, sessionId, messageIndex) {
    return this._store.get(encodeKey(roomId, sessionId, messageIndex));
  }
  set(roomId, sessionId, messageIndex, decryption) {
    decryption.key = encodeKey(roomId, sessionId, messageIndex);
    this._store.put(decryption);
  }
  removeAllForRoom(roomId) {
    const range = this._store.IDBKeyRange.bound(encodeKey(roomId, MIN_UNICODE, MIN_UNICODE), encodeKey(roomId, MAX_UNICODE, MAX_UNICODE));
    this._store.delete(range);
  }
}
function encodeScopeTypeKey(scope, type) {
  return `${scope}|${type}`;
}
class OperationStore {
  constructor(store) {
    this._store = store;
  }
  getAll() {
    return this._store.selectAll();
  }
  async getAllByTypeAndScope(type, scope) {
    const key = encodeScopeTypeKey(scope, type);
    const results = [];
    await this._store.index("byScopeAndType").iterateWhile(key, (value) => {
      if (value.scopeTypeKey !== key) {
        return false;
      }
      results.push(value);
      return true;
    });
    return results;
  }
  add(operation) {
    operation.scopeTypeKey = encodeScopeTypeKey(operation.scope, operation.type);
    this._store.add(operation);
  }
  update(operation) {
    this._store.put(operation);
  }
  remove(id) {
    this._store.delete(id);
  }
  async removeAllForScope(scope) {
    const range = this._store.IDBKeyRange.bound(encodeScopeTypeKey(scope, MIN_UNICODE), encodeScopeTypeKey(scope, MAX_UNICODE));
    const index = this._store.index("byScopeAndType");
    await index.iterateValues(range, (_, __, cur) => {
      cur.delete();
      return true;
    });
    return;
  }
}
class AccountDataStore {
  constructor(store) {
    this._store = store;
  }
  async get(type) {
    return await this._store.get(type);
  }
  set(event2) {
    this._store.put(event2);
  }
}
class WriteErrorInfo {
  constructor(error, refItem, operationName, keys) {
    this.error = error;
    this.refItem = refItem;
    this.operationName = operationName;
    this.keys = keys;
  }
}
class Transaction {
  constructor(txn, allowedStoreNames, storage) {
    this._txn = txn;
    this._allowedStoreNames = allowedStoreNames;
    this._stores = {};
    this._storage = storage;
    this._writeErrors = [];
  }
  get idbFactory() {
    return this._storage.idbFactory;
  }
  get IDBKeyRange() {
    return this._storage.IDBKeyRange;
  }
  get databaseName() {
    return this._storage.databaseName;
  }
  get logger() {
    return this._storage.logger;
  }
  _idbStore(name) {
    if (!this._allowedStoreNames.includes(name)) {
      throw new StorageError(`Invalid store for transaction: ${name}, only ${this._allowedStoreNames.join(", ")} are allowed.`);
    }
    return new Store(this._txn.objectStore(name), this);
  }
  _store(name, mapStore) {
    if (!this._stores[name]) {
      const idbStore = this._idbStore(name);
      this._stores[name] = mapStore(idbStore);
    }
    return this._stores[name];
  }
  get session() {
    return this._store(StoreNames.session, (idbStore) => new SessionStore(idbStore, this._storage.localStorage));
  }
  get roomSummary() {
    return this._store(StoreNames.roomSummary, (idbStore) => new RoomSummaryStore(idbStore));
  }
  get archivedRoomSummary() {
    return this._store(StoreNames.archivedRoomSummary, (idbStore) => new RoomSummaryStore(idbStore));
  }
  get invites() {
    return this._store(StoreNames.invites, (idbStore) => new InviteStore(idbStore));
  }
  get timelineFragments() {
    return this._store(StoreNames.timelineFragments, (idbStore) => new TimelineFragmentStore(idbStore));
  }
  get timelineEvents() {
    return this._store(StoreNames.timelineEvents, (idbStore) => new TimelineEventStore(idbStore));
  }
  get timelineRelations() {
    return this._store(StoreNames.timelineRelations, (idbStore) => new TimelineRelationStore(idbStore));
  }
  get roomState() {
    return this._store(StoreNames.roomState, (idbStore) => new RoomStateStore(idbStore));
  }
  get roomMembers() {
    return this._store(StoreNames.roomMembers, (idbStore) => new RoomMemberStore(idbStore));
  }
  get pendingEvents() {
    return this._store(StoreNames.pendingEvents, (idbStore) => new PendingEventStore(idbStore));
  }
  get userIdentities() {
    return this._store(StoreNames.userIdentities, (idbStore) => new UserIdentityStore(idbStore));
  }
  get deviceIdentities() {
    return this._store(StoreNames.deviceIdentities, (idbStore) => new DeviceIdentityStore(idbStore));
  }
  get olmSessions() {
    return this._store(StoreNames.olmSessions, (idbStore) => new OlmSessionStore(idbStore));
  }
  get inboundGroupSessions() {
    return this._store(StoreNames.inboundGroupSessions, (idbStore) => new InboundGroupSessionStore(idbStore));
  }
  get outboundGroupSessions() {
    return this._store(StoreNames.outboundGroupSessions, (idbStore) => new OutboundGroupSessionStore(idbStore));
  }
  get groupSessionDecryptions() {
    return this._store(StoreNames.groupSessionDecryptions, (idbStore) => new GroupSessionDecryptionStore(idbStore));
  }
  get operations() {
    return this._store(StoreNames.operations, (idbStore) => new OperationStore(idbStore));
  }
  get accountData() {
    return this._store(StoreNames.accountData, (idbStore) => new AccountDataStore(idbStore));
  }
  async complete(log) {
    try {
      await txnAsPromise(this._txn);
    } catch (err) {
      if (this._writeErrors.length) {
        this._logWriteErrors(log);
        throw this._writeErrors[0].error;
      }
      throw err;
    }
  }
  getCause(error) {
    if (error instanceof StorageError) {
      if (error.errcode === "AbortError" && this._writeErrors.length) {
        return this._writeErrors[0].error;
      }
    }
    return error;
  }
  abort(log) {
    try {
      this._txn.abort();
    } catch (abortErr) {
      log == null ? void 0 : log.set("couldNotAbortTxn", true);
    }
    if (this._writeErrors.length) {
      this._logWriteErrors(log);
    }
  }
  addWriteError(error, refItem, operationName, keys) {
    if (error.errcode !== "AbortError" || this._writeErrors.length === 0) {
      this._writeErrors.push(new WriteErrorInfo(error, refItem, operationName, keys));
    }
  }
  _logWriteErrors(parentItem) {
    const callback = (errorGroupItem) => {
      if (!parentItem) {
        errorGroupItem.set("allowedStoreNames", this._allowedStoreNames);
      }
      for (const info of this._writeErrors) {
        errorGroupItem.wrap({ l: info.operationName, id: info.keys }, (item) => {
          if (info.refItem) {
            item.refDetached(info.refItem);
          }
          item.catch(info.error);
        });
      }
    };
    const label = `${this._writeErrors.length} storage write operation(s) failed`;
    if (parentItem) {
      parentItem.wrap(label, callback);
    } else {
      this.logger.run(label, callback);
    }
  }
}
const WEBKITEARLYCLOSETXNBUG_BOGUS_KEY = "782rh281re38-boguskey";
class Storage {
  constructor(idbDatabase, idbFactory, _IDBKeyRange, hasWebkitEarlyCloseTxnBug, localStorage2, logger) {
    this._db = idbDatabase;
    this.idbFactory = idbFactory;
    this.IDBKeyRange = _IDBKeyRange;
    this._hasWebkitEarlyCloseTxnBug = hasWebkitEarlyCloseTxnBug;
    this.storeNames = StoreNames;
    this.localStorage = localStorage2;
    this.logger = logger;
  }
  _validateStoreNames(storeNames) {
    const idx = storeNames.findIndex((name) => !STORE_NAMES.includes(name));
    if (idx !== -1) {
      throw new StorageError(`Tried top, a transaction unknown store ${storeNames[idx]}`);
    }
  }
  async readTxn(storeNames) {
    this._validateStoreNames(storeNames);
    try {
      const txn = this._db.transaction(storeNames, "readonly");
      if (this._hasWebkitEarlyCloseTxnBug) {
        await reqAsPromise(txn.objectStore(storeNames[0]).get(WEBKITEARLYCLOSETXNBUG_BOGUS_KEY));
      }
      return new Transaction(txn, storeNames, this);
    } catch (err) {
      throw new StorageError("readTxn failed", err);
    }
  }
  async readWriteTxn(storeNames) {
    this._validateStoreNames(storeNames);
    try {
      const txn = this._db.transaction(storeNames, "readwrite");
      if (this._hasWebkitEarlyCloseTxnBug) {
        await reqAsPromise(txn.objectStore(storeNames[0]).get(WEBKITEARLYCLOSETXNBUG_BOGUS_KEY));
      }
      return new Transaction(txn, storeNames, this);
    } catch (err) {
      throw new StorageError("readWriteTxn failed", err);
    }
  }
  close() {
    this._db.close();
  }
  get databaseName() {
    return this._db.name;
  }
}
async function exportSession(db) {
  const txn = db.transaction(STORE_NAMES, "readonly");
  const data = {};
  await Promise.all(STORE_NAMES.map(async (name) => {
    const results = data[name] = [];
    const store = txn.objectStore(name);
    await iterateCursor(store.openCursor(), (value) => {
      results.push(value);
      return NOT_DONE;
    });
  }));
  return data;
}
async function importSession(db, data) {
  const txn = db.transaction(STORE_NAMES, "readwrite");
  for (const name of STORE_NAMES) {
    const store = txn.objectStore(name);
    for (const value of data[name]) {
      store.add(value);
    }
  }
  await txnAsPromise(txn);
}
const schema = [
  createInitialStores,
  createMemberStore,
  migrateSession,
  createE2EEStores,
  migrateEncryptionFlag,
  createAccountDataStore,
  createInviteStore,
  createArchivedRoomSummaryStore,
  migrateOperationScopeIndex,
  createTimelineRelationsStore,
  fixMissingRoomsInUserIdentities,
  changeSSSSKeyPrefix,
  backupAndRestoreE2EEAccountToLocalStorage,
  clearAllStores,
  addInboundSessionBackupIndex,
  migrateBackupStatus
];
function createDatabaseNameHelper(db) {
  const databaseNameHelper = {
    databaseName: db.name,
    get idbFactory() {
      throw new Error("unused");
    },
    get IDBKeyRange() {
      throw new Error("unused");
    },
    addWriteError() {
    }
  };
  return databaseNameHelper;
}
function createInitialStores(db) {
  db.createObjectStore("session", { keyPath: "key" });
  db.createObjectStore("roomSummary", { keyPath: "roomId" });
  db.createObjectStore("timelineFragments", { keyPath: "key" });
  const timelineEvents = db.createObjectStore("timelineEvents", { keyPath: "key" });
  timelineEvents.createIndex("byEventId", "eventIdKey", { unique: true });
  db.createObjectStore("roomState", { keyPath: "key" });
  db.createObjectStore("pendingEvents", { keyPath: "key" });
}
async function createMemberStore(db, txn) {
  const roomMembers = new RoomMemberStore(db.createObjectStore("roomMembers", { keyPath: "key" }));
  const roomState = txn.objectStore("roomState");
  await iterateCursor(roomState.openCursor(), (entry) => {
    if (entry.event.type === EVENT_TYPE$1) {
      roomState.delete(entry.key);
      const member = RoomMember.fromMemberEvent(entry.roomId, entry.event);
      if (member) {
        roomMembers.set(member.serialize());
      }
    }
    return NOT_DONE;
  });
}
async function migrateSession(db, txn, localStorage2) {
  const session = txn.objectStore("session");
  try {
    const PRE_MIGRATION_KEY = 1;
    const entry = await reqAsPromise(session.get(PRE_MIGRATION_KEY));
    if (entry) {
      session.delete(PRE_MIGRATION_KEY);
      const { syncToken, syncFilterId, serverVersions } = entry.value;
      const store = new SessionStore(session, localStorage2);
      store.set("sync", { token: syncToken, filterId: syncFilterId });
      store.set("serverVersions", serverVersions);
    }
  } catch (err) {
    txn.abort();
    console.error("could not migrate session", err.stack);
  }
}
function createE2EEStores(db) {
  db.createObjectStore("userIdentities", { keyPath: "userId" });
  const deviceIdentities = db.createObjectStore("deviceIdentities", { keyPath: "key" });
  deviceIdentities.createIndex("byCurve25519Key", "curve25519Key", { unique: true });
  db.createObjectStore("olmSessions", { keyPath: "key" });
  db.createObjectStore("inboundGroupSessions", { keyPath: "key" });
  db.createObjectStore("outboundGroupSessions", { keyPath: "roomId" });
  db.createObjectStore("groupSessionDecryptions", { keyPath: "key" });
  const operations = db.createObjectStore("operations", { keyPath: "id" });
  operations.createIndex("byTypeAndScope", "typeScopeKey", { unique: false });
}
async function migrateEncryptionFlag(db, txn) {
  var _a;
  const roomSummary = txn.objectStore("roomSummary");
  const roomState = txn.objectStore("roomState");
  const summaries = [];
  await iterateCursor(roomSummary.openCursor(), (summary) => {
    summaries.push(summary);
    return NOT_DONE;
  });
  for (const summary of summaries) {
    const encryptionEntry = await reqAsPromise(roomState.get(`${summary.roomId}|m.room.encryption|`));
    if (encryptionEntry) {
      summary.encryption = (_a = encryptionEntry == null ? void 0 : encryptionEntry.event) == null ? void 0 : _a.content;
      delete summary.isEncrypted;
      roomSummary.put(summary);
    }
  }
}
function createAccountDataStore(db) {
  db.createObjectStore("accountData", { keyPath: "type" });
}
function createInviteStore(db) {
  db.createObjectStore("invites", { keyPath: "roomId" });
}
function createArchivedRoomSummaryStore(db) {
  db.createObjectStore("archivedRoomSummary", { keyPath: "summary.roomId" });
}
async function migrateOperationScopeIndex(db, txn) {
  try {
    const operations = txn.objectStore("operations");
    operations.deleteIndex("byTypeAndScope");
    await iterateCursor(operations.openCursor(), (op, key, cur) => {
      const { typeScopeKey } = op;
      delete op.typeScopeKey;
      const [type, scope] = typeScopeKey.split("|");
      op.scopeTypeKey = encodeScopeTypeKey(scope, type);
      cur.update(op);
      return NOT_DONE;
    });
    operations.createIndex("byScopeAndType", "scopeTypeKey", { unique: false });
  } catch (err) {
    txn.abort();
    console.error("could not migrate operations", err.stack);
  }
}
function createTimelineRelationsStore(db) {
  db.createObjectStore("timelineRelations", { keyPath: "key" });
}
function fixMissingRoomsInUserIdentities() {
}
async function changeSSSSKeyPrefix(db, txn) {
  const session = txn.objectStore("session");
  const ssssKey = await reqAsPromise(session.get("ssssKey"));
  if (ssssKey) {
    session.put({ key: `${SESSION_E2EE_KEY_PREFIX}ssssKey`, value: ssssKey.value });
  }
}
async function backupAndRestoreE2EEAccountToLocalStorage(db, txn, localStorage2, log) {
  const session = txn.objectStore("session");
  const sessionStore = new SessionStore(new Store(session, createDatabaseNameHelper(db)), localStorage2);
  sessionStore.writeE2EEIdentityToLocalStorage();
  const restored = await sessionStore.tryRestoreE2EEIdentityFromLocalStorage(log);
  log.set("restored", restored);
}
async function clearAllStores(db, txn) {
  for (const storeName of Array.from(db.objectStoreNames)) {
    const store = txn.objectStore(storeName);
    switch (storeName) {
      case "inboundGroupSessions":
      case "outboundGroupSessions":
      case "olmSessions":
      case "operations":
        continue;
      case "session": {
        await iterateCursor(store.openCursor(), (value, key, cursor) => {
          if (!key.startsWith(SESSION_E2EE_KEY_PREFIX)) {
            cursor.delete();
          }
          return NOT_DONE;
        });
        break;
      }
      default: {
        store.clear();
        break;
      }
    }
  }
}
async function addInboundSessionBackupIndex(db, txn, localStorage2, log) {
  const inboundGroupSessions = txn.objectStore("inboundGroupSessions");
  inboundGroupSessions.createIndex("byBackup", "backup", { unique: false });
}
async function migrateBackupStatus(db, txn, localStorage2, log) {
  const inboundGroupSessions = txn.objectStore("inboundGroupSessions");
  let countWithSession = 0;
  let countWithoutSession = 0;
  await iterateCursor(inboundGroupSessions.openCursor(), (value, key, cursor) => {
    if (value.session) {
      value.backup = BackupStatus.NotBackedUp;
      value.source = KeySource.DeviceMessage;
      cursor.update(value);
      countWithSession += 1;
    } else {
      countWithoutSession += 1;
    }
    return NOT_DONE;
  });
  log.set("countWithoutSession", countWithoutSession);
  log.set("countWithSession", countWithSession);
}
async function detectWebkitEarlyCloseTxnBug(idbFactory) {
  const dbName = "hydrogen_webkit_test_inactive_txn_bug";
  try {
    const db = await openDatabase(dbName, (db2) => {
      db2.createObjectStore("test", { keyPath: "key" });
    }, 1, idbFactory);
    const readTxn = db.transaction(["test"], "readonly");
    await reqAsPromise(readTxn.objectStore("test").get("somekey"));
    await new Promise((r) => setTimeout(r, 0));
    const writeTxn = db.transaction(["test"], "readwrite");
    await Promise.resolve();
    writeTxn.objectStore("test").add({ key: "somekey", value: "foo" });
    await txnAsPromise(writeTxn);
    db.close();
  } catch (err) {
    if (err.name === "TransactionInactiveError") {
      return true;
    }
  }
  return false;
}
const sessionName = (sessionId) => `hydrogen_session_${sessionId}`;
const openDatabaseWithSessionId = function(sessionId, idbFactory, localStorage2, log) {
  const create2 = (db, txn, oldVersion, version) => createStores(db, txn, oldVersion, version, localStorage2, log);
  return openDatabase(sessionName(sessionId), create2, schema.length, idbFactory);
};
async function requestPersistedStorage() {
  var _a, _b;
  const glob = this;
  if ((_b = (_a = glob == null ? void 0 : glob.navigator) == null ? void 0 : _a.storage) == null ? void 0 : _b.persist) {
    return await glob.navigator.storage.persist();
  } else if (glob == null ? void 0 : glob.document.requestStorageAccess) {
    try {
      await glob.document.requestStorageAccess();
      return true;
    } catch (err) {
      console.warn("requestStorageAccess threw an error:", err);
      return false;
    }
  } else {
    return false;
  }
}
class StorageFactory {
  constructor(serviceWorkerHandler, idbFactory = window.indexedDB, _IDBKeyRange = window.IDBKeyRange, localStorage2 = window.localStorage) {
    this._serviceWorkerHandler = serviceWorkerHandler;
    this._idbFactory = idbFactory;
    this._IDBKeyRange = _IDBKeyRange;
    this._localStorage = localStorage2;
  }
  async create(sessionId, log) {
    var _a;
    await ((_a = this._serviceWorkerHandler) == null ? void 0 : _a.preventConcurrentSessionAccess(sessionId));
    requestPersistedStorage().then((persisted) => {
      if (!persisted) {
        console.warn("no persisted storage, database can be evicted by browser");
      }
    });
    const hasWebkitEarlyCloseTxnBug = await detectWebkitEarlyCloseTxnBug(this._idbFactory);
    const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, this._localStorage, log);
    return new Storage(db, this._idbFactory, this._IDBKeyRange, hasWebkitEarlyCloseTxnBug, this._localStorage, log.logger);
  }
  delete(sessionId) {
    const databaseName = sessionName(sessionId);
    clearKeysFromLocalStorage(this._localStorage, databaseName);
    const req = this._idbFactory.deleteDatabase(databaseName);
    return reqAsPromise(req);
  }
  async export(sessionId, log) {
    const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, this._localStorage, log);
    return await exportSession(db);
  }
  async import(sessionId, data, log) {
    const db = await openDatabaseWithSessionId(sessionId, this._idbFactory, this._localStorage, log);
    return await importSession(db, data);
  }
}
async function createStores(db, txn, oldVersion, version, localStorage2, log) {
  const startIdx = oldVersion || 0;
  return log.wrap({ l: "storage migration", oldVersion, version }, async (log2) => {
    for (let i = startIdx; i < version; ++i) {
      const migrationFunc = schema[i];
      await log2.wrap(`v${i + 1}`, (log3) => migrationFunc(db, txn, localStorage2, log3));
    }
  });
}
class RelationWriter {
  constructor({ roomId, ownUserId, fragmentIdComparer }) {
    this._roomId = roomId;
    this._ownUserId = ownUserId;
    this._fragmentIdComparer = fragmentIdComparer;
  }
  async writeRelation(sourceEntry, txn, log) {
    const { relatedEventId } = sourceEntry;
    if (relatedEventId) {
      const relation = getRelation(sourceEntry.event);
      if (relation && relation.rel_type) {
        txn.timelineRelations.add(this._roomId, relation.event_id, relation.rel_type, sourceEntry.id);
      }
      const target = await txn.timelineEvents.getByEventId(this._roomId, relatedEventId);
      if (target) {
        const updatedStorageEntries = await this._applyRelation(sourceEntry, target, txn, log);
        if (updatedStorageEntries) {
          return updatedStorageEntries.map((e) => {
            txn.timelineEvents.update(e);
            return new EventEntry(e, this._fragmentIdComparer);
          });
        }
      }
    }
    return null;
  }
  async writeGapRelation(storageEntry, direction, txn, log) {
    const sourceEntry = new EventEntry(storageEntry, this._fragmentIdComparer);
    const result = await this.writeRelation(sourceEntry, txn, log);
    if (direction.isBackward && !isRedacted(storageEntry.event)) {
      const relations = await txn.timelineRelations.getAllForTarget(this._roomId, sourceEntry.id);
      if (relations.length) {
        for (const r of relations) {
          const relationStorageEntry = await txn.timelineEvents.getByEventId(this._roomId, r.sourceEventId);
          if (relationStorageEntry) {
            const relationEntry = new EventEntry(relationStorageEntry, this._fragmentIdComparer);
            await this._applyRelation(relationEntry, storageEntry, txn, log);
          }
        }
      }
    }
    return result;
  }
  async _applyRelation(sourceEntry, targetStorageEntry, txn, log) {
    if (sourceEntry.eventType === REDACTION_TYPE) {
      return log.wrap("redact", async (log2) => {
        const redactedEvent = targetStorageEntry.event;
        const relation = getRelation(redactedEvent);
        const redacted = this._applyRedaction(sourceEntry.event, targetStorageEntry, txn, log2);
        if (redacted) {
          const updated = [targetStorageEntry];
          if (relation) {
            const relationTargetStorageEntry = await this._reaggregateRelation(redactedEvent, relation, txn, log2);
            if (relationTargetStorageEntry) {
              updated.push(relationTargetStorageEntry);
            }
          }
          return updated;
        }
        return null;
      });
    } else {
      const relation = getRelation(sourceEntry.event);
      if (relation && !isRedacted(targetStorageEntry.event)) {
        const relType = relation.rel_type;
        if (relType === ANNOTATION_RELATION_TYPE) {
          const aggregated = log.wrap("react", (log2) => {
            return this._aggregateAnnotation(sourceEntry.event, targetStorageEntry, log2);
          });
          if (aggregated) {
            return [targetStorageEntry];
          }
        }
      }
    }
    return null;
  }
  _applyRedaction(redactionEvent, redactedStorageEntry, txn, log) {
    const redactedEvent = redactedStorageEntry.event;
    log.set("redactionId", redactionEvent.event_id);
    log.set("id", redactedEvent.event_id);
    const relation = getRelation(redactedEvent);
    if (relation && relation.rel_type) {
      txn.timelineRelations.remove(this._roomId, relation.event_id, relation.rel_type, redactedEvent.event_id);
    }
    txn.timelineRelations.removeAllForTarget(this._roomId, redactedEvent.event_id);
    redactEvent(redactionEvent, redactedEvent);
    delete redactedStorageEntry.annotations;
    return true;
  }
  _aggregateAnnotation(annotationEvent, targetStorageEntry) {
    const relation = getRelation(annotationEvent);
    if (!relation) {
      return false;
    }
    let { annotations } = targetStorageEntry;
    if (!annotations) {
      targetStorageEntry.annotations = annotations = {};
    }
    let annotation = annotations[relation.key];
    if (!annotation) {
      annotations[relation.key] = annotation = {
        count: 0,
        me: false,
        firstTimestamp: Number.MAX_SAFE_INTEGER
      };
    }
    const sentByMe = annotationEvent.sender === this._ownUserId;
    annotation.me = annotation.me || sentByMe;
    annotation.count += 1;
    annotation.firstTimestamp = Math.min(annotation.firstTimestamp, annotationEvent.origin_server_ts);
    return true;
  }
  async _reaggregateRelation(redactedRelationEvent, redactedRelation, txn, log) {
    if (redactedRelation.rel_type === ANNOTATION_RELATION_TYPE) {
      return log.wrap("reaggregate annotations", (log2) => this._reaggregateAnnotation(redactedRelation.event_id, redactedRelation.key, txn, log2));
    }
    return null;
  }
  async _reaggregateAnnotation(targetId, key, txn, log) {
    const target = await txn.timelineEvents.getByEventId(this._roomId, targetId);
    if (!target || !target.annotations) {
      return null;
    }
    log.set("id", targetId);
    const relations = await txn.timelineRelations.getForTargetAndType(this._roomId, targetId, ANNOTATION_RELATION_TYPE);
    log.set("relations", relations.length);
    delete target.annotations[key];
    if (isObjectEmpty(target.annotations)) {
      delete target.annotations;
    }
    await Promise.all(relations.map(async (relation) => {
      const annotation = await txn.timelineEvents.getByEventId(this._roomId, relation.sourceEventId);
      if (!annotation) {
        log.log({ l: "missing annotation", id: relation.sourceEventId });
      }
      if (getRelation(annotation.event).key === key) {
        this._aggregateAnnotation(annotation.event, target, log);
      }
    }));
    return target;
  }
}
function isObjectEmpty(obj) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}
class Direction {
  constructor(isForward) {
    this.isForward = isForward;
  }
  get isBackward() {
    return !this.isForward;
  }
  asApiString() {
    return this.isForward ? "f" : "b";
  }
  reverse() {
    return this.isForward ? Direction.Backward : Direction.Forward;
  }
  static get Forward() {
    return _forward;
  }
  static get Backward() {
    return _backward;
  }
}
const _forward = new Direction(true);
const _backward = new Direction(false);
class FragmentBoundaryEntry extends BaseEntry {
  constructor(fragment, isFragmentStart, fragmentIdComparer) {
    super(fragmentIdComparer);
    this._fragment = fragment;
    this._isFragmentStart = isFragmentStart;
  }
  static start(fragment, fragmentIdComparer) {
    return new FragmentBoundaryEntry(fragment, true, fragmentIdComparer);
  }
  static end(fragment, fragmentIdComparer) {
    return new FragmentBoundaryEntry(fragment, false, fragmentIdComparer);
  }
  get started() {
    return this._isFragmentStart;
  }
  get hasEnded() {
    return !this.started;
  }
  get fragment() {
    return this._fragment;
  }
  get fragmentId() {
    return this._fragment.id;
  }
  get entryIndex() {
    if (this.started) {
      return KeyLimits.minStorageKey;
    } else {
      return KeyLimits.maxStorageKey;
    }
  }
  get isGap() {
    return !!this.token && !this.edgeReached;
  }
  get token() {
    if (this.started) {
      return this.fragment.previousToken;
    } else {
      return this.fragment.nextToken;
    }
  }
  set token(token) {
    if (this.started) {
      this.fragment.previousToken = token;
    } else {
      this.fragment.nextToken = token;
    }
  }
  get edgeReached() {
    if (this.started) {
      return this.fragment.startReached;
    } else {
      return this.fragment.endReached;
    }
  }
  set edgeReached(reached) {
    if (this.started) {
      this.fragment.startReached = reached;
    } else {
      this.fragment.endReached = reached;
    }
  }
  get linkedFragmentId() {
    if (this.started) {
      return this.fragment.previousId;
    } else {
      return this.fragment.nextId;
    }
  }
  set linkedFragmentId(id) {
    if (this.started) {
      this.fragment.previousId = id;
    } else {
      this.fragment.nextId = id;
    }
  }
  get hasLinkedFragment() {
    return isValidFragmentId(this.linkedFragmentId);
  }
  get direction() {
    if (this.started) {
      return Direction.Backward;
    } else {
      return Direction.Forward;
    }
  }
  withUpdatedFragment(fragment) {
    return new FragmentBoundaryEntry(fragment, this._isFragmentStart, this._fragmentIdComparer);
  }
  createNeighbourEntry(neighbour) {
    return new FragmentBoundaryEntry(neighbour, !this._isFragmentStart, this._fragmentIdComparer);
  }
  addLocalRelation() {
  }
  removeLocalRelation() {
  }
}
function deduplicateEvents(events) {
  const eventIds = /* @__PURE__ */ new Set();
  return events.filter((e) => {
    if (eventIds.has(e.event_id)) {
      return false;
    } else {
      eventIds.add(e.event_id);
      return true;
    }
  });
}
class SyncWriter {
  constructor({ roomId, fragmentIdComparer, memberWriter, relationWriter }) {
    this._roomId = roomId;
    this._memberWriter = memberWriter;
    this._relationWriter = relationWriter;
    this._fragmentIdComparer = fragmentIdComparer;
    this._lastLiveKey = null;
  }
  async load(txn, log) {
    const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
    if (liveFragment) {
      const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, liveFragment.id, 1);
      const eventIndex = lastEvent ? lastEvent.eventIndex : EventKey.defaultLiveKey.eventIndex;
      this._lastLiveKey = new EventKey(liveFragment.id, eventIndex);
    }
    if (this._lastLiveKey) {
      log.set("live key", this._lastLiveKey.toString());
    }
  }
  async _createLiveFragment(txn, previousToken) {
    const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
    if (!liveFragment) {
      if (!previousToken) {
        previousToken = null;
      }
      const fragment = {
        roomId: this._roomId,
        id: EventKey.defaultLiveKey.fragmentId,
        previousId: null,
        nextId: null,
        previousToken,
        nextToken: null
      };
      txn.timelineFragments.add(fragment);
      this._fragmentIdComparer.add(fragment);
      return fragment;
    } else {
      return liveFragment;
    }
  }
  async _replaceLiveFragment(oldFragmentId, newFragmentId, previousToken, txn) {
    const oldFragment = await txn.timelineFragments.get(this._roomId, oldFragmentId);
    if (!oldFragment) {
      throw new Error(`old live fragment doesn't exist: ${oldFragmentId}`);
    }
    oldFragment.nextId = newFragmentId;
    txn.timelineFragments.update(oldFragment);
    const newFragment = {
      roomId: this._roomId,
      id: newFragmentId,
      previousId: oldFragmentId,
      nextId: null,
      previousToken,
      nextToken: null
    };
    txn.timelineFragments.add(newFragment);
    this._fragmentIdComparer.append(newFragmentId, oldFragmentId);
    return { oldFragment, newFragment };
  }
  async _ensureLiveFragment(currentKey, entries, timeline, txn, log) {
    if (!currentKey) {
      let liveFragment = await this._createLiveFragment(txn, timeline.prev_batch);
      currentKey = new EventKey(liveFragment.id, EventKey.defaultLiveKey.eventIndex);
      entries.push(FragmentBoundaryEntry.start(liveFragment, this._fragmentIdComparer));
      log.log({ l: "live fragment", first: true, id: currentKey.fragmentId });
    } else if (timeline.limited) {
      const oldFragmentId = currentKey.fragmentId;
      currentKey = currentKey.nextFragmentKey();
      const { oldFragment, newFragment } = await this._replaceLiveFragment(oldFragmentId, currentKey.fragmentId, timeline.prev_batch, txn);
      entries.push(FragmentBoundaryEntry.end(oldFragment, this._fragmentIdComparer));
      entries.push(FragmentBoundaryEntry.start(newFragment, this._fragmentIdComparer));
      log.log({ l: "live fragment", limited: true, id: currentKey.fragmentId });
    }
    return currentKey;
  }
  async _writeStateEvents(stateEvents, txn, log) {
    let nonMemberStateEvents = 0;
    for (const event2 of stateEvents) {
      if (event2.type !== EVENT_TYPE$1) {
        txn.roomState.set(this._roomId, event2);
        nonMemberStateEvents += 1;
      }
    }
    log.set("stateEvents", nonMemberStateEvents);
  }
  async _writeTimeline(timelineEvents, timeline, memberSync, currentKey, txn, log) {
    const entries = [];
    const updatedEntries = [];
    if (timelineEvents == null ? void 0 : timelineEvents.length) {
      currentKey = await this._ensureLiveFragment(currentKey, entries, timeline, txn, log);
      log.set("timelineEvents", timelineEvents.length);
      let timelineStateEventCount = 0;
      for (const event2 of timelineEvents) {
        currentKey = currentKey.nextKey();
        const storageEntry = createEventEntry(currentKey, this._roomId, event2);
        let member = await memberSync.lookupMemberAtEvent(event2.sender, event2, txn);
        if (member) {
          storageEntry.displayName = member.displayName;
          storageEntry.avatarUrl = member.avatarUrl;
        }
        const couldInsert = await txn.timelineEvents.tryInsert(storageEntry, log);
        if (!couldInsert) {
          continue;
        }
        const entry = new EventEntry(storageEntry, this._fragmentIdComparer);
        entries.push(entry);
        const updatedRelationTargetEntries = await this._relationWriter.writeRelation(entry, txn, log);
        if (updatedRelationTargetEntries) {
          updatedEntries.push(...updatedRelationTargetEntries);
        }
        if (typeof event2.state_key === "string" && event2.type !== EVENT_TYPE$1) {
          timelineStateEventCount += 1;
          txn.roomState.set(this._roomId, event2);
        }
      }
      log.set("timelineStateEventCount", timelineStateEventCount);
    }
    return { currentKey, entries, updatedEntries };
  }
  async _handleRejoinOverlap(timeline, txn, log) {
    if (this._lastLiveKey) {
      const { fragmentId } = this._lastLiveKey;
      const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, fragmentId, 1);
      if (lastEvent) {
        const lastEventId = lastEvent.event.event_id;
        const { events } = timeline;
        const index = events.findIndex((event2) => event2.event_id === lastEventId);
        if (index !== -1) {
          log.set("overlap_event_id", lastEventId);
          return Object.assign({}, timeline, {
            limited: false,
            events: events.slice(index + 1)
          });
        }
      }
    }
    if (!timeline.limited) {
      log.set("force_limited_without_overlap", true);
      return Object.assign({}, timeline, { limited: true });
    }
    return timeline;
  }
  async writeSync(roomResponse, isRejoin, hasFetchedMembers, txn, log) {
    let { timeline } = roomResponse;
    log.set("isRejoin", isRejoin);
    if (isRejoin) {
      timeline = await this._handleRejoinOverlap(timeline, txn, log);
    }
    let timelineEvents;
    if (Array.isArray(timeline == null ? void 0 : timeline.events)) {
      timelineEvents = deduplicateEvents(timeline.events);
    }
    const { state } = roomResponse;
    let stateEvents;
    if (Array.isArray(state == null ? void 0 : state.events)) {
      stateEvents = state.events;
    }
    const memberSync = this._memberWriter.prepareMemberSync(stateEvents, timelineEvents, hasFetchedMembers);
    if (stateEvents) {
      await this._writeStateEvents(stateEvents, txn, log);
    }
    const { currentKey, entries, updatedEntries } = await this._writeTimeline(timelineEvents, timeline, memberSync, this._lastLiveKey, txn, log);
    const memberChanges = await memberSync.write(txn);
    return { entries, updatedEntries, newLiveKey: currentKey, memberChanges };
  }
  afterSync(newLiveKey) {
    this._lastLiveKey = newLiveKey;
  }
  get lastMessageKey() {
    return this._lastLiveKey;
  }
}
class BaseLRUCache {
  constructor(limit) {
    this.limit = limit;
    this._entries = [];
  }
  get size() {
    return this._entries.length;
  }
  _get(findEntryFn) {
    return this._getByIndexAndMoveUp(this._entries.findIndex(findEntryFn));
  }
  _getByIndexAndMoveUp(idx) {
    if (idx !== -1) {
      const entry = this._entries[idx];
      if (idx > 0) {
        this._entries.splice(idx, 1);
        this._entries.unshift(entry);
      }
      return entry;
    }
  }
  _set(value, findEntryFn) {
    let indexToRemove = findEntryFn ? this._entries.findIndex(findEntryFn) : -1;
    this._entries.unshift(value);
    if (indexToRemove === -1) {
      if (this._entries.length > this.limit) {
        indexToRemove = this._entries.length - 1;
      }
    } else {
      indexToRemove += 1;
    }
    if (indexToRemove !== -1) {
      this.onEvictEntry(this._entries[indexToRemove]);
      this._entries.splice(indexToRemove, 1);
    }
  }
  onEvictEntry(entry) {
  }
}
class LRUCache extends BaseLRUCache {
  constructor(limit, keyFn) {
    super(limit);
    this._keyFn = keyFn;
  }
  get(key) {
    return this._get((e) => this._keyFn(e) === key);
  }
  set(value) {
    const key = this._keyFn(value);
    this._set(value, (e) => this._keyFn(e) === key);
  }
}
class MemberWriter {
  constructor(roomId) {
    this._roomId = roomId;
    this._cache = new LRUCache(5, (member) => member.userId);
  }
  prepareMemberSync(stateEvents, timelineEvents, hasFetchedMembers) {
    return new MemberSync(this, stateEvents, timelineEvents, hasFetchedMembers);
  }
  async _writeMember(member, txn) {
    let existingMember = this._cache.get(member.userId);
    if (!existingMember) {
      const memberData = await txn.roomMembers.get(this._roomId, member.userId);
      if (memberData) {
        existingMember = new RoomMember(memberData);
      }
    }
    if (!existingMember || !existingMember.equals(member)) {
      txn.roomMembers.set(member.serialize());
      this._cache.set(member);
      return new MemberChange(member, existingMember == null ? void 0 : existingMember.membership);
    }
  }
  async lookupMember(userId, txn) {
    let member = this._cache.get(userId);
    if (!member) {
      const memberData = await txn.roomMembers.get(this._roomId, userId);
      if (memberData) {
        member = new RoomMember(memberData);
        this._cache.set(member);
      }
    }
    return member;
  }
}
class MemberSync {
  constructor(memberWriter, stateEvents, timelineEvents, hasFetchedMembers) {
    this._memberWriter = memberWriter;
    this._timelineEvents = timelineEvents;
    this._hasFetchedMembers = hasFetchedMembers;
    this._newStateMembers = null;
    if (stateEvents) {
      this._newStateMembers = this._stateEventsToMembers(stateEvents);
    }
  }
  get _roomId() {
    return this._memberWriter._roomId;
  }
  _stateEventsToMembers(stateEvents) {
    let members;
    for (const event2 of stateEvents) {
      if (event2.type === EVENT_TYPE$1) {
        const member = RoomMember.fromMemberEvent(this._roomId, event2);
        if (member) {
          if (!members) {
            members = /* @__PURE__ */ new Map();
          }
          members.set(member.userId, member);
        }
      }
    }
    return members;
  }
  _timelineEventsToMembers(timelineEvents) {
    let members;
    for (let i = timelineEvents.length - 1; i >= 0; i--) {
      const e = timelineEvents[i];
      const userId = e.state_key;
      if (e.type === EVENT_TYPE$1 && !(members == null ? void 0 : members.has(userId))) {
        const member = RoomMember.fromMemberEvent(this._roomId, e);
        if (member) {
          if (!members) {
            members = /* @__PURE__ */ new Map();
          }
          members.set(member.userId, member);
        }
      }
    }
    return members;
  }
  async lookupMemberAtEvent(userId, event2, txn) {
    var _a;
    let member;
    if (this._timelineEvents) {
      member = this._findPrecedingMemberEventInTimeline(userId, event2);
      if (member) {
        return member;
      }
    }
    member = (_a = this._newStateMembers) == null ? void 0 : _a.get(userId);
    if (member) {
      return member;
    }
    return await this._memberWriter.lookupMember(userId, txn);
  }
  async write(txn) {
    const memberChanges = /* @__PURE__ */ new Map();
    let newTimelineMembers;
    if (this._timelineEvents) {
      newTimelineMembers = this._timelineEventsToMembers(this._timelineEvents);
    }
    if (this._newStateMembers) {
      for (const member of this._newStateMembers.values()) {
        if (!(newTimelineMembers == null ? void 0 : newTimelineMembers.has(member.userId))) {
          const memberChange = await this._memberWriter._writeMember(member, txn);
          if (memberChange) {
            const maybeLazyLoadingMember = !this._hasFetchedMembers && !memberChange.previousMembership;
            if (maybeLazyLoadingMember) {
              memberChange.previousMembership = member.membership;
            }
            memberChanges.set(memberChange.userId, memberChange);
          }
        }
      }
    }
    if (newTimelineMembers) {
      for (const member of newTimelineMembers.values()) {
        const memberChange = await this._memberWriter._writeMember(member, txn);
        if (memberChange) {
          memberChanges.set(memberChange.userId, memberChange);
        }
      }
    }
    return memberChanges;
  }
  _findPrecedingMemberEventInTimeline(userId, event2) {
    let eventIndex = -1;
    for (let i = this._timelineEvents.length - 1; i >= 0; i--) {
      const e = this._timelineEvents[i];
      if (e.event_id === event2.event_id) {
        eventIndex = i;
        break;
      }
    }
    for (let i = eventIndex - 1; i >= 0; i--) {
      const e = this._timelineEvents[i];
      if (e.type === EVENT_TYPE$1 && e.state_key === userId) {
        const member = RoomMember.fromMemberEvent(this._roomId, e);
        if (member) {
          return member;
        }
      }
    }
  }
}
class GapWriter {
  constructor({ roomId, storage, fragmentIdComparer, relationWriter }) {
    this._roomId = roomId;
    this._storage = storage;
    this._fragmentIdComparer = fragmentIdComparer;
    this._relationWriter = relationWriter;
  }
  async _findOverlappingEvents(fragmentEntry, events, txn, log) {
    const eventIds = events.map((e) => e.event_id);
    const existingEventKeyMap = await txn.timelineEvents.getEventKeysForIds(this._roomId, eventIds);
    log.set("existingEvents", existingEventKeyMap.size);
    const nonOverlappingEvents = events.filter((e) => !existingEventKeyMap.has(e.event_id));
    log.set("nonOverlappingEvents", nonOverlappingEvents.length);
    let neighbourFragmentEntry;
    if (fragmentEntry.hasLinkedFragment) {
      log.set("linkedFragmentId", fragmentEntry.linkedFragmentId);
      for (const eventKey of existingEventKeyMap.values()) {
        if (eventKey.fragmentId === fragmentEntry.linkedFragmentId) {
          log.set("foundLinkedFragment", true);
          const neighbourFragment = await txn.timelineFragments.get(this._roomId, fragmentEntry.linkedFragmentId);
          neighbourFragmentEntry = fragmentEntry.createNeighbourEntry(neighbourFragment);
          break;
        }
      }
    }
    return { nonOverlappingEvents, neighbourFragmentEntry };
  }
  async _findFragmentEdgeEventKey(fragmentEntry, txn) {
    const { fragmentId, direction } = fragmentEntry;
    const event2 = await this._findFragmentEdgeEvent(fragmentId, direction, txn);
    if (event2) {
      return new EventKey(event2.fragmentId, event2.eventIndex);
    } else {
      return EventKey.defaultFragmentKey(fragmentEntry.fragmentId);
    }
  }
  async _findFragmentEdgeEvent(fragmentId, direction, txn) {
    if (direction.isBackward) {
      const [firstEvent] = await txn.timelineEvents.firstEvents(this._roomId, fragmentId, 1);
      return firstEvent;
    } else {
      const [lastEvent] = await txn.timelineEvents.lastEvents(this._roomId, fragmentId, 1);
      return lastEvent;
    }
  }
  async _storeEvents(events, startKey, direction, state, txn, log) {
    const entries = [];
    const updatedEntries = [];
    let key = startKey;
    for (let i = 0; i < events.length; ++i) {
      const event2 = events[i];
      key = key.nextKeyForDirection(direction);
      const eventStorageEntry = createEventEntry(key, this._roomId, event2);
      const member = this._findMember(event2.sender, state, events, i, direction);
      if (member) {
        eventStorageEntry.displayName = member.displayName;
        eventStorageEntry.avatarUrl = member.avatarUrl;
      }
      const updatedRelationTargetEntries = await this._relationWriter.writeGapRelation(eventStorageEntry, direction, txn, log);
      if (updatedRelationTargetEntries) {
        updatedEntries.push(...updatedRelationTargetEntries);
      }
      if (await txn.timelineEvents.tryInsert(eventStorageEntry, log)) {
        const eventEntry = new EventEntry(eventStorageEntry, this._fragmentIdComparer);
        directionalAppend(entries, eventEntry, direction);
      }
    }
    return { entries, updatedEntries };
  }
  _findMember(userId, state, events, index, direction) {
    function isOurUser(event2) {
      return event2.type === EVENT_TYPE$1 && event2.state_key === userId;
    }
    const inc = direction.isBackward ? 1 : -1;
    for (let i = index + inc; i >= 0 && i < events.length; i += inc) {
      const event2 = events[i];
      if (isOurUser(event2)) {
        return RoomMember.fromMemberEvent(this._roomId, event2);
      }
    }
    for (let i = index; i >= 0 && i < events.length; i -= inc) {
      const event2 = events[i];
      if (isOurUser(event2)) {
        return RoomMember.fromReplacingMemberEvent(this._roomId, event2);
      }
    }
    const stateMemberEvent = state == null ? void 0 : state.find(isOurUser);
    if (stateMemberEvent) {
      return RoomMember.fromMemberEvent(this._roomId, stateMemberEvent);
    }
  }
  async _updateFragments(fragmentEntry, neighbourFragmentEntry, end, entries, txn, log) {
    const { direction } = fragmentEntry;
    const changedFragments = [];
    directionalAppend(entries, fragmentEntry, direction);
    if (neighbourFragmentEntry) {
      log.set("closedGapWith", neighbourFragmentEntry.fragmentId);
      neighbourFragmentEntry.token = null;
      fragmentEntry.token = null;
      txn.timelineFragments.update(neighbourFragmentEntry.fragment);
      directionalAppend(entries, neighbourFragmentEntry, direction);
      changedFragments.push(fragmentEntry.fragment);
      changedFragments.push(neighbourFragmentEntry.fragment);
    } else {
      fragmentEntry.token = end;
    }
    txn.timelineFragments.update(fragmentEntry.fragment);
    return changedFragments;
  }
  async writeFragmentFill(fragmentEntry, response, txn, log) {
    const { fragmentId, direction } = fragmentEntry;
    const { chunk, start, state } = response;
    let { end } = response;
    if (!Array.isArray(chunk)) {
      throw new Error("Invalid chunk in response");
    }
    if (typeof end !== "string" && typeof end !== "undefined") {
      throw new Error("Invalid end token in response");
    }
    const fragment = await txn.timelineFragments.get(this._roomId, fragmentId);
    if (!fragment) {
      throw new Error(`Unknown fragment: ${fragmentId}`);
    }
    fragmentEntry = fragmentEntry.withUpdatedFragment(fragment);
    if (fragmentEntry.token !== start) {
      throw new Error("start is not equal to prev_batch or next_batch");
    }
    if (chunk.length === 0) {
      fragmentEntry.edgeReached = true;
      await txn.timelineFragments.update(fragmentEntry.fragment);
      return { entries: [fragmentEntry], updatedEntries: [], fragments: [] };
    }
    let lastKey = await this._findFragmentEdgeEventKey(fragmentEntry, txn);
    log.set("lastKey", lastKey.toString());
    const {
      nonOverlappingEvents,
      neighbourFragmentEntry
    } = await this._findOverlappingEvents(fragmentEntry, chunk, txn, log);
    const { entries, updatedEntries } = await this._storeEvents(nonOverlappingEvents, lastKey, direction, state, txn, log);
    const fragments = await this._updateFragments(fragmentEntry, neighbourFragmentEntry, end, entries, txn, log);
    return { entries, updatedEntries, fragments };
  }
}
class BaseObservableList extends BaseObservable {
  emitReset() {
    for (let h of this._handlers) {
      h.onReset(this);
    }
  }
  emitAdd(index, value) {
    for (let h of this._handlers) {
      h.onAdd(index, value, this);
    }
  }
  emitUpdate(index, value, params) {
    for (let h of this._handlers) {
      h.onUpdate(index, value, params, this);
    }
  }
  emitRemove(index, value) {
    for (let h of this._handlers) {
      h.onRemove(index, value, this);
    }
  }
  emitMove(fromIdx, toIdx, value) {
    for (let h of this._handlers) {
      h.onMove(fromIdx, toIdx, value, this);
    }
  }
}
/**
 * @license
 * Based off baseSortedIndex function in Lodash <https://lodash.com/>
 * Copyright JS Foundation and other contributors <https://js.foundation/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */
function sortedIndex(array, value, comparator) {
  let low = 0;
  let high = array.length;
  while (low < high) {
    let mid = low + high >>> 1;
    let cmpResult = comparator(value, array[mid]);
    if (cmpResult > 0) {
      low = mid + 1;
    } else if (cmpResult < 0) {
      high = mid;
    } else {
      low = high = mid;
    }
  }
  return high;
}
class SortedMapList extends BaseObservableList {
  constructor(sourceMap, comparator) {
    super();
    this._sourceMap = sourceMap;
    this._comparator = (a, b) => comparator(a.value, b.value);
    this._sortedPairs = null;
    this._mapSubscription = null;
  }
  onAdd(key, value) {
    const pair = { key, value };
    const idx = sortedIndex(this._sortedPairs, pair, this._comparator);
    this._sortedPairs.splice(idx, 0, pair);
    this.emitAdd(idx, value);
  }
  onRemove(key, value) {
    const pair = { key, value };
    const idx = sortedIndex(this._sortedPairs, pair, this._comparator);
    this._sortedPairs.splice(idx, 1);
    this.emitRemove(idx, value);
  }
  onUpdate(key, value, params) {
    if (!this._sortedPairs) {
      return;
    }
    const oldIdx = this._sortedPairs.findIndex((p) => p.key === key);
    this._sortedPairs.splice(oldIdx, 1);
    const pair = { key, value };
    const newIdx = sortedIndex(this._sortedPairs, pair, this._comparator);
    this._sortedPairs.splice(newIdx, 0, pair);
    if (oldIdx !== newIdx) {
      this.emitMove(oldIdx, newIdx, value);
    }
    this.emitUpdate(newIdx, value, params);
  }
  onReset() {
    this._sortedPairs = [];
    this.emitReset();
  }
  onSubscribeFirst() {
    this._mapSubscription = this._sourceMap.subscribe(this);
    this._sortedPairs = new Array(this._sourceMap.size);
    let i = 0;
    for (let [key, value] of this._sourceMap) {
      this._sortedPairs[i] = { key, value };
      ++i;
    }
    this._sortedPairs.sort(this._comparator);
    super.onSubscribeFirst();
  }
  onUnsubscribeLast() {
    super.onUnsubscribeLast();
    this._sortedPairs = null;
    this._mapSubscription = this._mapSubscription();
  }
  get(index) {
    return this._sortedPairs[index].value;
  }
  get length() {
    return this._sourceMap.size;
  }
  [Symbol.iterator]() {
    const it = this._sortedPairs.values();
    return {
      next() {
        const v = it.next();
        if (v.value) {
          v.value = v.value.value;
        }
        return v;
      }
    };
  }
}
class BaseObservableMap extends BaseObservable {
  constructor() {
    super();
  }
  emitReset() {
    for (let h of this._handlers) {
      h.onReset();
    }
  }
  emitAdd(key, value) {
    for (let h of this._handlers) {
      h.onAdd(key, value);
    }
  }
  emitUpdate(key, value, params) {
    for (let h of this._handlers) {
      h.onUpdate(key, value, params);
    }
  }
  emitRemove(key, value) {
    for (let h of this._handlers) {
      h.onRemove(key, value);
    }
  }
  join(...otherMaps) {
    return new JoinedMap([this].concat(otherMaps));
  }
  mapValues(mapper, updater) {
    return new MappedMap(this, mapper, updater);
  }
  sortValues(comparator) {
    return new SortedMapList(this, comparator);
  }
  filterValues(filter) {
    return new FilteredMap(this, filter);
  }
}
class ApplyMap extends BaseObservableMap {
  constructor(source, apply2) {
    super();
    this._source = source;
    this._apply = apply2;
  }
  hasApply() {
    return !!this._apply;
  }
  setApply(apply2) {
    this._apply = apply2;
    if (this._apply) {
      this.applyOnce(this._apply);
    }
  }
  applyOnce(apply2) {
    for (const [key, value] of this._source) {
      apply2(key, value);
    }
  }
  onAdd(key, value) {
    if (this._apply) {
      this._apply(key, value);
    }
    this.emitAdd(key, value);
  }
  onRemove(key, value) {
    this.emitRemove(key, value);
  }
  onUpdate(key, value, params) {
    if (this._apply) {
      this._apply(key, value, params);
    }
    this.emitUpdate(key, value, params);
  }
  onSubscribeFirst() {
    this._subscription = this._source.subscribe(this);
    if (this._apply) {
      this.applyOnce(this._apply);
    }
    super.onSubscribeFirst();
  }
  onUnsubscribeLast() {
    super.onUnsubscribeLast();
    if (this._subscription) {
      this._subscription = this._subscription();
    }
  }
  onReset() {
    if (this._apply) {
      this.applyOnce(this._apply);
    }
    this.emitReset();
  }
  [Symbol.iterator]() {
    return this._source[Symbol.iterator]();
  }
  get size() {
    return this._source.size;
  }
  get(key) {
    return this._source.get(key);
  }
}
class FilteredMap extends BaseObservableMap {
  constructor(source, filter) {
    super();
    this._source = source;
    this._filter = filter;
  }
  setFilter(filter) {
    this._filter = filter;
    if (this._subscription) {
      this._reapplyFilter();
    }
  }
  _reapplyFilter(silent = false) {
    if (this._filter) {
      const oldIncluded = this._included;
      this._included = this._included || /* @__PURE__ */ new Map();
      for (const [key, value] of this._source) {
        const isIncluded = this._filter(value, key);
        this._included.set(key, isIncluded);
        if (!silent) {
          const wasIncluded = oldIncluded ? oldIncluded.get(key) : true;
          this._emitForUpdate(wasIncluded, isIncluded, key, value);
        }
      }
    } else {
      if (this._included && !silent) {
        for (const [key, value] of this._source) {
          if (!this._included.get(key)) {
            this.emitAdd(key, value);
          }
        }
      }
      this._included = void 0;
    }
  }
  onAdd(key, value) {
    if (this._filter) {
      if (this._included) {
        const included = this._filter(value, key);
        this._included.set(key, included);
        if (!included) {
          return;
        }
      } else {
        throw new Error("Internal logic error: FilteredMap._included used before initialized");
      }
    }
    this.emitAdd(key, value);
  }
  onRemove(key, value) {
    var _a;
    const wasIncluded = !this._filter || ((_a = this._included) == null ? void 0 : _a.get(key));
    if (this._included) {
      this._included.delete(key);
      if (wasIncluded) {
        this.emitRemove(key, value);
      }
    } else {
      throw new Error("Internal logic error: FilteredMap._included used before initialized");
    }
  }
  onUpdate(key, value, params) {
    if (!this._included) {
      return;
    }
    if (this._filter) {
      const wasIncluded = this._included.get(key);
      const isIncluded = this._filter(value, key);
      this._included.set(key, isIncluded);
      this._emitForUpdate(wasIncluded, isIncluded, key, value, params);
    } else {
      this.emitUpdate(key, value, params);
    }
  }
  _emitForUpdate(wasIncluded, isIncluded, key, value, params = null) {
    if (wasIncluded && !isIncluded) {
      this.emitRemove(key, value);
    } else if (!wasIncluded && isIncluded) {
      this.emitAdd(key, value);
    } else if (wasIncluded && isIncluded) {
      this.emitUpdate(key, value, params);
    }
  }
  onSubscribeFirst() {
    this._subscription = this._source.subscribe(this);
    this._reapplyFilter(true);
    super.onSubscribeFirst();
  }
  onUnsubscribeLast() {
    super.onUnsubscribeLast();
    this._included = void 0;
    if (this._subscription) {
      this._subscription = this._subscription();
    }
  }
  onReset() {
    this._reapplyFilter();
    this.emitReset();
  }
  [Symbol.iterator]() {
    return new FilterIterator(this._source, this._included);
  }
  get size() {
    var _a;
    let count = 0;
    (_a = this._included) == null ? void 0 : _a.forEach((included) => {
      if (included) {
        count += 1;
      }
    });
    return count;
  }
  get(key) {
    const value = this._source.get(key);
    if (value && this._filter(value, key)) {
      return value;
    }
  }
}
class FilterIterator {
  constructor(map, included) {
    this._included = included;
    this._sourceIterator = map[Symbol.iterator]();
  }
  next() {
    var _a;
    while (true) {
      const sourceResult = this._sourceIterator.next();
      if (sourceResult.done) {
        return sourceResult;
      }
      const key = sourceResult.value[0];
      if ((_a = this._included) == null ? void 0 : _a.get(key)) {
        return sourceResult;
      }
    }
  }
}
class JoinedMap extends BaseObservableMap {
  constructor(sources) {
    super();
    this._sources = sources;
  }
  onAdd(source, key, value) {
    if (!this._isKeyAtSourceOccluded(source, key)) {
      const occludingValue = this._getValueFromOccludedSources(source, key);
      if (occludingValue !== void 0) {
        this.emitRemove(key, occludingValue);
      }
      this.emitAdd(key, value);
    }
  }
  onRemove(source, key, value) {
    if (!this._isKeyAtSourceOccluded(source, key)) {
      this.emitRemove(key, value);
      const occludedValue = this._getValueFromOccludedSources(source, key);
      if (occludedValue !== void 0) {
        this.emitAdd(key, occludedValue);
      }
    }
  }
  onUpdate(source, key, value, params) {
    if (!this._subscriptions) {
      return;
    }
    if (!this._isKeyAtSourceOccluded(source, key)) {
      this.emitUpdate(key, value, params);
    }
  }
  onReset() {
    this.emitReset();
  }
  onSubscribeFirst() {
    this._subscriptions = this._sources.map((source) => new SourceSubscriptionHandler(source, this).subscribe());
    super.onSubscribeFirst();
  }
  _isKeyAtSourceOccluded(source, key) {
    const index = this._sources.indexOf(source);
    for (let i = 0; i < index; i += 1) {
      if (this._sources[i].get(key) !== void 0) {
        return true;
      }
    }
    return false;
  }
  _getValueFromOccludedSources(source, key) {
    const index = this._sources.indexOf(source);
    for (let i = index + 1; i < this._sources.length; i += 1) {
      const source2 = this._sources[i];
      const occludedValue = source2.get(key);
      if (occludedValue !== void 0) {
        return occludedValue;
      }
    }
    return void 0;
  }
  onUnsubscribeLast() {
    super.onUnsubscribeLast();
    if (this._subscriptions) {
      for (const s of this._subscriptions) {
        s.dispose();
      }
    }
  }
  [Symbol.iterator]() {
    return new JoinedIterator(this._sources);
  }
  get size() {
    return this._sources.reduce((sum, s) => sum + s.size, 0);
  }
  get(key) {
    for (const s of this._sources) {
      const value = s.get(key);
      if (value) {
        return value;
      }
    }
    return void 0;
  }
}
class JoinedIterator {
  constructor(sources) {
    this._sourceIndex = -1;
    this._encounteredKeys = /* @__PURE__ */ new Set();
    this._sources = sources;
  }
  next() {
    var _a;
    let result = void 0;
    while (!result) {
      if (!this._currentIterator) {
        this._sourceIndex += 1;
        if (this._sources.length <= this._sourceIndex) {
          return { done: true, value: null };
        }
        this._currentIterator = this._sources[this._sourceIndex][Symbol.iterator]();
      }
      const sourceResult = (_a = this._currentIterator) == null ? void 0 : _a.next();
      if (!sourceResult || sourceResult.done) {
        this._currentIterator = void 0;
        continue;
      } else {
        const key = sourceResult.value[0];
        if (!this._encounteredKeys.has(key)) {
          this._encounteredKeys.add(key);
          result = sourceResult;
        }
      }
    }
    return result;
  }
}
class SourceSubscriptionHandler {
  constructor(source, joinedMap) {
    this._source = source;
    this._joinedMap = joinedMap;
    this._subscription = void 0;
  }
  subscribe() {
    this._subscription = this._source.subscribe(this);
    return this;
  }
  dispose() {
    if (this._subscription)
      this._subscription = this._subscription();
  }
  onAdd(key, value) {
    this._joinedMap.onAdd(this._source, key, value);
  }
  onRemove(key, value) {
    this._joinedMap.onRemove(this._source, key, value);
  }
  onUpdate(key, value, params) {
    this._joinedMap.onUpdate(this._source, key, value, params);
  }
  onReset() {
    this._joinedMap.onReset();
  }
}
class MappedMap extends BaseObservableMap {
  constructor(source, mapper, updater) {
    super();
    this._source = source;
    this._mapper = mapper;
    this._updater = updater;
    this._mappedValues = /* @__PURE__ */ new Map();
  }
  _emitSpontaneousUpdate(key, params) {
    const value = this._mappedValues.get(key);
    if (value) {
      this.emitUpdate(key, value, params);
    }
  }
  onAdd(key, value) {
    const emitSpontaneousUpdate = this._emitSpontaneousUpdate.bind(this, key);
    const mappedValue = this._mapper(value, emitSpontaneousUpdate);
    this._mappedValues.set(key, mappedValue);
    this.emitAdd(key, mappedValue);
  }
  onRemove(key) {
    const mappedValue = this._mappedValues.get(key);
    if (this._mappedValues.delete(key)) {
      if (mappedValue) {
        this.emitRemove(key, mappedValue);
      }
    }
  }
  onUpdate(key, value, params) {
    var _a;
    if (!this._mappedValues) {
      return;
    }
    const mappedValue = this._mappedValues.get(key);
    if (mappedValue !== void 0) {
      (_a = this._updater) == null ? void 0 : _a.call(this, params, mappedValue, value);
      this.emitUpdate(key, mappedValue, params);
    }
  }
  onSubscribeFirst() {
    this._subscription = this._source.subscribe(this);
    for (let [key, value] of this._source) {
      const emitSpontaneousUpdate = this._emitSpontaneousUpdate.bind(this, key);
      const mappedValue = this._mapper(value, emitSpontaneousUpdate);
      this._mappedValues.set(key, mappedValue);
    }
    super.onSubscribeFirst();
  }
  onUnsubscribeLast() {
    super.onUnsubscribeLast();
    if (this._subscription) {
      this._subscription = this._subscription();
    }
    this._mappedValues.clear();
  }
  onReset() {
    this._mappedValues.clear();
    this.emitReset();
  }
  [Symbol.iterator]() {
    return this._mappedValues.entries();
  }
  get size() {
    return this._mappedValues.size;
  }
  get(key) {
    return this._mappedValues.get(key);
  }
}
class ObservableMap extends BaseObservableMap {
  constructor(initialValues) {
    super();
    this._values = new Map(initialValues);
  }
  update(key, params) {
    const value = this._values.get(key);
    if (value !== void 0) {
      this._values.set(key, value);
      this.emitUpdate(key, value, params);
      return true;
    }
    return false;
  }
  add(key, value) {
    if (!this._values.has(key)) {
      this._values.set(key, value);
      this.emitAdd(key, value);
      return true;
    }
    return false;
  }
  remove(key) {
    const value = this._values.get(key);
    if (value !== void 0) {
      this._values.delete(key);
      this.emitRemove(key, value);
      return true;
    } else {
      return false;
    }
  }
  set(key, value) {
    if (this._values.has(key)) {
      this._values.set(key, value);
      return this.update(key, void 0);
    } else {
      return this.add(key, value);
    }
  }
  reset() {
    this._values.clear();
    this.emitReset();
  }
  get(key) {
    return this._values.get(key);
  }
  get size() {
    return this._values.size;
  }
  [Symbol.iterator]() {
    return this._values.entries();
  }
  values() {
    return this._values.values();
  }
  keys() {
    return this._values.keys();
  }
}
class ObservableArray extends BaseObservableList {
  constructor(initialValues = []) {
    super();
    this._items = initialValues;
  }
  append(item) {
    this._items.push(item);
    this.emitAdd(this._items.length - 1, item);
  }
  remove(idx) {
    const [item] = this._items.splice(idx, 1);
    this.emitRemove(idx, item);
  }
  insertMany(idx, items) {
    for (let item of items) {
      this.insert(idx, item);
      idx += 1;
    }
  }
  insert(idx, item) {
    this._items.splice(idx, 0, item);
    this.emitAdd(idx, item);
  }
  move(fromIdx, toIdx) {
    if (fromIdx < this._items.length && toIdx < this._items.length) {
      const [item] = this._items.splice(fromIdx, 1);
      this._items.splice(toIdx, 0, item);
      this.emitMove(fromIdx, toIdx, item);
    }
  }
  update(idx, item, params = null) {
    if (idx < this._items.length) {
      this._items[idx] = item;
      this.emitUpdate(idx, item, params);
    }
  }
  get array() {
    return this._items;
  }
  at(idx) {
    if (this._items && idx >= 0 && idx < this._items.length) {
      return this._items[idx];
    }
  }
  get length() {
    return this._items.length;
  }
  [Symbol.iterator]() {
    return this._items.values();
  }
}
function findAndUpdateInArray(predicate, array, observable, updater) {
  const index = array.findIndex(predicate);
  if (index !== -1) {
    const value = array[index];
    const params = updater(value);
    if (params !== false) {
      observable.emitUpdate(index, value, params);
    }
    return true;
  }
  return false;
}
class SortedArray extends BaseObservableList {
  constructor(comparator) {
    super();
    this._items = [];
    this._comparator = comparator;
  }
  setManyUnsorted(items) {
    this.setManySorted(items);
  }
  setManySorted(items) {
    for (let item of items) {
      this.set(item);
    }
  }
  findAndUpdate(predicate, updater) {
    return findAndUpdateInArray(predicate, this._items, this, updater);
  }
  getAndUpdate(item, updater, updateParams = null) {
    const idx = this.indexOf(item);
    if (idx !== -1) {
      const existingItem = this._items[idx];
      const newItem = updater(existingItem, item);
      this._items[idx] = newItem;
      this.emitUpdate(idx, newItem, updateParams);
    }
  }
  update(item, updateParams = null) {
    const idx = this.indexOf(item);
    if (idx !== -1) {
      this._items[idx] = item;
      this.emitUpdate(idx, item, updateParams);
    }
  }
  indexOf(item) {
    const idx = sortedIndex(this._items, item, this._comparator);
    if (idx < this._items.length && this._comparator(this._items[idx], item) === 0) {
      return idx;
    } else {
      return -1;
    }
  }
  _getNext(item) {
    let idx = sortedIndex(this._items, item, this._comparator);
    while (idx < this._items.length && this._comparator(this._items[idx], item) <= 0) {
      idx += 1;
    }
    return this.get(idx);
  }
  set(item, updateParams = null) {
    const idx = sortedIndex(this._items, item, this._comparator);
    if (idx >= this._items.length || this._comparator(this._items[idx], item) !== 0) {
      this._items.splice(idx, 0, item);
      this.emitAdd(idx, item);
    } else {
      this._items[idx] = item;
      this.emitUpdate(idx, item, updateParams);
    }
  }
  get(idx) {
    return this._items[idx];
  }
  remove(idx) {
    const item = this._items[idx];
    this._items.splice(idx, 1);
    this.emitRemove(idx, item);
  }
  get array() {
    return this._items;
  }
  get length() {
    return this._items.length;
  }
  [Symbol.iterator]() {
    return new Iterator(this);
  }
}
class Iterator {
  constructor(sortedArray) {
    this._consumed = false;
    this._sortedArray = sortedArray;
    this._current = null;
  }
  next() {
    if (this._consumed) {
      return { value: void 0, done: true };
    }
    this._current = this._current ? this._sortedArray._getNext(this._current) : this._sortedArray.get(0);
    if (!this._current) {
      this._consumed = true;
    }
    return { value: this._current, done: this._consumed };
  }
}
class BaseMappedList extends BaseObservableList {
  constructor(sourceList, mapper, updater, removeCallback) {
    super();
    this._sourceUnsubscribe = null;
    this._mappedValues = null;
    this._sourceList = sourceList;
    this._mapper = mapper;
    this._updater = updater;
    this._removeCallback = removeCallback;
  }
  findAndUpdate(predicate, updater) {
    return findAndUpdateInArray(predicate, this._mappedValues, this, updater);
  }
  get length() {
    return this._mappedValues.length;
  }
  [Symbol.iterator]() {
    return this._mappedValues.values();
  }
}
function runAdd(list, index, mappedValue) {
  list._mappedValues.splice(index, 0, mappedValue);
  list.emitAdd(index, mappedValue);
}
function runUpdate(list, index, value, params) {
  const mappedValue = list._mappedValues[index];
  if (list._updater) {
    list._updater(mappedValue, params, value);
  }
  list.emitUpdate(index, mappedValue, params);
}
function runRemove(list, index) {
  const mappedValue = list._mappedValues[index];
  list._mappedValues.splice(index, 1);
  if (list._removeCallback) {
    list._removeCallback(mappedValue);
  }
  list.emitRemove(index, mappedValue);
}
function runMove(list, fromIdx, toIdx) {
  const mappedValue = list._mappedValues[fromIdx];
  list._mappedValues.splice(fromIdx, 1);
  list._mappedValues.splice(toIdx, 0, mappedValue);
  list.emitMove(fromIdx, toIdx, mappedValue);
}
function runReset(list) {
  list._mappedValues = [];
  list.emitReset();
}
class AsyncMappedList extends BaseMappedList {
  constructor() {
    super(...arguments);
    this._eventQueue = null;
    this._flushing = false;
  }
  onSubscribeFirst() {
    this._sourceUnsubscribe = this._sourceList.subscribe(this);
    this._eventQueue = [];
    this._mappedValues = [];
    let idx = 0;
    for (const item of this._sourceList) {
      this._eventQueue.push(new AddEvent(idx, item));
      idx += 1;
    }
    void this._flush();
  }
  async _flush() {
    if (this._flushing) {
      return;
    }
    this._flushing = true;
    try {
      while (this._eventQueue.length) {
        const event2 = this._eventQueue.shift();
        await event2.run(this);
      }
    } finally {
      this._flushing = false;
    }
  }
  onReset() {
    if (this._eventQueue) {
      this._eventQueue.push(new ResetEvent());
      void this._flush();
    }
  }
  onAdd(index, value) {
    if (this._eventQueue) {
      this._eventQueue.push(new AddEvent(index, value));
      void this._flush();
    }
  }
  onUpdate(index, value, params) {
    if (this._eventQueue) {
      this._eventQueue.push(new UpdateEvent(index, value, params));
      void this._flush();
    }
  }
  onRemove(index) {
    if (this._eventQueue) {
      this._eventQueue.push(new RemoveEvent(index));
      void this._flush();
    }
  }
  onMove(fromIdx, toIdx) {
    if (this._eventQueue) {
      this._eventQueue.push(new MoveEvent(fromIdx, toIdx));
      void this._flush();
    }
  }
  onUnsubscribeLast() {
    this._sourceUnsubscribe();
    this._eventQueue = null;
    this._mappedValues = null;
  }
}
class AddEvent {
  constructor(index, value) {
    this.index = index;
    this.value = value;
  }
  async run(list) {
    const mappedValue = await list._mapper(this.value);
    runAdd(list, this.index, mappedValue);
  }
}
class UpdateEvent {
  constructor(index, value, params) {
    this.index = index;
    this.value = value;
    this.params = params;
  }
  async run(list) {
    runUpdate(list, this.index, this.value, this.params);
  }
}
class RemoveEvent {
  constructor(index) {
    this.index = index;
  }
  async run(list) {
    runRemove(list, this.index);
  }
}
class MoveEvent {
  constructor(fromIdx, toIdx) {
    this.fromIdx = fromIdx;
    this.toIdx = toIdx;
  }
  async run(list) {
    runMove(list, this.fromIdx, this.toIdx);
  }
}
class ResetEvent {
  async run(list) {
    runReset(list);
  }
}
class ConcatList extends BaseObservableList {
  constructor(...sourceLists) {
    super();
    this._sourceUnsubscribes = null;
    this._sourceLists = sourceLists;
  }
  _offsetForSource(sourceList) {
    const listIdx = this._sourceLists.indexOf(sourceList);
    let offset = 0;
    for (let i = 0; i < listIdx; ++i) {
      offset += this._sourceLists[i].length;
    }
    return offset;
  }
  onSubscribeFirst() {
    this._sourceUnsubscribes = this._sourceLists.map((sourceList) => sourceList.subscribe(this));
  }
  onUnsubscribeLast() {
    for (const sourceUnsubscribe of this._sourceUnsubscribes) {
      sourceUnsubscribe();
    }
  }
  onReset() {
    this.emitReset();
    let idx = 0;
    for (const item of this) {
      this.emitAdd(idx, item);
      idx += 1;
    }
  }
  onAdd(index, value, sourceList) {
    this.emitAdd(this._offsetForSource(sourceList) + index, value);
  }
  onUpdate(index, value, params, sourceList) {
    if (!this._sourceUnsubscribes) {
      return;
    }
    this.emitUpdate(this._offsetForSource(sourceList) + index, value, params);
  }
  onRemove(index, value, sourceList) {
    this.emitRemove(this._offsetForSource(sourceList) + index, value);
  }
  onMove(fromIdx, toIdx, value, sourceList) {
    const offset = this._offsetForSource(sourceList);
    this.emitMove(offset + fromIdx, offset + toIdx, value);
  }
  get length() {
    let len = 0;
    for (let i = 0; i < this._sourceLists.length; ++i) {
      len += this._sourceLists[i].length;
    }
    return len;
  }
  [Symbol.iterator]() {
    let sourceListIdx = 0;
    let it = this._sourceLists[0][Symbol.iterator]();
    return {
      next: () => {
        let result = it.next();
        while (result.done) {
          sourceListIdx += 1;
          if (sourceListIdx >= this._sourceLists.length) {
            return result;
          }
          it = this._sourceLists[sourceListIdx][Symbol.iterator]();
          result = it.next();
        }
        return result;
      }
    };
  }
}
function disposeValue(value) {
  if (typeof value === "function") {
    value();
  } else {
    value.dispose();
  }
}
function isDisposable(value) {
  return value && (typeof value === "function" || typeof value.dispose === "function");
}
class Disposables {
  constructor() {
    this._disposables = [];
  }
  track(disposable) {
    if (!isDisposable(disposable)) {
      throw new Error("Not a disposable");
    }
    if (this.isDisposed) {
      console.warn("Disposables already disposed, disposing new value");
      disposeValue(disposable);
      return disposable;
    }
    this._disposables.push(disposable);
    return disposable;
  }
  untrack(disposable) {
    if (this.isDisposed) {
      console.warn("Disposables already disposed, cannot untrack");
      return void 0;
    }
    const idx = this._disposables.indexOf(disposable);
    if (idx >= 0) {
      this._disposables.splice(idx, 1);
    }
    return void 0;
  }
  dispose() {
    if (this._disposables) {
      for (const d of this._disposables) {
        disposeValue(d);
      }
      this._disposables = void 0;
    }
  }
  get isDisposed() {
    return this._disposables === void 0;
  }
  disposeTracked(value) {
    if (value === void 0 || value === null || this.isDisposed) {
      return void 0;
    }
    const idx = this._disposables.indexOf(value);
    if (idx !== -1) {
      const [foundValue] = this._disposables.splice(idx, 1);
      disposeValue(foundValue);
    } else {
      console.warn("disposable not found, did it leak?", value);
    }
    return void 0;
  }
}
class ReaderRequest {
  constructor(fn, log) {
    this.decryptRequest = null;
    this._promise = fn(this, log);
  }
  complete() {
    return this._promise;
  }
  dispose() {
    if (this.decryptRequest) {
      this.decryptRequest.dispose();
      this.decryptRequest = null;
    }
  }
}
async function readRawTimelineEntriesWithTxn(roomId, eventKey, direction, amount, fragmentIdComparer, txn) {
  let entries = [];
  const timelineStore = txn.timelineEvents;
  const fragmentStore = txn.timelineFragments;
  while (entries.length < amount && eventKey) {
    let eventsWithinFragment;
    if (direction.isForward) {
      eventsWithinFragment = await timelineStore.eventsAfter(roomId, eventKey, amount);
    } else {
      eventsWithinFragment = await timelineStore.eventsBefore(roomId, eventKey, amount);
    }
    let eventEntries = eventsWithinFragment.map((e) => new EventEntry(e, fragmentIdComparer));
    entries = directionalConcat(entries, eventEntries, direction);
    if (entries.length < amount) {
      const fragment = await fragmentStore.get(roomId, eventKey.fragmentId);
      let fragmentEntry = new FragmentBoundaryEntry(fragment, direction.isBackward, fragmentIdComparer);
      directionalAppend(entries, fragmentEntry, direction);
      if (!fragmentEntry.token && fragmentEntry.hasLinkedFragment) {
        const nextFragment = await fragmentStore.get(roomId, fragmentEntry.linkedFragmentId);
        fragmentIdComparer.add(nextFragment);
        const nextFragmentEntry = new FragmentBoundaryEntry(nextFragment, direction.isForward, fragmentIdComparer);
        directionalAppend(entries, nextFragmentEntry, direction);
        eventKey = nextFragmentEntry.asEventKey();
      } else {
        eventKey = null;
      }
    }
  }
  return entries;
}
class TimelineReader {
  constructor({ roomId, storage, fragmentIdComparer }) {
    this._roomId = roomId;
    this._storage = storage;
    this._fragmentIdComparer = fragmentIdComparer;
    this._decryptEntries = null;
  }
  enableEncryption(decryptEntries) {
    this._decryptEntries = decryptEntries;
  }
  get readTxnStores() {
    const stores = [
      this._storage.storeNames.timelineEvents,
      this._storage.storeNames.timelineFragments
    ];
    if (this._decryptEntries) {
      stores.push(this._storage.storeNames.inboundGroupSessions);
    }
    return stores;
  }
  readFrom(eventKey, direction, amount, log) {
    return new ReaderRequest(async (r, log2) => {
      const txn = await this._storage.readTxn(this.readTxnStores);
      return await this._readFrom(eventKey, direction, amount, r, txn, log2);
    }, log);
  }
  readFromEnd(amount, existingTxn = null, log) {
    return new ReaderRequest(async (r, log2) => {
      const txn = existingTxn || await this._storage.readTxn(this.readTxnStores);
      const liveFragment = await txn.timelineFragments.liveFragment(this._roomId);
      let entries;
      if (!liveFragment) {
        entries = [];
      } else {
        this._fragmentIdComparer.add(liveFragment);
        const liveFragmentEntry = FragmentBoundaryEntry.end(liveFragment, this._fragmentIdComparer);
        const eventKey = liveFragmentEntry.asEventKey();
        entries = await this._readFrom(eventKey, Direction.Backward, amount, r, txn, log2);
        entries.unshift(liveFragmentEntry);
      }
      return entries;
    }, log);
  }
  async readById(id, log) {
    let stores = [this._storage.storeNames.timelineEvents];
    if (this._decryptEntries) {
      stores.push(this._storage.storeNames.inboundGroupSessions);
    }
    const txn = await this._storage.readTxn(stores);
    const storageEntry = await txn.timelineEvents.getByEventId(this._roomId, id);
    if (storageEntry) {
      const entry = new EventEntry(storageEntry, this._fragmentIdComparer);
      if (this._decryptEntries) {
        const request = this._decryptEntries([entry], txn, log);
        await request.complete();
      }
      return entry;
    }
  }
  async _readFrom(eventKey, direction, amount, r, txn, log) {
    const entries = await readRawTimelineEntriesWithTxn(this._roomId, eventKey, direction, amount, this._fragmentIdComparer, txn);
    if (this._decryptEntries) {
      r.decryptRequest = this._decryptEntries(entries, txn, log);
      try {
        await r.decryptRequest.complete();
      } finally {
        r.decryptRequest = null;
      }
    }
    return entries;
  }
}
class NonPersistedEventEntry extends EventEntry {
  get fragmentId() {
    throw new Error("Cannot access fragmentId for non-persisted EventEntry");
  }
  get entryIndex() {
    throw new Error("Cannot access entryIndex for non-persisted EventEntry");
  }
  get isNonPersisted() {
    return true;
  }
  get isRedacting() {
    return false;
  }
  get isRedacted() {
    return super.isRedacting;
  }
}
class User {
  constructor(userId) {
    this._userId = userId;
  }
  get id() {
    return this._userId;
  }
}
class Timeline {
  constructor({ roomId, storage, closeCallback, fragmentIdComparer, pendingEvents, clock, powerLevelsObservable, hsApi }) {
    this._roomId = roomId;
    this._storage = storage;
    this._closeCallback = closeCallback;
    this._fragmentIdComparer = fragmentIdComparer;
    this._disposables = new Disposables();
    this._pendingEvents = pendingEvents;
    this._clock = clock;
    this._remoteEntries = new SortedArray((a, b) => a.compare(b));
    this._ownMember = null;
    this._timelineReader = new TimelineReader({
      roomId: this._roomId,
      storage: this._storage,
      fragmentIdComparer: this._fragmentIdComparer
    });
    this._readerRequest = null;
    this._allEntries = null;
    this._contextEntriesNotInTimeline = /* @__PURE__ */ new Map();
    this._decryptEntries = null;
    this._hsApi = hsApi;
    this.initializePowerLevels(powerLevelsObservable);
  }
  initializePowerLevels(observable) {
    if (observable) {
      this._powerLevels = observable.get();
      this._disposables.track(observable.subscribe((powerLevels) => this._powerLevels = powerLevels));
    }
  }
  async load(user, membership, log) {
    const txn = await this._storage.readTxn(this._timelineReader.readTxnStores.concat(this._storage.storeNames.roomMembers, this._storage.storeNames.roomState));
    const memberData = await txn.roomMembers.get(this._roomId, user.id);
    if (memberData) {
      this._ownMember = new RoomMember(memberData);
    } else {
      this._ownMember = RoomMember.fromUserId(this._roomId, user.id, membership);
    }
    const readerRequest = this._disposables.track(this._timelineReader.readFromEnd(20, txn, log));
    try {
      const entries = await readerRequest.complete();
      this._loadContextEntriesWhereNeeded(entries);
      this._setupEntries(entries);
    } finally {
      this._disposables.disposeTracked(readerRequest);
    }
  }
  _setupEntries(timelineEntries) {
    this._remoteEntries.setManySorted(timelineEntries);
    if (this._pendingEvents) {
      this._localEntries = new AsyncMappedList(this._pendingEvents, (pe) => this._mapPendingEventToEntry(pe), (pee, params) => {
        pee.notifyUpdate(params);
      }, (pee) => this._applyAndEmitLocalRelationChange(pee, (target) => target.removeLocalRelation(pee)));
    } else {
      this._localEntries = new ObservableArray();
    }
    this._allEntries = new ConcatList(this._remoteEntries, this._localEntries);
  }
  async _mapPendingEventToEntry(pe) {
    let redactingEntry;
    if (pe.eventType === REDACTION_TYPE) {
      redactingEntry = await this._getOrLoadEntry(pe.relatedTxnId, pe.relatedEventId);
    }
    const pee = new PendingEventEntry({
      pendingEvent: pe,
      member: this._ownMember,
      clock: this._clock,
      redactingEntry
    });
    this._loadContextEntriesWhereNeeded([pee]);
    this._applyAndEmitLocalRelationChange(pee, (target) => target.addLocalRelation(pee));
    return pee;
  }
  _applyAndEmitLocalRelationChange(pee, updater) {
    var _a, _b;
    const updateOrFalse = (e) => {
      const params = updater(e);
      return params ? params : false;
    };
    this._findAndUpdateEntryById(pee.pendingEvent.relatedTxnId, pee.relatedEventId, updateOrFalse);
    if (pee.redactingEntry) {
      const relatedTxnId = (_a = pee.redactingEntry.pendingEvent) == null ? void 0 : _a.relatedTxnId;
      this._findAndUpdateEntryById(relatedTxnId, pee.redactingEntry.relatedEventId, updateOrFalse);
      (_b = pee.redactingEntry.contextForEntries) == null ? void 0 : _b.forEach((e) => this._emitUpdateForEntry(e, "contextEntry"));
    }
  }
  _findAndUpdateEntryById(txnId, eventId, updateOrFalse) {
    let found = false;
    if (txnId) {
      found = this._localEntries.findAndUpdate((e) => e.id === txnId, updateOrFalse);
    }
    if (!found && eventId) {
      this._remoteEntries.findAndUpdate((e) => e.id === eventId, updateOrFalse);
    }
  }
  async getOwnAnnotationEntry(targetId, key) {
    const txn = await this._storage.readWriteTxn([
      this._storage.storeNames.timelineEvents,
      this._storage.storeNames.timelineRelations
    ]);
    const relations = await txn.timelineRelations.getForTargetAndType(this._roomId, targetId, ANNOTATION_RELATION_TYPE);
    for (const relation of relations) {
      const annotation = await txn.timelineEvents.getByEventId(this._roomId, relation.sourceEventId);
      if (annotation && annotation.event.sender === this._ownMember.userId && getRelation(annotation.event).key === key) {
        const eventEntry = new EventEntry(annotation, this._fragmentIdComparer);
        this._addLocalRelationsToNewRemoteEntries([eventEntry]);
        return eventEntry;
      }
    }
    return null;
  }
  updateOwnMember(member) {
    this._ownMember = member;
  }
  _addLocalRelationsToNewRemoteEntries(entries) {
    var _a;
    if (!((_a = this._localEntries) == null ? void 0 : _a.hasSubscriptions)) {
      return;
    }
    for (const pee of this._localEntries) {
      if (pee.relatedEventId) {
        const relationTarget = entries.find((e) => e.id === pee.relatedEventId);
        relationTarget == null ? void 0 : relationTarget.addLocalRelation(pee);
      }
      if (pee.redactingEntry) {
        const eventId = pee.redactingEntry.relatedEventId;
        const relationTarget = entries.find((e) => e.id === eventId);
        relationTarget == null ? void 0 : relationTarget.addLocalRelation(pee);
      }
    }
  }
  static _entryUpdater(existingEntry, entry) {
    var _a;
    (_a = existingEntry.contextForEntries) == null ? void 0 : _a.forEach((event2) => event2.setContextEntry(entry));
    entry.updateFrom(existingEntry);
    return entry;
  }
  replaceEntries(entries) {
    var _a;
    this._addLocalRelationsToNewRemoteEntries(entries);
    for (const entry of entries) {
      try {
        this._remoteEntries.getAndUpdate(entry, Timeline._entryUpdater);
        const oldEntry = this._contextEntriesNotInTimeline.get(entry.id);
        if (oldEntry) {
          Timeline._entryUpdater(oldEntry, entry);
          this._contextEntriesNotInTimeline.set(entry.id, entry);
        }
        (_a = entry.contextForEntries) == null ? void 0 : _a.forEach((e) => this._emitUpdateForEntry(e, "contextEntry"));
      } catch (err) {
        if (err.name === "CompareError") {
          continue;
        } else {
          throw err;
        }
      }
    }
  }
  addEntries(newEntries) {
    this._addLocalRelationsToNewRemoteEntries(newEntries);
    this._updateEntriesFetchedFromHomeserver(newEntries);
    this._moveEntryToRemoteEntries(newEntries);
    this._loadContextEntriesWhereNeeded(newEntries);
    this._remoteEntries.setManySorted(newEntries);
  }
  _updateEntriesFetchedFromHomeserver(entries) {
    var _a;
    for (const entry of entries) {
      const relatedEntry = this._contextEntriesNotInTimeline.get(entry.relatedEventId);
      if ((relatedEntry == null ? void 0 : relatedEntry.isNonPersisted) && (relatedEntry == null ? void 0 : relatedEntry.addLocalRelation(entry))) {
        (_a = relatedEntry.contextForEntries) == null ? void 0 : _a.forEach((e) => this._emitUpdateForEntry(e, "contextEntry"));
      }
    }
  }
  _moveEntryToRemoteEntries(entries) {
    for (const entry of entries) {
      const fetchedEntry = this._contextEntriesNotInTimeline.get(entry.id);
      if (fetchedEntry) {
        fetchedEntry.contextForEntries.forEach((e) => {
          e.setContextEntry(entry);
          this._emitUpdateForEntry(e, "contextEntry");
        });
        this._contextEntriesNotInTimeline.delete(entry.id);
      }
    }
  }
  _emitUpdateForEntry(entry, param) {
    const txnId = entry.isPending ? entry.id : null;
    const eventId = entry.isPending ? null : entry.id;
    this._findAndUpdateEntryById(txnId, eventId, () => param);
  }
  async _loadContextEntriesWhereNeeded(entries) {
    for (const entry of entries) {
      if (!entry.contextEventId) {
        continue;
      }
      const id = entry.contextEventId;
      let contextEvent = entries.find((e) => e.id === id);
      if (!contextEvent) {
        contextEvent = this._findLoadedEventById(id);
      }
      if (contextEvent) {
        entry.setContextEntry(contextEvent);
      } else {
        this._loadContextEntryNotInTimeline(entry);
      }
    }
  }
  async _loadContextEntryNotInTimeline(entry) {
    const id = entry.contextEventId;
    let contextEvent = await this._getEventFromStorage(id);
    if (!contextEvent) {
      contextEvent = await this._getEventFromHomeserver(id);
    }
    if (contextEvent) {
      this._contextEntriesNotInTimeline.set(id, contextEvent);
      entry.setContextEntry(contextEvent);
      this._emitUpdateForEntry(entry, "contextEntry");
    }
  }
  _findLoadedEventById(eventId) {
    var _a;
    return (_a = this.getByEventId(eventId)) != null ? _a : this._contextEntriesNotInTimeline.get(eventId);
  }
  async _getEventFromStorage(eventId) {
    const entry = await this._timelineReader.readById(eventId);
    return entry;
  }
  async _getEventFromHomeserver(eventId) {
    const response = await this._hsApi.context(this._roomId, eventId, 0).response();
    const sender = response.event.sender;
    const member = response.state.find((e) => e.type === EVENT_TYPE$1 && e.user_id === sender);
    const entry = {
      event: response.event,
      displayName: member.content.displayname,
      avatarUrl: member.content.avatar_url
    };
    const eventEntry = new NonPersistedEventEntry(entry, this._fragmentIdComparer);
    if (this._decryptEntries) {
      const request = this._decryptEntries([eventEntry]);
      await request.complete();
    }
    return eventEntry;
  }
  async loadAtTop(amount) {
    if (this._disposables.isDisposed) {
      return true;
    }
    const firstEventEntry = this._remoteEntries.array.find((e) => !!e.eventType);
    if (!firstEventEntry) {
      return true;
    }
    const readerRequest = this._disposables.track(this._timelineReader.readFrom(firstEventEntry.asEventKey(), Direction.Backward, amount));
    try {
      const entries = await readerRequest.complete();
      this.addEntries(entries);
      return entries.length < amount;
    } finally {
      this._disposables.disposeTracked(readerRequest);
    }
  }
  async _getOrLoadEntry(txnId, eventId) {
    var _a;
    if (txnId) {
      for (const p of this._localEntries) {
        if (p.id === txnId) {
          return p;
        }
      }
    }
    if (eventId) {
      return (_a = this.getByEventId(eventId)) != null ? _a : await this._getEventFromStorage(eventId);
    }
    return null;
  }
  getByEventId(eventId) {
    for (let i = 0; i < this._remoteEntries.length; i += 1) {
      const entry = this._remoteEntries.get(i);
      if (entry.id === eventId) {
        return entry;
      }
    }
    return null;
  }
  get entries() {
    return this._allEntries;
  }
  get remoteEntries() {
    return this._remoteEntries.array;
  }
  dispose() {
    if (this._closeCallback) {
      this._disposables.dispose();
      this._closeCallback();
      this._closeCallback = null;
    }
  }
  enableEncryption(decryptEntries) {
    this._decryptEntries = decryptEntries;
    this._timelineReader.enableEncryption(decryptEntries);
  }
  get powerLevels() {
    return this._powerLevels;
  }
  get me() {
    return this._ownMember;
  }
}
async function loadMembers({ roomId, storage, txn }) {
  if (!txn) {
    txn = await storage.readTxn([
      storage.storeNames.roomMembers
    ]);
  }
  const memberDatas = await txn.roomMembers.getAll(roomId);
  return memberDatas.map((d) => new RoomMember(d));
}
async function fetchMembers({ summary, syncToken, roomId, hsApi, storage, setChangedMembersMap }, log) {
  const changedMembersDuringSync = /* @__PURE__ */ new Map();
  setChangedMembersMap(changedMembersDuringSync);
  const memberResponse = await hsApi.members(roomId, { at: syncToken }, { log }).response();
  const txn = await storage.readWriteTxn([
    storage.storeNames.roomSummary,
    storage.storeNames.roomMembers
  ]);
  let summaryChanges;
  let members;
  try {
    summaryChanges = summary.writeHasFetchedMembers(true, txn);
    const { roomMembers } = txn;
    const memberEvents = memberResponse.chunk;
    if (!Array.isArray(memberEvents)) {
      throw new Error("malformed");
    }
    log.set("members", memberEvents.length);
    members = await Promise.all(memberEvents.map(async (memberEvent) => {
      const userId = memberEvent == null ? void 0 : memberEvent.state_key;
      if (!userId) {
        throw new Error("malformed");
      }
      const changedMember = changedMembersDuringSync.get(userId);
      if (changedMember) {
        return changedMember;
      } else {
        const member = RoomMember.fromMemberEvent(roomId, memberEvent);
        if (member) {
          roomMembers.set(member.serialize());
        }
        return member;
      }
    }));
  } catch (err) {
    txn.abort();
    throw err;
  } finally {
    setChangedMembersMap(null);
  }
  await txn.complete();
  summary.applyChanges(summaryChanges);
  return members;
}
async function fetchOrLoadMembers(options, logger) {
  const { summary } = options;
  if (!summary.data.hasFetchedMembers) {
    return logger.wrapOrRun(options.log, "fetchMembers", (log) => fetchMembers(options, log));
  } else {
    return loadMembers(options);
  }
}
async function fetchOrLoadMember(options, logger) {
  const member = await loadMember(options);
  const { summary } = options;
  if (!summary.data.hasFetchedMembers && !member) {
    return logger.wrapOrRun(options.log, "fetchMember", (log) => fetchMember(options, log));
  }
  return member;
}
async function loadMember({ roomId, userId, storage }) {
  const txn = await storage.readTxn([storage.storeNames.roomMembers]);
  const member = await txn.roomMembers.get(roomId, userId);
  return member ? new RoomMember(member) : null;
}
async function fetchMember({ roomId, userId, hsApi, storage }, log) {
  let memberData;
  try {
    memberData = await hsApi.state(roomId, "m.room.member", userId, { log }).response();
  } catch (error) {
    if (error.name === "HomeServerError" && error.errcode === "M_NOT_FOUND") {
      return null;
    }
    throw error;
  }
  const member = new RoomMember({
    roomId,
    userId,
    membership: memberData.membership,
    avatarUrl: memberData.avatar_url,
    displayName: memberData.displayname
  });
  const txn = await storage.readWriteTxn([storage.storeNames.roomMembers]);
  try {
    txn.roomMembers.set(member.serialize());
  } catch (e) {
    txn.abort();
    throw e;
  }
  await txn.complete();
  return member;
}
class RetainedValue {
  constructor(freeCallback) {
    this._retentionCount = 1;
    this._freeCallback = freeCallback;
  }
  retain() {
    this._retentionCount += 1;
  }
  release() {
    this._retentionCount -= 1;
    if (this._retentionCount === 0) {
      this._freeCallback();
    }
  }
}
class MemberList extends RetainedValue {
  constructor({ members, closeCallback }) {
    super(closeCallback);
    this._members = new ObservableMap();
    for (const member of members) {
      this._members.add(member.userId, member);
    }
  }
  afterSync(memberChanges) {
    for (const [userId, memberChange] of memberChanges.entries()) {
      this._members.set(userId, memberChange.member);
    }
  }
  get members() {
    return this._members;
  }
}
function calculateRoomName(sortedMembers, summaryData, log) {
  const countWithoutMe = summaryData.joinCount + summaryData.inviteCount - 1;
  if (sortedMembers.length >= countWithoutMe) {
    if (sortedMembers.length > 1) {
      const lastMember = sortedMembers[sortedMembers.length - 1];
      const firstMembers = sortedMembers.slice(0, sortedMembers.length - 1);
      return firstMembers.map((m) => m.name).join(", ") + " and " + lastMember.name;
    } else {
      const otherMember = sortedMembers[0];
      if (otherMember) {
        return otherMember.name;
      } else {
        log.log({ l: "could get get other member name", length: sortedMembers.length, otherMember: !!otherMember, otherMemberMembership: otherMember == null ? void 0 : otherMember.membership });
        return "Unknown DM Name";
      }
    }
  } else if (sortedMembers.length < countWithoutMe) {
    return sortedMembers.map((m) => m.name).join(", ") + ` and ${countWithoutMe} others`;
  } else {
    return null;
  }
}
class Heroes {
  constructor(roomId) {
    this._roomId = roomId;
    this._members = /* @__PURE__ */ new Map();
  }
  async calculateChanges(newHeroes, memberChanges, txn) {
    const updatedHeroMembers = /* @__PURE__ */ new Map();
    const removedUserIds = [];
    for (const existingUserId of this._members.keys()) {
      if (newHeroes.indexOf(existingUserId) === -1) {
        removedUserIds.push(existingUserId);
      }
    }
    for (const [userId, memberChange] of memberChanges.entries()) {
      if (this._members.has(userId) || newHeroes.indexOf(userId) !== -1) {
        updatedHeroMembers.set(userId, memberChange.member);
      }
    }
    for (const userId of newHeroes) {
      if (!this._members.has(userId) && !updatedHeroMembers.has(userId)) {
        const memberData = await txn.roomMembers.get(this._roomId, userId);
        if (memberData) {
          const member = new RoomMember(memberData);
          updatedHeroMembers.set(member.userId, member);
        }
      }
    }
    return { updatedHeroMembers: updatedHeroMembers.values(), removedUserIds };
  }
  applyChanges({ updatedHeroMembers, removedUserIds }, summaryData, log) {
    for (const userId of removedUserIds) {
      this._members.delete(userId);
    }
    for (const member of updatedHeroMembers) {
      if (!removedUserIds.includes(member.userId)) {
        this._members.set(member.userId, member);
      }
    }
    const sortedMembers = Array.from(this._members.values()).sort((a, b) => a.name.localeCompare(b.name));
    this._roomName = calculateRoomName(sortedMembers, summaryData, log);
  }
  get roomName() {
    return this._roomName;
  }
  get roomAvatarUrl() {
    if (this._members.size === 1) {
      for (const member of this._members.values()) {
        return member.avatarUrl;
      }
    }
    return null;
  }
  get roomAvatarColorId() {
    if (this._members.size === 1) {
      for (const member of this._members.keys()) {
        return member;
      }
    }
    return null;
  }
}
class ObservedEventMap {
  constructor(notifyEmpty) {
    this._map = /* @__PURE__ */ new Map();
    this._notifyEmpty = notifyEmpty;
  }
  observe(eventId, eventEntry = null) {
    let observable = this._map.get(eventId);
    if (!observable) {
      observable = new ObservedEvent(this, eventEntry, eventId);
      this._map.set(eventId, observable);
    }
    return observable;
  }
  updateEvents(eventEntries) {
    for (let i = 0; i < eventEntries.length; i += 1) {
      const entry = eventEntries[i];
      const observable = this._map.get(entry.id);
      observable == null ? void 0 : observable.update(entry);
    }
  }
  _remove(id) {
    this._map.delete(id);
    if (this._map.size === 0) {
      this._notifyEmpty();
    }
  }
}
class ObservedEvent extends BaseObservableValue {
  constructor(eventMap, entry, id) {
    super();
    this._eventMap = eventMap;
    this._entry = entry;
    this._id = id;
    Promise.resolve().then(() => {
      if (!this.hasSubscriptions) {
        this._eventMap._remove(this._id);
        this._eventMap = null;
      }
    });
  }
  subscribe(handler) {
    if (!this._eventMap) {
      throw new Error("ObservedEvent expired, subscribe right after calling room.observeEvent()");
    }
    return super.subscribe(handler);
  }
  onUnsubscribeLast() {
    this._eventMap._remove(this._id);
    this._eventMap = null;
    super.onUnsubscribeLast();
  }
  update(entry) {
    this._entry = entry;
    this.emit(this._entry);
  }
  get() {
    return this._entry;
  }
}
function ensureLogItem(logItem) {
  return logItem || Instance.item;
}
const EVENT_TYPE = "m.room.power_levels";
class PowerLevels {
  constructor({ powerLevelEvent, createEvent, ownUserId, membership }) {
    this._plEvent = powerLevelEvent;
    this._createEvent = createEvent;
    this._ownUserId = ownUserId;
    this._membership = membership;
  }
  canRedactFromSender(userId) {
    if (userId === this._ownUserId && this._membership === "join") {
      return true;
    } else {
      return this.canRedact;
    }
  }
  canSendType(eventType) {
    return this._myLevel >= this._getEventTypeLevel(eventType);
  }
  get canRedact() {
    return this._myLevel >= this._getActionLevel("redact");
  }
  get _myLevel() {
    if (this._membership !== "join") {
      return Number.MIN_SAFE_INTEGER;
    }
    return this.getUserLevel(this._ownUserId);
  }
  getUserLevel(userId) {
    var _a, _b, _c2, _d2;
    if (this._plEvent) {
      let userLevel = (_b = (_a = this._plEvent.content) == null ? void 0 : _a.users) == null ? void 0 : _b[userId];
      if (typeof userLevel !== "number") {
        userLevel = (_c2 = this._plEvent.content) == null ? void 0 : _c2.users_default;
      }
      if (typeof userLevel === "number") {
        return userLevel;
      }
    } else if (this._createEvent) {
      if (userId === ((_d2 = this._createEvent.content) == null ? void 0 : _d2.creator)) {
        return 100;
      }
    }
    return 0;
  }
  _getActionLevel(action) {
    var _a;
    const level = (_a = this._plEvent) == null ? void 0 : _a.content[action];
    if (typeof level === "number") {
      return level;
    } else {
      return 50;
    }
  }
  _getEventTypeLevel(eventType) {
    var _a, _b, _c2, _d2, _e;
    const level = (_c2 = (_b = (_a = this._plEvent) == null ? void 0 : _a.content) == null ? void 0 : _b.events) == null ? void 0 : _c2[eventType];
    if (typeof level === "number") {
      return level;
    } else {
      const level2 = (_e = (_d2 = this._plEvent) == null ? void 0 : _d2.content) == null ? void 0 : _e.events_default;
      if (typeof level2 === "number") {
        return level2;
      } else {
        return 0;
      }
    }
  }
}
const EVENT_ENCRYPTED_TYPE$1 = "m.room.encrypted";
class BaseRoom extends EventEmitter {
  constructor({ roomId, storage, hsApi, mediaRepository, emitCollectionChange, user, createRoomEncryption, getSyncToken, platform: platform2 }) {
    super();
    this._roomId = roomId;
    this._storage = storage;
    this._hsApi = hsApi;
    this._mediaRepository = mediaRepository;
    this._summary = new RoomSummary(roomId);
    this._fragmentIdComparer = new FragmentIdComparer([]);
    this._emitCollectionChange = emitCollectionChange;
    this._timeline = null;
    this._user = user;
    this._changedMembersDuringSync = null;
    this._memberList = null;
    this._createRoomEncryption = createRoomEncryption;
    this._roomEncryption = null;
    this._getSyncToken = getSyncToken;
    this._platform = platform2;
    this._observedEvents = null;
    this._powerLevels = null;
    this._powerLevelLoading = null;
    this._observedMembers = null;
  }
  async _eventIdsToEntries(eventIds, txn) {
    const retryEntries = [];
    await Promise.all(eventIds.map(async (eventId) => {
      const storageEntry = await txn.timelineEvents.getByEventId(this._roomId, eventId);
      if (storageEntry) {
        retryEntries.push(new EventEntry(storageEntry, this._fragmentIdComparer));
      }
    }));
    return retryEntries;
  }
  _getAdditionalTimelineRetryEntries(otherRetryEntries, roomKeys) {
    let retryTimelineEntries = this._roomEncryption.filterUndecryptedEventEntriesForKeys(this._timeline.remoteEntries, roomKeys);
    const existingIds = otherRetryEntries.reduce((ids, e) => {
      ids.add(e.id);
      return ids;
    }, /* @__PURE__ */ new Set());
    retryTimelineEntries = retryTimelineEntries.filter((e) => !existingIds.has(e.id));
    return retryTimelineEntries;
  }
  async notifyRoomKey(roomKey, eventIds, log) {
    var _a;
    if (!this._roomEncryption) {
      return;
    }
    const txn = await this._storage.readTxn([
      this._storage.storeNames.timelineEvents,
      this._storage.storeNames.inboundGroupSessions
    ]);
    let retryEntries = await this._eventIdsToEntries(eventIds, txn);
    if (this._timeline) {
      const retryTimelineEntries = this._getAdditionalTimelineRetryEntries(retryEntries, [roomKey]);
      retryEntries = retryEntries.concat(retryTimelineEntries);
    }
    if (retryEntries.length) {
      const decryptRequest = this._decryptEntries(DecryptionSource.Retry, retryEntries, txn, log);
      await decryptRequest.complete();
      (_a = this._timeline) == null ? void 0 : _a.replaceEntries(retryEntries);
      const changes = this._summary.data.applyTimelineEntries(retryEntries, false, false);
      if (await this._summary.writeAndApplyData(changes, this._storage)) {
        this._emitUpdate();
      }
    }
  }
  _setEncryption(roomEncryption) {
    if (roomEncryption && !this._roomEncryption) {
      this._roomEncryption = roomEncryption;
      if (this._timeline) {
        this._timeline.enableEncryption(this._decryptEntries.bind(this, DecryptionSource.Timeline));
      }
      return true;
    }
    return false;
  }
  _decryptEntries(source, entries, inboundSessionTxn, log = null) {
    const request = new DecryptionRequest(async (r, log2) => {
      if (!inboundSessionTxn) {
        inboundSessionTxn = await this._storage.readTxn([this._storage.storeNames.inboundGroupSessions]);
      }
      if (r.cancelled)
        return;
      const events = entries.filter((entry) => {
        return entry.eventType === EVENT_ENCRYPTED_TYPE$1;
      }).map((entry) => entry.event);
      r.preparation = await this._roomEncryption.prepareDecryptAll(events, null, source, inboundSessionTxn);
      if (r.cancelled)
        return;
      const changes = await r.preparation.decrypt();
      r.preparation = null;
      if (r.cancelled)
        return;
      const stores = [this._storage.storeNames.groupSessionDecryptions];
      const isTimelineOpen = this._isTimelineOpen;
      if (isTimelineOpen) {
        stores.push(this._storage.storeNames.deviceIdentities);
      }
      const writeTxn = await this._storage.readWriteTxn(stores);
      let decryption;
      try {
        decryption = await changes.write(writeTxn, log2);
        if (isTimelineOpen) {
          await decryption.verifyKnownSenders(writeTxn);
        }
      } catch (err) {
        writeTxn.abort();
        throw err;
      }
      await writeTxn.complete();
      decryption.applyToEntries(entries);
      if (this._observedEvents) {
        this._observedEvents.updateEvents(entries);
      }
      if (isTimelineOpen && decryption.hasUnverifiedSenders) {
        log2.wrapDetached("fetch unknown senders keys", async (log3) => {
          var _a, _b;
          const newlyVerifiedDecryption = await decryption.fetchAndVerifyRemainingSenders(this._hsApi, log3);
          const verifiedEntries = [];
          newlyVerifiedDecryption.applyToEntries(entries, (entry) => verifiedEntries.push(entry));
          (_a = this._timeline) == null ? void 0 : _a.replaceEntries(verifiedEntries);
          (_b = this._observedEvents) == null ? void 0 : _b.updateEvents(verifiedEntries);
        });
      }
    }, ensureLogItem(log));
    return request;
  }
  async _getSyncRetryDecryptEntries(newKeys, roomEncryption, txn) {
    const entriesPerKey = await Promise.all(newKeys.map(async (key) => {
      const retryEventIds = await roomEncryption.getEventIdsForMissingKey(key, txn);
      if (retryEventIds) {
        return this._eventIdsToEntries(retryEventIds, txn);
      }
    }));
    let retryEntries = entriesPerKey.reduce((allEntries, entries) => entries ? allEntries.concat(entries) : allEntries, []);
    if (this._timeline) {
      const retryTimelineEntries = this._getAdditionalTimelineRetryEntries(retryEntries, newKeys);
      const retryTimelineEntriesCopies = retryTimelineEntries.map((e) => e.clone());
      retryEntries = retryEntries.concat(retryTimelineEntriesCopies);
    }
    return retryEntries;
  }
  async load(summary, txn, log) {
    log.set("id", this.id);
    try {
      if (summary) {
        this._summary.load(summary);
      }
      if (this._summary.data.encryption) {
        const roomEncryption = this._createRoomEncryption(this, this._summary.data.encryption);
        this._setEncryption(roomEncryption);
      }
      if (this._summary.data.needsHeroes) {
        this._heroes = new Heroes(this._roomId);
        const changes = await this._heroes.calculateChanges(this._summary.data.heroes, [], txn);
        this._heroes.applyChanges(changes, this._summary.data, log);
      }
    } catch (err) {
      throw new WrappedError(`Could not load room ${this._roomId}`, err);
    }
  }
  async observeMember(userId) {
    if (!this._observedMembers) {
      this._observedMembers = /* @__PURE__ */ new Map();
    }
    const mapMember = this._observedMembers.get(userId);
    if (mapMember) {
      return mapMember;
    }
    const member = await fetchOrLoadMember({
      summary: this._summary,
      roomId: this._roomId,
      userId,
      storage: this._storage,
      hsApi: this._hsApi
    }, this._platform.logger);
    if (!member) {
      return null;
    }
    const observableMember = new RetainedObservableValue(member, () => this._observedMembers.delete(userId));
    this._observedMembers.set(userId, observableMember);
    return observableMember;
  }
  async loadMemberList(txn = void 0, log = null) {
    if (this._memberList) {
      this._memberList.retain();
      return this._memberList;
    } else {
      const members = await fetchOrLoadMembers({
        summary: this._summary,
        roomId: this._roomId,
        hsApi: this._hsApi,
        storage: this._storage,
        txn,
        syncToken: this._getSyncToken(),
        setChangedMembersMap: (map) => this._changedMembersDuringSync = map,
        log
      }, this._platform.logger);
      this._memberList = new MemberList({
        members,
        closeCallback: () => {
          this._memberList = null;
        }
      });
      return this._memberList;
    }
  }
  fillGap(fragmentEntry, amount, log = null) {
    return this._platform.logger.wrapOrRun(log, "fillGap", async (log2) => {
      log2.set("id", this.id);
      log2.set("fragment", fragmentEntry.fragmentId);
      log2.set("dir", fragmentEntry.direction.asApiString());
      if (fragmentEntry.edgeReached) {
        log2.set("edgeReached", true);
        return;
      }
      const response = await this._hsApi.messages(this._roomId, {
        from: fragmentEntry.token,
        dir: fragmentEntry.direction.asApiString(),
        limit: amount,
        filter: {
          lazy_load_members: true,
          include_redundant_members: true
        }
      }, { log: log2 }).response();
      const txn = await this._storage.readWriteTxn([
        this._storage.storeNames.pendingEvents,
        this._storage.storeNames.timelineEvents,
        this._storage.storeNames.timelineRelations,
        this._storage.storeNames.timelineFragments
      ]);
      let extraGapFillChanges;
      let gapResult;
      try {
        extraGapFillChanges = await this._writeGapFill(response.chunk, txn, log2);
        const relationWriter = new RelationWriter({
          roomId: this._roomId,
          fragmentIdComparer: this._fragmentIdComparer,
          ownUserId: this._user.id
        });
        const gapWriter = new GapWriter({
          roomId: this._roomId,
          storage: this._storage,
          fragmentIdComparer: this._fragmentIdComparer,
          relationWriter
        });
        gapResult = await gapWriter.writeFragmentFill(fragmentEntry, response, txn, log2);
      } catch (err) {
        txn.abort();
        throw err;
      }
      await txn.complete();
      if (this._roomEncryption) {
        const decryptRequest = this._decryptEntries(DecryptionSource.Timeline, gapResult.entries, null, log2);
        await decryptRequest.complete();
      }
      for (const fragment of gapResult.fragments) {
        this._fragmentIdComparer.add(fragment);
      }
      if (extraGapFillChanges) {
        this._applyGapFill(extraGapFillChanges);
      }
      if (this._timeline) {
        this._timeline.replaceEntries(gapResult.updatedEntries);
        this._timeline.addEntries(gapResult.entries);
      }
    });
  }
  async _writeGapFill(chunk, txn, log) {
  }
  _applyGapFill() {
  }
  get name() {
    if (this._heroes) {
      return this._heroes.roomName;
    }
    const summaryData = this._summary.data;
    if (summaryData.name) {
      return summaryData.name;
    }
    if (summaryData.canonicalAlias) {
      return summaryData.canonicalAlias;
    }
    return null;
  }
  get id() {
    return this._roomId;
  }
  get avatarUrl() {
    if (this._summary.data.avatarUrl) {
      return this._summary.data.avatarUrl;
    } else if (this._heroes) {
      return this._heroes.roomAvatarUrl;
    }
    return null;
  }
  get avatarColorId() {
    return this._roomId;
  }
  get lastMessageTimestamp() {
    return this._summary.data.lastMessageTimestamp;
  }
  get isLowPriority() {
    const tags = this._summary.data.tags;
    return !!(tags && tags["m.lowpriority"]);
  }
  get isEncrypted() {
    return !!this._summary.data.encryption;
  }
  get isJoined() {
    return this.membership === "join";
  }
  get isLeft() {
    return this.membership === "leave";
  }
  get canonicalAlias() {
    return this._summary.data.canonicalAlias;
  }
  get joinedMemberCount() {
    return this._summary.data.joinCount;
  }
  get mediaRepository() {
    return this._mediaRepository;
  }
  get membership() {
    return this._summary.data.membership;
  }
  isDirectMessageForUserId(userId) {
    if (this._summary.data.dmUserId === userId) {
      return true;
    } else {
      const { heroes, joinCount, inviteCount } = this._summary.data;
      if (heroes && heroes.includes(userId) && joinCount + inviteCount === 2) {
        return true;
      }
    }
    return false;
  }
  async _loadPowerLevels() {
    const txn = await this._storage.readTxn([this._storage.storeNames.roomState]);
    const powerLevelsState = await txn.roomState.get(this._roomId, "m.room.power_levels", "");
    if (powerLevelsState) {
      return new PowerLevels({
        powerLevelEvent: powerLevelsState.event,
        ownUserId: this._user.id,
        membership: this.membership
      });
    }
    const createState = await txn.roomState.get(this._roomId, "m.room.create", "");
    if (createState) {
      return new PowerLevels({
        createEvent: createState.event,
        ownUserId: this._user.id,
        membership: this.membership
      });
    } else {
      const membership = this.membership;
      return new PowerLevels({ ownUserId: this._user.id, membership });
    }
  }
  async observePowerLevels() {
    if (this._powerLevelLoading) {
      await this._powerLevelLoading;
    }
    let observable = this._powerLevels;
    if (!observable) {
      this._powerLevelLoading = this._loadPowerLevels();
      const powerLevels = await this._powerLevelLoading;
      observable = new RetainedObservableValue(powerLevels, () => {
        this._powerLevels = null;
      });
      this._powerLevels = observable;
      this._powerLevelLoading = null;
    }
    return observable;
  }
  enableKeyBackup(keyBackup) {
    var _a;
    (_a = this._roomEncryption) == null ? void 0 : _a.enableKeyBackup(keyBackup);
    if (this._timeline && keyBackup) {
      this._platform.logger.run("enableKeyBackup", (log) => {
        return this._roomEncryption.restoreMissingSessionsFromBackup(this._timeline.remoteEntries, log);
      });
    }
  }
  get _isTimelineOpen() {
    return !!this._timeline;
  }
  _emitUpdate() {
    this.emit("change");
    this._emitCollectionChange(this);
  }
  openTimeline(log = null) {
    return this._platform.logger.wrapOrRun(log, "open timeline", async (log2) => {
      log2.set("id", this.id);
      if (this._timeline) {
        throw new Error("not dealing with load race here for now");
      }
      this._timeline = new Timeline({
        roomId: this.id,
        storage: this._storage,
        fragmentIdComparer: this._fragmentIdComparer,
        pendingEvents: this._getPendingEvents(),
        closeCallback: () => {
          this._timeline = null;
          if (this._roomEncryption) {
            this._roomEncryption.notifyTimelineClosed();
          }
        },
        clock: this._platform.clock,
        logger: this._platform.logger,
        powerLevelsObservable: await this.observePowerLevels(),
        hsApi: this._hsApi
      });
      try {
        if (this._roomEncryption) {
          this._timeline.enableEncryption(this._decryptEntries.bind(this, DecryptionSource.Timeline));
        }
        await this._timeline.load(this._user, this.membership, log2);
      } catch (err) {
        this._timeline.dispose();
        throw err;
      }
      return this._timeline;
    });
  }
  _getPendingEvents() {
    return null;
  }
  observeEvent(eventId) {
    if (!this._observedEvents) {
      this._observedEvents = new ObservedEventMap(() => {
        this._observedEvents = null;
      });
    }
    let entry = null;
    if (this._timeline) {
      entry = this._timeline.getByEventId(eventId);
    }
    const observable = this._observedEvents.observe(eventId, entry);
    if (!entry) {
      this._readEventById(eventId).then((entry2) => {
        observable.update(entry2);
      }).catch((err) => {
        console.warn(`could not load event ${eventId} from storage`, err);
      });
    }
    return observable;
  }
  async _readEventById(eventId) {
    const reader = new TimelineReader({ roomId: this._roomId, storage: this._storage, fragmentIdComparer: this._fragmentIdComparer });
    const entry = await reader.readById(eventId);
    return entry;
  }
  dispose() {
    var _a, _b;
    (_a = this._roomEncryption) == null ? void 0 : _a.dispose();
    (_b = this._timeline) == null ? void 0 : _b.dispose();
  }
}
class DecryptionRequest {
  constructor(decryptFn, log) {
    this._cancelled = false;
    this.preparation = null;
    this._promise = log.wrap("decryptEntries", (log2) => decryptFn(this, log2));
  }
  complete() {
    return this._promise;
  }
  get cancelled() {
    return this._cancelled;
  }
  dispose() {
    this._cancelled = true;
    if (this.preparation) {
      this.preparation.dispose();
    }
  }
}
function makeTxnId() {
  const n = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const str = n.toString(16);
  return "t" + "0".repeat(14 - str.length) + str;
}
function isTxnId(txnId) {
  return txnId.startsWith("t") && txnId.length === 15;
}
class SendQueue {
  constructor({ roomId, storage, hsApi, pendingEvents }) {
    pendingEvents = pendingEvents || [];
    this._roomId = roomId;
    this._storage = storage;
    this._hsApi = hsApi;
    this._pendingEvents = new SortedArray((a, b) => a.queueIndex - b.queueIndex);
    this._pendingEvents.setManyUnsorted(pendingEvents.map((data) => this._createPendingEvent(data)));
    this._isSending = false;
    this._offline = false;
    this._roomEncryption = null;
    this._currentQueueIndex = 0;
  }
  _createPendingEvent(data, attachments = null) {
    const pendingEvent = new PendingEvent({
      data,
      remove: () => this._removeEvent(pendingEvent),
      emitUpdate: (params) => this._pendingEvents.update(pendingEvent, params),
      attachments
    });
    return pendingEvent;
  }
  enableEncryption(roomEncryption) {
    this._roomEncryption = roomEncryption;
  }
  _sendLoop(log) {
    this._isSending = true;
    this._sendLoopLogItem = log.runDetached("send queue flush", async (log2) => {
      try {
        for (const pendingEvent of this._pendingEvents) {
          await log2.wrap("send event", async (log3) => {
            log3.set("queueIndex", pendingEvent.queueIndex);
            try {
              this._currentQueueIndex = pendingEvent.queueIndex;
              await this._sendEvent(pendingEvent, log3);
            } catch (err) {
              if (err instanceof ConnectionError) {
                this._offline = true;
                log3.set("offline", true);
                pendingEvent.setWaiting();
              } else {
                log3.catch(err);
                const isPermanentError = err.name === "HomeServerError" && (err.statusCode === 400 || err.statusCode === 403 || err.statusCode === 404);
                if (isPermanentError) {
                  log3.set("remove", true);
                  await pendingEvent.abort();
                } else {
                  pendingEvent.setError(err);
                }
              }
            } finally {
              this._currentQueueIndex = 0;
            }
          });
        }
      } finally {
        this._isSending = false;
        this._sendLoopLogItem = null;
      }
    });
  }
  async _sendEvent(pendingEvent, log) {
    if (pendingEvent.needsUpload) {
      await log.wrap("upload attachments", (log2) => pendingEvent.uploadAttachments(this._hsApi, log2));
      await this._tryUpdateEvent(pendingEvent);
    }
    if (pendingEvent.needsEncryption) {
      pendingEvent.setEncrypting();
      const encryptionContent = pendingEvent.contentForEncryption;
      const { type, content } = await log.wrap("encrypt", (log2) => this._roomEncryption.encrypt(pendingEvent.eventType, encryptionContent, this._hsApi, log2));
      pendingEvent.setEncrypted(type, content);
      await this._tryUpdateEvent(pendingEvent);
    }
    if (pendingEvent.needsSending) {
      await pendingEvent.send(this._hsApi, log);
      const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
      try {
        await this._tryUpdateEventWithTxn(pendingEvent, txn);
        await this._resolveRemoteIdInPendingRelations(pendingEvent.txnId, pendingEvent.remoteId, txn);
      } catch (err) {
        txn.abort();
        throw err;
      }
      await txn.complete();
    }
  }
  async _resolveRemoteIdInPendingRelations(txnId, remoteId, txn) {
    const relatedEventWithoutRemoteId = this._pendingEvents.array.filter((pe) => {
      return pe.relatedTxnId === txnId && pe.relatedEventId !== remoteId;
    });
    for (const relatedPE of relatedEventWithoutRemoteId) {
      relatedPE.setRelatedEventId(remoteId);
      await this._tryUpdateEventWithTxn(relatedPE, txn);
    }
    return relatedEventWithoutRemoteId;
  }
  async removeRemoteEchos(events, txn, parentLog) {
    const removed = [];
    for (const event2 of events) {
      const txnId = event2.unsigned && event2.unsigned.transaction_id;
      let idx;
      if (txnId) {
        idx = this._pendingEvents.array.findIndex((pe) => pe.txnId === txnId);
      } else {
        idx = this._pendingEvents.array.findIndex((pe) => pe.remoteId === event2.event_id);
      }
      if (idx !== -1) {
        const pendingEvent = this._pendingEvents.get(idx);
        const remoteId = event2.event_id;
        parentLog.log({ l: "removeRemoteEcho", queueIndex: pendingEvent.queueIndex, remoteId, txnId });
        txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
        removed.push(pendingEvent);
        await this._resolveRemoteIdInPendingRelations(txnId, remoteId, txn);
      }
    }
    return removed;
  }
  async _removeEvent(pendingEvent) {
    let hasEvent = this._pendingEvents.array.indexOf(pendingEvent) !== -1;
    if (hasEvent) {
      const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
      try {
        txn.pendingEvents.remove(pendingEvent.roomId, pendingEvent.queueIndex);
      } catch (err) {
        txn.abort();
      }
      await txn.complete();
      const idx = this._pendingEvents.array.indexOf(pendingEvent);
      if (idx !== -1) {
        this._pendingEvents.remove(idx);
      }
    }
    pendingEvent.dispose();
  }
  emitRemovals(pendingEvents) {
    for (const pendingEvent of pendingEvents) {
      const idx = this._pendingEvents.array.indexOf(pendingEvent);
      if (idx !== -1) {
        this._pendingEvents.remove(idx);
      }
      pendingEvent.dispose();
    }
  }
  resumeSending(parentLog) {
    this._offline = false;
    if (this._pendingEvents.length) {
      parentLog.wrap("resumeSending", (log) => {
        log.set("id", this._roomId);
        log.set("pendingEvents", this._pendingEvents.length);
        if (!this._isSending) {
          this._sendLoop(log);
        }
        if (this._sendLoopLogItem) {
          log.refDetached(this._sendLoopLogItem);
        }
      });
    }
  }
  async enqueueEvent(eventType, content, attachments, log) {
    const relation = getRelationFromContent(content);
    let relatedTxnId = null;
    if (relation) {
      const relationTarget = getRelationTarget(relation);
      if (isTxnId(relationTarget)) {
        relatedTxnId = relationTarget;
        setRelationTarget(relation, null);
      }
      if (relation.rel_type === ANNOTATION_RELATION_TYPE) {
        const isAlreadyAnnotating = this._pendingEvents.array.some((pe) => {
          const r = getRelationFromContent(pe.content);
          return pe.eventType === eventType && r && r.key === relation.key && (pe.relatedTxnId === relatedTxnId || r.event_id === relation.event_id);
        });
        if (isAlreadyAnnotating) {
          log.set("already_annotating", true);
          return;
        }
      }
    }
    await this._enqueueEvent(eventType, content, attachments, relatedTxnId, null, log);
  }
  async _enqueueEvent(eventType, content, attachments, relatedTxnId, relatedEventId, log) {
    const pendingEvent = await this._createAndStoreEvent(eventType, content, relatedTxnId, relatedEventId, attachments);
    this._pendingEvents.set(pendingEvent);
    log.set("queueIndex", pendingEvent.queueIndex);
    log.set("pendingEvents", this._pendingEvents.length);
    if (!this._isSending && !this._offline) {
      this._sendLoop(log);
    }
    if (this._sendLoopLogItem) {
      log.refDetached(this._sendLoopLogItem);
    }
  }
  async enqueueRedaction(eventIdOrTxnId, reason, log) {
    const isAlreadyRedacting = this._pendingEvents.array.some((pe) => {
      return pe.eventType === REDACTION_TYPE && (pe.relatedTxnId === eventIdOrTxnId || pe.relatedEventId === eventIdOrTxnId);
    });
    if (isAlreadyRedacting) {
      log.set("already_redacting", true);
      return;
    }
    let relatedTxnId;
    let relatedEventId;
    if (isTxnId(eventIdOrTxnId)) {
      relatedTxnId = eventIdOrTxnId;
      const txnId = eventIdOrTxnId;
      const pe = this._pendingEvents.array.find((pe2) => pe2.txnId === txnId);
      if (pe && !pe.remoteId && pe.status !== SendStatus.Sending) {
        log.set("remove", relatedTxnId);
        await pe.abort();
        return;
      } else if (pe) {
        relatedEventId = pe.remoteId;
      } else {
        return;
      }
    } else {
      relatedEventId = eventIdOrTxnId;
      const pe = this._pendingEvents.array.find((pe2) => pe2.remoteId === relatedEventId);
      if (pe) {
        relatedTxnId = pe.txnId;
      }
    }
    log.set("relatedTxnId", relatedTxnId);
    log.set("relatedEventId", relatedEventId);
    await this._enqueueEvent(REDACTION_TYPE, { reason }, null, relatedTxnId, relatedEventId, log);
  }
  get pendingEvents() {
    return this._pendingEvents;
  }
  async _tryUpdateEvent(pendingEvent) {
    const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
    try {
      this._tryUpdateEventWithTxn(pendingEvent, txn);
    } catch (err) {
      txn.abort();
      throw err;
    }
    await txn.complete();
  }
  async _tryUpdateEventWithTxn(pendingEvent, txn) {
    if (await txn.pendingEvents.exists(pendingEvent.roomId, pendingEvent.queueIndex)) {
      txn.pendingEvents.update(pendingEvent.data);
    }
  }
  async _createAndStoreEvent(eventType, content, relatedTxnId, relatedEventId, attachments) {
    const txn = await this._storage.readWriteTxn([this._storage.storeNames.pendingEvents]);
    let pendingEvent;
    try {
      const pendingEventsStore = txn.pendingEvents;
      const maxStorageQueueIndex = await pendingEventsStore.getMaxQueueIndex(this._roomId) || 0;
      const maxQueueIndex = Math.max(maxStorageQueueIndex, this._currentQueueIndex);
      const queueIndex = maxQueueIndex + 1;
      const needsEncryption = eventType !== REDACTION_TYPE && eventType !== REACTION_TYPE && !!this._roomEncryption;
      pendingEvent = this._createPendingEvent({
        roomId: this._roomId,
        queueIndex,
        eventType,
        content,
        relatedTxnId,
        relatedEventId,
        txnId: makeTxnId(),
        needsEncryption,
        needsUpload: !!attachments
      }, attachments);
      pendingEventsStore.add(pendingEvent.data);
    } catch (err) {
      txn.abort();
      throw err;
    }
    await txn.complete();
    return pendingEvent;
  }
  dispose() {
    for (const pe of this._pendingEvents) {
      pe.dispose();
    }
  }
}
class AttachmentUpload {
  constructor({ filename, blob, platform: platform2 }) {
    this._filename = filename;
    this._unencryptedBlob = blob;
    this._transferredBlob = this._unencryptedBlob;
    this._platform = platform2;
    this._mxcUrl = null;
    this._encryptionInfo = null;
    this._uploadRequest = null;
    this._aborted = false;
    this._error = null;
    this._sentBytes = 0;
  }
  get size() {
    return this._transferredBlob.size;
  }
  get sentBytes() {
    return this._sentBytes;
  }
  abort() {
    var _a;
    (_a = this._uploadRequest) == null ? void 0 : _a.abort();
  }
  get localPreview() {
    return this._unencryptedBlob;
  }
  async encrypt() {
    if (this._encryptionInfo) {
      throw new Error("already encrypted");
    }
    const { info, blob } = await encryptAttachment(this._platform, this._transferredBlob);
    this._transferredBlob = blob;
    this._encryptionInfo = info;
  }
  async upload(hsApi, progressCallback, log) {
    this._uploadRequest = hsApi.uploadAttachment(this._transferredBlob, this._filename, {
      uploadProgress: (sentBytes) => {
        this._sentBytes = sentBytes;
        progressCallback();
      },
      log
    });
    const { content_uri } = await this._uploadRequest.response();
    this._mxcUrl = content_uri;
  }
  applyToContent(urlPath, content) {
    if (!this._mxcUrl) {
      throw new Error("upload has not finished");
    }
    let prefix = urlPath.substr(0, urlPath.lastIndexOf("url"));
    setPath(`${prefix}info.size`, content, this._transferredBlob.size);
    setPath(`${prefix}info.mimetype`, content, this._unencryptedBlob.mimeType);
    if (this._encryptionInfo) {
      setPath(`${prefix}file`, content, Object.assign(this._encryptionInfo, {
        mimetype: this._unencryptedBlob.mimeType,
        url: this._mxcUrl
      }));
    } else {
      setPath(`${prefix}url`, content, this._mxcUrl);
    }
  }
  dispose() {
    this._unencryptedBlob.dispose();
    this._transferredBlob.dispose();
  }
}
function setPath(path, content, value) {
  const parts = path.split(".");
  let obj = content;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!obj[key]) {
      obj[key] = {};
    }
    obj = obj[key];
  }
  const propKey = parts[parts.length - 1];
  obj[propKey] = value;
}
const EVENT_ENCRYPTED_TYPE = "m.room.encrypted";
class Room extends BaseRoom {
  constructor(options) {
    super(options);
    const { pendingEvents } = options;
    const relationWriter = new RelationWriter({
      roomId: this.id,
      fragmentIdComparer: this._fragmentIdComparer,
      ownUserId: this._user.id
    });
    this._syncWriter = new SyncWriter({
      roomId: this.id,
      fragmentIdComparer: this._fragmentIdComparer,
      relationWriter,
      memberWriter: new MemberWriter(this.id)
    });
    this._sendQueue = new SendQueue({ roomId: this.id, storage: this._storage, hsApi: this._hsApi, pendingEvents });
  }
  _setEncryption(roomEncryption) {
    if (super._setEncryption(roomEncryption)) {
      this._sendQueue.enableEncryption(this._roomEncryption);
      return true;
    }
    return false;
  }
  async prepareSync(roomResponse, membership, newKeys, txn, log) {
    var _a;
    log.set("id", this.id);
    if (newKeys) {
      log.set("newKeys", newKeys.length);
    }
    let summaryChanges = this._summary.data.applySyncResponse(roomResponse, membership, this._user.id);
    let roomEncryption = this._roomEncryption;
    if (!roomEncryption && summaryChanges.encryption) {
      log.set("enableEncryption", true);
      roomEncryption = this._createRoomEncryption(this, summaryChanges.encryption);
    }
    let retryEntries;
    let decryptPreparation;
    if (roomEncryption) {
      let eventsToDecrypt = ((_a = roomResponse == null ? void 0 : roomResponse.timeline) == null ? void 0 : _a.events) || [];
      if (newKeys) {
        retryEntries = await this._getSyncRetryDecryptEntries(newKeys, roomEncryption, txn);
        if (retryEntries.length) {
          log.set("retry", retryEntries.length);
          eventsToDecrypt = eventsToDecrypt.concat(retryEntries.map((entry) => entry.event));
        }
      }
      eventsToDecrypt = eventsToDecrypt.filter((event2) => {
        return (event2 == null ? void 0 : event2.type) === EVENT_ENCRYPTED_TYPE;
      });
      if (eventsToDecrypt.length) {
        decryptPreparation = await roomEncryption.prepareDecryptAll(eventsToDecrypt, newKeys, DecryptionSource.Sync, txn);
      }
    }
    return {
      roomEncryption,
      summaryChanges,
      decryptPreparation,
      decryptChanges: null,
      retryEntries
    };
  }
  async afterPrepareSync(preparation, parentLog) {
    if (preparation.decryptPreparation) {
      await parentLog.wrap("decrypt", async (log) => {
        log.set("id", this.id);
        preparation.decryptChanges = await preparation.decryptPreparation.decrypt();
        preparation.decryptPreparation = null;
      }, parentLog.level.Detail);
    }
  }
  async writeSync(roomResponse, isInitialSync, { summaryChanges, decryptChanges, roomEncryption, retryEntries }, txn, log) {
    var _a;
    log.set("id", this.id);
    const isRejoin = summaryChanges.isNewJoin(this._summary.data);
    if (isRejoin) {
      txn.roomState.removeAllForRoom(this.id);
      txn.roomMembers.removeAllForRoom(this.id);
    }
    const { entries: newEntries, updatedEntries, newLiveKey, memberChanges } = await log.wrap("syncWriter", (log2) => this._syncWriter.writeSync(roomResponse, isRejoin, summaryChanges.hasFetchedMembers, txn, log2), log.level.Detail);
    let decryption;
    if (decryptChanges) {
      decryption = await log.wrap("decryptChanges", (log2) => decryptChanges.write(txn, log2));
      log.set("decryptionResults", decryption.results.size);
      log.set("decryptionErrors", decryption.errors.size);
      if (this._isTimelineOpen) {
        await decryption.verifyKnownSenders(txn);
      }
      decryption.applyToEntries(newEntries);
      if (retryEntries == null ? void 0 : retryEntries.length) {
        decryption.applyToEntries(retryEntries);
        updatedEntries.push(...retryEntries);
      }
    }
    log.set("newEntries", newEntries.length);
    log.set("updatedEntries", updatedEntries.length);
    let encryptionChanges;
    if (roomEncryption) {
      encryptionChanges = await roomEncryption.writeSync(roomResponse, memberChanges, txn, log);
      log.set("shouldFlushKeyShares", encryptionChanges.shouldFlush);
    }
    const allEntries = newEntries.concat(updatedEntries);
    summaryChanges = summaryChanges.applyTimelineEntries(allEntries, isInitialSync, !this._isTimelineOpen, this._user.id);
    if (summaryChanges.membership !== "join") {
      txn.roomSummary.remove(this.id);
    } else {
      summaryChanges = this._summary.writeData(summaryChanges, txn);
    }
    if (summaryChanges) {
      log.set("summaryChanges", summaryChanges.changedKeys(this._summary.data));
    }
    let heroChanges;
    if (summaryChanges == null ? void 0 : summaryChanges.needsHeroes) {
      if (!this._heroes) {
        this._heroes = new Heroes(this._roomId);
      }
      heroChanges = await this._heroes.calculateChanges(summaryChanges.heroes, memberChanges, txn);
    }
    let removedPendingEvents;
    if (Array.isArray((_a = roomResponse.timeline) == null ? void 0 : _a.events)) {
      removedPendingEvents = await this._sendQueue.removeRemoteEchos(roomResponse.timeline.events, txn, log);
    }
    const powerLevelsEvent = this._getPowerLevelsEvent(roomResponse);
    return {
      summaryChanges,
      roomEncryption,
      newEntries,
      updatedEntries,
      newLiveKey,
      removedPendingEvents,
      memberChanges,
      heroChanges,
      powerLevelsEvent,
      encryptionChanges,
      decryption
    };
  }
  afterSync(changes, log) {
    const {
      summaryChanges,
      newEntries,
      updatedEntries,
      newLiveKey,
      removedPendingEvents,
      memberChanges,
      powerLevelsEvent,
      heroChanges,
      roomEncryption,
      encryptionChanges
    } = changes;
    log.set("id", this.id);
    this._syncWriter.afterSync(newLiveKey);
    this._setEncryption(roomEncryption);
    if (this._roomEncryption) {
      this._roomEncryption.afterSync(encryptionChanges);
    }
    if (memberChanges.size) {
      if (this._changedMembersDuringSync) {
        for (const [userId, memberChange] of memberChanges.entries()) {
          this._changedMembersDuringSync.set(userId, memberChange.member);
        }
      }
      if (this._memberList) {
        this._memberList.afterSync(memberChanges);
      }
      if (this._observedMembers) {
        this._updateObservedMembers(memberChanges);
      }
      if (this._timeline) {
        for (const [userId, memberChange] of memberChanges.entries()) {
          if (userId === this._user.id) {
            this._timeline.updateOwnMember(memberChange.member);
            break;
          }
        }
      }
    }
    let emitChange = false;
    if (summaryChanges) {
      this._summary.applyChanges(summaryChanges);
      if (!this._summary.data.needsHeroes) {
        this._heroes = null;
      }
      emitChange = true;
    }
    if (this._heroes && heroChanges) {
      const oldName = this.name;
      this._heroes.applyChanges(heroChanges, this._summary.data, log);
      if (oldName !== this.name) {
        emitChange = true;
      }
    }
    if (powerLevelsEvent) {
      this._updatePowerLevels(powerLevelsEvent);
    }
    if (emitChange) {
      this._emitUpdate();
    }
    if (this._timeline) {
      this._timeline.replaceEntries(updatedEntries);
      this._timeline.addEntries(newEntries);
    }
    if (this._observedEvents) {
      this._observedEvents.updateEvents(updatedEntries);
      this._observedEvents.updateEvents(newEntries);
    }
    if (removedPendingEvents) {
      this._sendQueue.emitRemovals(removedPendingEvents);
    }
  }
  _updateObservedMembers(memberChanges) {
    for (const [userId, memberChange] of memberChanges) {
      const observableMember = this._observedMembers.get(userId);
      if (observableMember) {
        observableMember.set(memberChange.member);
      }
    }
  }
  _getPowerLevelsEvent(roomResponse) {
    var _a, _b, _c2;
    const isPowerlevelEvent = (event2) => event2.state_key === "" && event2.type === EVENT_TYPE;
    const powerLevelEvent = (_c2 = (_a = roomResponse.timeline) == null ? void 0 : _a.events.find(isPowerlevelEvent)) != null ? _c2 : (_b = roomResponse.state) == null ? void 0 : _b.events.find(isPowerlevelEvent);
    return powerLevelEvent;
  }
  _updatePowerLevels(powerLevelEvent) {
    if (this._powerLevels) {
      const newPowerLevels = new PowerLevels({
        powerLevelEvent,
        ownUserId: this._user.id,
        membership: this.membership
      });
      this._powerLevels.set(newPowerLevels);
    }
  }
  async afterSyncCompleted({ encryptionChanges, decryption, newEntries, updatedEntries }, log) {
    const shouldFlushKeys = encryptionChanges == null ? void 0 : encryptionChanges.shouldFlush;
    const shouldFetchUnverifiedSenders = this._isTimelineOpen && (decryption == null ? void 0 : decryption.hasUnverifiedSenders);
    if (shouldFlushKeys || shouldFetchUnverifiedSenders) {
      await log.wrap({ l: "room", id: this.id }, async (log2) => {
        const promises = [];
        if (shouldFlushKeys) {
          promises.push(this._roomEncryption.flushPendingRoomKeyShares(this._hsApi, null, log2));
        }
        if (shouldFetchUnverifiedSenders) {
          const promise = log2.wrap("verify senders", async (log3) => {
            var _a, _b;
            const newlyVerifiedDecryption = await decryption.fetchAndVerifyRemainingSenders(this._hsApi, log3);
            const verifiedEntries = [];
            const updateCallback = (entry) => verifiedEntries.push(entry);
            newlyVerifiedDecryption.applyToEntries(newEntries, updateCallback);
            newlyVerifiedDecryption.applyToEntries(updatedEntries, updateCallback);
            log3.set("verifiedEntries", verifiedEntries.length);
            (_a = this._timeline) == null ? void 0 : _a.replaceEntries(verifiedEntries);
            (_b = this._observedEvents) == null ? void 0 : _b.updateEvents(verifiedEntries);
          });
          promises.push(promise);
        }
        await Promise.all(promises);
      });
    }
  }
  start(pendingOperations, parentLog) {
    if (this._roomEncryption) {
      const roomKeyShares = pendingOperations == null ? void 0 : pendingOperations.get("share_room_key");
      if (roomKeyShares) {
        parentLog.wrapDetached("flush room keys", (log) => {
          log.set("id", this.id);
          return this._roomEncryption.flushPendingRoomKeyShares(this._hsApi, roomKeyShares, log);
        });
      }
    }
    this._sendQueue.resumeSending(parentLog);
  }
  async load(summary, txn, log) {
    try {
      await super.load(summary, txn, log);
      await this._syncWriter.load(txn, log);
    } catch (err) {
      throw new WrappedError(`Could not load room ${this._roomId}`, err);
    }
  }
  async _writeGapFill(gapChunk, txn, log) {
    const removedPendingEvents = await this._sendQueue.removeRemoteEchos(gapChunk, txn, log);
    return removedPendingEvents;
  }
  _applyGapFill(removedPendingEvents) {
    this._sendQueue.emitRemovals(removedPendingEvents);
  }
  sendEvent(eventType, content, attachments, log = null) {
    return this._platform.logger.wrapOrRun(log, "send", (log2) => {
      log2.set("id", this.id);
      return this._sendQueue.enqueueEvent(eventType, content, attachments, log2);
    });
  }
  sendRedaction(eventIdOrTxnId, reason, log = null) {
    return this._platform.logger.wrapOrRun(log, "redact", (log2) => {
      log2.set("id", this.id);
      return this._sendQueue.enqueueRedaction(eventIdOrTxnId, reason, log2);
    });
  }
  async ensureMessageKeyIsShared(log = null) {
    if (!this._roomEncryption) {
      return;
    }
    return this._platform.logger.wrapOrRun(log, "ensureMessageKeyIsShared", (log2) => {
      log2.set("id", this.id);
      return this._roomEncryption.ensureMessageKeyIsShared(this._hsApi, log2);
    });
  }
  get avatarColorId() {
    var _a;
    return ((_a = this._heroes) == null ? void 0 : _a.roomAvatarColorId) || this._roomId;
  }
  get isUnread() {
    return this._summary.data.isUnread;
  }
  get notificationCount() {
    return this._summary.data.notificationCount;
  }
  get highlightCount() {
    return this._summary.data.highlightCount;
  }
  get isTrackingMembers() {
    return this._summary.data.isTrackingMembers;
  }
  async _getLastEventId() {
    var _a;
    const lastKey = this._syncWriter.lastMessageKey;
    if (lastKey) {
      const txn = await this._storage.readTxn([
        this._storage.storeNames.timelineEvents
      ]);
      const eventEntry = await txn.timelineEvents.get(this._roomId, lastKey);
      return (_a = eventEntry == null ? void 0 : eventEntry.event) == null ? void 0 : _a.event_id;
    }
  }
  async clearUnread(log = null) {
    if (this.isUnread || this.notificationCount) {
      return await this._platform.logger.wrapOrRun(log, "clearUnread", async (log2) => {
        log2.set("id", this.id);
        const txn = await this._storage.readWriteTxn([
          this._storage.storeNames.roomSummary
        ]);
        let data;
        try {
          data = this._summary.writeClearUnread(txn);
        } catch (err) {
          txn.abort();
          throw err;
        }
        await txn.complete();
        this._summary.applyChanges(data);
        this._emitUpdate();
        try {
          const lastEventId = await this._getLastEventId();
          if (lastEventId) {
            await this._hsApi.receipt(this._roomId, "m.read", lastEventId);
          }
        } catch (err) {
          if (err.name !== "ConnectionError") {
            throw err;
          }
        }
      });
    }
  }
  leave(log = null) {
    return this._platform.logger.wrapOrRun(log, "leave room", async (log2) => {
      log2.set("id", this.id);
      await this._hsApi.leave(this.id, { log: log2 }).response();
    });
  }
  _getPendingEvents() {
    return this._sendQueue.pendingEvents;
  }
  writeIsTrackingMembers(value, txn) {
    return this._summary.writeIsTrackingMembers(value, txn);
  }
  applyIsTrackingMembersChanges(changes) {
    this._summary.applyChanges(changes);
  }
  createAttachment(blob, filename) {
    return new AttachmentUpload({ blob, filename, platform: this._platform });
  }
  dispose() {
    super.dispose();
    this._sendQueue.dispose();
  }
}
class ArchivedRoom extends BaseRoom {
  constructor(options) {
    super(options);
    this._releaseCallback = options.releaseCallback;
    this._forgetCallback = options.forgetCallback;
    this._retentionCount = 1;
    this._kickDetails = null;
    this._kickedBy = null;
  }
  retain() {
    this._retentionCount += 1;
  }
  release() {
    this._retentionCount -= 1;
    if (this._retentionCount === 0) {
      this._releaseCallback();
    }
  }
  async _getKickAuthor(sender, txn) {
    const senderMember = await txn.roomMembers.get(this.id, sender);
    if (senderMember) {
      return new RoomMember(senderMember);
    } else {
      return RoomMember.fromUserId(this.id, sender, "join");
    }
  }
  async load(archivedRoomSummary, txn, log) {
    const { summary, kickDetails } = archivedRoomSummary;
    this._kickDetails = kickDetails;
    if (this._kickDetails) {
      this._kickedBy = await this._getKickAuthor(this._kickDetails.sender, txn);
    }
    return super.load(summary, txn, log);
  }
  async writeSync(joinedSummaryData, roomResponse, membership, txn, log) {
    log.set("id", this.id);
    if (membership === "leave") {
      const newKickDetails = findKickDetails(roomResponse, this._user.id);
      if (newKickDetails || joinedSummaryData) {
        const kickDetails = newKickDetails || this._kickDetails;
        let kickedBy;
        if (newKickDetails) {
          kickedBy = await this._getKickAuthor(newKickDetails.sender, txn);
        }
        const summaryData = joinedSummaryData || this._summary.data;
        txn.archivedRoomSummary.set({
          summary: summaryData.serialize(),
          kickDetails
        });
        return { kickDetails, kickedBy, summaryData };
      }
    } else if (membership === "join") {
      txn.archivedRoomSummary.remove(this.id);
    }
    return {};
  }
  afterSync({ summaryData, kickDetails, kickedBy }, log) {
    log.set("id", this.id);
    if (summaryData) {
      this._summary.applyChanges(summaryData);
    }
    if (kickDetails) {
      this._kickDetails = kickDetails;
    }
    if (kickedBy) {
      this._kickedBy = kickedBy;
    }
    this._emitUpdate();
  }
  get isKicked() {
    var _a;
    return ((_a = this._kickDetails) == null ? void 0 : _a.membership) === "leave";
  }
  get isBanned() {
    var _a;
    return ((_a = this._kickDetails) == null ? void 0 : _a.membership) === "ban";
  }
  get kickedBy() {
    return this._kickedBy;
  }
  get kickReason() {
    var _a;
    return (_a = this._kickDetails) == null ? void 0 : _a.reason;
  }
  isArchived() {
    return true;
  }
  forget(log = null) {
    return this._platform.logger.wrapOrRun(log, "forget room", async (log2) => {
      log2.set("id", this.id);
      await this._hsApi.forget(this.id, { log: log2 }).response();
      const storeNames = this._storage.storeNames;
      const txn = await this._storage.readWriteTxn([
        storeNames.roomState,
        storeNames.archivedRoomSummary,
        storeNames.roomMembers,
        storeNames.timelineEvents,
        storeNames.timelineFragments,
        storeNames.timelineRelations,
        storeNames.pendingEvents,
        storeNames.inboundGroupSessions,
        storeNames.groupSessionDecryptions,
        storeNames.operations
      ]);
      txn.roomState.removeAllForRoom(this.id);
      txn.archivedRoomSummary.remove(this.id);
      txn.roomMembers.removeAllForRoom(this.id);
      txn.timelineEvents.removeAllForRoom(this.id);
      txn.timelineFragments.removeAllForRoom(this.id);
      txn.timelineRelations.removeAllForRoom(this.id);
      txn.pendingEvents.removeAllForRoom(this.id);
      txn.inboundGroupSessions.removeAllForRoom(this.id);
      txn.groupSessionDecryptions.removeAllForRoom(this.id);
      await txn.operations.removeAllForScope(this.id);
      await txn.complete();
      this._retentionCount = 0;
      this._releaseCallback();
      this._forgetCallback(this.id);
    });
  }
  join(log = null) {
    return this._platform.logger.wrapOrRun(log, "rejoin archived room", async (log2) => {
      await this._hsApi.join(this.id, { log: log2 }).response();
    });
  }
}
function findKickDetails(roomResponse, ownUserId) {
  var _a, _b;
  const kickEvent = reduceStateEvents(roomResponse, (kickEvent2, event2) => {
    if (event2.type === EVENT_TYPE$1) {
      if (event2.state_key === ownUserId && event2.sender !== event2.state_key) {
        kickEvent2 = event2;
      }
    }
    return kickEvent2;
  }, null);
  if (kickEvent) {
    return {
      membership: (_a = kickEvent.content) == null ? void 0 : _a.membership,
      reason: (_b = kickEvent.content) == null ? void 0 : _b.reason,
      sender: kickEvent.sender
    };
  }
}
async function loadProfiles(userIds, hsApi, log) {
  const profiles = await Promise.all(userIds.map(async (userId) => {
    const response = await hsApi.profile(userId, { log }).response();
    return new Profile(userId, response.displayname, response.avatar_url);
  }));
  profiles.sort((a, b) => a.name.localeCompare(b.name));
  return profiles;
}
class Profile {
  constructor(userId, displayName, avatarUrl) {
    this.userId = userId;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
  }
  get name() {
    return this.displayName || this.userId;
  }
}
class UserIdProfile {
  constructor(userId) {
    this.userId = userId;
  }
  get displayName() {
    return void 0;
  }
  get name() {
    return this.userId;
  }
  get avatarUrl() {
    return void 0;
  }
}
function defaultE2EEStatusForType(type) {
  switch (type) {
    case RoomType.DirectMessage:
    case RoomType.Private:
      return true;
    case RoomType.Public:
      return false;
  }
}
function presetForType(type) {
  switch (type) {
    case RoomType.DirectMessage:
      return "trusted_private_chat";
    case RoomType.Private:
      return "private_chat";
    case RoomType.Public:
      return "public_chat";
  }
}
class RoomBeingCreated extends EventEmitter {
  constructor(id, options, updateCallback, mediaRepository, platform2, log) {
    var _a;
    super();
    this.id = id;
    this.options = options;
    this.updateCallback = updateCallback;
    this.mediaRepository = mediaRepository;
    this.platform = platform2;
    this.profiles = [];
    this._isCancelled = false;
    this.isEncrypted = options.isEncrypted === void 0 ? defaultE2EEStatusForType(options.type) : options.isEncrypted;
    if (options.name) {
      this._calculatedName = options.name;
    } else {
      const summaryData = {
        joinCount: 1,
        inviteCount: ((_a = options.invites) == null ? void 0 : _a.length) || 0
      };
      const userIdProfiles = (options.invites || []).map((userId) => new UserIdProfile(userId));
      this._calculatedName = calculateRoomName(userIdProfiles, summaryData, log);
    }
  }
  async create(hsApi, log) {
    try {
      let avatarEventContent;
      if (this.options.avatar) {
        const { avatar } = this.options;
        const attachment = new AttachmentUpload({ filename: avatar.name, blob: avatar.blob, platform: this.platform });
        await attachment.upload(hsApi, () => {
        }, log);
        avatarEventContent = {
          info: avatar.info
        };
        attachment.applyToContent("url", avatarEventContent);
      }
      const createOptions = {
        is_direct: this.options.type === RoomType.DirectMessage,
        preset: presetForType(this.options.type),
        initial_state: []
      };
      if (this.options.name) {
        createOptions.name = this.options.name;
      }
      if (this.options.topic) {
        createOptions.topic = this.options.topic;
      }
      if (this.options.invites) {
        createOptions.invite = this.options.invites;
      }
      if (this.options.alias) {
        createOptions.room_alias_name = this.options.alias;
      }
      if (this.options.isFederationDisabled === true) {
        createOptions.creation_content = {
          "m.federate": false
        };
      }
      if (this.options.powerLevelContentOverride) {
        createOptions.power_level_content_override = this.options.powerLevelContentOverride;
      }
      if (this.isEncrypted) {
        createOptions.initial_state.push(createRoomEncryptionEvent());
      }
      if (avatarEventContent) {
        createOptions.initial_state.push({
          type: "m.room.avatar",
          state_key: "",
          content: avatarEventContent
        });
      }
      const response = await hsApi.createRoom(createOptions, { log }).response();
      this._roomId = response["room_id"];
    } catch (err) {
      this._error = err;
    }
    this.emitChange();
  }
  async loadProfiles(hsApi, log) {
    try {
      if (!this.options.name && this.options.invites) {
        this.profiles = await loadProfiles(this.options.invites, hsApi, log);
        const summaryData = {
          joinCount: 1,
          inviteCount: this.options.invites.length
        };
        this._calculatedName = calculateRoomName(this.profiles, summaryData, log);
        this.emitChange();
      }
    } catch (err) {
    }
  }
  emitChange(params) {
    this.updateCallback(this, params);
    this.emit("change");
  }
  get avatarColorId() {
    var _a, _b, _c2;
    return (_c2 = (_b = (_a = this.options.invites) == null ? void 0 : _a[0]) != null ? _b : this._roomId) != null ? _c2 : this.id;
  }
  get avatarUrl() {
    var _a, _b;
    return (_b = (_a = this.profiles) == null ? void 0 : _a[0]) == null ? void 0 : _b.avatarUrl;
  }
  get avatarBlobUrl() {
    var _a, _b;
    return (_b = (_a = this.options.avatar) == null ? void 0 : _a.blob) == null ? void 0 : _b.url;
  }
  get roomId() {
    return this._roomId;
  }
  get name() {
    return this._calculatedName;
  }
  get isBeingCreated() {
    return true;
  }
  get error() {
    return this._error;
  }
  cancel() {
    if (!this._isCancelled) {
      this.dispose();
      this._isCancelled = true;
      this.emitChange("isCancelled");
    }
  }
  get isCancelled() {
    return this._isCancelled;
  }
  dispose() {
    if (this.options.avatar) {
      this.options.avatar.blob.dispose();
    }
  }
  async adjustDirectMessageMapIfNeeded(user, storage, hsApi, log) {
    if (!this.options.invites || this.options.type !== RoomType.DirectMessage) {
      return;
    }
    const userId = this.options.invites[0];
    const DM_MAP_TYPE = "m.direct";
    await log.wrap("set " + DM_MAP_TYPE, async (log2) => {
      try {
        const txn = await storage.readWriteTxn([storage.storeNames.accountData]);
        let mapEntry;
        try {
          mapEntry = await txn.accountData.get(DM_MAP_TYPE);
          if (!mapEntry) {
            mapEntry = { type: DM_MAP_TYPE, content: {} };
          }
          const map = mapEntry.content;
          let userRooms = map[userId];
          if (!userRooms) {
            map[userId] = userRooms = [];
          }
          userRooms.push(this._roomId);
          txn.accountData.set(mapEntry);
          await txn.complete();
        } catch (err) {
          txn.abort();
          throw err;
        }
        await hsApi.setAccountData(user.id, DM_MAP_TYPE, mapEntry.content, { log: log2 }).response();
      } catch (err) {
        log2.catch(err);
      }
    });
  }
}
class Invite extends EventEmitter {
  constructor({ roomId, user, hsApi, mediaRepository, emitCollectionRemove, emitCollectionUpdate, platform: platform2 }) {
    super();
    this._roomId = roomId;
    this._user = user;
    this._hsApi = hsApi;
    this._emitCollectionRemove = emitCollectionRemove;
    this._emitCollectionUpdate = emitCollectionUpdate;
    this._mediaRepository = mediaRepository;
    this._platform = platform2;
    this._inviteData = null;
    this._accepting = false;
    this._rejecting = false;
    this._accepted = false;
    this._rejected = false;
  }
  get isInvite() {
    return true;
  }
  get id() {
    return this._roomId;
  }
  get name() {
    return this._inviteData.name || this._inviteData.canonicalAlias;
  }
  get isDirectMessage() {
    return this._inviteData.isDirectMessage;
  }
  get avatarUrl() {
    return this._inviteData.avatarUrl;
  }
  get avatarColorId() {
    return this._inviteData.avatarColorId || this.id;
  }
  get timestamp() {
    return this._inviteData.timestamp;
  }
  get isEncrypted() {
    return this._inviteData.isEncrypted;
  }
  get inviter() {
    return this._inviter;
  }
  isDirectMessageForUserId(userId) {
    return this.isDirectMessage && this._inviter.userId === userId;
  }
  get isPublic() {
    return this._inviteData.joinRule === "public";
  }
  get canonicalAlias() {
    return this._inviteData.canonicalAlias;
  }
  async accept(log = null) {
    await this._platform.logger.wrapOrRun(log, "acceptInvite", async (log2) => {
      this._accepting = true;
      this._emitChange("accepting");
      await this._hsApi.join(this._roomId, { log: log2 }).response();
    });
  }
  async reject(log = null) {
    await this._platform.logger.wrapOrRun(log, "rejectInvite", async (log2) => {
      this._rejecting = true;
      this._emitChange("rejecting");
      await this._hsApi.leave(this._roomId, { log: log2 }).response();
    });
  }
  get accepting() {
    return this._accepting;
  }
  get accepted() {
    return this._accepted;
  }
  get rejecting() {
    return this._rejecting;
  }
  get rejected() {
    return this._rejected;
  }
  get mediaRepository() {
    return this._mediaRepository;
  }
  _emitChange(params) {
    this.emit("change");
    this._emitCollectionUpdate(this, params);
  }
  load(inviteData, log) {
    log.set("id", this.id);
    this._inviteData = inviteData;
    this._inviter = inviteData.inviter ? new RoomMember(inviteData.inviter) : null;
  }
  async writeSync(membership, roomResponse, txn, log) {
    var _a;
    if (membership === "invite") {
      log.set("id", this.id);
      log.set("add", true);
      const inviteState = (_a = roomResponse["invite_state"]) == null ? void 0 : _a.events;
      if (!Array.isArray(inviteState)) {
        return null;
      }
      const summaryData = this._createSummaryData(inviteState);
      let heroes;
      if (!summaryData.name && !summaryData.canonicalAlias) {
        heroes = await this._createHeroes(inviteState, log);
      }
      const myInvite = this._getMyInvite(inviteState);
      if (!myInvite) {
        return null;
      }
      const inviter = this._getInviter(myInvite, inviteState);
      const inviteData = this._createData(inviteState, myInvite, inviter, summaryData, heroes);
      txn.invites.set(inviteData);
      return { inviteData, inviter };
    } else {
      log.set("id", this.id);
      log.set("membership", membership);
      txn.invites.remove(this.id);
      return { removed: true, membership };
    }
  }
  afterSync(changes, log) {
    log.set("id", this.id);
    if (changes) {
      if (changes.removed) {
        this._accepting = false;
        this._rejecting = false;
        if (changes.membership === "join") {
          this._accepted = true;
        } else {
          this._rejected = true;
        }
        this.emit("change");
      } else {
        this._inviteData = changes.inviteData;
        this._inviter = changes.inviter;
      }
    }
  }
  _createData(inviteState, myInvite, inviter, summaryData, heroes) {
    const name = heroes ? heroes.roomName : summaryData.name;
    const avatarUrl = heroes ? heroes.roomAvatarUrl : summaryData.avatarUrl;
    const avatarColorId = (heroes == null ? void 0 : heroes.roomAvatarColorId) || this.id;
    return {
      roomId: this.id,
      isEncrypted: !!summaryData.encryption,
      isDirectMessage: summaryData.isDirectMessage,
      name,
      avatarUrl,
      avatarColorId,
      canonicalAlias: summaryData.canonicalAlias,
      timestamp: this._platform.clock.now(),
      joinRule: this._getJoinRule(inviteState),
      inviter: inviter == null ? void 0 : inviter.serialize()
    };
  }
  _createSummaryData(inviteState) {
    return inviteState.reduce((data, event2) => processStateEvent(data, event2, this._user.id), new SummaryData(null, this.id));
  }
  async _createHeroes(inviteState, log) {
    const members = inviteState.filter((e) => e.type === EVENT_TYPE$1);
    const otherMembers = members.filter((e) => e.state_key !== this._user.id);
    const memberChanges = otherMembers.reduce((map, e) => {
      const member = RoomMember.fromMemberEvent(this.id, e);
      map.set(member.userId, new MemberChange(member, null));
      return map;
    }, /* @__PURE__ */ new Map());
    const otherUserIds = otherMembers.map((e) => e.state_key);
    const heroes = new Heroes(this.id);
    const changes = await heroes.calculateChanges(otherUserIds, memberChanges, null);
    const countSummary = new SummaryData(null, this.id);
    countSummary.joinCount = members.reduce((sum, e) => {
      var _a;
      return sum + (((_a = e.content) == null ? void 0 : _a.membership) === "join" ? 1 : 0);
    }, 0);
    countSummary.inviteCount = members.reduce((sum, e) => {
      var _a;
      return sum + (((_a = e.content) == null ? void 0 : _a.membership) === "invite" ? 1 : 0);
    }, 0);
    heroes.applyChanges(changes, countSummary, log);
    return heroes;
  }
  _getMyInvite(inviteState) {
    return inviteState.find((e) => e.type === EVENT_TYPE$1 && e.state_key === this._user.id);
  }
  _getInviter(myInvite, inviteState) {
    const inviterMemberEvent = inviteState.find((e) => e.type === EVENT_TYPE$1 && e.state_key === myInvite.sender);
    if (inviterMemberEvent) {
      return RoomMember.fromMemberEvent(this.id, inviterMemberEvent);
    }
  }
  _getJoinRule(inviteState) {
    var _a;
    const event2 = inviteState.find((e) => e.type === "m.room.join_rules");
    if (event2) {
      return (_a = event2.content) == null ? void 0 : _a.join_rule;
    }
    return null;
  }
}
class Pusher {
  constructor(description) {
    this._description = description;
  }
  static httpPusher(host2, appId, pushkey, data) {
    return new Pusher({
      kind: "http",
      append: true,
      data: Object.assign({}, data, { url: host2 + "/_matrix/push/v1/notify" }),
      pushkey,
      app_id: appId,
      app_display_name: "Hydrogen",
      device_display_name: "Hydrogen",
      lang: "en"
    });
  }
  static createDefaultPayload(sessionId) {
    return { session_id: sessionId };
  }
  async enable(hsApi, log) {
    try {
      log.set("endpoint", new URL(this._description.data.endpoint).host);
    } catch {
      log.set("endpoint", null);
    }
    await hsApi.setPusher(this._description, { log }).response();
  }
  async disable(hsApi, log) {
    const deleteDescription = Object.assign({}, this._description, { kind: null });
    await hsApi.setPusher(deleteDescription, { log }).response();
  }
  serialize() {
    return this._description;
  }
  equals(pusher) {
    if (this._description.app_id !== pusher._description.app_id) {
      return false;
    }
    if (this._description.pushkey !== pusher._description.pushkey) {
      return false;
    }
    return JSON.stringify(this._description.data) === JSON.stringify(pusher._description.data);
  }
}
function groupBy(array, groupFn) {
  return groupByWithCreator(array, groupFn, () => {
    return [];
  }, (array2, value) => array2.push(value));
}
function groupByWithCreator(array, groupFn, createCollectionFn, addCollectionFn) {
  return array.reduce((map, value) => {
    const key = groupFn(value);
    let collection = map.get(key);
    if (!collection) {
      collection = createCollectionFn();
      map.set(key, collection);
    }
    addCollectionFn(collection, value);
    return map;
  }, /* @__PURE__ */ new Map());
}
function countBy(events, mapper) {
  return events.reduce((counts, event2) => {
    const mappedValue = mapper(event2);
    if (!counts[mappedValue]) {
      counts[mappedValue] = 1;
    } else {
      counts[mappedValue] += 1;
    }
    return counts;
  }, {});
}
class DeviceMessageHandler {
  constructor({ storage }) {
    this._storage = storage;
    this._olmDecryption = null;
    this._megolmDecryption = null;
  }
  enableEncryption({ olmDecryption, megolmDecryption }) {
    this._olmDecryption = olmDecryption;
    this._megolmDecryption = megolmDecryption;
  }
  obtainSyncLock(toDeviceEvents) {
    var _a;
    return (_a = this._olmDecryption) == null ? void 0 : _a.obtainDecryptionLock(toDeviceEvents);
  }
  async prepareSync(toDeviceEvents, lock, txn, log) {
    log.set("messageTypes", countBy(toDeviceEvents, (e) => e.type));
    const encryptedEvents = toDeviceEvents.filter((e) => e.type === "m.room.encrypted");
    if (!this._olmDecryption) {
      log.log("can't decrypt, encryption not enabled", log.level.Warn);
      return;
    }
    const olmEvents = encryptedEvents.filter((e) => {
      var _a;
      return ((_a = e.content) == null ? void 0 : _a.algorithm) === OLM_ALGORITHM;
    });
    if (olmEvents.length) {
      const olmDecryptChanges = await this._olmDecryption.decryptAll(olmEvents, lock, txn);
      log.set("decryptedTypes", countBy(olmDecryptChanges.results, (r) => {
        var _a;
        return (_a = r.event) == null ? void 0 : _a.type;
      }));
      for (const err of olmDecryptChanges.errors) {
        log.child("decrypt_error").catch(err);
      }
      const newRoomKeys = this._megolmDecryption.roomKeysFromDeviceMessages(olmDecryptChanges.results, log);
      return new SyncPreparation(olmDecryptChanges, newRoomKeys);
    }
  }
  async writeSync(prep, txn) {
    prep.olmDecryptChanges.write(txn);
    const didWriteValues = await Promise.all(prep.newRoomKeys.map((key) => this._megolmDecryption.writeRoomKey(key, txn)));
    return didWriteValues.some((didWrite) => !!didWrite);
  }
}
class SyncPreparation {
  constructor(olmDecryptChanges, newRoomKeys) {
    this.olmDecryptChanges = olmDecryptChanges;
    this.newRoomKeys = newRoomKeys;
    this.newKeysByRoom = groupBy(newRoomKeys, (r) => r.roomId);
  }
}
const ACCOUNT_SESSION_KEY = SESSION_E2EE_KEY_PREFIX + "olmAccount";
const DEVICE_KEY_FLAG_SESSION_KEY = SESSION_E2EE_KEY_PREFIX + "areDeviceKeysUploaded";
const SERVER_OTK_COUNT_SESSION_KEY = SESSION_E2EE_KEY_PREFIX + "serverOTKCount";
async function initiallyStoreAccount(account, pickleKey, areDeviceKeysUploaded, serverOTKCount, storage) {
  const pickledAccount = account.pickle(pickleKey);
  const txn = await storage.readWriteTxn([
    storage.storeNames.session
  ]);
  try {
    txn.session.add(ACCOUNT_SESSION_KEY, pickledAccount);
    txn.session.add(DEVICE_KEY_FLAG_SESSION_KEY, areDeviceKeysUploaded);
    txn.session.add(SERVER_OTK_COUNT_SESSION_KEY, serverOTKCount);
  } catch (err) {
    txn.abort();
    throw err;
  }
  await txn.complete();
}
class Account {
  static async load({ olm, pickleKey, hsApi, userId, deviceId, olmWorker, txn }) {
    const pickledAccount = await txn.session.get(ACCOUNT_SESSION_KEY);
    if (pickledAccount) {
      const account = new olm.Account();
      const areDeviceKeysUploaded = await txn.session.get(DEVICE_KEY_FLAG_SESSION_KEY);
      account.unpickle(pickleKey, pickledAccount);
      const serverOTKCount = await txn.session.get(SERVER_OTK_COUNT_SESSION_KEY);
      return new Account({
        pickleKey,
        hsApi,
        account,
        userId,
        deviceId,
        areDeviceKeysUploaded,
        serverOTKCount,
        olm,
        olmWorker
      });
    }
  }
  static async adoptDehydratedDevice({ olm, dehydratedDevice, pickleKey, hsApi, userId, olmWorker, storage }) {
    const account = dehydratedDevice.adoptUnpickledOlmAccount();
    const oneTimeKeys = JSON.parse(account.one_time_keys());
    const oneTimeKeysEntries = Object.entries(oneTimeKeys.curve25519);
    const serverOTKCount = oneTimeKeysEntries.length;
    const areDeviceKeysUploaded = true;
    await initiallyStoreAccount(account, pickleKey, areDeviceKeysUploaded, serverOTKCount, storage);
    return new Account({
      pickleKey,
      hsApi,
      account,
      userId,
      deviceId: dehydratedDevice.deviceId,
      areDeviceKeysUploaded,
      serverOTKCount,
      olm,
      olmWorker
    });
  }
  static async create({ olm, pickleKey, hsApi, userId, deviceId, olmWorker, storage }) {
    const account = new olm.Account();
    if (olmWorker) {
      await olmWorker.createAccountAndOTKs(account, account.max_number_of_one_time_keys());
    } else {
      account.create();
      account.generate_one_time_keys(account.max_number_of_one_time_keys());
    }
    const areDeviceKeysUploaded = false;
    const serverOTKCount = 0;
    if (storage) {
      await initiallyStoreAccount(account, pickleKey, areDeviceKeysUploaded, serverOTKCount, storage);
    }
    return new Account({
      pickleKey,
      hsApi,
      account,
      userId,
      deviceId,
      areDeviceKeysUploaded,
      serverOTKCount,
      olm,
      olmWorker
    });
  }
  constructor({ pickleKey, hsApi, account, userId, deviceId, areDeviceKeysUploaded, serverOTKCount, olm, olmWorker }) {
    this._olm = olm;
    this._pickleKey = pickleKey;
    this._hsApi = hsApi;
    this._account = account;
    this._userId = userId;
    this._deviceId = deviceId;
    this._areDeviceKeysUploaded = areDeviceKeysUploaded;
    this._serverOTKCount = serverOTKCount;
    this._olmWorker = olmWorker;
    this._identityKeys = JSON.parse(this._account.identity_keys());
  }
  get identityKeys() {
    return this._identityKeys;
  }
  setDeviceId(deviceId) {
    this._deviceId = deviceId;
  }
  async uploadKeys(storage, isDehydratedDevice, log) {
    var _a;
    const oneTimeKeys = JSON.parse(this._account.one_time_keys());
    const oneTimeKeysEntries = Object.entries(oneTimeKeys.curve25519);
    if (oneTimeKeysEntries.length || !this._areDeviceKeysUploaded) {
      const payload = {};
      if (!this._areDeviceKeysUploaded) {
        log.set("identity", true);
        const identityKeys = JSON.parse(this._account.identity_keys());
        payload.device_keys = this._deviceKeysPayload(identityKeys);
      }
      if (oneTimeKeysEntries.length) {
        log.set("otks", true);
        payload.one_time_keys = this._oneTimeKeysPayload(oneTimeKeysEntries);
      }
      const dehydratedDeviceId = isDehydratedDevice ? this._deviceId : void 0;
      const response = await this._hsApi.uploadKeys(dehydratedDeviceId, payload, { log }).response();
      this._serverOTKCount = (_a = response == null ? void 0 : response.one_time_key_counts) == null ? void 0 : _a.signed_curve25519;
      log.set("serverOTKCount", this._serverOTKCount);
      await this._updateSessionStorage(storage, (sessionStore) => {
        if (oneTimeKeysEntries.length) {
          this._account.mark_keys_as_published();
          sessionStore == null ? void 0 : sessionStore.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
          sessionStore == null ? void 0 : sessionStore.set(SERVER_OTK_COUNT_SESSION_KEY, this._serverOTKCount);
        }
        if (!this._areDeviceKeysUploaded) {
          this._areDeviceKeysUploaded = true;
          sessionStore == null ? void 0 : sessionStore.set(DEVICE_KEY_FLAG_SESSION_KEY, this._areDeviceKeysUploaded);
        }
      });
    }
  }
  async generateOTKsIfNeeded(storage, log) {
    const maxOTKs = this._account.max_number_of_one_time_keys();
    const keyLimit = Math.floor(maxOTKs / 2);
    if (this._serverOTKCount < keyLimit) {
      const oneTimeKeys = JSON.parse(this._account.one_time_keys());
      const oneTimeKeysEntries = Object.entries(oneTimeKeys.curve25519);
      const unpublishedOTKCount = oneTimeKeysEntries.length;
      const newKeyCount = keyLimit - unpublishedOTKCount - this._serverOTKCount;
      if (newKeyCount > 0) {
        await log.wrap("generate otks", (log2) => {
          log2.set("max", maxOTKs);
          log2.set("server", this._serverOTKCount);
          log2.set("unpublished", unpublishedOTKCount);
          log2.set("new", newKeyCount);
          log2.set("limit", keyLimit);
          this._account.generate_one_time_keys(newKeyCount);
          this._updateSessionStorage(storage, (sessionStore) => {
            sessionStore.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
          });
        });
      }
      return true;
    }
    return false;
  }
  createInboundOlmSession(senderKey, body) {
    const newSession = new this._olm.Session();
    try {
      newSession.create_inbound_from(this._account, senderKey, body);
      return newSession;
    } catch (err) {
      newSession.free();
      throw err;
    }
  }
  async createOutboundOlmSession(theirIdentityKey, theirOneTimeKey) {
    const newSession = new this._olm.Session();
    try {
      if (this._olmWorker) {
        await this._olmWorker.createOutboundOlmSession(this._account, newSession, theirIdentityKey, theirOneTimeKey);
      } else {
        newSession.create_outbound(this._account, theirIdentityKey, theirOneTimeKey);
      }
      return newSession;
    } catch (err) {
      newSession.free();
      throw err;
    }
  }
  writeRemoveOneTimeKey(session, txn) {
    this._account.remove_one_time_keys(session);
    txn.session.set(ACCOUNT_SESSION_KEY, this._account.pickle(this._pickleKey));
  }
  writeSync(deviceOneTimeKeysCount, txn, log) {
    const otkCount = deviceOneTimeKeysCount.signed_curve25519;
    if (Number.isSafeInteger(otkCount) && otkCount !== this._serverOTKCount) {
      txn.session.set(SERVER_OTK_COUNT_SESSION_KEY, otkCount);
      log.set("otkCount", otkCount);
      return otkCount;
    }
  }
  afterSync(otkCount) {
    if (Number.isSafeInteger(otkCount)) {
      this._serverOTKCount = otkCount;
    }
  }
  _deviceKeysPayload(identityKeys) {
    const obj = {
      user_id: this._userId,
      device_id: this._deviceId,
      algorithms: [OLM_ALGORITHM, MEGOLM_ALGORITHM],
      keys: {}
    };
    for (const [algorithm, pubKey] of Object.entries(identityKeys)) {
      obj.keys[`${algorithm}:${this._deviceId}`] = pubKey;
    }
    this.signObject(obj);
    return obj;
  }
  _oneTimeKeysPayload(oneTimeKeysEntries) {
    const obj = {};
    for (const [keyId, pubKey] of oneTimeKeysEntries) {
      const keyObj = {
        key: pubKey
      };
      this.signObject(keyObj);
      obj[`signed_curve25519:${keyId}`] = keyObj;
    }
    return obj;
  }
  async _updateSessionStorage(storage, callback) {
    if (storage) {
      const txn = await storage.readWriteTxn([
        storage.storeNames.session
      ]);
      try {
        await callback(txn.session);
      } catch (err) {
        txn.abort();
        throw err;
      }
      await txn.complete();
    } else {
      await callback(void 0);
    }
  }
  signObject(obj) {
    const sigs = obj.signatures || {};
    const unsigned = obj.unsigned;
    delete obj.signatures;
    delete obj.unsigned;
    sigs[this._userId] = sigs[this._userId] || {};
    sigs[this._userId]["ed25519:" + this._deviceId] = this._account.sign(anotherJson.stringify(obj));
    obj.signatures = sigs;
    if (unsigned !== void 0) {
      obj.unsigned = unsigned;
    }
  }
  pickleWithKey(key) {
    return this._account.pickle(key);
  }
  dispose() {
    this._account.free();
    this._account = void 0;
  }
}
class KeyDescription {
  constructor(id, keyDescription) {
    this._id = id;
    this._keyDescription = keyDescription;
  }
  get id() {
    return this._id;
  }
  get passphraseParams() {
    var _a;
    return (_a = this._keyDescription) == null ? void 0 : _a.passphrase;
  }
  get algorithm() {
    var _a;
    return (_a = this._keyDescription) == null ? void 0 : _a.algorithm;
  }
  async isCompatible(key, platform2) {
    if (this.algorithm === "m.secret_storage.v1.aes-hmac-sha2") {
      const kd = this._keyDescription;
      if (kd.mac) {
        const otherMac = await calculateKeyMac(key.binaryKey, kd.iv, platform2);
        return kd.mac === otherMac;
      } else if (kd.passphrase) {
        const kdOther = key.description._keyDescription;
        if (!kdOther.passphrase) {
          return false;
        }
        return kd.passphrase.algorithm === kdOther.passphrase.algorithm && kd.passphrase.iterations === kdOther.passphrase.iterations && kd.passphrase.salt === kdOther.passphrase.salt;
      }
    }
    return false;
  }
}
class Key {
  constructor(keyDescription, binaryKey) {
    this._keyDescription = keyDescription;
    this._binaryKey = binaryKey;
  }
  withDescription(description) {
    return new Key(description, this._binaryKey);
  }
  get description() {
    return this._keyDescription;
  }
  get id() {
    return this._keyDescription.id;
  }
  get binaryKey() {
    return this._binaryKey;
  }
  get algorithm() {
    return this._keyDescription.algorithm;
  }
}
async function calculateKeyMac(key, ivStr, platform2) {
  const { crypto: crypto2, encoding } = platform2;
  const { utf8, base64 } = encoding;
  const { derive: derive2, aes, hmac } = crypto2;
  const iv = base64.decode(ivStr);
  const zerosalt = new Uint8Array(8);
  const ZERO_STR = "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
  const info = utf8.encode("");
  const keybits = await derive2.hkdf(key, zerosalt, info, "SHA-256", 512);
  const aesKey = keybits.slice(0, 32);
  const hmacKey = keybits.slice(32);
  const ciphertext = await aes.encryptCTR({ key: aesKey, iv, data: utf8.encode(ZERO_STR) });
  const mac = await hmac.compute(hmacKey, ciphertext, "SHA-256");
  return base64.encode(mac);
}
const DEFAULT_ITERATIONS = 5e5;
const DEFAULT_BITSIZE = 256;
async function keyFromPassphrase(keyDescription, passphrase, platform2) {
  const { passphraseParams } = keyDescription;
  if (!passphraseParams) {
    throw new Error("not a passphrase key");
  }
  if (passphraseParams.algorithm !== "m.pbkdf2") {
    throw new Error(`Unsupported passphrase algorithm: ${passphraseParams.algorithm}`);
  }
  const { utf8 } = platform2.encoding;
  const keyBits = await platform2.crypto.derive.pbkdf2(utf8.encode(passphrase), passphraseParams.iterations || DEFAULT_ITERATIONS, utf8.encode(passphraseParams.salt), "SHA-512", passphraseParams.bits || DEFAULT_BITSIZE);
  return new Key(keyDescription, keyBits);
}
const OLM_RECOVERY_KEY_PREFIX = [139, 1];
function keyFromRecoveryKey(keyDescription, recoveryKey, olm, platform2) {
  const result = platform2.encoding.base58.decode(recoveryKey.replace(/ /g, ""));
  let parity = 0;
  for (const b of result) {
    parity ^= b;
  }
  if (parity !== 0) {
    throw new Error("Incorrect parity");
  }
  for (let i = 0; i < OLM_RECOVERY_KEY_PREFIX.length; ++i) {
    if (result[i] !== OLM_RECOVERY_KEY_PREFIX[i]) {
      throw new Error("Incorrect prefix");
    }
  }
  if (result.length !== OLM_RECOVERY_KEY_PREFIX.length + olm.PRIVATE_KEY_LENGTH + 1) {
    throw new Error("Incorrect length");
  }
  const keyBits = Uint8Array.from(result.slice(OLM_RECOVERY_KEY_PREFIX.length, OLM_RECOVERY_KEY_PREFIX.length + olm.PRIVATE_KEY_LENGTH));
  return new Key(keyDescription, keyBits);
}
const SSSS_KEY = `${SESSION_E2EE_KEY_PREFIX}ssssKey`;
const BACKUPVERSION_KEY = `${SESSION_E2EE_KEY_PREFIX}keyBackupVersion`;
var KeyType = /* @__PURE__ */ ((KeyType2) => {
  KeyType2[KeyType2["RecoveryKey"] = 0] = "RecoveryKey";
  KeyType2[KeyType2["Passphrase"] = 1] = "Passphrase";
  return KeyType2;
})(KeyType || {});
async function readDefaultKeyDescription(storage) {
  var _a;
  const txn = await storage.readTxn([
    storage.storeNames.accountData
  ]);
  const defaultKeyEvent = await txn.accountData.get("m.secret_storage.default_key");
  const id = (_a = defaultKeyEvent == null ? void 0 : defaultKeyEvent.content) == null ? void 0 : _a.key;
  if (!id) {
    return;
  }
  const keyAccountData = await txn.accountData.get(`m.secret_storage.key.${id}`);
  if (!keyAccountData) {
    return;
  }
  return new KeyDescription(id, keyAccountData.content);
}
async function writeKey(key, keyBackupVersion, txn) {
  const existingVersion = await txn.session.get(BACKUPVERSION_KEY);
  txn.session.set(BACKUPVERSION_KEY, keyBackupVersion);
  txn.session.set(SSSS_KEY, { id: key.id, binaryKey: key.binaryKey });
  return existingVersion;
}
async function readKey(txn) {
  const keyData = await txn.session.get(SSSS_KEY);
  if (!keyData) {
    return;
  }
  const keyAccountData = await txn.accountData.get(`m.secret_storage.key.${keyData.id}`);
  if (keyAccountData) {
    return new Key(new KeyDescription(keyData.id, keyAccountData.content), keyData.binaryKey);
  }
}
async function removeKey(txn) {
  txn.session.remove(SSSS_KEY);
}
async function keyFromCredential(type, credential, storage, platform2, olm) {
  const keyDescription = await readDefaultKeyDescription(storage);
  if (!keyDescription) {
    throw new Error("Could not find a default secret storage key in account data");
  }
  return await keyFromCredentialAndDescription(type, credential, keyDescription, platform2, olm);
}
async function keyFromCredentialAndDescription(type, credential, keyDescription, platform2, olm) {
  let key;
  if (type === 1) {
    key = await keyFromPassphrase(keyDescription, credential, platform2);
  } else if (type === 0) {
    key = keyFromRecoveryKey(keyDescription, credential, olm, platform2);
  } else {
    throw new Error(`Invalid type: ${type}`);
  }
  return key;
}
async function keyFromDehydratedDeviceKey(key, storage, platform2) {
  const keyDescription = await readDefaultKeyDescription(storage);
  if (await (keyDescription == null ? void 0 : keyDescription.isCompatible(key, platform2))) {
    return key.withDescription(keyDescription);
  }
}
const DEHYDRATION_LIBOLM_PICKLE_ALGORITHM = "org.matrix.msc2697.v1.olm.libolm_pickle";
async function getDehydratedDevice(hsApi, olm, platform2, log) {
  try {
    const response = await hsApi.getDehydratedDevice({ log }).response();
    if (response.device_data.algorithm === DEHYDRATION_LIBOLM_PICKLE_ALGORITHM) {
      return new EncryptedDehydratedDevice(response, olm, platform2);
    }
  } catch (err) {
    if (err.name !== "HomeServerError") {
      log.error = err;
    }
    return void 0;
  }
}
async function uploadAccountAsDehydratedDevice(account, hsApi, key, deviceDisplayName, log) {
  var _a;
  const response = await hsApi.createDehydratedDevice({
    device_data: {
      algorithm: DEHYDRATION_LIBOLM_PICKLE_ALGORITHM,
      account: account.pickleWithKey(key.binaryKey.slice()),
      passphrase: ((_a = key.description) == null ? void 0 : _a.passphraseParams) || {}
    },
    initial_device_display_name: deviceDisplayName
  }).response();
  const deviceId = response.device_id;
  account.setDeviceId(deviceId);
  await account.uploadKeys(void 0, true, log);
  return deviceId;
}
class EncryptedDehydratedDevice {
  constructor(dehydratedDevice, olm, platform2) {
    this._dehydratedDevice = dehydratedDevice;
    this._olm = olm;
    this._platform = platform2;
  }
  async decrypt(keyType, credential) {
    const keyDescription = new KeyDescription("dehydrated_device", this._dehydratedDevice.device_data.passphrase);
    const key = await keyFromCredentialAndDescription(keyType, credential, keyDescription, this._platform, this._olm);
    const account = new this._olm.Account();
    try {
      const pickledAccount = this._dehydratedDevice.device_data.account;
      account.unpickle(key.binaryKey.slice(), pickledAccount);
      return new DehydratedDevice(this._dehydratedDevice, account, key);
    } catch (err) {
      account.free();
      if (err.message === "OLM.BAD_ACCOUNT_KEY") {
        return void 0;
      } else {
        throw err;
      }
    }
  }
  get deviceId() {
    return this._dehydratedDevice.device_id;
  }
}
class DehydratedDevice {
  constructor(dehydratedDevice, account, key) {
    this._dehydratedDevice = dehydratedDevice;
    this._account = account;
    this._key = key;
  }
  async claim(hsApi, log) {
    try {
      const response = await hsApi.claimDehydratedDevice(this.deviceId, { log }).response();
      return response.success;
    } catch (err) {
      return false;
    }
  }
  adoptUnpickledOlmAccount() {
    const account = this._account;
    this._account = void 0;
    return account;
  }
  get deviceId() {
    return this._dehydratedDevice.device_id;
  }
  get key() {
    return this._key;
  }
  dispose() {
    var _a;
    (_a = this._account) == null ? void 0 : _a.free();
    this._account = void 0;
  }
}
class Lock {
  tryTake() {
    if (!this._promise) {
      this._promise = new Promise((resolve) => {
        this._resolve = resolve;
      });
      return true;
    }
    return false;
  }
  async take() {
    while (!this.tryTake()) {
      await this.released();
    }
  }
  get isTaken() {
    return !!this._promise;
  }
  release() {
    if (this._resolve) {
      this._promise = void 0;
      const resolve = this._resolve;
      this._resolve = void 0;
      resolve();
    }
  }
  released() {
    return this._promise;
  }
}
class MultiLock {
  constructor(locks) {
    this.locks = locks;
  }
  release() {
    for (const lock of this.locks) {
      lock.release();
    }
  }
}
function createSessionEntry(olmSession, senderKey, timestamp, pickleKey) {
  return {
    session: olmSession.pickle(pickleKey),
    sessionId: olmSession.session_id(),
    senderKey,
    lastUsed: timestamp
  };
}
class Session$1 {
  constructor(data, pickleKey, olm, isNew = false) {
    this.data = data;
    this.pickleKey = pickleKey;
    this.olm = olm;
    this.isNew = isNew;
    this.isModified = isNew;
  }
  static create(senderKey, olmSession, olm, pickleKey, timestamp) {
    const data = createSessionEntry(olmSession, senderKey, timestamp, pickleKey);
    return new Session$1(data, pickleKey, olm, true);
  }
  get id() {
    return this.data.sessionId;
  }
  load() {
    const session = new this.olm.Session();
    session.unpickle(this.pickleKey, this.data.session);
    return session;
  }
  unload(olmSession) {
    olmSession.free();
  }
  save(olmSession) {
    this.data.session = olmSession.pickle(this.pickleKey);
    this.isModified = true;
  }
}
class DecryptionResult {
  constructor(event2, senderCurve25519Key, claimedEd25519Key, encryptedEvent) {
    this.event = event2;
    this.senderCurve25519Key = senderCurve25519Key;
    this.claimedEd25519Key = claimedEd25519Key;
    this.encryptedEvent = encryptedEvent;
  }
  setDevice(device) {
    this.device = device;
  }
  get isVerified() {
    if (this.device) {
      const comesFromDevice = this.device.ed25519Key === this.claimedEd25519Key;
      return comesFromDevice;
    }
    return false;
  }
  get isUnverified() {
    if (this.device) {
      return !this.isVerified;
    } else {
      return true;
    }
  }
  get isVerificationUnknown() {
    return !this.device;
  }
}
var OlmPayloadType = /* @__PURE__ */ ((OlmPayloadType2) => {
  OlmPayloadType2[OlmPayloadType2["PreKey"] = 0] = "PreKey";
  OlmPayloadType2[OlmPayloadType2["Normal"] = 1] = "Normal";
  return OlmPayloadType2;
})(OlmPayloadType || {});
const SESSION_LIMIT_PER_SENDER_KEY = 4;
function sortSessions(sessions) {
  sessions.sort((a, b) => {
    return b.data.lastUsed - a.data.lastUsed;
  });
}
class Decryption$1 {
  constructor(account, pickleKey, now, ownUserId, olm, senderKeyLock) {
    this.account = account;
    this.pickleKey = pickleKey;
    this.now = now;
    this.ownUserId = ownUserId;
    this.olm = olm;
    this.senderKeyLock = senderKeyLock;
  }
  async obtainDecryptionLock(events) {
    var _a;
    const senderKeys = /* @__PURE__ */ new Set();
    for (const event2 of events) {
      const senderKey = (_a = event2.content) == null ? void 0 : _a["sender_key"];
      if (senderKey) {
        senderKeys.add(senderKey);
      }
    }
    const locks = await Promise.all(Array.from(senderKeys).map((senderKey) => {
      return this.senderKeyLock.takeLock(senderKey);
    }));
    return new MultiLock(locks);
  }
  async decryptAll(events, lock, txn) {
    try {
      const eventsPerSenderKey = groupBy(events, (event2) => {
        var _a;
        return (_a = event2.content) == null ? void 0 : _a["sender_key"];
      });
      const timestamp = this.now();
      const senderKeyOperations = await Promise.all(Array.from(eventsPerSenderKey.entries()).map(([senderKey, events2]) => {
        return this._decryptAllForSenderKey(senderKey, events2, timestamp, txn);
      }));
      const results = senderKeyOperations.reduce((all, r) => all.concat(r.results), []);
      const errors = senderKeyOperations.reduce((all, r) => all.concat(r.errors), []);
      const senderKeyDecryptions = senderKeyOperations.map((r) => r.senderKeyDecryption);
      return new DecryptionChanges$2(senderKeyDecryptions, results, errors, this.account, lock);
    } catch (err) {
      lock.release();
      throw err;
    }
  }
  async _decryptAllForSenderKey(senderKey, events, timestamp, readSessionsTxn) {
    const sessions = await this._getSessions(senderKey, readSessionsTxn);
    const senderKeyDecryption = new SenderKeyDecryption(senderKey, sessions, timestamp);
    const results = [];
    const errors = [];
    for (const event2 of events) {
      try {
        const result = this._decryptForSenderKey(senderKeyDecryption, event2, timestamp);
        results.push(result);
      } catch (err) {
        errors.push(err);
      }
    }
    return { results, errors, senderKeyDecryption };
  }
  _decryptForSenderKey(senderKeyDecryption, event2, timestamp) {
    const senderKey = senderKeyDecryption.senderKey;
    const message = this._getMessageAndValidateEvent(event2);
    let plaintext;
    try {
      plaintext = senderKeyDecryption.decrypt(message);
    } catch (err) {
      throw new DecryptionError("OLM_BAD_ENCRYPTED_MESSAGE", event2, { senderKey, error: err.message });
    }
    if (typeof plaintext !== "string" && message.type === OlmPayloadType.PreKey) {
      let createResult;
      try {
        createResult = this._createSessionAndDecrypt(senderKey, message, timestamp);
      } catch (error) {
        throw new DecryptionError(`Could not create inbound olm session: ${error.message}`, event2, { senderKey, error });
      }
      senderKeyDecryption.addNewSession(createResult.session);
      plaintext = createResult.plaintext;
    }
    if (typeof plaintext === "string") {
      let payload;
      try {
        payload = JSON.parse(plaintext);
      } catch (error) {
        throw new DecryptionError("PLAINTEXT_NOT_JSON", event2, { plaintext, error });
      }
      this._validatePayload(payload, event2);
      return new DecryptionResult(payload, senderKey, payload.keys.ed25519);
    } else {
      throw new DecryptionError("OLM_NO_MATCHING_SESSION", event2, { knownSessionIds: senderKeyDecryption.sessions.map((s) => s.id) });
    }
  }
  _createSessionAndDecrypt(senderKey, message, timestamp) {
    let plaintext;
    const olmSession = this.account.createInboundOlmSession(senderKey, message.body);
    try {
      plaintext = olmSession.decrypt(message.type, message.body);
      const session = Session$1.create(senderKey, olmSession, this.olm, this.pickleKey, timestamp);
      session.unload(olmSession);
      return { session, plaintext };
    } catch (err) {
      olmSession.free();
      throw err;
    }
  }
  _getMessageAndValidateEvent(event2) {
    var _a;
    const ciphertext = (_a = event2.content) == null ? void 0 : _a.ciphertext;
    if (!ciphertext) {
      throw new DecryptionError("OLM_MISSING_CIPHERTEXT", event2);
    }
    const message = ciphertext == null ? void 0 : ciphertext[this.account.identityKeys.curve25519];
    if (!message) {
      throw new DecryptionError("OLM_NOT_INCLUDED_IN_RECIPIENTS", event2);
    }
    return message;
  }
  async _getSessions(senderKey, txn) {
    const sessionEntries = await txn.olmSessions.getAll(senderKey);
    const sessions = sessionEntries.map((s) => new Session$1(s, this.pickleKey, this.olm));
    sortSessions(sessions);
    return sessions;
  }
  _validatePayload(payload, event2) {
    var _a, _b, _c2;
    if (payload.sender !== event2.sender) {
      throw new DecryptionError("OLM_FORWARDED_MESSAGE", event2, { sentBy: event2.sender, encryptedBy: payload.sender });
    }
    if (payload.recipient !== this.ownUserId) {
      throw new DecryptionError("OLM_BAD_RECIPIENT", event2, { recipient: payload.recipient });
    }
    if (((_a = payload.recipient_keys) == null ? void 0 : _a.ed25519) !== this.account.identityKeys.ed25519) {
      throw new DecryptionError("OLM_BAD_RECIPIENT_KEY", event2, { key: (_b = payload.recipient_keys) == null ? void 0 : _b.ed25519 });
    }
    if (!payload.type) {
      throw new DecryptionError("missing type on payload", event2, { payload });
    }
    if (typeof ((_c2 = payload.keys) == null ? void 0 : _c2.ed25519) !== "string") {
      throw new DecryptionError("Missing or invalid claimed ed25519 key on payload", event2, { payload });
    }
  }
}
class SenderKeyDecryption {
  constructor(senderKey, sessions, timestamp) {
    this.senderKey = senderKey;
    this.sessions = sessions;
    this.timestamp = timestamp;
  }
  addNewSession(session) {
    this.sessions.unshift(session);
  }
  decrypt(message) {
    for (const session of this.sessions) {
      const plaintext = this.decryptWithSession(session, message);
      if (typeof plaintext === "string") {
        sortSessions(this.sessions);
        return plaintext;
      }
    }
  }
  getModifiedSessions() {
    return this.sessions.filter((session) => session.isModified);
  }
  get hasNewSessions() {
    return this.sessions.some((session) => session.isNew);
  }
  decryptWithSession(session, message) {
    if (message.type === void 0 || message.body === void 0) {
      throw new Error("Invalid message without type or body");
    }
    const olmSession = session.load();
    try {
      if (message.type === OlmPayloadType.PreKey && !olmSession.matches_inbound(message.body)) {
        return;
      }
      try {
        const plaintext = olmSession.decrypt(message.type, message.body);
        session.save(olmSession);
        session.data.lastUsed = this.timestamp;
        return plaintext;
      } catch (err) {
        if (message.type === OlmPayloadType.PreKey) {
          throw new Error(`Error decrypting prekey message with existing session id ${session.id}: ${err.message}`);
        }
        return;
      }
    } finally {
      session.unload(olmSession);
    }
  }
}
class DecryptionChanges$2 {
  constructor(senderKeyDecryptions, results, errors, account, lock) {
    this.senderKeyDecryptions = senderKeyDecryptions;
    this.results = results;
    this.errors = errors;
    this.account = account;
    this.lock = lock;
  }
  get hasNewSessions() {
    return this.senderKeyDecryptions.some((skd) => skd.hasNewSessions);
  }
  write(txn) {
    try {
      for (const senderKeyDecryption of this.senderKeyDecryptions) {
        for (const session of senderKeyDecryption.getModifiedSessions()) {
          txn.olmSessions.set(session.data);
          if (session.isNew) {
            const olmSession = session.load();
            try {
              this.account.writeRemoveOneTimeKey(olmSession, txn);
            } finally {
              session.unload(olmSession);
            }
          }
        }
        if (senderKeyDecryption.sessions.length > SESSION_LIMIT_PER_SENDER_KEY) {
          const { senderKey, sessions } = senderKeyDecryption;
          for (let i = sessions.length - 1; i >= SESSION_LIMIT_PER_SENDER_KEY; i -= 1) {
            const session = sessions[i];
            txn.olmSessions.remove(senderKey, session.id);
          }
        }
      }
    } finally {
      this.lock.release();
    }
  }
}
function findFirstSessionId(sessionIds) {
  return sessionIds.reduce((first, sessionId) => {
    if (!first || sessionId < first) {
      return sessionId;
    } else {
      return first;
    }
  }, null);
}
const OTK_ALGORITHM = "signed_curve25519";
const MAX_BATCH_SIZE = 20;
class Encryption$1 {
  constructor(account, pickleKey, olm, storage, now, ownUserId, olmUtil, senderKeyLock) {
    this.account = account;
    this.pickleKey = pickleKey;
    this.olm = olm;
    this.storage = storage;
    this.now = now;
    this.ownUserId = ownUserId;
    this.olmUtil = olmUtil;
    this.senderKeyLock = senderKeyLock;
  }
  async encrypt(type, content, devices, hsApi, log) {
    let messages = [];
    for (let i = 0; i < devices.length; i += MAX_BATCH_SIZE) {
      const batchDevices = devices.slice(i, i + MAX_BATCH_SIZE);
      const batchMessages = await this._encryptForMaxDevices(type, content, batchDevices, hsApi, log);
      messages = messages.concat(batchMessages);
    }
    return messages;
  }
  async _encryptForMaxDevices(type, content, devices, hsApi, log) {
    const locks = await Promise.all(devices.map((device) => {
      return this.senderKeyLock.takeLock(device.curve25519Key);
    }));
    try {
      const {
        devicesWithoutSession,
        existingEncryptionTargets
      } = await this._findExistingSessions(devices);
      const timestamp = this.now();
      let encryptionTargets = [];
      try {
        if (devicesWithoutSession.length) {
          const newEncryptionTargets = await log.wrap("create sessions", (log2) => this._createNewSessions(devicesWithoutSession, hsApi, timestamp, log2));
          encryptionTargets = encryptionTargets.concat(newEncryptionTargets);
        }
        await this._loadSessions(existingEncryptionTargets);
        encryptionTargets = encryptionTargets.concat(existingEncryptionTargets);
        const encryptLog = { l: "encrypt", targets: encryptionTargets.length };
        const messages = log.wrap(encryptLog, () => encryptionTargets.map((target) => {
          const encryptedContent = this._encryptForDevice(type, content, target);
          return new EncryptedMessage(encryptedContent, target.device);
        }));
        await this._storeSessions(encryptionTargets, timestamp);
        return messages;
      } finally {
        for (const target of encryptionTargets) {
          target.dispose();
        }
      }
    } finally {
      for (const lock of locks) {
        lock.release();
      }
    }
  }
  async _findExistingSessions(devices) {
    const txn = await this.storage.readTxn([this.storage.storeNames.olmSessions]);
    const sessionIdsForDevice = await Promise.all(devices.map(async (device) => {
      return await txn.olmSessions.getSessionIds(device.curve25519Key);
    }));
    const devicesWithoutSession = devices.filter((_, i) => {
      const sessionIds = sessionIdsForDevice[i];
      return !(sessionIds == null ? void 0 : sessionIds.length);
    });
    const existingEncryptionTargets = devices.map((device, i) => {
      const sessionIds = sessionIdsForDevice[i];
      if ((sessionIds == null ? void 0 : sessionIds.length) > 0) {
        const sessionId = findFirstSessionId(sessionIds);
        return EncryptionTarget.fromSessionId(device, sessionId);
      }
    }).filter((target) => !!target);
    return { devicesWithoutSession, existingEncryptionTargets };
  }
  _encryptForDevice(type, content, target) {
    const { session, device } = target;
    const plaintext = JSON.stringify(this._buildPlainTextMessageForDevice(type, content, device));
    const message = session.encrypt(plaintext);
    const encryptedContent = {
      algorithm: OLM_ALGORITHM,
      sender_key: this.account.identityKeys.curve25519,
      ciphertext: {
        [device.curve25519Key]: message
      }
    };
    return encryptedContent;
  }
  _buildPlainTextMessageForDevice(type, content, device) {
    return {
      keys: {
        "ed25519": this.account.identityKeys.ed25519
      },
      recipient_keys: {
        "ed25519": device.ed25519Key
      },
      recipient: device.userId,
      sender: this.ownUserId,
      content,
      type
    };
  }
  async _createNewSessions(devicesWithoutSession, hsApi, timestamp, log) {
    const newEncryptionTargets = await log.wrap("claim", (log2) => this._claimOneTimeKeys(hsApi, devicesWithoutSession, log2));
    try {
      for (const target of newEncryptionTargets) {
        const { device, oneTimeKey } = target;
        target.session = await this.account.createOutboundOlmSession(device.curve25519Key, oneTimeKey);
      }
      await this._storeSessions(newEncryptionTargets, timestamp);
    } catch (err) {
      for (const target of newEncryptionTargets) {
        target.dispose();
      }
      throw err;
    }
    return newEncryptionTargets;
  }
  async _claimOneTimeKeys(hsApi, deviceIdentities, log) {
    const devicesByUser = groupByWithCreator(deviceIdentities, (device) => device.userId, () => /* @__PURE__ */ new Map(), (deviceMap, device) => deviceMap.set(device.deviceId, device));
    const oneTimeKeys = Array.from(devicesByUser.entries()).reduce((usersObj, [userId, deviceMap]) => {
      usersObj[userId] = Array.from(deviceMap.values()).reduce((devicesObj, device) => {
        devicesObj[device.deviceId] = OTK_ALGORITHM;
        return devicesObj;
      }, {});
      return usersObj;
    }, {});
    const claimResponse = await hsApi.claimKeys({
      timeout: 1e4,
      one_time_keys: oneTimeKeys
    }, { log }).response();
    if (Object.keys(claimResponse.failures).length) {
      log.log({ l: "failures", servers: Object.keys(claimResponse.failures) }, log.level.Warn);
    }
    const userKeyMap = claimResponse == null ? void 0 : claimResponse["one_time_keys"];
    return this._verifyAndCreateOTKTargets(userKeyMap, devicesByUser, log);
  }
  _verifyAndCreateOTKTargets(userKeyMap, devicesByUser, log) {
    var _a;
    const verifiedEncryptionTargets = [];
    for (const [userId, userSection] of Object.entries(userKeyMap)) {
      for (const [deviceId, deviceSection] of Object.entries(userSection)) {
        const [firstPropName, keySection] = Object.entries(deviceSection)[0];
        const [keyAlgorithm] = firstPropName.split(":");
        if (keyAlgorithm === OTK_ALGORITHM) {
          const device = (_a = devicesByUser.get(userId)) == null ? void 0 : _a.get(deviceId);
          if (device) {
            const isValidSignature = verifyEd25519Signature(this.olmUtil, userId, deviceId, device.ed25519Key, keySection, log);
            if (isValidSignature) {
              const target = EncryptionTarget.fromOTK(device, keySection.key);
              verifiedEncryptionTargets.push(target);
            }
          }
        }
      }
    }
    return verifiedEncryptionTargets;
  }
  async _loadSessions(encryptionTargets) {
    const txn = await this.storage.readTxn([this.storage.storeNames.olmSessions]);
    let failed = false;
    try {
      await Promise.all(encryptionTargets.map(async (encryptionTarget) => {
        const sessionEntry = await txn.olmSessions.get(encryptionTarget.device.curve25519Key, encryptionTarget.sessionId);
        if (sessionEntry && !failed) {
          const olmSession = new this.olm.Session();
          olmSession.unpickle(this.pickleKey, sessionEntry.session);
          encryptionTarget.session = olmSession;
        }
      }));
    } catch (err) {
      failed = true;
      for (const target of encryptionTargets) {
        target.dispose();
      }
      throw err;
    }
  }
  async _storeSessions(encryptionTargets, timestamp) {
    const txn = await this.storage.readWriteTxn([this.storage.storeNames.olmSessions]);
    try {
      for (const target of encryptionTargets) {
        const sessionEntry = createSessionEntry(target.session, target.device.curve25519Key, timestamp, this.pickleKey);
        txn.olmSessions.set(sessionEntry);
      }
    } catch (err) {
      txn.abort();
      throw err;
    }
    await txn.complete();
  }
}
class EncryptionTarget {
  constructor(device, oneTimeKey, sessionId) {
    this.device = device;
    this.oneTimeKey = oneTimeKey;
    this.sessionId = sessionId;
    this.session = null;
  }
  static fromOTK(device, oneTimeKey) {
    return new EncryptionTarget(device, oneTimeKey, null);
  }
  static fromSessionId(device, sessionId) {
    return new EncryptionTarget(device, null, sessionId);
  }
  dispose() {
    if (this.session) {
      this.session.free();
    }
  }
}
class EncryptedMessage {
  constructor(content, device) {
    this.content = content;
    this.device = device;
  }
}
class DecryptionChanges$1 {
  constructor(roomId, results, errors, replayEntries) {
    this._roomId = roomId;
    this._results = results;
    this._errors = errors;
    this._replayEntries = replayEntries;
  }
  async write(txn) {
    await Promise.all(this._replayEntries.map(async (replayEntry) => {
      try {
        this._handleReplayAttack(this._roomId, replayEntry, txn);
      } catch (err) {
        this._errors.set(replayEntry.eventId, err);
      }
    }));
    return {
      results: this._results,
      errors: this._errors
    };
  }
  async _handleReplayAttack(roomId, replayEntry, txn) {
    const { messageIndex, sessionId, eventId, timestamp } = replayEntry;
    const decryption = await txn.groupSessionDecryptions.get(roomId, sessionId, messageIndex);
    if (decryption && decryption.eventId !== eventId) {
      const decryptedEventIsBad = decryption.timestamp < timestamp;
      const badEventId = decryptedEventIsBad ? eventId : decryption.eventId;
      this._results.delete(eventId);
      throw new DecryptionError("MEGOLM_REPLAYED_INDEX", event, {
        messageIndex,
        badEventId,
        otherEventId: decryption.eventId
      });
    }
    if (!decryption) {
      txn.groupSessionDecryptions.set(roomId, sessionId, messageIndex, {
        eventId,
        timestamp
      });
    }
  }
}
function mergeMap(src2, dst) {
  if (src2) {
    for (const [key, value] of src2.entries()) {
      dst.set(key, value);
    }
  }
}
class DecryptionPreparation$1 {
  constructor(roomId, sessionDecryptions, errors) {
    this._roomId = roomId;
    this._sessionDecryptions = sessionDecryptions;
    this._initialErrors = errors;
  }
  async decrypt() {
    try {
      const errors = this._initialErrors;
      const results = /* @__PURE__ */ new Map();
      const replayEntries = [];
      await Promise.all(this._sessionDecryptions.map(async (sessionDecryption) => {
        const sessionResult = await sessionDecryption.decryptAll();
        mergeMap(sessionResult.errors, errors);
        mergeMap(sessionResult.results, results);
        replayEntries.push(...sessionResult.replayEntries);
      }));
      return new DecryptionChanges$1(this._roomId, results, errors, replayEntries);
    } finally {
      this.dispose();
    }
  }
  dispose() {
    for (const sd of this._sessionDecryptions) {
      sd.dispose();
    }
  }
}
class ReplayDetectionEntry {
  constructor(sessionId, messageIndex, event2) {
    this.sessionId = sessionId;
    this.messageIndex = messageIndex;
    this.event = event2;
  }
  get eventId() {
    return this.event.event_id;
  }
  get timestamp() {
    return this.event.origin_server_ts;
  }
}
class SessionDecryption {
  constructor(key, events, olmWorker, keyLoader) {
    this.key = key;
    this.events = events;
    this.olmWorker = olmWorker;
    this.keyLoader = keyLoader;
    this.decryptionRequests = olmWorker ? [] : void 0;
  }
  async decryptAll() {
    const replayEntries = [];
    const results = /* @__PURE__ */ new Map();
    let errors;
    await this.keyLoader.useKey(this.key, async (session) => {
      for (const event2 of this.events) {
        try {
          const ciphertext = event2.content.ciphertext;
          let decryptionResult;
          if (this.olmWorker) {
            const request = this.olmWorker.megolmDecrypt(session, ciphertext);
            this.decryptionRequests.push(request);
            decryptionResult = await request.response();
          } else {
            decryptionResult = session.decrypt(ciphertext);
          }
          const { plaintext } = decryptionResult;
          let payload;
          try {
            payload = JSON.parse(plaintext);
          } catch (err) {
            throw new DecryptionError("PLAINTEXT_NOT_JSON", event2, { plaintext, err });
          }
          if (payload.room_id !== this.key.roomId) {
            throw new DecryptionError("MEGOLM_WRONG_ROOM", event2, { encryptedRoomId: payload.room_id, eventRoomId: this.key.roomId });
          }
          replayEntries.push(new ReplayDetectionEntry(this.key.sessionId, decryptionResult.message_index, event2));
          const result = new DecryptionResult(payload, this.key.senderKey, this.key.claimedEd25519Key, event2);
          results.set(event2.event_id, result);
        } catch (err) {
          if (err.name === "AbortError") {
            return;
          }
          if (!errors) {
            errors = /* @__PURE__ */ new Map();
          }
          errors.set(event2.event_id, err);
        }
      }
    });
    return { results, errors, replayEntries };
  }
  dispose() {
    if (this.decryptionRequests) {
      for (const r of this.decryptionRequests) {
        r.abort();
      }
    }
  }
}
function getSenderKey(event2) {
  var _a;
  return (_a = event2.content) == null ? void 0 : _a["sender_key"];
}
function getSessionId(event2) {
  var _a;
  return (_a = event2.content) == null ? void 0 : _a["session_id"];
}
function getCiphertext(event2) {
  var _a;
  return (_a = event2.content) == null ? void 0 : _a.ciphertext;
}
function validateEvent(event2) {
  return typeof getSenderKey(event2) === "string" && typeof getSessionId(event2) === "string" && typeof getCiphertext(event2) === "string";
}
class SessionKeyGroup {
  constructor() {
    this.events = [];
  }
  get senderKey() {
    return getSenderKey(this.events[0]);
  }
  get sessionId() {
    return getSessionId(this.events[0]);
  }
}
function groupEventsBySession(events) {
  return groupByWithCreator(events, (event2) => `${getSenderKey(event2)}|${getSessionId(event2)}`, () => new SessionKeyGroup(), (group, event2) => group.events.push(event2));
}
class RoomKey {
  isForSession(roomId, senderKey, sessionId) {
    return this.roomId === roomId && this.senderKey === senderKey && this.sessionId === sessionId;
  }
  get isBetter() {
    return this._isBetter;
  }
  set isBetter(value) {
    this._isBetter = value;
  }
}
function isBetterThan(newSession, existingSession) {
  return newSession.first_known_index() < existingSession.first_known_index();
}
class IncomingRoomKey extends RoomKey {
  checkBetterThanKeyInStorage(loader, txn) {
    return this._checkBetterThanKeyInStorage(loader, void 0, txn);
  }
  async write(loader, txn) {
    let pickledSession;
    if (this.isBetter === void 0) {
      await this._checkBetterThanKeyInStorage(loader, (session, pickleKey) => {
        pickledSession = session.pickle(pickleKey);
      }, txn);
    }
    if (this.isBetter === false) {
      return false;
    }
    if (!pickledSession) {
      pickledSession = await loader.useKey(this, (session, pickleKey) => session.pickle(pickleKey));
    }
    const sessionEntry = {
      roomId: this.roomId,
      senderKey: this.senderKey,
      sessionId: this.sessionId,
      session: pickledSession,
      backup: this.backupStatus,
      source: this.keySource,
      claimedKeys: { "ed25519": this.claimedEd25519Key }
    };
    txn.inboundGroupSessions.set(sessionEntry);
    return true;
  }
  get eventIds() {
    return this._eventIds;
  }
  async _checkBetterThanKeyInStorage(loader, callback, txn) {
    if (this.isBetter !== void 0) {
      return this.isBetter;
    }
    let existingKey = loader.getCachedKey(this.roomId, this.senderKey, this.sessionId);
    if (!existingKey) {
      const storageKey = await keyFromStorage(this.roomId, this.senderKey, this.sessionId, txn);
      if (storageKey) {
        if (storageKey.hasSession) {
          existingKey = storageKey;
        } else if (storageKey.eventIds) {
          this._eventIds = storageKey.eventIds;
        }
      }
    }
    if (existingKey) {
      const key = existingKey;
      await loader.useKey(this, async (newSession) => {
        await loader.useKey(key, (existingSession, pickleKey) => {
          this.isBetter = isBetterThan(newSession, existingSession);
          key.isBetter = !this.isBetter;
          if (this.isBetter && callback) {
            callback(newSession, pickleKey);
          }
        });
      });
    } else {
      this.isBetter = true;
    }
    return this.isBetter;
  }
  get backupStatus() {
    return BackupStatus.NotBackedUp;
  }
}
class DeviceMessageRoomKey extends IncomingRoomKey {
  constructor(decryptionResult) {
    super();
    this._decryptionResult = decryptionResult;
  }
  get roomId() {
    var _a;
    return (_a = this._decryptionResult.event.content) == null ? void 0 : _a["room_id"];
  }
  get senderKey() {
    return this._decryptionResult.senderCurve25519Key;
  }
  get sessionId() {
    var _a;
    return (_a = this._decryptionResult.event.content) == null ? void 0 : _a["session_id"];
  }
  get claimedEd25519Key() {
    return this._decryptionResult.claimedEd25519Key;
  }
  get serializationKey() {
    var _a;
    return (_a = this._decryptionResult.event.content) == null ? void 0 : _a["session_key"];
  }
  get serializationType() {
    return "create";
  }
  get keySource() {
    return KeySource.DeviceMessage;
  }
  loadInto(session) {
    session.create(this.serializationKey);
  }
}
class OutboundRoomKey extends IncomingRoomKey {
  constructor(_roomId, outboundSession, identityKeys) {
    super();
    this._roomId = _roomId;
    this.outboundSession = outboundSession;
    this.identityKeys = identityKeys;
    this.isBetter = true;
    this._sessionKey = this.outboundSession.session_key();
  }
  get roomId() {
    return this._roomId;
  }
  get senderKey() {
    return this.identityKeys.curve25519;
  }
  get sessionId() {
    return this.outboundSession.session_id();
  }
  get claimedEd25519Key() {
    return this.identityKeys.ed25519;
  }
  get serializationKey() {
    return this._sessionKey;
  }
  get serializationType() {
    return "create";
  }
  get keySource() {
    return KeySource.Outbound;
  }
  loadInto(session) {
    session.create(this.serializationKey);
  }
}
class BackupRoomKey extends IncomingRoomKey {
  constructor(_roomId, _sessionId, _backupInfo) {
    super();
    this._roomId = _roomId;
    this._sessionId = _sessionId;
    this._backupInfo = _backupInfo;
  }
  get roomId() {
    return this._roomId;
  }
  get senderKey() {
    return this._backupInfo["sender_key"];
  }
  get sessionId() {
    return this._sessionId;
  }
  get claimedEd25519Key() {
    var _a;
    return (_a = this._backupInfo["sender_claimed_keys"]) == null ? void 0 : _a["ed25519"];
  }
  get serializationKey() {
    return this._backupInfo["session_key"];
  }
  get serializationType() {
    return "import_session";
  }
  get keySource() {
    return KeySource.Backup;
  }
  loadInto(session) {
    session.import_session(this.serializationKey);
  }
  get backupStatus() {
    return BackupStatus.BackedUp;
  }
}
class StoredRoomKey extends RoomKey {
  constructor(storageEntry) {
    super();
    this.isBetter = true;
    this.storageEntry = storageEntry;
  }
  get roomId() {
    return this.storageEntry.roomId;
  }
  get senderKey() {
    return this.storageEntry.senderKey;
  }
  get sessionId() {
    return this.storageEntry.sessionId;
  }
  get claimedEd25519Key() {
    return this.storageEntry.claimedKeys["ed25519"];
  }
  get eventIds() {
    return this.storageEntry.eventIds;
  }
  get serializationKey() {
    return this.storageEntry.session || "";
  }
  get serializationType() {
    return "unpickle";
  }
  loadInto(session, pickleKey) {
    session.unpickle(pickleKey, this.serializationKey);
  }
  get hasSession() {
    return !!this.serializationKey;
  }
}
function keyFromDeviceMessage(dr) {
  var _a;
  const sessionKey = (_a = dr.event.content) == null ? void 0 : _a["session_key"];
  const key = new DeviceMessageRoomKey(dr);
  if (typeof key.roomId === "string" && typeof key.sessionId === "string" && typeof key.senderKey === "string" && typeof sessionKey === "string") {
    return key;
  }
}
function keyFromBackup(roomId, sessionId, backupInfo) {
  var _a;
  const sessionKey = backupInfo["session_key"];
  const senderKey = backupInfo["sender_key"];
  const claimedEd25519Key = (_a = backupInfo["sender_claimed_keys"]) == null ? void 0 : _a["ed25519"];
  if (typeof roomId === "string" && typeof sessionId === "string" && typeof senderKey === "string" && typeof sessionKey === "string" && typeof claimedEd25519Key === "string") {
    return new BackupRoomKey(roomId, sessionId, backupInfo);
  }
}
async function keyFromStorage(roomId, senderKey, sessionId, txn) {
  const existingSessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
  if (existingSessionEntry) {
    return new StoredRoomKey(existingSessionEntry);
  }
  return;
}
class Decryption {
  constructor(keyLoader, olmWorker) {
    this.keyLoader = keyLoader;
    this.olmWorker = olmWorker;
  }
  async addMissingKeyEventIds(roomId, senderKey, sessionId, eventIds, txn) {
    let sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
    if (sessionEntry == null ? void 0 : sessionEntry.session) {
      return;
    }
    if (sessionEntry) {
      const uniqueEventIds = new Set(sessionEntry.eventIds);
      for (const id of eventIds) {
        uniqueEventIds.add(id);
      }
      sessionEntry.eventIds = Array.from(uniqueEventIds);
    } else {
      sessionEntry = { roomId, senderKey, sessionId, eventIds };
    }
    txn.inboundGroupSessions.set(sessionEntry);
  }
  async getEventIdsForMissingKey(roomId, senderKey, sessionId, txn) {
    const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
    if (sessionEntry && !sessionEntry.session) {
      return sessionEntry.eventIds;
    }
  }
  async hasSession(roomId, senderKey, sessionId, txn) {
    const sessionEntry = await txn.inboundGroupSessions.get(roomId, senderKey, sessionId);
    const isValidSession = typeof (sessionEntry == null ? void 0 : sessionEntry.session) === "string";
    return isValidSession;
  }
  async prepareDecryptAll(roomId, events, newKeys, txn) {
    const errors = /* @__PURE__ */ new Map();
    const validEvents = [];
    for (const event2 of events) {
      if (validateEvent(event2)) {
        validEvents.push(event2);
      } else {
        errors.set(event2.event_id, new DecryptionError("MEGOLM_INVALID_EVENT", event2));
      }
    }
    const eventsBySession = groupEventsBySession(validEvents);
    const sessionDecryptions = [];
    await Promise.all(Array.from(eventsBySession.values()).map(async (group) => {
      const key = await this.getRoomKey(roomId, group.senderKey, group.sessionId, newKeys, txn);
      if (key) {
        sessionDecryptions.push(new SessionDecryption(key, group.events, this.olmWorker, this.keyLoader));
      } else {
        for (const event2 of group.events) {
          errors.set(event2.event_id, new DecryptionError("MEGOLM_NO_SESSION", event2));
        }
      }
    }));
    return new DecryptionPreparation$1(roomId, sessionDecryptions, errors);
  }
  async getRoomKey(roomId, senderKey, sessionId, newKeys, txn) {
    if (newKeys) {
      const key = newKeys.find((k) => k.isForSession(roomId, senderKey, sessionId));
      if (key && await key.checkBetterThanKeyInStorage(this.keyLoader, txn)) {
        return key;
      }
    }
    const cachedKey = this.keyLoader.getCachedKey(roomId, senderKey, sessionId);
    if (cachedKey) {
      return cachedKey;
    }
    const storageKey = await keyFromStorage(roomId, senderKey, sessionId, txn);
    if (storageKey && storageKey.serializationKey) {
      return storageKey;
    }
  }
  writeRoomKey(key, txn) {
    return key.write(this.keyLoader, txn);
  }
  roomKeysFromDeviceMessages(decryptionResults, log) {
    var _a, _b;
    const keys = [];
    for (const dr of decryptionResults) {
      if (((_a = dr.event) == null ? void 0 : _a.type) !== "m.room_key" || ((_b = dr.event.content) == null ? void 0 : _b.algorithm) !== MEGOLM_ALGORITHM) {
        continue;
      }
      log.wrap("room_key", (log2) => {
        const key = keyFromDeviceMessage(dr);
        if (key) {
          log2.set("roomId", key.roomId);
          log2.set("id", key.sessionId);
          keys.push(key);
        } else {
          log2.logLevel = log2.level.Warn;
          log2.set("invalid", true);
        }
      }, log.level.Detail);
    }
    return keys;
  }
  roomKeyFromBackup(roomId, sessionId, sessionInfo) {
    return keyFromBackup(roomId, sessionId, sessionInfo);
  }
  dispose() {
    this.keyLoader.dispose();
  }
}
class KeyLoader extends BaseLRUCache {
  constructor(olm, pickleKey, limit) {
    super(limit);
    this.pickleKey = pickleKey;
    this.olm = olm;
  }
  getCachedKey(roomId, senderKey, sessionId) {
    const idx = this.findCachedKeyIndex(roomId, senderKey, sessionId);
    if (idx !== -1) {
      return this._getByIndexAndMoveUp(idx).key;
    }
  }
  async useKey(key, callback) {
    const keyOp = await this.allocateOperation(key);
    try {
      return await callback(keyOp.session, this.pickleKey);
    } finally {
      this.releaseOperation(keyOp);
    }
  }
  get running() {
    return this._entries.some((op) => op.refCount !== 0);
  }
  dispose() {
    for (let i = 0; i < this._entries.length; i += 1) {
      this._entries[i].dispose();
    }
    this._entries.splice(0, this._entries.length);
  }
  async allocateOperation(key) {
    let idx;
    while ((idx = this.findIndexForAllocation(key)) === -1) {
      await this.operationBecomesUnused();
    }
    if (idx < this.size) {
      const op = this._getByIndexAndMoveUp(idx);
      if (op.isForKey(key)) {
        op.refCount += 1;
        return op;
      } else {
        op.refCount = 1;
        op.key = key;
        key.loadInto(op.session, this.pickleKey);
      }
      return op;
    } else {
      const session = new this.olm.InboundGroupSession();
      key.loadInto(session, this.pickleKey);
      const op = new KeyOperation(key, session);
      this._set(op);
      return op;
    }
  }
  releaseOperation(op) {
    op.refCount -= 1;
    if (op.refCount <= 0 && this.resolveUnusedOperation) {
      this.resolveUnusedOperation();
      this.operationBecomesUnusedPromise = this.resolveUnusedOperation = void 0;
    }
  }
  operationBecomesUnused() {
    if (!this.operationBecomesUnusedPromise) {
      this.operationBecomesUnusedPromise = new Promise((resolve) => {
        this.resolveUnusedOperation = resolve;
      });
    }
    return this.operationBecomesUnusedPromise;
  }
  findIndexForAllocation(key) {
    let idx = this.findIndexSameKey(key);
    if (idx === -1) {
      if (this.size < this.limit) {
        idx = this.size;
      } else {
        idx = this.findIndexSameSessionUnused(key);
        if (idx === -1) {
          idx = this.findIndexOldestUnused();
        }
      }
    }
    return idx;
  }
  findCachedKeyIndex(roomId, senderKey, sessionId) {
    return this._entries.reduce((bestIdx, op, i, arr) => {
      const bestOp = bestIdx === -1 ? void 0 : arr[bestIdx];
      if (op.isBest === true && op.isForSameSession(roomId, senderKey, sessionId)) {
        if (!bestOp || op.isBetter(bestOp)) {
          return i;
        }
      }
      return bestIdx;
    }, -1);
  }
  findIndexSameKey(key) {
    return this._entries.findIndex((op) => {
      return op.isForSameSession(key.roomId, key.senderKey, key.sessionId) && op.isForKey(key);
    });
  }
  findIndexSameSessionUnused(key) {
    return this._entries.reduce((worstIdx, op, i, arr) => {
      const worst = worstIdx === -1 ? void 0 : arr[worstIdx];
      if (op.refCount === 0 && op.isForSameSession(key.roomId, key.senderKey, key.sessionId)) {
        if (!worst || !op.isBetter(worst)) {
          return i;
        }
      }
      return worstIdx;
    }, -1);
  }
  findIndexOldestUnused() {
    for (let i = this._entries.length - 1; i >= 0; i -= 1) {
      const op = this._entries[i];
      if (op.refCount === 0) {
        return i;
      }
    }
    return -1;
  }
}
class KeyOperation {
  constructor(key, session) {
    this.key = key;
    this.session = session;
    this.refCount = 1;
  }
  isForSameSession(roomId, senderKey, sessionId) {
    return this.key.roomId === roomId && this.key.senderKey === senderKey && this.key.sessionId === sessionId;
  }
  isBetter(other) {
    return isBetterThan(this.session, other.session);
  }
  isForKey(key) {
    return this.key.serializationKey === key.serializationKey && this.key.serializationType === key.serializationType;
  }
  dispose() {
    this.session.free();
    this.session = void 0;
  }
  get isBest() {
    return this.key.isBetter;
  }
}
const Algorithm = "m.megolm_backup.v1.curve25519-aes-sha2";
class BackupEncryption {
  constructor(encryption, decryption) {
    this.encryption = encryption;
    this.decryption = decryption;
  }
  static fromAuthData(authData, privateKey, olm) {
    const expectedPubKey = authData.public_key;
    const decryption = new olm.PkDecryption();
    const encryption = new olm.PkEncryption();
    try {
      const pubKey = decryption.init_with_private_key(privateKey);
      if (pubKey !== expectedPubKey) {
        throw new Error(`Bad backup key, public key does not match. Calculated ${pubKey} but expected ${expectedPubKey}`);
      }
      encryption.set_recipient_key(pubKey);
    } catch (err) {
      decryption.free();
      throw err;
    }
    return new BackupEncryption(encryption, decryption);
  }
  decryptRoomKey(sessionData) {
    const sessionInfo = this.decryption.decrypt(sessionData.ephemeral, sessionData.mac, sessionData.ciphertext);
    return JSON.parse(sessionInfo);
  }
  encryptRoomKey(key, sessionKey) {
    const sessionInfo = {
      algorithm: MEGOLM_ALGORITHM,
      sender_key: key.senderKey,
      sender_claimed_keys: { ed25519: key.claimedEd25519Key },
      forwarding_curve25519_key_chain: [],
      session_key: sessionKey
    };
    return this.encryption.encrypt(JSON.stringify(sessionInfo));
  }
  dispose() {
    var _a, _b;
    (_a = this.decryption) == null ? void 0 : _a.free();
    this.decryption = void 0;
    (_b = this.encryption) == null ? void 0 : _b.free();
    this.encryption = void 0;
  }
}
const KEYS_PER_REQUEST = 200;
class KeyBackup {
  constructor(backupInfo, crypto2, hsApi, keyLoader, storage, platform2, maxDelay = 1e4) {
    this.backupInfo = backupInfo;
    this.crypto = crypto2;
    this.hsApi = hsApi;
    this.keyLoader = keyLoader;
    this.storage = storage;
    this.platform = platform2;
    this.maxDelay = maxDelay;
    this.operationInProgress = new ObservableValue(void 0);
    this._stopped = false;
    this._needsNewKey = false;
    this._hasBackedUpAllKeys = false;
  }
  get hasStopped() {
    return this._stopped;
  }
  get error() {
    return this._error;
  }
  get version() {
    return this.backupInfo.version;
  }
  get needsNewKey() {
    return this._needsNewKey;
  }
  get hasBackedUpAllKeys() {
    return this._hasBackedUpAllKeys;
  }
  async getRoomKey(roomId, sessionId, log) {
    const sessionResponse = await this.hsApi.roomKeyForRoomAndSession(this.backupInfo.version, roomId, sessionId, { log }).response();
    if (!sessionResponse.session_data) {
      return;
    }
    const sessionKeyInfo = this.crypto.decryptRoomKey(sessionResponse.session_data);
    if ((sessionKeyInfo == null ? void 0 : sessionKeyInfo.algorithm) === MEGOLM_ALGORITHM) {
      return keyFromBackup(roomId, sessionId, sessionKeyInfo);
    } else if (sessionKeyInfo == null ? void 0 : sessionKeyInfo.algorithm) {
      log.set("unknown algorithm", sessionKeyInfo.algorithm);
    }
  }
  markAllForBackup(txn) {
    return txn.inboundGroupSessions.markAllAsNotBackedUp();
  }
  flush(log) {
    if (!this.operationInProgress.get()) {
      log.wrapDetached("flush key backup", async (log2) => {
        if (this._needsNewKey) {
          log2.set("needsNewKey", this._needsNewKey);
          return;
        }
        this._stopped = false;
        this._error = void 0;
        this._hasBackedUpAllKeys = false;
        const operation = this._runFlushOperation(log2);
        this.operationInProgress.set(operation);
        try {
          await operation.result;
          this._hasBackedUpAllKeys = true;
        } catch (err) {
          this._stopped = true;
          if (err.name === "HomeServerError" && (err.errcode === "M_WRONG_ROOM_KEYS_VERSION" || err.errcode === "M_NOT_FOUND")) {
            log2.set("wrong_version", true);
            this._needsNewKey = true;
          } else {
            if (err.name !== "AbortError" || err.name === "StorageError" && err.errcode === "AbortError") {
              this._error = err;
            }
          }
          log2.catch(err);
        }
        this.operationInProgress.set(void 0);
      });
    }
  }
  _runFlushOperation(log) {
    return new AbortableOperation(async (setAbortable, setProgress) => {
      let total = 0;
      let amountFinished = 0;
      while (true) {
        const waitMs = this.platform.random() * this.maxDelay;
        const timeout = this.platform.clock.createTimeout(waitMs);
        setAbortable(timeout);
        await timeout.elapsed();
        const txn = await this.storage.readTxn([StoreNames.inboundGroupSessions]);
        setAbortable(txn);
        total = amountFinished + await txn.inboundGroupSessions.countNonBackedUpSessions();
        setProgress(new Progress(total, amountFinished));
        const keysNeedingBackup = (await txn.inboundGroupSessions.getFirstNonBackedUpSessions(KEYS_PER_REQUEST)).map((entry) => new StoredRoomKey(entry));
        if (keysNeedingBackup.length === 0) {
          log.set("total", total);
          return;
        }
        const payload = await this.encodeKeysForBackup(keysNeedingBackup);
        const uploadRequest = this.hsApi.uploadRoomKeysToBackup(this.backupInfo.version, payload, { log });
        setAbortable(uploadRequest);
        await uploadRequest.response();
        await this.markKeysAsBackedUp(keysNeedingBackup, setAbortable);
        amountFinished += keysNeedingBackup.length;
        setProgress(new Progress(total, amountFinished));
      }
    });
  }
  async encodeKeysForBackup(roomKeys) {
    const payload = { rooms: {} };
    const payloadRooms = payload.rooms;
    for (const key of roomKeys) {
      let roomPayload = payloadRooms[key.roomId];
      if (!roomPayload) {
        roomPayload = payloadRooms[key.roomId] = { sessions: {} };
      }
      roomPayload.sessions[key.sessionId] = await this.encodeRoomKey(key);
    }
    return payload;
  }
  async markKeysAsBackedUp(roomKeys, setAbortable) {
    const txn = await this.storage.readWriteTxn([
      StoreNames.inboundGroupSessions
    ]);
    setAbortable(txn);
    try {
      await Promise.all(roomKeys.map((key) => {
        return txn.inboundGroupSessions.markAsBackedUp(key.roomId, key.senderKey, key.sessionId);
      }));
    } catch (err) {
      txn.abort();
      throw err;
    }
    await txn.complete();
  }
  async encodeRoomKey(roomKey) {
    return await this.keyLoader.useKey(roomKey, (session) => {
      const firstMessageIndex = session.first_known_index();
      const sessionKey = session.export_session(firstMessageIndex);
      return {
        first_message_index: firstMessageIndex,
        forwarded_count: 0,
        is_verified: false,
        session_data: this.crypto.encryptRoomKey(roomKey, sessionKey)
      };
    });
  }
  dispose() {
    this.crypto.dispose();
  }
  static async fromSecretStorage(platform2, olm, secretStorage, hsApi, keyLoader, storage, txn) {
    const base64PrivateKey = await secretStorage.readSecret("m.megolm_backup.v1", txn);
    if (base64PrivateKey) {
      const privateKey = new Uint8Array(platform2.encoding.base64.decode(base64PrivateKey));
      const backupInfo = await hsApi.roomKeysVersion().response();
      if (backupInfo.algorithm === Algorithm) {
        const crypto2 = BackupEncryption.fromAuthData(backupInfo.auth_data, privateKey, olm);
        return new KeyBackup(backupInfo, crypto2, hsApi, keyLoader, storage, platform2);
      } else {
        throw new Error(`Unknown backup algorithm: ${backupInfo.algorithm}`);
      }
    }
  }
}
class Progress {
  constructor(total, finished) {
    this.total = total;
    this.finished = finished;
  }
}
class Encryption {
  constructor({ pickleKey, olm, account, keyLoader, storage, now, ownDeviceId }) {
    this._pickleKey = pickleKey;
    this._olm = olm;
    this._account = account;
    this._keyLoader = keyLoader;
    this._storage = storage;
    this._now = now;
    this._ownDeviceId = ownDeviceId;
  }
  discardOutboundSession(roomId, txn) {
    txn.outboundGroupSessions.remove(roomId);
  }
  async createRoomKeyMessage(roomId, txn) {
    let sessionEntry = await txn.outboundGroupSessions.get(roomId);
    if (sessionEntry) {
      const session = new this._olm.OutboundGroupSession();
      try {
        session.unpickle(this._pickleKey, sessionEntry.session);
        return this._createRoomKeyMessage(session, roomId);
      } finally {
        session.free();
      }
    }
  }
  createWithheldMessage(roomMessage, code, reason) {
    return {
      algorithm: roomMessage.algorithm,
      code,
      reason,
      room_id: roomMessage.room_id,
      sender_key: this._account.identityKeys.curve25519,
      session_id: roomMessage.session_id
    };
  }
  async ensureOutboundSession(roomId, encryptionParams) {
    let session = new this._olm.OutboundGroupSession();
    try {
      const txn = await this._storage.readWriteTxn([
        this._storage.storeNames.inboundGroupSessions,
        this._storage.storeNames.outboundGroupSessions
      ]);
      let roomKeyMessage;
      try {
        let sessionEntry = await txn.outboundGroupSessions.get(roomId);
        roomKeyMessage = await this._readOrCreateSession(session, sessionEntry, roomId, encryptionParams, txn);
        if (roomKeyMessage) {
          this._writeSession(this._now(), session, roomId, txn);
        }
      } catch (err) {
        txn.abort();
        throw err;
      }
      await txn.complete();
      return roomKeyMessage;
    } finally {
      session.free();
    }
  }
  async _readOrCreateSession(session, sessionEntry, roomId, encryptionParams, txn) {
    if (sessionEntry) {
      session.unpickle(this._pickleKey, sessionEntry.session);
    }
    if (!sessionEntry || this._needsToRotate(session, sessionEntry.createdAt, encryptionParams)) {
      if (sessionEntry) {
        session.free();
        session = new this._olm.OutboundGroupSession();
      }
      session.create();
      const roomKeyMessage = this._createRoomKeyMessage(session, roomId);
      const roomKey = new OutboundRoomKey(roomId, session, this._account.identityKeys);
      await roomKey.write(this._keyLoader, txn);
      return roomKeyMessage;
    }
  }
  _writeSession(createdAt, session, roomId, txn) {
    txn.outboundGroupSessions.set({
      roomId,
      session: session.pickle(this._pickleKey),
      createdAt
    });
  }
  async encrypt(roomId, type, content, encryptionParams) {
    let session = new this._olm.OutboundGroupSession();
    try {
      const txn = await this._storage.readWriteTxn([
        this._storage.storeNames.inboundGroupSessions,
        this._storage.storeNames.outboundGroupSessions
      ]);
      let roomKeyMessage;
      let encryptedContent;
      try {
        let sessionEntry = await txn.outboundGroupSessions.get(roomId);
        roomKeyMessage = await this._readOrCreateSession(session, sessionEntry, roomId, encryptionParams, txn);
        encryptedContent = this._encryptContent(roomId, session, type, content);
        const createdAt = roomKeyMessage ? this._now() : sessionEntry.createdAt;
        this._writeSession(createdAt, session, roomId, txn);
      } catch (err) {
        txn.abort();
        throw err;
      }
      await txn.complete();
      return new EncryptionResult(encryptedContent, roomKeyMessage);
    } finally {
      if (session) {
        session.free();
      }
    }
  }
  _needsToRotate(session, createdAt, encryptionParams) {
    let rotationPeriodMs = 6048e5;
    if (Number.isSafeInteger(encryptionParams == null ? void 0 : encryptionParams.rotation_period_ms)) {
      rotationPeriodMs = encryptionParams == null ? void 0 : encryptionParams.rotation_period_ms;
    }
    let rotationPeriodMsgs = 100;
    if (Number.isSafeInteger(encryptionParams == null ? void 0 : encryptionParams.rotation_period_msgs)) {
      rotationPeriodMsgs = encryptionParams == null ? void 0 : encryptionParams.rotation_period_msgs;
    }
    if (this._now() > createdAt + rotationPeriodMs) {
      return true;
    }
    if (session.message_index() >= rotationPeriodMsgs) {
      return true;
    }
  }
  _encryptContent(roomId, session, type, content) {
    const plaintext = JSON.stringify({
      room_id: roomId,
      type,
      content
    });
    const ciphertext = session.encrypt(plaintext);
    const encryptedContent = {
      algorithm: MEGOLM_ALGORITHM,
      sender_key: this._account.identityKeys.curve25519,
      ciphertext,
      session_id: session.session_id(),
      device_id: this._ownDeviceId
    };
    return encryptedContent;
  }
  _createRoomKeyMessage(session, roomId) {
    return {
      room_id: roomId,
      session_id: session.session_id(),
      session_key: session.session_key(),
      algorithm: MEGOLM_ALGORITHM,
      chain_index: session.message_index()
    };
  }
}
class EncryptionResult {
  constructor(content, roomKeyMessage) {
    this.content = content;
    this.roomKeyMessage = roomKeyMessage;
  }
}
const ENCRYPTED_TYPE = "m.room.encrypted";
const ROOM_HISTORY_VISIBILITY_TYPE = "m.room.history_visibility";
const MIN_PRESHARE_INTERVAL = 60 * 1e3;
class RoomEncryption {
  constructor({ room, deviceTracker, olmEncryption, megolmEncryption, megolmDecryption, encryptionParams, storage, keyBackup, notifyMissingMegolmSession, clock }) {
    this._room = room;
    this._deviceTracker = deviceTracker;
    this._olmEncryption = olmEncryption;
    this._megolmEncryption = megolmEncryption;
    this._megolmDecryption = megolmDecryption;
    this._encryptionParams = encryptionParams;
    this._senderDeviceCache = /* @__PURE__ */ new Map();
    this._storage = storage;
    this._keyBackup = keyBackup;
    this._notifyMissingMegolmSession = notifyMissingMegolmSession;
    this._clock = clock;
    this._isFlushingRoomKeyShares = false;
    this._lastKeyPreShareTime = null;
    this._keySharePromise = null;
    this._historyVisibility = void 0;
    this._disposed = false;
  }
  enableKeyBackup(keyBackup) {
    if (this._keyBackup && !!keyBackup) {
      return;
    }
    this._keyBackup = keyBackup;
  }
  async restoreMissingSessionsFromBackup(entries, log) {
    const events = entries.filter((e) => e.isEncrypted && !e.isDecrypted && e.event).map((e) => e.event);
    const eventsBySession = groupEventsBySession(events);
    const groups = Array.from(eventsBySession.values());
    const txn = await this._storage.readTxn([this._storage.storeNames.inboundGroupSessions]);
    const hasSessions = await Promise.all(groups.map(async (group) => {
      return this._megolmDecryption.hasSession(this._room.id, group.senderKey, group.sessionId, txn);
    }));
    const missingSessions = groups.filter((_, i2) => !hasSessions[i2]);
    if (missingSessions.length) {
      for (var i = missingSessions.length - 1; i >= 0; i--) {
        const session = missingSessions[i];
        await log.wrap("session", (log2) => this._requestMissingSessionFromBackup(session.senderKey, session.sessionId, log2));
      }
    }
  }
  notifyTimelineClosed() {
    this._senderDeviceCache = /* @__PURE__ */ new Map();
  }
  async writeSync(roomResponse, memberChanges, txn, log) {
    let historyVisibility = await this._loadHistoryVisibilityIfNeeded(this._historyVisibility, txn);
    const addedMembers = [];
    const removedMembers = [];
    await iterateResponseStateEvents(roomResponse, (event2) => {
      var _a;
      if (event2.state_key === "" && event2.type === ROOM_HISTORY_VISIBILITY_TYPE) {
        const newHistoryVisibility = (_a = event2 == null ? void 0 : event2.content) == null ? void 0 : _a.history_visibility;
        if (newHistoryVisibility !== historyVisibility) {
          return log.wrap({
            l: "history_visibility changed",
            from: historyVisibility,
            to: newHistoryVisibility
          }, async (log2) => {
            historyVisibility = newHistoryVisibility;
            const result = await this._deviceTracker.writeHistoryVisibility(this._room, historyVisibility, txn, log2);
            addedMembers.push(...result.added);
            removedMembers.push(...result.removed);
          });
        }
      }
    });
    if (memberChanges.size) {
      const result = await this._deviceTracker.writeMemberChanges(this._room, memberChanges, historyVisibility, txn);
      addedMembers.push(...result.added);
      removedMembers.push(...result.removed);
    }
    if (removedMembers.length) {
      log.log({
        l: "discardOutboundSession",
        leftUsers: removedMembers
      });
      this._megolmEncryption.discardOutboundSession(this._room.id, txn);
    }
    let shouldFlush = false;
    if (addedMembers.length) {
      shouldFlush = await this._addShareRoomKeyOperationForMembers(addedMembers, txn, log);
    }
    return { shouldFlush, historyVisibility };
  }
  afterSync({ historyVisibility }) {
    this._historyVisibility = historyVisibility;
  }
  async _loadHistoryVisibilityIfNeeded(historyVisibility, txn = void 0) {
    var _a, _b;
    if (!historyVisibility) {
      if (!txn) {
        txn = await this._storage.readTxn([this._storage.storeNames.roomState]);
      }
      const visibilityEntry = await txn.roomState.get(this._room.id, ROOM_HISTORY_VISIBILITY_TYPE, "");
      if (visibilityEntry) {
        return (_b = (_a = visibilityEntry.event) == null ? void 0 : _a.content) == null ? void 0 : _b.history_visibility;
      }
    }
    return historyVisibility;
  }
  async prepareDecryptAll(events, newKeys, source, txn) {
    var _a, _b, _c2;
    const errors = /* @__PURE__ */ new Map();
    const validEvents = [];
    for (const event2 of events) {
      if (event2.redacted_because || ((_a = event2.unsigned) == null ? void 0 : _a.redacted_because)) {
        continue;
      }
      if (((_b = event2.content) == null ? void 0 : _b.algorithm) !== MEGOLM_ALGORITHM) {
        errors.set(event2.event_id, new Error("Unsupported algorithm: " + ((_c2 = event2.content) == null ? void 0 : _c2.algorithm)));
      }
      validEvents.push(event2);
    }
    const preparation = await this._megolmDecryption.prepareDecryptAll(this._room.id, validEvents, newKeys, txn);
    return new DecryptionPreparation(preparation, errors, source, this, events);
  }
  async _processDecryptionResults(events, results, errors, source, txn, log) {
    const missingSessionEvents = events.filter((event2) => {
      const error = errors.get(event2.event_id);
      return (error == null ? void 0 : error.code) === "MEGOLM_NO_SESSION";
    });
    if (!missingSessionEvents.length) {
      return;
    }
    const missingEventsBySession = groupEventsBySession(missingSessionEvents);
    if (source === DecryptionSource.Sync) {
      await Promise.all(Array.from(missingEventsBySession.values()).map(async (group) => {
        const eventIds = group.events.map((e) => e.event_id);
        return this._megolmDecryption.addMissingKeyEventIds(this._room.id, group.senderKey, group.sessionId, eventIds, txn);
      }));
    }
    if (!this._keyBackup) {
      return;
    }
    log.wrapDetached("check key backup", async (log2) => {
      log2.set("source", source);
      log2.set("events", missingSessionEvents.length);
      log2.set("sessions", missingEventsBySession.size);
      if (source === DecryptionSource.Sync) {
        await this._clock.createTimeout(1e4).elapsed();
        if (this._disposed) {
          return;
        }
        const txn2 = await this._storage.readTxn([this._storage.storeNames.inboundGroupSessions]);
        await Promise.all(Array.from(missingEventsBySession).map(async ([key, group]) => {
          if (await this._megolmDecryption.hasSession(this._room.id, group.senderKey, group.sessionId, txn2)) {
            missingEventsBySession.delete(key);
          }
        }));
      }
      await Promise.all(Array.from(missingEventsBySession.values()).map((group) => {
        return log2.wrap("session", (log3) => this._requestMissingSessionFromBackup(group.senderKey, group.sessionId, log3));
      }));
    });
  }
  async _verifyDecryptionResults(results, txn) {
    await Promise.all(results.map(async (result) => {
      let device = this._senderDeviceCache.get(result.senderCurve25519Key);
      if (!device) {
        device = await this._deviceTracker.getDeviceByCurve25519Key(result.senderCurve25519Key, txn);
        this._senderDeviceCache.set(result.senderCurve25519Key, device);
      }
      if (device) {
        result.setDevice(device);
      }
    }));
  }
  async _fetchKeyAndVerifyDecryptionResults(results, hsApi, log) {
    const resultsWithoutDevice = results.filter((r) => r.isVerificationUnknown);
    if (resultsWithoutDevice.length) {
      return log.wrap("fetch unverified senders", async (log2) => {
        const sendersWithoutDevice = Array.from(resultsWithoutDevice.reduce((senders, r) => {
          return senders.add(r.encryptedEvent.sender);
        }, /* @__PURE__ */ new Set()));
        log2.set("senders", sendersWithoutDevice);
        await this._deviceTracker.devicesForRoomMembers(this._room.id, sendersWithoutDevice, hsApi, log2);
        const txn = await this._storage.readTxn([this._storage.storeNames.deviceIdentities]);
        await this._verifyDecryptionResults(resultsWithoutDevice, txn);
        const resultsWithFoundDevice = resultsWithoutDevice.filter((r) => !r.isVerificationUnknown);
        const resultsToEventIdMap = resultsWithFoundDevice.reduce((map, r) => {
          map.set(r.encryptedEvent.event_id, r);
          return map;
        }, /* @__PURE__ */ new Map());
        return new BatchDecryptionResult(resultsToEventIdMap, /* @__PURE__ */ new Map(), this);
      });
    }
    return new BatchDecryptionResult(/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map(), this);
  }
  async _requestMissingSessionFromBackup(senderKey, sessionId, log) {
    if (!this._keyBackup) {
      log.set("enabled", false);
      this._notifyMissingMegolmSession();
      return;
    }
    log.set("id", sessionId);
    log.set("senderKey", senderKey);
    try {
      const roomKey = await this._keyBackup.getRoomKey(this._room.id, sessionId, log);
      if (roomKey) {
        if (roomKey.senderKey !== senderKey) {
          log.set("wrong_sender_key", roomKey.senderKey);
          log.logLevel = log.level.Warn;
          return;
        }
        let keyIsBestOne = false;
        let retryEventIds;
        const txn = await this._storage.readWriteTxn([this._storage.storeNames.inboundGroupSessions]);
        try {
          keyIsBestOne = await this._megolmDecryption.writeRoomKey(roomKey, txn);
          log.set("isBetter", keyIsBestOne);
          if (keyIsBestOne) {
            retryEventIds = roomKey.eventIds;
          }
        } catch (err) {
          txn.abort();
          throw err;
        }
        await txn.complete();
        if (keyIsBestOne) {
          await log.wrap("retryDecryption", (log2) => this._room.notifyRoomKey(roomKey, retryEventIds || [], log2));
        }
      }
    } catch (err) {
      if (!(err.name === "HomeServerError" && err.errcode === "M_NOT_FOUND")) {
        log.set("not_found", true);
      } else {
        log.error = err;
        log.logLevel = log.level.Error;
      }
    }
  }
  getEventIdsForMissingKey(roomKey, txn) {
    return this._megolmDecryption.getEventIdsForMissingKey(this._room.id, roomKey.senderKey, roomKey.sessionId, txn);
  }
  async ensureMessageKeyIsShared(hsApi, log) {
    var _a;
    if (((_a = this._lastKeyPreShareTime) == null ? void 0 : _a.measure()) < MIN_PRESHARE_INTERVAL) {
      return;
    }
    this._lastKeyPreShareTime = this._clock.createMeasure();
    try {
      this._keySharePromise = (async () => {
        var _a2;
        const roomKeyMessage = await this._megolmEncryption.ensureOutboundSession(this._room.id, this._encryptionParams);
        if (roomKeyMessage) {
          (_a2 = this._keyBackup) == null ? void 0 : _a2.flush(log);
          await log.wrap("share key", (log2) => this._shareNewRoomKey(roomKeyMessage, hsApi, log2));
        }
      })();
      await this._keySharePromise;
    } finally {
      this._keySharePromise = null;
    }
  }
  async encrypt(type, content, hsApi, log) {
    var _a;
    if (this._keySharePromise) {
      log.set("waitForRunningKeyShare", true);
      await this._keySharePromise;
    }
    const megolmResult = await log.wrap("megolm encrypt", () => this._megolmEncryption.encrypt(this._room.id, type, content, this._encryptionParams));
    if (megolmResult.roomKeyMessage) {
      (_a = this._keyBackup) == null ? void 0 : _a.flush(log);
      await log.wrap("share key", (log2) => this._shareNewRoomKey(megolmResult.roomKeyMessage, hsApi, log2));
    }
    return {
      type: ENCRYPTED_TYPE,
      content: megolmResult.content
    };
  }
  needsToShareKeys(memberChanges) {
    for (const m of memberChanges.values()) {
      if (m.hasJoined) {
        return true;
      }
    }
    return false;
  }
  async _shareNewRoomKey(roomKeyMessage, hsApi, log) {
    this._historyVisibility = await this._loadHistoryVisibilityIfNeeded(this._historyVisibility);
    await this._deviceTracker.trackRoom(this._room, this._historyVisibility, log);
    const devices = await this._deviceTracker.devicesForTrackedRoom(this._room.id, hsApi, log);
    const userIds = Array.from(devices.reduce((set, device) => set.add(device.userId), /* @__PURE__ */ new Set()));
    let writeOpTxn = await this._storage.readWriteTxn([this._storage.storeNames.operations]);
    let operation;
    try {
      operation = this._writeRoomKeyShareOperation(roomKeyMessage, userIds, writeOpTxn);
    } catch (err) {
      writeOpTxn.abort();
      throw err;
    }
    await this._processShareRoomKeyOperation(operation, hsApi, log);
  }
  async _addShareRoomKeyOperationForMembers(userIds, txn, log) {
    const roomKeyMessage = await this._megolmEncryption.createRoomKeyMessage(this._room.id, txn);
    if (roomKeyMessage) {
      log.log({
        l: "share key for new members",
        userIds,
        id: roomKeyMessage.session_id,
        chain_index: roomKeyMessage.chain_index
      });
      this._writeRoomKeyShareOperation(roomKeyMessage, userIds, txn);
      return true;
    }
    return false;
  }
  async flushPendingRoomKeyShares(hsApi, operations, log) {
    if (this._isFlushingRoomKeyShares) {
      return;
    }
    this._isFlushingRoomKeyShares = true;
    try {
      if (!operations) {
        const txn = await this._storage.readTxn([this._storage.storeNames.operations]);
        operations = await txn.operations.getAllByTypeAndScope("share_room_key", this._room.id);
      }
      for (const operation of operations) {
        if (operation.type !== "share_room_key") {
          continue;
        }
        await log.wrap("operation", (log2) => this._processShareRoomKeyOperation(operation, hsApi, log2));
      }
    } finally {
      this._isFlushingRoomKeyShares = false;
    }
  }
  _writeRoomKeyShareOperation(roomKeyMessage, userIds, txn) {
    const id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
    const operation = {
      id,
      type: "share_room_key",
      scope: this._room.id,
      userIds,
      roomKeyMessage
    };
    txn.operations.add(operation);
    return operation;
  }
  async _processShareRoomKeyOperation(operation, hsApi, log) {
    log.set("id", operation.id);
    this._historyVisibility = await this._loadHistoryVisibilityIfNeeded(this._historyVisibility);
    await this._deviceTracker.trackRoom(this._room, this._historyVisibility, log);
    const devices = await this._deviceTracker.devicesForRoomMembers(this._room.id, operation.userIds, hsApi, log);
    const messages = await log.wrap("olm encrypt", (log2) => this._olmEncryption.encrypt("m.room_key", operation.roomKeyMessage, devices, hsApi, log2));
    const missingDevices = devices.filter((d) => !messages.some((m) => m.device === d));
    await log.wrap("send", (log2) => this._sendMessagesToDevices(ENCRYPTED_TYPE, messages, hsApi, log2));
    if (missingDevices.length) {
      await log.wrap("missingDevices", async (log2) => {
        log2.set("devices", missingDevices.map((d) => d.deviceId));
        const unsentUserIds = operation.userIds.filter((userId) => missingDevices.some((d) => d.userId === userId));
        log2.set("unsentUserIds", unsentUserIds);
        operation.userIds = unsentUserIds;
        await this._updateOperationsStore((operations) => operations.update(operation));
        const withheldMessage = this._megolmEncryption.createWithheldMessage(operation.roomKeyMessage, "m.no_olm", "OTKs exhausted");
        await this._sendSharedMessageToDevices("org.matrix.room_key.withheld", withheldMessage, missingDevices, hsApi, log2);
      });
    }
    await this._updateOperationsStore((operations) => operations.remove(operation.id));
  }
  async _updateOperationsStore(callback) {
    const writeTxn = await this._storage.readWriteTxn([this._storage.storeNames.operations]);
    try {
      callback(writeTxn.operations);
    } catch (err) {
      writeTxn.abort();
      throw err;
    }
    await writeTxn.complete();
  }
  async _sendSharedMessageToDevices(type, message, devices, hsApi, log) {
    const devicesByUser = groupBy(devices, (device) => device.userId);
    const payload = {
      messages: Array.from(devicesByUser.entries()).reduce((userMap, [userId, devices2]) => {
        userMap[userId] = devices2.reduce((deviceMap, device) => {
          deviceMap[device.deviceId] = message;
          return deviceMap;
        }, {});
        return userMap;
      }, {})
    };
    const txnId = makeTxnId();
    await hsApi.sendToDevice(type, payload, txnId, { log }).response();
  }
  async _sendMessagesToDevices(type, messages, hsApi, log) {
    log.set("messages", messages.length);
    const messagesByUser = groupBy(messages, (message) => message.device.userId);
    const payload = {
      messages: Array.from(messagesByUser.entries()).reduce((userMap, [userId, messages2]) => {
        userMap[userId] = messages2.reduce((deviceMap, message) => {
          deviceMap[message.device.deviceId] = message.content;
          return deviceMap;
        }, {});
        return userMap;
      }, {})
    };
    const txnId = makeTxnId();
    await hsApi.sendToDevice(type, payload, txnId, { log }).response();
  }
  filterUndecryptedEventEntriesForKeys(entries, keys) {
    return entries.filter((entry) => {
      var _a, _b;
      if (entry.isEncrypted && !entry.isDecrypted) {
        const { event: event2 } = entry;
        if (event2) {
          const senderKey = (_a = event2.content) == null ? void 0 : _a["sender_key"];
          const sessionId = (_b = event2.content) == null ? void 0 : _b["session_id"];
          return keys.some((key) => senderKey === key.senderKey && sessionId === key.sessionId);
        }
      }
      return false;
    });
  }
  dispose() {
    this._disposed = true;
  }
}
class DecryptionPreparation {
  constructor(megolmDecryptionPreparation, extraErrors, source, roomEncryption, events) {
    this._megolmDecryptionPreparation = megolmDecryptionPreparation;
    this._extraErrors = extraErrors;
    this._source = source;
    this._roomEncryption = roomEncryption;
    this._events = events;
  }
  async decrypt() {
    return new DecryptionChanges(await this._megolmDecryptionPreparation.decrypt(), this._extraErrors, this._source, this._roomEncryption, this._events);
  }
  dispose() {
    this._megolmDecryptionPreparation.dispose();
  }
}
class DecryptionChanges {
  constructor(megolmDecryptionChanges, extraErrors, source, roomEncryption, events) {
    this._megolmDecryptionChanges = megolmDecryptionChanges;
    this._extraErrors = extraErrors;
    this._source = source;
    this._roomEncryption = roomEncryption;
    this._events = events;
  }
  async write(txn, log) {
    const { results, errors } = await this._megolmDecryptionChanges.write(txn);
    mergeMap(this._extraErrors, errors);
    await this._roomEncryption._processDecryptionResults(this._events, results, errors, this._source, txn, log);
    return new BatchDecryptionResult(results, errors, this._roomEncryption);
  }
}
class BatchDecryptionResult {
  constructor(results, errors, roomEncryption) {
    this.results = results;
    this.errors = errors;
    this._roomEncryption = roomEncryption;
  }
  applyToEntries(entries, callback = void 0) {
    for (const entry of entries) {
      const result = this.results.get(entry.id);
      if (result) {
        entry.setDecryptionResult(result);
        callback == null ? void 0 : callback(entry);
      } else {
        const error = this.errors.get(entry.id);
        if (error) {
          entry.setDecryptionError(error);
          callback == null ? void 0 : callback(entry);
        }
      }
    }
  }
  verifyKnownSenders(txn) {
    return this._roomEncryption._verifyDecryptionResults(Array.from(this.results.values()), txn);
  }
  get hasUnverifiedSenders() {
    for (const r of this.results.values()) {
      if (r.isVerificationUnknown) {
        return true;
      }
    }
    return false;
  }
  fetchAndVerifyRemainingSenders(hsApi, log) {
    return this._roomEncryption._fetchKeyAndVerifyDecryptionResults(Array.from(this.results.values()), hsApi, log);
  }
}
const TRACKING_STATUS_OUTDATED = 0;
const TRACKING_STATUS_UPTODATE = 1;
function addRoomToIdentity(identity, userId, roomId) {
  if (!identity) {
    identity = {
      userId,
      roomIds: [roomId],
      deviceTrackingStatus: TRACKING_STATUS_OUTDATED
    };
    return identity;
  } else {
    if (!identity.roomIds.includes(roomId)) {
      identity.roomIds.push(roomId);
      return identity;
    }
  }
}
function deviceKeysAsDeviceIdentity(deviceSection) {
  var _a;
  const deviceId = deviceSection["device_id"];
  const userId = deviceSection["user_id"];
  return {
    userId,
    deviceId,
    ed25519Key: deviceSection.keys[`ed25519:${deviceId}`],
    curve25519Key: deviceSection.keys[`curve25519:${deviceId}`],
    algorithms: deviceSection.algorithms,
    displayName: (_a = deviceSection.unsigned) == null ? void 0 : _a.device_display_name
  };
}
class DeviceTracker {
  constructor({ storage, getSyncToken, olmUtil, ownUserId, ownDeviceId }) {
    this._storage = storage;
    this._getSyncToken = getSyncToken;
    this._identityChangedForRoom = null;
    this._olmUtil = olmUtil;
    this._ownUserId = ownUserId;
    this._ownDeviceId = ownDeviceId;
  }
  async writeDeviceChanges(changed, txn, log) {
    const { userIdentities } = txn;
    log.set("changed", changed.length);
    await Promise.all(changed.map(async (userId) => {
      const user = await userIdentities.get(userId);
      if (user) {
        log.log({ l: "outdated", id: userId });
        user.deviceTrackingStatus = TRACKING_STATUS_OUTDATED;
        userIdentities.set(user);
      }
    }));
  }
  async writeMemberChanges(room, memberChanges, historyVisibility, txn) {
    const added = [];
    const removed = [];
    await Promise.all(Array.from(memberChanges.values()).map(async (memberChange) => {
      if (shouldShareKey(memberChange.membership, historyVisibility)) {
        if (await this._addRoomToUserIdentity(memberChange.roomId, memberChange.userId, txn)) {
          added.push(memberChange.userId);
        }
      } else if (shouldShareKey(memberChange.previousMembership, historyVisibility)) {
        const { roomId } = memberChange;
        if (memberChange.userId === this._ownUserId) {
          const userIds = await txn.roomMembers.getAllUserIds(roomId);
          await Promise.all(userIds.map((userId) => {
            return this._removeRoomFromUserIdentity(roomId, userId, txn);
          }));
        } else {
          await this._removeRoomFromUserIdentity(roomId, memberChange.userId, txn);
        }
        removed.push(memberChange.userId);
      }
    }));
    return { added, removed };
  }
  async trackRoom(room, historyVisibility, log) {
    if (room.isTrackingMembers || !room.isEncrypted) {
      return;
    }
    const memberList = await room.loadMemberList(void 0, log);
    const txn = await this._storage.readWriteTxn([
      this._storage.storeNames.roomSummary,
      this._storage.storeNames.userIdentities
    ]);
    try {
      let isTrackingChanges;
      try {
        isTrackingChanges = room.writeIsTrackingMembers(true, txn);
        const members = Array.from(memberList.members.values());
        log.set("members", members.length);
        await Promise.all(members.map(async (member) => {
          if (shouldShareKey(member.membership, historyVisibility)) {
            await this._addRoomToUserIdentity(member.roomId, member.userId, txn);
          }
        }));
      } catch (err) {
        txn.abort();
        throw err;
      }
      await txn.complete();
      room.applyIsTrackingMembersChanges(isTrackingChanges);
    } finally {
      memberList.release();
    }
  }
  async writeHistoryVisibility(room, historyVisibility, syncTxn, log) {
    const added = [];
    const removed = [];
    if (room.isTrackingMembers && room.isEncrypted) {
      await log.wrap("rewriting userIdentities", async (log2) => {
        const memberList = await room.loadMemberList(syncTxn, log2);
        try {
          const members = Array.from(memberList.members.values());
          log2.set("members", members.length);
          await Promise.all(members.map(async (member) => {
            if (shouldShareKey(member.membership, historyVisibility)) {
              if (await this._addRoomToUserIdentity(member.roomId, member.userId, syncTxn)) {
                added.push(member.userId);
              }
            } else {
              if (await this._removeRoomFromUserIdentity(member.roomId, member.userId, syncTxn)) {
                removed.push(member.userId);
              }
            }
          }));
        } finally {
          memberList.release();
        }
      });
    }
    return { added, removed };
  }
  async _addRoomToUserIdentity(roomId, userId, txn) {
    const { userIdentities } = txn;
    const identity = await userIdentities.get(userId);
    const updatedIdentity = addRoomToIdentity(identity, userId, roomId);
    if (updatedIdentity) {
      userIdentities.set(updatedIdentity);
      return true;
    }
    return false;
  }
  async _removeRoomFromUserIdentity(roomId, userId, txn) {
    const { userIdentities, deviceIdentities } = txn;
    const identity = await userIdentities.get(userId);
    if (identity) {
      identity.roomIds = identity.roomIds.filter((id) => id !== roomId);
      if (identity.roomIds.length === 0) {
        userIdentities.remove(userId);
        deviceIdentities.removeAllForUser(userId);
      } else {
        userIdentities.set(identity);
      }
      return true;
    }
    return false;
  }
  async _queryKeys(userIds, hsApi, log) {
    const deviceKeyResponse = await hsApi.queryKeys({
      "timeout": 1e4,
      "device_keys": userIds.reduce((deviceKeysMap, userId) => {
        deviceKeysMap[userId] = [];
        return deviceKeysMap;
      }, {}),
      "token": this._getSyncToken()
    }, { log }).response();
    const verifiedKeysPerUser = log.wrap("verify", (log2) => this._filterVerifiedDeviceKeys(deviceKeyResponse["device_keys"], log2));
    const txn = await this._storage.readWriteTxn([
      this._storage.storeNames.userIdentities,
      this._storage.storeNames.deviceIdentities
    ]);
    let deviceIdentities;
    try {
      const devicesIdentitiesPerUser = await Promise.all(verifiedKeysPerUser.map(async ({ userId, verifiedKeys }) => {
        const deviceIdentities2 = verifiedKeys.map(deviceKeysAsDeviceIdentity);
        return await this._storeQueriedDevicesForUserId(userId, deviceIdentities2, txn);
      }));
      deviceIdentities = devicesIdentitiesPerUser.reduce((all, devices) => all.concat(devices), []);
      log.set("devices", deviceIdentities.length);
    } catch (err) {
      txn.abort();
      throw err;
    }
    await txn.complete();
    return deviceIdentities;
  }
  async _storeQueriedDevicesForUserId(userId, deviceIdentities, txn) {
    const knownDeviceIds = await txn.deviceIdentities.getAllDeviceIds(userId);
    for (const deviceId of knownDeviceIds) {
      if (deviceIdentities.every((di) => di.deviceId !== deviceId)) {
        txn.deviceIdentities.remove(userId, deviceId);
      }
    }
    const allDeviceIdentities = [];
    const deviceIdentitiesToStore = [];
    await Promise.all(deviceIdentities.map(async (deviceIdentity) => {
      if (knownDeviceIds.includes(deviceIdentity.deviceId)) {
        const existingDevice = await txn.deviceIdentities.get(deviceIdentity.userId, deviceIdentity.deviceId);
        if (existingDevice.ed25519Key !== deviceIdentity.ed25519Key) {
          allDeviceIdentities.push(existingDevice);
          return;
        }
      }
      allDeviceIdentities.push(deviceIdentity);
      deviceIdentitiesToStore.push(deviceIdentity);
    }));
    for (const deviceIdentity of deviceIdentitiesToStore) {
      txn.deviceIdentities.set(deviceIdentity);
    }
    const identity = await txn.userIdentities.get(userId);
    identity.deviceTrackingStatus = TRACKING_STATUS_UPTODATE;
    txn.userIdentities.set(identity);
    return allDeviceIdentities;
  }
  _filterVerifiedDeviceKeys(keyQueryDeviceKeysResponse, parentLog) {
    const curve25519Keys = /* @__PURE__ */ new Set();
    const verifiedKeys = Object.entries(keyQueryDeviceKeysResponse).map(([userId, keysByDevice]) => {
      const verifiedEntries = Object.entries(keysByDevice).filter(([deviceId, deviceKeys]) => {
        var _a, _b;
        const deviceIdOnKeys = deviceKeys["device_id"];
        const userIdOnKeys = deviceKeys["user_id"];
        if (userIdOnKeys !== userId) {
          return false;
        }
        if (deviceIdOnKeys !== deviceId) {
          return false;
        }
        const ed25519Key = (_a = deviceKeys.keys) == null ? void 0 : _a[`ed25519:${deviceId}`];
        const curve25519Key = (_b = deviceKeys.keys) == null ? void 0 : _b[`curve25519:${deviceId}`];
        if (typeof ed25519Key !== "string" || typeof curve25519Key !== "string") {
          return false;
        }
        if (curve25519Keys.has(curve25519Key)) {
          parentLog.log({
            l: "ignore device with duplicate curve25519 key",
            keys: deviceKeys
          }, parentLog.level.Warn);
          return false;
        }
        curve25519Keys.add(curve25519Key);
        const isValid = this._hasValidSignature(deviceKeys, parentLog);
        if (!isValid) {
          parentLog.log({
            l: "ignore device with invalid signature",
            keys: deviceKeys
          }, parentLog.level.Warn);
        }
        return isValid;
      });
      const verifiedKeys2 = verifiedEntries.map(([, deviceKeys]) => deviceKeys);
      return { userId, verifiedKeys: verifiedKeys2 };
    });
    return verifiedKeys;
  }
  _hasValidSignature(deviceSection, parentLog) {
    var _a;
    const deviceId = deviceSection["device_id"];
    const userId = deviceSection["user_id"];
    const ed25519Key = (_a = deviceSection == null ? void 0 : deviceSection.keys) == null ? void 0 : _a[`${SIGNATURE_ALGORITHM}:${deviceId}`];
    return verifyEd25519Signature(this._olmUtil, userId, deviceId, ed25519Key, deviceSection, parentLog);
  }
  async devicesForTrackedRoom(roomId, hsApi, log) {
    const txn = await this._storage.readTxn([
      this._storage.storeNames.roomMembers,
      this._storage.storeNames.userIdentities
    ]);
    const userIds = await txn.roomMembers.getAllUserIds(roomId);
    return await this._devicesForUserIds(roomId, userIds, txn, hsApi, log);
  }
  async devicesForRoomMembers(roomId, userIds, hsApi, log) {
    const txn = await this._storage.readTxn([
      this._storage.storeNames.userIdentities
    ]);
    return await this._devicesForUserIds(roomId, userIds, txn, hsApi, log);
  }
  async _devicesForUserIds(roomId, userIds, userIdentityTxn, hsApi, log) {
    const allMemberIdentities = await Promise.all(userIds.map((userId) => userIdentityTxn.userIdentities.get(userId)));
    const identities = allMemberIdentities.filter((identity) => {
      return identity && identity.roomIds.includes(roomId);
    });
    const upToDateIdentities = identities.filter((i) => i.deviceTrackingStatus === TRACKING_STATUS_UPTODATE);
    const outdatedIdentities = identities.filter((i) => i.deviceTrackingStatus === TRACKING_STATUS_OUTDATED);
    log.set("uptodate", upToDateIdentities.length);
    log.set("outdated", outdatedIdentities.length);
    let queriedDevices;
    if (outdatedIdentities.length) {
      queriedDevices = await this._queryKeys(outdatedIdentities.map((i) => i.userId), hsApi, log);
    }
    const deviceTxn = await this._storage.readTxn([
      this._storage.storeNames.deviceIdentities
    ]);
    const devicesPerUser = await Promise.all(upToDateIdentities.map((identity) => {
      return deviceTxn.deviceIdentities.getAllForUserId(identity.userId);
    }));
    let flattenedDevices = devicesPerUser.reduce((all, devicesForUser) => all.concat(devicesForUser), []);
    if (queriedDevices && queriedDevices.length) {
      flattenedDevices = flattenedDevices.concat(queriedDevices);
    }
    const devices = flattenedDevices.filter((device) => {
      const isOwnDevice = device.userId === this._ownUserId && device.deviceId === this._ownDeviceId;
      return !isOwnDevice;
    });
    return devices;
  }
  async getDeviceByCurve25519Key(curve25519Key, txn) {
    return await txn.deviceIdentities.getByCurve25519Key(curve25519Key);
  }
}
class LockMap {
  constructor() {
    this._map = /* @__PURE__ */ new Map();
  }
  async takeLock(key) {
    let lock = this._map.get(key);
    if (lock) {
      await lock.take();
    } else {
      lock = new Lock();
      lock.tryTake();
      this._map.set(key, lock);
    }
    lock.released().then(() => {
      Promise.resolve().then(() => {
        if (!lock.isTaken) {
          this._map.delete(key);
        }
      });
    });
    return lock;
  }
}
class SecretStorage {
  constructor({ key, platform: platform2 }) {
    this._key = key;
    this._platform = platform2;
  }
  async readSecret(name, txn) {
    var _a, _b;
    const accountData = await txn.accountData.get(name);
    if (!accountData) {
      return;
    }
    const encryptedData = (_b = (_a = accountData == null ? void 0 : accountData.content) == null ? void 0 : _a.encrypted) == null ? void 0 : _b[this._key.id];
    if (!encryptedData) {
      throw new Error(`Secret ${accountData.type} is not encrypted for key ${this._key.id}`);
    }
    if (this._key.algorithm === "m.secret_storage.v1.aes-hmac-sha2") {
      return await this._decryptAESSecret(accountData.type, encryptedData);
    } else {
      throw new Error(`Unsupported algorithm for key ${this._key.id}: ${this._key.algorithm}`);
    }
  }
  async _decryptAESSecret(type, encryptedData) {
    const { base64, utf8 } = this._platform.encoding;
    const hkdfKey = await this._platform.crypto.derive.hkdf(this._key.binaryKey, new Uint8Array(8).buffer, utf8.encode(type), "SHA-256", 512);
    const aesKey = hkdfKey.slice(0, 32);
    const hmacKey = hkdfKey.slice(32);
    const ciphertextBytes = base64.decode(encryptedData.ciphertext);
    const isVerified = await this._platform.crypto.hmac.verify(hmacKey, base64.decode(encryptedData.mac), ciphertextBytes, "SHA-256");
    if (!isVerified) {
      throw new Error("Bad MAC");
    }
    const plaintextBytes = await this._platform.crypto.aes.decryptCTR({
      key: aesKey,
      iv: base64.decode(encryptedData.iv),
      data: ciphertextBytes
    });
    return utf8.decode(plaintextBytes);
  }
}
const PICKLE_KEY = "DEFAULT_KEY";
const PUSHER_KEY = "pusher";
class Session {
  constructor({ storage, hsApi, sessionInfo, olm, olmWorker, platform: platform2, mediaRepository }) {
    this._platform = platform2;
    this._storage = storage;
    this._hsApi = hsApi;
    this._mediaRepository = mediaRepository;
    this._syncInfo = null;
    this._sessionInfo = sessionInfo;
    this._rooms = new ObservableMap();
    this._roomUpdateCallback = (room, params) => this._rooms.update(room.id, params);
    this._activeArchivedRooms = /* @__PURE__ */ new Map();
    this._invites = new ObservableMap();
    this._inviteUpdateCallback = (invite, params) => this._invites.update(invite.id, params);
    this._roomsBeingCreatedUpdateCallback = (rbc, params) => {
      if (rbc.isCancelled) {
        this._roomsBeingCreated.remove(rbc.id);
      } else {
        this._roomsBeingCreated.update(rbc.id, params);
      }
    };
    this._roomsBeingCreated = new ObservableMap();
    this._user = new User(sessionInfo.userId);
    this._deviceMessageHandler = new DeviceMessageHandler({ storage });
    this._olm = olm;
    this._olmUtil = null;
    this._e2eeAccount = null;
    this._deviceTracker = null;
    this._olmEncryption = null;
    this._keyLoader = null;
    this._megolmEncryption = null;
    this._megolmDecryption = null;
    this._getSyncToken = () => this.syncToken;
    this._olmWorker = olmWorker;
    this._keyBackup = new ObservableValue(void 0);
    this._observedRoomStatus = /* @__PURE__ */ new Map();
    if (olm) {
      this._olmUtil = new olm.Utility();
      this._deviceTracker = new DeviceTracker({
        storage,
        getSyncToken: this._getSyncToken,
        olmUtil: this._olmUtil,
        ownUserId: sessionInfo.userId,
        ownDeviceId: sessionInfo.deviceId
      });
    }
    this._createRoomEncryption = this._createRoomEncryption.bind(this);
    this._forgetArchivedRoom = this._forgetArchivedRoom.bind(this);
    this.needsKeyBackup = new ObservableValue(false);
  }
  get fingerprintKey() {
    var _a;
    return (_a = this._e2eeAccount) == null ? void 0 : _a.identityKeys.ed25519;
  }
  get hasSecretStorageKey() {
    return this._hasSecretStorageKey;
  }
  get deviceId() {
    return this._sessionInfo.deviceId;
  }
  get userId() {
    return this._sessionInfo.userId;
  }
  _setupEncryption() {
    const senderKeyLock = new LockMap();
    const olmDecryption = new Decryption$1(this._e2eeAccount, PICKLE_KEY, this._platform.clock.now, this._user.id, this._olm, senderKeyLock);
    this._olmEncryption = new Encryption$1(this._e2eeAccount, PICKLE_KEY, this._olm, this._storage, this._platform.clock.now, this._user.id, this._olmUtil, senderKeyLock);
    this._keyLoader = new KeyLoader(this._olm, PICKLE_KEY, 20);
    this._megolmEncryption = new Encryption({
      account: this._e2eeAccount,
      pickleKey: PICKLE_KEY,
      olm: this._olm,
      storage: this._storage,
      keyLoader: this._keyLoader,
      now: this._platform.clock.now,
      ownDeviceId: this._sessionInfo.deviceId
    });
    this._megolmDecryption = new Decryption(this._keyLoader, this._olmWorker);
    this._deviceMessageHandler.enableEncryption({ olmDecryption, megolmDecryption: this._megolmDecryption });
  }
  _createRoomEncryption(room, encryptionParams) {
    var _a;
    if (!this._olmEncryption) {
      throw new Error("creating room encryption before encryption got globally enabled");
    }
    if (encryptionParams.algorithm !== MEGOLM_ALGORITHM) {
      return null;
    }
    return new RoomEncryption({
      room,
      deviceTracker: this._deviceTracker,
      olmEncryption: this._olmEncryption,
      megolmEncryption: this._megolmEncryption,
      megolmDecryption: this._megolmDecryption,
      storage: this._storage,
      keyBackup: (_a = this._keyBackup) == null ? void 0 : _a.get(),
      encryptionParams,
      notifyMissingMegolmSession: () => {
        if (!this._keyBackup.get()) {
          this.needsKeyBackup.set(true);
        }
      },
      clock: this._platform.clock
    });
  }
  enableSecretStorage(type, credential, log = void 0) {
    return this._platform.logger.wrapOrRun(log, "enable secret storage", async (log2) => {
      if (!this._olm) {
        throw new Error("olm required");
      }
      if (this._keyBackup.get()) {
        this._keyBackup.get().dispose();
        this._keyBackup.set(null);
      }
      const key = await keyFromCredential(type, credential, this._storage, this._platform, this._olm);
      const readTxn = await this._storage.readTxn([
        this._storage.storeNames.accountData
      ]);
      if (await this._createKeyBackup(key, readTxn, log2)) {
        await this._writeSSSSKey(key, log2);
        this._keyBackup.get().flush(log2);
        return key;
      } else {
        throw new Error("Could not read key backup with the given key");
      }
    });
  }
  async _writeSSSSKey(key, log) {
    const keyBackup = this._keyBackup.get();
    if (!keyBackup) {
      return;
    }
    const backupVersion = keyBackup.version;
    const writeTxn = await this._storage.readWriteTxn([
      this._storage.storeNames.session,
      this._storage.storeNames.inboundGroupSessions
    ]);
    try {
      const previousBackupVersion = await writeKey(key, backupVersion, writeTxn);
      log.set("previousBackupVersion", previousBackupVersion);
      log.set("backupVersion", backupVersion);
      if (!!previousBackupVersion && previousBackupVersion !== backupVersion) {
        const amountMarked = await keyBackup.markAllForBackup(writeTxn);
        log.set("amountMarkedForBackup", amountMarked);
      }
    } catch (err) {
      writeTxn.abort();
      throw err;
    }
    await writeTxn.complete();
  }
  async disableSecretStorage() {
    const writeTxn = await this._storage.readWriteTxn([
      this._storage.storeNames.session
    ]);
    try {
      removeKey(writeTxn);
    } catch (err) {
      writeTxn.abort();
      throw err;
    }
    await writeTxn.complete();
    if (this._keyBackup.get()) {
      for (const room of this._rooms.values()) {
        if (room.isEncrypted) {
          room.enableKeyBackup(void 0);
        }
      }
      this._keyBackup.get().dispose();
      this._keyBackup.set(null);
    }
  }
  _createKeyBackup(ssssKey, txn, log) {
    return log.wrap("enable key backup", async (log2) => {
      try {
        const secretStorage = new SecretStorage({ key: ssssKey, platform: this._platform });
        const keyBackup = await KeyBackup.fromSecretStorage(this._platform, this._olm, secretStorage, this._hsApi, this._keyLoader, this._storage, txn);
        if (keyBackup) {
          for (const room of this._rooms.values()) {
            if (room.isEncrypted) {
              room.enableKeyBackup(keyBackup);
            }
          }
          this._keyBackup.set(keyBackup);
          return true;
        }
      } catch (err) {
        log2.catch(err);
      }
      return false;
    });
  }
  get keyBackup() {
    return this._keyBackup;
  }
  get hasIdentity() {
    return !!this._e2eeAccount;
  }
  async createIdentity(log) {
    if (this._olm) {
      if (!this._e2eeAccount) {
        this._e2eeAccount = await this._createNewAccount(this._sessionInfo.deviceId, this._storage);
        log.set("keys", this._e2eeAccount.identityKeys);
        this._setupEncryption();
      }
      await this._e2eeAccount.generateOTKsIfNeeded(this._storage, log);
      await log.wrap("uploadKeys", (log2) => this._e2eeAccount.uploadKeys(this._storage, false, log2));
    }
  }
  async dehydrateIdentity(dehydratedDevice, log) {
    log.set("deviceId", dehydratedDevice.deviceId);
    if (!this._olm) {
      log.set("no_olm", true);
      return false;
    }
    if (dehydratedDevice.deviceId !== this.deviceId) {
      log.set("wrong_device", true);
      return false;
    }
    if (this._e2eeAccount) {
      log.set("account_already_setup", true);
      return false;
    }
    if (!await dehydratedDevice.claim(this._hsApi, log)) {
      log.set("already_claimed", true);
      return false;
    }
    this._e2eeAccount = await Account.adoptDehydratedDevice({
      dehydratedDevice,
      hsApi: this._hsApi,
      olm: this._olm,
      pickleKey: PICKLE_KEY,
      userId: this._sessionInfo.userId,
      olmWorker: this._olmWorker,
      deviceId: this.deviceId,
      storage: this._storage
    });
    log.set("keys", this._e2eeAccount.identityKeys);
    this._setupEncryption();
    return true;
  }
  _createNewAccount(deviceId, storage = void 0) {
    return Account.create({
      hsApi: this._hsApi,
      olm: this._olm,
      pickleKey: PICKLE_KEY,
      userId: this._sessionInfo.userId,
      olmWorker: this._olmWorker,
      deviceId,
      storage
    });
  }
  setupDehydratedDevice(key, log = null) {
    return this._platform.logger.wrapOrRun(log, "setupDehydratedDevice", async (log2) => {
      const dehydrationAccount = await this._createNewAccount("temp-device-id");
      try {
        const deviceId = await uploadAccountAsDehydratedDevice(dehydrationAccount, this._hsApi, key, "Dehydrated device", log2);
        log2.set("deviceId", deviceId);
        return deviceId;
      } finally {
        dehydrationAccount.dispose();
      }
    });
  }
  async load(log) {
    const txn = await this._storage.readTxn([
      this._storage.storeNames.session,
      this._storage.storeNames.roomSummary,
      this._storage.storeNames.invites,
      this._storage.storeNames.roomMembers,
      this._storage.storeNames.timelineEvents,
      this._storage.storeNames.timelineFragments,
      this._storage.storeNames.pendingEvents
    ]);
    this._syncInfo = await txn.session.get("sync");
    if (this._olm) {
      this._e2eeAccount = await Account.load({
        hsApi: this._hsApi,
        olm: this._olm,
        pickleKey: PICKLE_KEY,
        userId: this._sessionInfo.userId,
        deviceId: this._sessionInfo.deviceId,
        olmWorker: this._olmWorker,
        txn
      });
      if (this._e2eeAccount) {
        log.set("keys", this._e2eeAccount.identityKeys);
        this._setupEncryption();
      }
    }
    const pendingEventsByRoomId = await this._getPendingEventsByRoom(txn);
    const invites = await txn.invites.getAll();
    const inviteLoadPromise = Promise.all(invites.map(async (inviteData) => {
      const invite = this.createInvite(inviteData.roomId);
      log.wrap("invite", (log2) => invite.load(inviteData, log2));
      this._invites.add(invite.id, invite);
    }));
    const rooms = await txn.roomSummary.getAll();
    const roomLoadPromise = Promise.all(rooms.map(async (summary) => {
      const room = this.createJoinedRoom(summary.roomId, pendingEventsByRoomId.get(summary.roomId));
      await log.wrap("room", (log2) => room.load(summary, txn, log2));
      this._rooms.add(room.id, room);
    }));
    await Promise.all([inviteLoadPromise, roomLoadPromise]);
    for (const [roomId, invite] of this.invites) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.setInvite(invite);
      }
    }
  }
  dispose() {
    var _a, _b, _c2, _d2;
    (_a = this._olmWorker) == null ? void 0 : _a.dispose();
    this._olmWorker = void 0;
    (_b = this._keyBackup.get()) == null ? void 0 : _b.dispose();
    this._keyBackup.set(void 0);
    (_c2 = this._megolmDecryption) == null ? void 0 : _c2.dispose();
    this._megolmDecryption = void 0;
    (_d2 = this._e2eeAccount) == null ? void 0 : _d2.dispose();
    this._e2eeAccount = void 0;
    for (const room of this._rooms.values()) {
      room.dispose();
    }
    this._rooms = void 0;
  }
  async start(lastVersionResponse, dehydratedDevice, log) {
    var _a;
    if (lastVersionResponse) {
      const txn = await this._storage.readWriteTxn([
        this._storage.storeNames.session
      ]);
      txn.session.set("serverVersions", lastVersionResponse);
      await txn.complete();
    }
    if (!this._keyBackup.get()) {
      if (dehydratedDevice) {
        await log.wrap("SSSSKeyFromDehydratedDeviceKey", async (log2) => {
          const ssssKey2 = await keyFromDehydratedDeviceKey(dehydratedDevice.key, this._storage, this._platform);
          if (ssssKey2) {
            log2.set("success", true);
            await this._writeSSSSKey(ssssKey2);
          }
        });
      }
      const txn = await this._storage.readTxn([
        this._storage.storeNames.session,
        this._storage.storeNames.accountData
      ]);
      const ssssKey = await readKey(txn);
      if (ssssKey) {
        if (await this._createKeyBackup(ssssKey, txn, log)) {
          (_a = this._keyBackup.get()) == null ? void 0 : _a.flush(log);
        }
      }
      if (!this._keyBackup.get()) {
        this._keyBackup.set(null);
      }
    }
    const opsTxn = await this._storage.readWriteTxn([
      this._storage.storeNames.operations
    ]);
    const operations = await opsTxn.operations.getAll();
    const operationsByScope = groupBy(operations, (o) => o.scope);
    for (const room of this._rooms.values()) {
      let roomOperationsByType;
      const roomOperations = operationsByScope.get(room.id);
      if (roomOperations) {
        roomOperationsByType = groupBy(roomOperations, (r) => r.type);
      }
      room.start(roomOperationsByType, log);
    }
  }
  async _getPendingEventsByRoom(txn) {
    const pendingEvents = await txn.pendingEvents.getAll();
    return pendingEvents.reduce((groups, pe) => {
      const group = groups.get(pe.roomId);
      if (group) {
        group.push(pe);
      } else {
        groups.set(pe.roomId, [pe]);
      }
      return groups;
    }, /* @__PURE__ */ new Map());
  }
  get rooms() {
    return this._rooms;
  }
  findDirectMessageForUserId(userId) {
    for (const [, room] of this._rooms) {
      if (room.isDirectMessageForUserId(userId)) {
        return room;
      }
    }
    for (const [, invite] of this._invites) {
      if (invite.isDirectMessageForUserId(userId)) {
        return invite;
      }
    }
  }
  createJoinedRoom(roomId, pendingEvents) {
    return new Room({
      roomId,
      getSyncToken: this._getSyncToken,
      storage: this._storage,
      emitCollectionChange: this._roomUpdateCallback,
      hsApi: this._hsApi,
      mediaRepository: this._mediaRepository,
      pendingEvents,
      user: this._user,
      createRoomEncryption: this._createRoomEncryption,
      platform: this._platform
    });
  }
  _createArchivedRoom(roomId) {
    const room = new ArchivedRoom({
      roomId,
      getSyncToken: this._getSyncToken,
      storage: this._storage,
      emitCollectionChange: () => {
      },
      releaseCallback: () => this._activeArchivedRooms.delete(roomId),
      forgetCallback: this._forgetArchivedRoom,
      hsApi: this._hsApi,
      mediaRepository: this._mediaRepository,
      user: this._user,
      createRoomEncryption: this._createRoomEncryption,
      platform: this._platform
    });
    this._activeArchivedRooms.set(roomId, room);
    return room;
  }
  get invites() {
    return this._invites;
  }
  createInvite(roomId) {
    return new Invite({
      roomId,
      hsApi: this._hsApi,
      emitCollectionUpdate: this._inviteUpdateCallback,
      mediaRepository: this._mediaRepository,
      user: this._user,
      platform: this._platform
    });
  }
  get roomsBeingCreated() {
    return this._roomsBeingCreated;
  }
  createRoom(options) {
    let roomBeingCreated;
    this._platform.logger.runDetached("create room", async (log) => {
      const id = `local-${Math.floor(this._platform.random() * Number.MAX_SAFE_INTEGER)}`;
      roomBeingCreated = new RoomBeingCreated(id, options, this._roomsBeingCreatedUpdateCallback, this._mediaRepository, this._platform, log);
      this._roomsBeingCreated.set(id, roomBeingCreated);
      const promises = [roomBeingCreated.create(this._hsApi, log)];
      const loadProfiles2 = options.loadProfiles !== false;
      if (loadProfiles2) {
        promises.push(roomBeingCreated.loadProfiles(this._hsApi, log));
      }
      await Promise.all(promises);
      if (roomBeingCreated.roomId) {
        if (this.rooms.get(roomBeingCreated.roomId)) {
          this._tryReplaceRoomBeingCreated(roomBeingCreated.roomId, log);
        }
        await roomBeingCreated.adjustDirectMessageMapIfNeeded(this._user, this._storage, this._hsApi, log);
      }
    });
    return roomBeingCreated;
  }
  async obtainSyncLock(syncResponse) {
    var _a;
    const toDeviceEvents = (_a = syncResponse.to_device) == null ? void 0 : _a.events;
    if (Array.isArray(toDeviceEvents) && toDeviceEvents.length) {
      return await this._deviceMessageHandler.obtainSyncLock(toDeviceEvents);
    }
  }
  async prepareSync(syncResponse, lock, txn, log) {
    var _a;
    const toDeviceEvents = (_a = syncResponse.to_device) == null ? void 0 : _a.events;
    if (Array.isArray(toDeviceEvents) && toDeviceEvents.length) {
      return await log.wrap("deviceMsgs", (log2) => this._deviceMessageHandler.prepareSync(toDeviceEvents, lock, txn, log2));
    }
  }
  async writeSync(syncResponse, syncFilterId, preparation, txn, log) {
    const changes = {
      syncInfo: null,
      e2eeAccountChanges: null
    };
    const syncToken = syncResponse.next_batch;
    if (syncToken !== this.syncToken) {
      const syncInfo = { token: syncToken, filterId: syncFilterId };
      txn.session.set("sync", syncInfo);
      changes.syncInfo = syncInfo;
    }
    const deviceOneTimeKeysCount = syncResponse.device_one_time_keys_count;
    if (this._e2eeAccount && deviceOneTimeKeysCount) {
      changes.e2eeAccountChanges = this._e2eeAccount.writeSync(deviceOneTimeKeysCount, txn, log);
    }
    const deviceLists = syncResponse.device_lists;
    if (this._deviceTracker && Array.isArray(deviceLists == null ? void 0 : deviceLists.changed) && deviceLists.changed.length) {
      await log.wrap("deviceLists", (log2) => this._deviceTracker.writeDeviceChanges(deviceLists.changed, txn, log2));
    }
    if (preparation) {
      changes.hasNewRoomKeys = await log.wrap("deviceMsgs", (log2) => this._deviceMessageHandler.writeSync(preparation, txn, log2));
    }
    const accountData = syncResponse["account_data"];
    if (Array.isArray(accountData == null ? void 0 : accountData.events)) {
      for (const event2 of accountData.events) {
        if (typeof event2.type === "string") {
          txn.accountData.set(event2);
        }
      }
    }
    return changes;
  }
  afterSync({ syncInfo, e2eeAccountChanges }) {
    if (syncInfo) {
      this._syncInfo = syncInfo;
    }
    if (this._e2eeAccount) {
      this._e2eeAccount.afterSync(e2eeAccountChanges);
    }
  }
  async afterSyncCompleted(changes, isCatchupSync, log) {
    var _a;
    if (!isCatchupSync) {
      const needsToUploadOTKs = await this._e2eeAccount.generateOTKsIfNeeded(this._storage, log);
      if (needsToUploadOTKs) {
        await log.wrap("uploadKeys", (log2) => this._e2eeAccount.uploadKeys(this._storage, false, log2));
      }
    }
    if (changes.hasNewRoomKeys) {
      (_a = this._keyBackup.get()) == null ? void 0 : _a.flush(log);
    }
  }
  _tryReplaceRoomBeingCreated(roomId, log) {
    for (const [, roomBeingCreated] of this._roomsBeingCreated) {
      if (roomBeingCreated.roomId === roomId) {
        const observableStatus = this._observedRoomStatus.get(roomBeingCreated.id);
        if (observableStatus) {
          log.log(`replacing room being created`).set("localId", roomBeingCreated.id).set("roomId", roomBeingCreated.roomId);
          observableStatus.set(observableStatus.get() | RoomStatus.Replaced);
        }
        roomBeingCreated.dispose();
        this._roomsBeingCreated.remove(roomBeingCreated.id);
        return;
      }
    }
  }
  applyRoomCollectionChangesAfterSync(inviteStates, roomStates, archivedRoomStates, log) {
    var _a, _b;
    for (const rs of roomStates) {
      if (rs.shouldAdd) {
        this._rooms.add(rs.id, rs.room);
        this._tryReplaceRoomBeingCreated(rs.id, log);
      } else if (rs.shouldRemove) {
        this._rooms.remove(rs.id);
      }
    }
    for (const is of inviteStates) {
      if (is.shouldAdd) {
        this._invites.add(is.id, is.invite);
      } else if (is.shouldRemove) {
        this._invites.remove(is.id);
      }
    }
    if (this._observedRoomStatus.size !== 0) {
      for (const ars of archivedRoomStates) {
        if (ars.shouldAdd) {
          (_a = this._observedRoomStatus.get(ars.id)) == null ? void 0 : _a.set(RoomStatus.Archived);
        }
      }
      for (const rs of roomStates) {
        if (rs.shouldAdd) {
          (_b = this._observedRoomStatus.get(rs.id)) == null ? void 0 : _b.set(RoomStatus.Joined);
        }
      }
      for (const is of inviteStates) {
        const statusObservable = this._observedRoomStatus.get(is.id);
        if (statusObservable) {
          const withInvited = statusObservable.get() | RoomStatus.Invited;
          if (is.shouldAdd) {
            statusObservable.set(withInvited);
          } else if (is.shouldRemove) {
            const withoutInvited = withInvited ^ RoomStatus.Invited;
            statusObservable.set(withoutInvited);
          }
        }
      }
    }
  }
  _forgetArchivedRoom(roomId) {
    const statusObservable = this._observedRoomStatus.get(roomId);
    if (statusObservable) {
      statusObservable.set((statusObservable.get() | RoomStatus.Archived) ^ RoomStatus.Archived);
    }
  }
  get syncToken() {
    var _a;
    return (_a = this._syncInfo) == null ? void 0 : _a.token;
  }
  get syncFilterId() {
    var _a;
    return (_a = this._syncInfo) == null ? void 0 : _a.filterId;
  }
  get user() {
    return this._user;
  }
  get mediaRepository() {
    return this._mediaRepository;
  }
  enablePushNotifications(enable) {
    if (enable) {
      return this._enablePush();
    } else {
      return this._disablePush();
    }
  }
  async _enablePush() {
    return this._platform.logger.run("enablePush", async (log) => {
      const defaultPayload = Pusher.createDefaultPayload(this._sessionInfo.id);
      const pusher = await this._platform.notificationService.enablePush(Pusher, defaultPayload);
      if (!pusher) {
        log.set("no_pusher", true);
        return false;
      }
      await pusher.enable(this._hsApi, log);
      const txn = await this._storage.readWriteTxn([this._storage.storeNames.session]);
      txn.session.set(PUSHER_KEY, pusher.serialize());
      await txn.complete();
      return true;
    });
  }
  async _disablePush() {
    return this._platform.logger.run("disablePush", async (log) => {
      await this._platform.notificationService.disablePush();
      const readTxn = await this._storage.readTxn([this._storage.storeNames.session]);
      const pusherData = await readTxn.session.get(PUSHER_KEY);
      if (!pusherData) {
        return true;
      }
      const pusher = new Pusher(pusherData);
      await pusher.disable(this._hsApi, log);
      const txn = await this._storage.readWriteTxn([this._storage.storeNames.session]);
      txn.session.remove(PUSHER_KEY);
      await txn.complete();
      return true;
    });
  }
  async arePushNotificationsEnabled() {
    if (!await this._platform.notificationService.isPushEnabled()) {
      return false;
    }
    const readTxn = await this._storage.readTxn([this._storage.storeNames.session]);
    const pusherData = await readTxn.session.get(PUSHER_KEY);
    return !!pusherData;
  }
  async checkPusherEnabledOnHomeserver() {
    const readTxn = await this._storage.readTxn([this._storage.storeNames.session]);
    const pusherData = await readTxn.session.get(PUSHER_KEY);
    if (!pusherData) {
      return false;
    }
    const myPusher = new Pusher(pusherData);
    const serverPushersData = await this._hsApi.getPushers().response();
    const serverPushers = ((serverPushersData == null ? void 0 : serverPushersData.pushers) || []).map((data) => new Pusher(data));
    return serverPushers.some((p) => p.equals(myPusher));
  }
  async getRoomStatus(roomId) {
    const isBeingCreated = !!this._roomsBeingCreated.get(roomId);
    if (isBeingCreated) {
      return RoomStatus.BeingCreated;
    }
    const isJoined = !!this._rooms.get(roomId);
    if (isJoined) {
      return RoomStatus.Joined;
    } else {
      const isInvited = !!this._invites.get(roomId);
      const txn = await this._storage.readTxn([this._storage.storeNames.archivedRoomSummary]);
      const isArchived = await txn.archivedRoomSummary.has(roomId);
      if (isInvited && isArchived) {
        return RoomStatus.Invited | RoomStatus.Archived;
      } else if (isInvited) {
        return RoomStatus.Invited;
      } else if (isArchived) {
        return RoomStatus.Archived;
      } else {
        return RoomStatus.None;
      }
    }
  }
  async observeRoomStatus(roomId) {
    let observable = this._observedRoomStatus.get(roomId);
    if (!observable) {
      const status = await this.getRoomStatus(roomId);
      observable = new RetainedObservableValue(status, () => {
        this._observedRoomStatus.delete(roomId);
      });
      this._observedRoomStatus.set(roomId, observable);
    }
    return observable;
  }
  createOrGetArchivedRoomForSync(roomId) {
    let archivedRoom = this._activeArchivedRooms.get(roomId);
    if (archivedRoom) {
      archivedRoom.retain();
    } else {
      archivedRoom = this._createArchivedRoom(roomId);
    }
    return archivedRoom;
  }
  loadArchivedRoom(roomId, log = null) {
    return this._platform.logger.wrapOrRun(log, "loadArchivedRoom", async (log2) => {
      log2.set("id", roomId);
      const activeArchivedRoom = this._activeArchivedRooms.get(roomId);
      if (activeArchivedRoom) {
        activeArchivedRoom.retain();
        return activeArchivedRoom;
      }
      const txn = await this._storage.readTxn([
        this._storage.storeNames.archivedRoomSummary,
        this._storage.storeNames.roomMembers
      ]);
      const summary = await txn.archivedRoomSummary.get(roomId);
      if (summary) {
        const room = this._createArchivedRoom(roomId);
        await room.load(summary, txn, log2);
        return room;
      }
    });
  }
  joinRoom(roomIdOrAlias, log = null) {
    return this._platform.logger.wrapOrRun(log, "joinRoom", async (log2) => {
      const body = await this._hsApi.joinIdOrAlias(roomIdOrAlias, { log: log2 }).response();
      return body.room_id;
    });
  }
}
class PasswordLoginMethod {
  constructor({ username, password, homeserver }) {
    this._username = username;
    this._password = password;
    this.homeserver = homeserver;
  }
  async login(hsApi, deviceName, log) {
    return await hsApi.passwordLogin(this._username, this._password, deviceName, { log }).response();
  }
}
class TokenLoginMethod {
  constructor({ homeserver, loginToken }) {
    this.homeserver = homeserver;
    this._loginToken = loginToken;
  }
  async login(hsApi, deviceName, log) {
    return await hsApi.tokenLogin(this._loginToken, makeTxnId(), deviceName, { log }).response();
  }
}
class SSOLoginHelper {
  constructor(homeserver) {
    this._homeserver = homeserver;
  }
  get homeserver() {
    return this._homeserver;
  }
  createSSORedirectURL(returnURL) {
    return `${this._homeserver}/_matrix/client/r0/login/sso/redirect?redirectUrl=${encodeURIComponent(returnURL)}`;
  }
}
class BaseRegistrationStage {
  constructor(session, params) {
    this._session = session;
    this._params = params;
  }
  setNextStage(stage) {
    this._nextStage = stage;
  }
  get nextStage() {
    return this._nextStage;
  }
}
class DummyAuth extends BaseRegistrationStage {
  generateAuthenticationData() {
    return {
      session: this._session,
      type: this.type
    };
  }
  get type() {
    return "m.login.dummy";
  }
}
class TermsAuth extends BaseRegistrationStage {
  generateAuthenticationData() {
    return {
      session: this._session,
      type: this.type
    };
  }
  get type() {
    return "m.login.terms";
  }
  get privacyPolicy() {
    var _a;
    return (_a = this._params) == null ? void 0 : _a.policies["privacy_policy"];
  }
  get termsOfService() {
    var _a;
    return (_a = this._params) == null ? void 0 : _a.policies["terms_of_service"];
  }
}
class TokenAuth extends BaseRegistrationStage {
  constructor(session, params, type) {
    super(session, params);
    this._type = type;
  }
  generateAuthenticationData() {
    if (!this._token) {
      throw new Error("No token provided for TokenAuth");
    }
    return {
      session: this._session,
      type: this._type,
      token: this._token
    };
  }
  setToken(token) {
    this._token = token;
  }
  get type() {
    return this._type;
  }
}
class Registration {
  constructor(homeserver, hsApi, accountDetails, flowSelector) {
    this.homeserver = homeserver;
    this._hsApi = hsApi;
    this._accountDetails = accountDetails;
    this._flowSelector = flowSelector != null ? flowSelector : (flows) => flows[0];
  }
  async start() {
    const response = await this._hsApi.register(this._accountDetails.username, this._accountDetails.password, this._accountDetails.initialDeviceDisplayName, void 0, this._accountDetails.inhibitLogin).response();
    return this.parseStagesFromResponse(response);
  }
  async submitStage(stage) {
    const auth = stage.generateAuthenticationData();
    const { username, password, initialDeviceDisplayName, inhibitLogin } = this._accountDetails;
    const request = this._hsApi.register(username, password, initialDeviceDisplayName, auth, inhibitLogin);
    const response = await request.response();
    const status = await request.responseCode();
    const registrationResponse = __spreadProps(__spreadValues({}, response), { status });
    return this.parseRegistrationResponse(registrationResponse, stage);
  }
  parseStagesFromResponse(response) {
    const { session, params } = response;
    const flow = this._flowSelector(response.flows);
    if (!flow) {
      throw new Error("flowSelector did not return any flow!");
    }
    let firstStage;
    let lastStage;
    for (const stage of flow.stages) {
      const registrationStage = this._createRegistrationStage(stage, session, params);
      if (!firstStage) {
        firstStage = registrationStage;
        lastStage = registrationStage;
      } else {
        lastStage.setNextStage(registrationStage);
        lastStage = registrationStage;
      }
    }
    return firstStage;
  }
  async parseRegistrationResponse(response, currentStage) {
    var _a;
    switch (response.status) {
      case 200:
        this._registerResponse = response;
        return void 0;
      case 401:
        if ((_a = response.completed) == null ? void 0 : _a.includes(currentStage.type)) {
          return currentStage.nextStage;
        } else {
          throw new Error("This stage could not be completed!");
        }
    }
  }
  _createRegistrationStage(type, session, params) {
    switch (type) {
      case "m.login.dummy":
        return new DummyAuth(session, params == null ? void 0 : params[type]);
      case "m.login.terms":
        return new TermsAuth(session, params == null ? void 0 : params[type]);
      case "org.matrix.msc3231.login.registration_token":
      case "m.login.registration_token":
        return new TokenAuth(session, params == null ? void 0 : params[type], type);
      default:
        throw new Error(`Unknown stage: ${type}`);
    }
  }
  get authData() {
    if (this._registerResponse) {
      return {
        accessToken: this._registerResponse.access_token,
        homeserver: this.homeserver,
        userId: this._registerResponse.user_id,
        deviceId: this._registerResponse.device_id
      };
    }
  }
}
const LoadStatus = createEnum("NotLoading", "Login", "LoginFailed", "QueryAccount", "AccountSetup", "Loading", "SessionSetup", "Migrating", "FirstSync", "Error", "Ready");
const LoginFailure = createEnum("Connection", "Credentials", "Unknown");
class Client {
  constructor(platform2) {
    this._platform = platform2;
    this._sessionStartedByReconnector = false;
    this._status = new ObservableValue(LoadStatus.NotLoading);
    this._error = null;
    this._loginFailure = null;
    this._reconnector = null;
    this._session = null;
    this._sync = null;
    this._sessionId = null;
    this._storage = null;
    this._requestScheduler = null;
    this._olmPromise = platform2.loadOlm();
    this._workerPromise = platform2.loadOlmWorker();
    this._accountSetup = void 0;
  }
  createNewSessionId() {
    return Math.floor(this._platform.random() * Number.MAX_SAFE_INTEGER).toString();
  }
  get sessionId() {
    return this._sessionId;
  }
  async startWithExistingSession(sessionId) {
    if (this._status.get() !== LoadStatus.NotLoading) {
      return;
    }
    this._status.set(LoadStatus.Loading);
    await this._platform.logger.run("load session", async (log) => {
      log.set("id", sessionId);
      try {
        const sessionInfo = await this._platform.sessionInfoStorage.get(sessionId);
        if (!sessionInfo) {
          throw new Error("Invalid session id: " + sessionId);
        }
        await this._loadSessionInfo(sessionInfo, null, log);
        log.set("status", this._status.get());
      } catch (err) {
        log.catch(err);
        this._error = err;
        this._status.set(LoadStatus.Error);
      }
    });
  }
  _parseLoginOptions(options, homeserver) {
    const flows = options.flows;
    const result = { homeserver };
    for (const flow of flows) {
      if (flow.type === "m.login.password") {
        result.password = (username, password) => new PasswordLoginMethod({ homeserver, username, password });
      } else if (flow.type === "m.login.sso" && flows.find((flow2) => flow2.type === "m.login.token")) {
        result.sso = new SSOLoginHelper(homeserver);
      } else if (flow.type === "m.login.token") {
        result.token = (loginToken) => new TokenLoginMethod({ homeserver, loginToken });
      }
    }
    return result;
  }
  queryLogin(homeserver) {
    return new AbortableOperation(async (setAbortable) => {
      homeserver = await lookupHomeserver(homeserver, (url, options) => {
        return setAbortable(this._platform.request(url, options));
      });
      const hsApi = new HomeServerApi({ homeserver, request: this._platform.request });
      const response = await setAbortable(hsApi.getLoginFlows()).response();
      return this._parseLoginOptions(response, homeserver);
    });
  }
  async startRegistration(homeserver, username, password, initialDeviceDisplayName, flowSelector) {
    const request = this._platform.request;
    const hsApi = new HomeServerApi({ homeserver, request });
    const registration = new Registration(homeserver, hsApi, {
      username,
      password,
      initialDeviceDisplayName
    }, flowSelector);
    return registration;
  }
  async startWithAuthData({ accessToken, deviceId, userId, homeserver }) {
    await this._platform.logger.run("startWithAuthData", async (log) => {
      await this._createSessionAfterAuth({ accessToken, deviceId, userId, homeserver }, true, log);
    });
  }
  async startWithLogin(loginMethod, { inspectAccountSetup } = {}) {
    const currentStatus = this._status.get();
    if (currentStatus !== LoadStatus.LoginFailed && currentStatus !== LoadStatus.NotLoading && currentStatus !== LoadStatus.Error) {
      return;
    }
    this._resetStatus();
    await this._platform.logger.run("login", async (log) => {
      this._status.set(LoadStatus.Login);
      let sessionInfo;
      try {
        const request = this._platform.request;
        const hsApi = new HomeServerApi({ homeserver: loginMethod.homeserver, request });
        const loginData = await loginMethod.login(hsApi, "Hydrogen", log);
        sessionInfo = {
          deviceId: loginData.device_id,
          userId: loginData.user_id,
          homeserver: loginMethod.homeserver,
          accessToken: loginData.access_token
        };
      } catch (err) {
        this._error = err;
        if (err.name === "HomeServerError") {
          if (err.errcode === "M_FORBIDDEN") {
            this._loginFailure = LoginFailure.Credentials;
          } else {
            this._loginFailure = LoginFailure.Unknown;
          }
          log.set("loginFailure", this._loginFailure);
          this._status.set(LoadStatus.LoginFailed);
        } else if (err.name === "ConnectionError") {
          this._loginFailure = LoginFailure.Connection;
          this._status.set(LoadStatus.LoginFailed);
        } else {
          this._status.set(LoadStatus.Error);
        }
        return;
      }
      await this._createSessionAfterAuth(sessionInfo, inspectAccountSetup, log);
    });
  }
  async _createSessionAfterAuth({ deviceId, userId, accessToken, homeserver }, inspectAccountSetup, log) {
    const id = this.createNewSessionId();
    const lastUsed = this._platform.clock.now();
    const sessionInfo = {
      id,
      deviceId,
      userId,
      homeServer: homeserver,
      homeserver,
      accessToken,
      lastUsed
    };
    let dehydratedDevice;
    if (inspectAccountSetup) {
      dehydratedDevice = await this._inspectAccountAfterLogin(sessionInfo, log);
      if (dehydratedDevice) {
        sessionInfo.deviceId = dehydratedDevice.deviceId;
      }
    }
    await this._platform.sessionInfoStorage.add(sessionInfo);
    try {
      await this._loadSessionInfo(sessionInfo, dehydratedDevice, log);
      log.set("status", this._status.get());
    } catch (err) {
      log.catch(err);
      dehydratedDevice == null ? void 0 : dehydratedDevice.dispose();
      this._error = err;
      this._status.set(LoadStatus.Error);
    }
  }
  async _loadSessionInfo(sessionInfo, dehydratedDevice, log) {
    log.set("appVersion", this._platform.version);
    const clock = this._platform.clock;
    this._sessionStartedByReconnector = false;
    this._status.set(LoadStatus.Loading);
    this._reconnector = new Reconnector({
      onlineStatus: this._platform.onlineStatus,
      retryDelay: new ExponentialRetryDelay(clock.createTimeout),
      createMeasure: clock.createMeasure
    });
    const hsApi = new HomeServerApi({
      homeserver: sessionInfo.homeServer,
      accessToken: sessionInfo.accessToken,
      request: this._platform.request,
      reconnector: this._reconnector
    });
    this._sessionId = sessionInfo.id;
    this._storage = await this._platform.storageFactory.create(sessionInfo.id, log);
    const filteredSessionInfo = {
      id: sessionInfo.id,
      deviceId: sessionInfo.deviceId,
      userId: sessionInfo.userId,
      homeserver: sessionInfo.homeServer
    };
    const olm = await this._olmPromise;
    let olmWorker = null;
    if (this._workerPromise) {
      olmWorker = await this._workerPromise;
    }
    this._requestScheduler = new RequestScheduler({ hsApi, clock });
    this._requestScheduler.start();
    const mediaRepository = new MediaRepository({
      homeserver: sessionInfo.homeServer,
      platform: this._platform
    });
    this._session = new Session({
      storage: this._storage,
      sessionInfo: filteredSessionInfo,
      hsApi: this._requestScheduler.hsApi,
      olm,
      olmWorker,
      mediaRepository,
      platform: this._platform
    });
    await this._session.load(log);
    if (dehydratedDevice) {
      await log.wrap("dehydrateIdentity", (log2) => this._session.dehydrateIdentity(dehydratedDevice, log2));
      await this._session.setupDehydratedDevice(dehydratedDevice.key, log);
    } else if (!this._session.hasIdentity) {
      this._status.set(LoadStatus.SessionSetup);
      await log.wrap("createIdentity", (log2) => this._session.createIdentity(log2));
    }
    this._sync = new Sync({ hsApi: this._requestScheduler.hsApi, storage: this._storage, session: this._session, logger: this._platform.logger });
    this._reconnectSubscription = this._reconnector.connectionStatus.subscribe((state) => {
      if (state === ConnectionStatus.Online) {
        this._platform.logger.runDetached("reconnect", async (log2) => {
          this._requestScheduler.start();
          this._sync.start();
          this._sessionStartedByReconnector = true;
          const d = dehydratedDevice;
          dehydratedDevice = void 0;
          await log2.wrap("session start", (log3) => this._session.start(this._reconnector.lastVersionsResponse, d, log3));
        });
      }
    });
    await log.wrap("wait first sync", () => this._waitForFirstSync());
    if (this._isDisposed) {
      return;
    }
    this._status.set(LoadStatus.Ready);
    if (!this._sessionStartedByReconnector) {
      const lastVersionsResponse = await hsApi.versions({ timeout: 1e4, log }).response();
      if (this._isDisposed) {
        return;
      }
      const d = dehydratedDevice;
      dehydratedDevice = void 0;
      await log.wrap("session start", (log2) => this._session.start(lastVersionsResponse, d, log2));
    }
  }
  async _waitForFirstSync() {
    this._sync.start();
    this._status.set(LoadStatus.FirstSync);
    this._waitForFirstSyncHandle = this._sync.status.waitFor((s) => {
      var _a;
      if (s === SyncStatus.Stopped) {
        return ((_a = this._sync.error) == null ? void 0 : _a.name) !== "ConnectionError";
      }
      return s === SyncStatus.Syncing;
    });
    try {
      await this._waitForFirstSyncHandle.promise;
      if (this._sync.status.get() === SyncStatus.Stopped && this._sync.error) {
        throw this._sync.error;
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      throw err;
    } finally {
      this._waitForFirstSyncHandle = null;
    }
  }
  _inspectAccountAfterLogin(sessionInfo, log) {
    return log.wrap("inspectAccount", async (log2) => {
      var _a;
      this._status.set(LoadStatus.QueryAccount);
      const hsApi = new HomeServerApi({
        homeserver: sessionInfo.homeServer,
        accessToken: sessionInfo.accessToken,
        request: this._platform.request
      });
      const olm = await this._olmPromise;
      let encryptedDehydratedDevice;
      try {
        encryptedDehydratedDevice = await getDehydratedDevice(hsApi, olm, this._platform, log2);
      } catch (err) {
        if (err.name === "HomeServerError") {
          log2.set("not_supported", true);
        } else {
          throw err;
        }
      }
      if (encryptedDehydratedDevice) {
        let resolveStageFinish;
        const promiseStageFinish = new Promise((r) => resolveStageFinish = r);
        this._accountSetup = new AccountSetup(encryptedDehydratedDevice, resolveStageFinish);
        this._status.set(LoadStatus.AccountSetup);
        await promiseStageFinish;
        const dehydratedDevice = (_a = this._accountSetup) == null ? void 0 : _a._dehydratedDevice;
        this._accountSetup = null;
        return dehydratedDevice;
      }
    });
  }
  get accountSetup() {
    return this._accountSetup;
  }
  get loadStatus() {
    return this._status;
  }
  get loadError() {
    return this._error;
  }
  get loginFailure() {
    return this._loginFailure;
  }
  get sync() {
    return this._sync;
  }
  get session() {
    return this._session;
  }
  get reconnector() {
    return this._reconnector;
  }
  get _isDisposed() {
    return !this._reconnector;
  }
  startLogout(sessionId) {
    return this._platform.logger.run("logout", async (log) => {
      this._sessionId = sessionId;
      log.set("id", this._sessionId);
      const sessionInfo = await this._platform.sessionInfoStorage.get(this._sessionId);
      if (!sessionInfo) {
        throw new Error(`Could not find session for id ${this._sessionId}`);
      }
      try {
        const hsApi = new HomeServerApi({
          homeserver: sessionInfo.homeServer,
          accessToken: sessionInfo.accessToken,
          request: this._platform.request
        });
        await hsApi.logout({ log }).response();
      } catch (err) {
      }
      await this.deleteSession(log);
    });
  }
  startForcedLogout(sessionId) {
    return this._platform.logger.run("forced-logout", async (log) => {
      this._sessionId = sessionId;
      log.set("id", this._sessionId);
      await this.deleteSession(log);
    });
  }
  dispose() {
    if (this._reconnectSubscription) {
      this._reconnectSubscription();
      this._reconnectSubscription = null;
    }
    this._reconnector = null;
    if (this._requestScheduler) {
      this._requestScheduler.stop();
      this._requestScheduler = null;
    }
    if (this._sync) {
      this._sync.stop();
      this._sync = null;
    }
    if (this._session) {
      this._session.dispose();
      this._session = null;
    }
    if (this._waitForFirstSyncHandle) {
      this._waitForFirstSyncHandle.dispose();
      this._waitForFirstSyncHandle = null;
    }
    if (this._storage) {
      this._storage.close();
      this._storage = null;
    }
  }
  async deleteSession(log) {
    if (this._sessionId) {
      this.dispose();
      await Promise.all([
        log.wrap("storageFactory", () => this._platform.storageFactory.delete(this._sessionId)),
        log.wrap("sessionInfoStorage", () => this._platform.sessionInfoStorage.delete(this._sessionId))
      ]);
      this._sessionId = null;
    }
  }
  _resetStatus() {
    this._status.set(LoadStatus.NotLoading);
    this._error = null;
    this._loginFailure = null;
  }
}
class AccountSetup {
  constructor(encryptedDehydratedDevice, finishStage) {
    this._encryptedDehydratedDevice = encryptedDehydratedDevice;
    this._dehydratedDevice = void 0;
    this._finishStage = finishStage;
  }
  get encryptedDehydratedDevice() {
    return this._encryptedDehydratedDevice;
  }
  finish(dehydratedDevice) {
    this._dehydratedDevice = dehydratedDevice;
    this._finishStage();
  }
}
class ViewModel extends EventEmitter {
  constructor(options) {
    super();
    this._isDisposed = false;
    this._options = options;
  }
  childOptions(explicitOptions) {
    return Object.assign({}, this._options, explicitOptions);
  }
  get options() {
    return this._options;
  }
  getOption(name) {
    return this._options[name];
  }
  observeNavigation(type, onChange) {
    const segmentObservable = this.navigation.observe(type);
    const unsubscribe = segmentObservable.subscribe((value) => {
      onChange(value, type);
    });
    this.track(unsubscribe);
  }
  track(disposable) {
    if (!this.disposables) {
      this.disposables = new Disposables();
    }
    return this.disposables.track(disposable);
  }
  untrack(disposable) {
    if (this.disposables) {
      return this.disposables.untrack(disposable);
    }
    return void 0;
  }
  dispose() {
    if (this.disposables) {
      this.disposables.dispose();
    }
    this._isDisposed = true;
  }
  get isDisposed() {
    return this._isDisposed;
  }
  disposeTracked(disposable) {
    if (this.disposables) {
      return this.disposables.disposeTracked(disposable);
    }
    return void 0;
  }
  i18n(parts, ...expr) {
    let result = "";
    for (let i = 0; i < parts.length; ++i) {
      result = result + parts[i];
      if (i < expr.length) {
        result = result + expr[i];
      }
    }
    return result;
  }
  emitChange(changedProps) {
    if (this._options.emitChange) {
      this._options.emitChange(changedProps);
    } else {
      this.emit("change", changedProps);
    }
  }
  get platform() {
    return this._options.platform;
  }
  get clock() {
    return this._options.platform.clock;
  }
  get logger() {
    return this.platform.logger;
  }
  get urlCreator() {
    return this._options.urlCreator;
  }
  get navigation() {
    return this._options.navigation;
  }
}
function avatarInitials(name) {
  let firstChar = name.charAt(0);
  if (firstChar === "!" || firstChar === "@" || firstChar === "#") {
    firstChar = name.charAt(1);
  }
  return firstChar.toUpperCase();
}
function hashCode(str) {
  let hash = 0;
  let i;
  let chr;
  if (str.length === 0) {
    return hash;
  }
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}
function getIdentifierColorNumber(id) {
  return hashCode(id) % 8 + 1;
}
function getAvatarHttpUrl(avatarUrl, cssSize, platform2, mediaRepository) {
  if (avatarUrl) {
    const imageSize = cssSize * platform2.devicePixelRatio;
    return mediaRepository.mxcUrlThumbnail(avatarUrl, imageSize, imageSize, "crop");
  }
  return null;
}
const KIND_ORDER = ["roomBeingCreated", "invite", "room"];
class BaseTileViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._isOpen = false;
    this._hidden = false;
  }
  get hidden() {
    return this._hidden;
  }
  set hidden(value) {
    if (value !== this._hidden) {
      this._hidden = value;
      this.emitChange("hidden");
    }
  }
  close() {
    if (this._isOpen) {
      this._isOpen = false;
      this.emitChange("isOpen");
    }
  }
  open() {
    if (!this._isOpen) {
      this._isOpen = true;
      this.emitChange("isOpen");
    }
  }
  get isOpen() {
    return this._isOpen;
  }
  compare(other) {
    if (other.kind !== this.kind) {
      return KIND_ORDER.indexOf(this.kind) - KIND_ORDER.indexOf(other.kind);
    }
    return 0;
  }
  get avatarLetter() {
    return avatarInitials(this.name);
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this._avatarSource.avatarColorId);
  }
  avatarUrl(size) {
    return getAvatarHttpUrl(this._avatarSource.avatarUrl, size, this.platform, this._avatarSource.mediaRepository);
  }
  get avatarTitle() {
    return this.name;
  }
}
class RoomTileViewModel extends BaseTileViewModel {
  constructor(options) {
    super(options);
    const { room } = options;
    this._room = room;
    this._url = this.urlCreator.openRoomActionUrl(this._room.id);
  }
  get kind() {
    return "room";
  }
  get url() {
    return this._url;
  }
  compare(other) {
    const parentComparison = super.compare(other);
    if (parentComparison !== 0) {
      return parentComparison;
    }
    const myRoom = this._room;
    const theirRoom = other._room;
    if (myRoom.isLowPriority !== theirRoom.isLowPriority) {
      if (myRoom.isLowPriority) {
        return 1;
      }
      return -1;
    }
    const myTimestamp = myRoom.lastMessageTimestamp;
    const theirTimestamp = theirRoom.lastMessageTimestamp;
    const myTimestampValid = Number.isSafeInteger(myTimestamp);
    const theirTimestampValid = Number.isSafeInteger(theirTimestamp);
    if (myTimestampValid !== theirTimestampValid) {
      if (!theirTimestampValid) {
        return -1;
      }
      return 1;
    }
    const timeDiff = theirTimestamp - myTimestamp;
    if (timeDiff === 0 || !theirTimestampValid || !myTimestampValid) {
      const nameCmp = this.name.localeCompare(other.name);
      if (nameCmp === 0) {
        return this._room.id.localeCompare(other._room.id);
      }
      return nameCmp;
    }
    return timeDiff;
  }
  get isUnread() {
    return this._room.isUnread;
  }
  get name() {
    return this._room.name || this.i18n`Empty Room`;
  }
  get badgeCount() {
    return this._room.notificationCount;
  }
  get isHighlighted() {
    return this._room.highlightCount !== 0;
  }
  get _avatarSource() {
    return this._room;
  }
}
function comparePrimitive(a, b) {
  if (a === b) {
    return 0;
  } else {
    return a < b ? -1 : 1;
  }
}
class InviteTileViewModel extends BaseTileViewModel {
  constructor(options) {
    super(options);
    const { invite } = options;
    this._invite = invite;
    this._url = this.urlCreator.openRoomActionUrl(this._invite.id);
  }
  get busy() {
    return this._invite.accepting || this._invite.rejecting;
  }
  get kind() {
    return "invite";
  }
  get url() {
    return this._url;
  }
  get name() {
    return this._invite.name;
  }
  get isHighlighted() {
    return true;
  }
  get isUnread() {
    return true;
  }
  get badgeCount() {
    return this.i18n`!`;
  }
  get _avatarSource() {
    return this._invite;
  }
  compare(other) {
    const parentComparison = super.compare(other);
    if (parentComparison !== 0) {
      return parentComparison;
    }
    const timeDiff = other._invite.timestamp - this._invite.timestamp;
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return comparePrimitive(this._invite.id, other._invite.id);
  }
}
class RoomBeingCreatedTileViewModel extends BaseTileViewModel {
  constructor(options) {
    super(options);
    const { roomBeingCreated } = options;
    this._roomBeingCreated = roomBeingCreated;
    this._url = this.urlCreator.openRoomActionUrl(this._roomBeingCreated.id);
  }
  get busy() {
    return !this._roomBeingCreated.error;
  }
  get kind() {
    return "roomBeingCreated";
  }
  get isHighlighted() {
    return !this.busy;
  }
  get badgeCount() {
    return !this.busy && this.i18n`Failed`;
  }
  get url() {
    return this._url;
  }
  get name() {
    return this._roomBeingCreated.name;
  }
  get _avatarSource() {
    return this._roomBeingCreated;
  }
  compare(other) {
    const parentCmp = super.compare(other);
    if (parentCmp !== 0) {
      return parentCmp;
    }
    const nameCmp = comparePrimitive(this.name, other.name);
    if (nameCmp === 0) {
      return comparePrimitive(this._roomBeingCreated.id, other._roomBeingCreated.id);
    } else {
      return nameCmp;
    }
  }
  avatarUrl(size) {
    var _a;
    return (_a = this._roomBeingCreated.avatarBlobUrl) != null ? _a : super.avatarUrl(size);
  }
}
class RoomFilter {
  constructor(query) {
    this._parts = query.split(" ").map((s) => s.toLowerCase().trim());
  }
  matches(roomTileVM) {
    const name = roomTileVM.name.toLowerCase();
    return this._parts.every((p) => name.includes(p));
  }
}
class Navigation {
  constructor(allowsChild2) {
    this._observables = /* @__PURE__ */ new Map();
    this._allowsChild = allowsChild2;
    this._path = new Path([], allowsChild2);
    this._pathObservable = new ObservableValue(this._path);
  }
  get pathObservable() {
    return this._pathObservable;
  }
  get path() {
    return this._path;
  }
  push(type, ...value) {
    const newPath = this.path.with(new Segment(type, ...value));
    if (newPath) {
      this.applyPath(newPath);
    }
  }
  applyPath(path) {
    const oldPath = this._path;
    this._path = path;
    for (let i = oldPath.segments.length - 1; i >= 0; i -= 1) {
      const segment = oldPath.segments[i];
      if (!this._path.get(segment.type)) {
        const observable = this._observables.get(segment.type);
        observable == null ? void 0 : observable.emitIfChanged();
      }
    }
    for (const segment of this._path.segments) {
      const observable = this._observables.get(segment.type);
      observable == null ? void 0 : observable.emitIfChanged();
    }
    this._pathObservable.set(this._path);
  }
  observe(type) {
    let observable = this._observables.get(type);
    if (!observable) {
      observable = new SegmentObservable(this, type);
      this._observables.set(type, observable);
    }
    return observable;
  }
  pathFrom(segments) {
    let parent;
    let i;
    for (i = 0; i < segments.length; i += 1) {
      if (!this._allowsChild(parent, segments[i])) {
        return new Path(segments.slice(0, i), this._allowsChild);
      }
      parent = segments[i];
    }
    return new Path(segments, this._allowsChild);
  }
  segment(type, ...value) {
    return new Segment(type, ...value);
  }
}
function segmentValueEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  return false;
}
class Segment {
  constructor(type, ...value) {
    this.type = type;
    this.value = value[0] === void 0 ? true : value[0];
  }
}
class Path {
  constructor(segments = [], allowsChild2) {
    this._segments = segments;
    this._allowsChild = allowsChild2;
  }
  clone() {
    return new Path(this._segments.slice(), this._allowsChild);
  }
  with(segment) {
    let index = this._segments.length - 1;
    do {
      if (this._allowsChild(this._segments[index], segment)) {
        const newSegments = this._segments.slice(0, index + 1);
        newSegments.push(segment);
        return new Path(newSegments, this._allowsChild);
      }
      index -= 1;
    } while (index >= -1);
    return void 0;
  }
  until(type) {
    const index = this._segments.findIndex((s) => s.type === type);
    if (index !== -1) {
      return new Path(this._segments.slice(0, index + 1), this._allowsChild);
    }
    return new Path([], this._allowsChild);
  }
  get(type) {
    return this._segments.find((s) => s.type === type);
  }
  replace(segment) {
    const index = this._segments.findIndex((s) => s.type === segment.type);
    if (index !== -1) {
      const parent = this._segments[index - 1];
      if (this._allowsChild(parent, segment)) {
        const child = this._segments[index + 1];
        if (!child || this._allowsChild(segment, child)) {
          const newSegments = this._segments.slice();
          newSegments[index] = segment;
          return new Path(newSegments, this._allowsChild);
        }
      }
    }
    return void 0;
  }
  get segments() {
    return this._segments;
  }
}
class SegmentObservable extends BaseObservableValue {
  constructor(navigation, type) {
    var _a;
    super();
    this._navigation = navigation;
    this._type = type;
    this._lastSetValue = (_a = navigation.path.get(type)) == null ? void 0 : _a.value;
  }
  get() {
    const path = this._navigation.path;
    const segment = path.get(this._type);
    const value = segment == null ? void 0 : segment.value;
    return value;
  }
  emitIfChanged() {
    const newValue = this.get();
    if (!segmentValueEqual(newValue, this._lastSetValue)) {
      this._lastSetValue = newValue;
      this.emit(newValue);
    }
  }
}
class URLRouter {
  constructor(history, navigation, parseUrlPath2, stringifyPath2) {
    this._isApplyingUrl = false;
    this._history = history;
    this._navigation = navigation;
    this._parseUrlPath = parseUrlPath2;
    this._stringifyPath = stringifyPath2;
    this._defaultSessionId = this._getLastSessionId();
  }
  _getLastSessionId() {
    var _a;
    const navPath = this._urlAsNavPath(this._history.getLastSessionUrl() || "");
    const sessionId = (_a = navPath.get("session")) == null ? void 0 : _a.value;
    if (typeof sessionId === "string") {
      return sessionId;
    }
    return void 0;
  }
  attach() {
    this._subscription = this._history.subscribe((url) => this._applyUrl(url));
    this._pathSubscription = this._navigation.pathObservable.subscribe((path) => this._applyNavPathToHistory(path));
    this._applyUrl(this._history.get());
  }
  dispose() {
    if (this._subscription) {
      this._subscription = this._subscription();
    }
    if (this._pathSubscription) {
      this._pathSubscription = this._pathSubscription();
    }
  }
  _applyNavPathToHistory(path) {
    const url = this.urlForPath(path);
    if (url !== this._history.get()) {
      if (this._isApplyingUrl) {
        this._history.replaceUrlSilently(url);
      } else {
        this._history.pushUrlSilently(url);
      }
    }
  }
  _applyNavPathToNavigation(navPath) {
    this._isApplyingUrl = true;
    this._navigation.applyPath(navPath);
    this._isApplyingUrl = false;
  }
  _urlAsNavPath(url) {
    const urlPath = this._history.urlAsPath(url);
    return this._navigation.pathFrom(this._parseUrlPath(urlPath, this._navigation.path, this._defaultSessionId));
  }
  _applyUrl(url) {
    const navPath = this._urlAsNavPath(url);
    this._applyNavPathToNavigation(navPath);
  }
  pushUrl(url) {
    this._history.pushUrl(url);
  }
  tryRestoreLastUrl() {
    const lastNavPath = this._urlAsNavPath(this._history.getLastSessionUrl() || "");
    if (lastNavPath.segments.length !== 0) {
      this._applyNavPathToNavigation(lastNavPath);
      return true;
    }
    return false;
  }
  urlForSegments(segments) {
    let path = this._navigation.path;
    for (const segment of segments) {
      path = path.with(segment);
      if (!path) {
        return;
      }
    }
    return this.urlForPath(path);
  }
  urlForSegment(type, ...value) {
    return this.urlForSegments([this._navigation.segment(type, ...value)]);
  }
  urlUntilSegment(type) {
    return this.urlForPath(this._navigation.path.until(type));
  }
  urlForPath(path) {
    return this._history.pathAsUrl(this._stringifyPath(path));
  }
  openRoomActionUrl(roomId) {
    const urlPath = `${this._stringifyPath(this._navigation.path.until("session"))}/open-room/${roomId}`;
    return this._history.pathAsUrl(urlPath);
  }
  createSSOCallbackURL() {
    return window.location.origin;
  }
  normalizeUrl() {
    this._history.replaceUrlSilently(`${window.location.origin}/${window.location.hash}`);
  }
}
function createNavigation() {
  return new Navigation(allowsChild);
}
function createRouter({ history, navigation }) {
  return new URLRouter(history, navigation, parseUrlPath, stringifyPath);
}
function allowsChild(parent, child) {
  const { type } = child;
  switch (parent == null ? void 0 : parent.type) {
    case void 0:
      return type === "login" || type === "session" || type === "sso" || type === "logout";
    case "session":
      return type === "room" || type === "rooms" || type === "settings" || type === "create-room" || type === "join-room";
    case "rooms":
      return type === "room" || type === "empty-grid-tile";
    case "room":
      return type === "lightbox" || type === "right-panel";
    case "right-panel":
      return type === "details" || type === "members" || type === "member";
    case "logout":
      return type === "forced";
    default:
      return false;
  }
}
function roomsSegmentWithRoom(rooms, roomId, path) {
  if (!rooms.value.includes(roomId)) {
    const emptyGridTile = path.get("empty-grid-tile");
    const oldRoom = path.get("room");
    let index = 0;
    if (emptyGridTile) {
      index = emptyGridTile.value;
    } else if (oldRoom) {
      index = rooms.value.indexOf(oldRoom.value);
    }
    const roomIds = rooms.value.slice();
    roomIds[index] = roomId;
    return new Segment("rooms", roomIds);
  } else {
    return rooms;
  }
}
function pushRightPanelSegment(array, segment, ...value) {
  array.push(new Segment("right-panel"));
  array.push(new Segment(segment, ...value));
}
function addPanelIfNeeded(navigation, path) {
  const segments = navigation.path.segments;
  const i = segments.findIndex((segment) => segment.type === "right-panel");
  let _path = path;
  if (i !== -1) {
    _path = path.until("room");
    _path = _path.with(segments[i]);
    _path = _path.with(segments[i + 1]);
  }
  return _path;
}
function parseUrlPath(urlPath, currentNavPath, defaultSessionId) {
  const parts = urlPath.substring(1).split("/");
  const iterator = parts[Symbol.iterator]();
  const segments = [];
  let next;
  while (!(next = iterator.next()).done) {
    const type = next.value;
    if (type === "rooms") {
      const roomsValue = iterator.next().value;
      if (roomsValue === void 0) {
        break;
      }
      const roomIds = roomsValue.split(",");
      segments.push(new Segment(type, roomIds));
      const selectedIndex = parseInt(iterator.next().value || "0", 10);
      const roomId = roomIds[selectedIndex];
      if (roomId) {
        segments.push(new Segment("room", roomId));
      } else {
        segments.push(new Segment("empty-grid-tile", selectedIndex));
      }
    } else if (type === "open-room") {
      const roomId = iterator.next().value;
      if (!roomId) {
        break;
      }
      const rooms = currentNavPath.get("rooms");
      if (rooms) {
        segments.push(roomsSegmentWithRoom(rooms, roomId, currentNavPath));
      }
      segments.push(new Segment("room", roomId));
      const openRoomPartIndex = parts.findIndex((part) => part === "open-room");
      const hasOnlyRoomIdAfterPart = openRoomPartIndex >= parts.length - 2;
      if (hasOnlyRoomIdAfterPart) {
        const previousSegments = currentNavPath.segments;
        const i = previousSegments.findIndex((s) => s.type === "right-panel");
        if (i !== -1) {
          segments.push(...previousSegments.slice(i));
        }
      }
    } else if (type === "last-session") {
      let sessionSegment = currentNavPath.get("session");
      if (typeof (sessionSegment == null ? void 0 : sessionSegment.value) !== "string" && defaultSessionId) {
        sessionSegment = new Segment("session", defaultSessionId);
      }
      if (sessionSegment) {
        segments.push(sessionSegment);
      }
    } else if (type === "details" || type === "members") {
      pushRightPanelSegment(segments, type);
    } else if (type === "member") {
      const userId = iterator.next().value;
      if (!userId) {
        break;
      }
      pushRightPanelSegment(segments, type, userId);
    } else if (type.includes("loginToken")) {
      const loginToken = type.split("=").pop();
      segments.push(new Segment("sso", loginToken));
    } else {
      const value = iterator.next().value;
      segments.push(new Segment(type, value));
    }
  }
  return segments;
}
function stringifyPath(path) {
  let urlPath = "";
  let prevSegment;
  for (const segment of path.segments) {
    switch (segment.type) {
      case "rooms":
        urlPath += `/rooms/${segment.value.join(",")}`;
        break;
      case "empty-grid-tile":
        urlPath += `/${segment.value}`;
        break;
      case "room":
        if ((prevSegment == null ? void 0 : prevSegment.type) === "rooms") {
          const index = prevSegment.value.indexOf(segment.value);
          urlPath += `/${index}`;
        } else {
          urlPath += `/${segment.type}/${segment.value}`;
        }
        break;
      case "right-panel":
      case "sso":
        continue;
      default:
        urlPath += `/${segment.type}`;
        if (segment.value && segment.value !== true) {
          urlPath += `/${segment.value}`;
        }
    }
    prevSegment = segment;
  }
  return urlPath;
}
class LeftPanelViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { session } = options;
    this._tileViewModelsMap = this._mapTileViewModels(session.roomsBeingCreated, session.invites, session.rooms);
    this._tileViewModelsFilterMap = new ApplyMap(this._tileViewModelsMap);
    this._tileViewModels = this._tileViewModelsFilterMap.sortValues((a, b) => a.compare(b));
    this._currentTileVM = null;
    this._setupNavigation();
    this._closeUrl = this.urlCreator.urlForSegment("session");
    this._settingsUrl = this.urlCreator.urlForSegment("settings");
  }
  _mapTileViewModels(roomsBeingCreated, invites, rooms) {
    const allTiles = invites.join(roomsBeingCreated, rooms).mapValues((item, emitChange) => {
      var _a;
      let vm;
      if (item.isBeingCreated) {
        vm = new RoomBeingCreatedTileViewModel(this.childOptions({ roomBeingCreated: item, emitChange }));
      } else if (item.isInvite) {
        vm = new InviteTileViewModel(this.childOptions({ invite: item, emitChange }));
      } else {
        vm = new RoomTileViewModel(this.childOptions({ room: item, emitChange }));
      }
      const isOpen = ((_a = this.navigation.path.get("room")) == null ? void 0 : _a.value) === item.id;
      if (isOpen) {
        vm.open();
        this._updateCurrentVM(vm);
      }
      return vm;
    });
    return allTiles;
  }
  _updateCurrentVM(vm) {
    var _a;
    (_a = this._currentTileVM) == null ? void 0 : _a.close();
    this._currentTileVM = vm;
  }
  get closeUrl() {
    return this._closeUrl;
  }
  get settingsUrl() {
    return this._settingsUrl;
  }
  showCreateRoomView() {
    this.navigation.push("create-room");
  }
  showJoinRoomView() {
    this.navigation.push("join-room");
  }
  _setupNavigation() {
    const roomObservable = this.navigation.observe("room");
    this.track(roomObservable.subscribe((roomId) => this._open(roomId)));
    const gridObservable = this.navigation.observe("rooms");
    this.gridEnabled = !!gridObservable.get();
    this.track(gridObservable.subscribe((roomIds) => {
      const changed = this.gridEnabled ^ !!roomIds;
      this.gridEnabled = !!roomIds;
      if (changed) {
        this.emitChange("gridEnabled");
      }
    }));
  }
  _open(roomId) {
    var _a, _b;
    (_a = this._currentTileVM) == null ? void 0 : _a.close();
    this._currentTileVM = null;
    if (roomId) {
      this._currentTileVM = this._tileViewModelsMap.get(roomId);
      (_b = this._currentTileVM) == null ? void 0 : _b.open();
    }
  }
  toggleGrid() {
    const room = this.navigation.path.get("room");
    let path = this.navigation.path.until("session");
    if (this.gridEnabled) {
      if (room) {
        path = path.with(room);
        path = addPanelIfNeeded(this.navigation, path);
      }
    } else {
      if (room) {
        path = path.with(this.navigation.segment("rooms", [room.value]));
        path = path.with(room);
        path = addPanelIfNeeded(this.navigation, path);
      } else {
        path = path.with(this.navigation.segment("rooms", []));
        path = path.with(this.navigation.segment("empty-grid-tile", 0));
      }
    }
    this.navigation.applyPath(path);
  }
  get tileViewModels() {
    return this._tileViewModels;
  }
  clearFilter() {
    this._tileViewModelsFilterMap.setApply(null);
    this._tileViewModelsFilterMap.applyOnce((roomId, vm) => vm.hidden = false);
  }
  setFilter(query) {
    query = query.trim();
    if (query.length === 0) {
      this.clearFilter();
      return false;
    } else {
      const startFiltering = !this._tileViewModelsFilterMap.hasApply();
      const filter = new RoomFilter(query);
      this._tileViewModelsFilterMap.setApply((roomId, vm) => {
        vm.hidden = !filter.matches(vm);
      });
      return startFiltering;
    }
  }
}
class UpdateAction {
  constructor(remove, update, replace, updateParams) {
    this._remove = remove;
    this._update = update;
    this._replace = replace;
    this._updateParams = updateParams;
  }
  get shouldReplace() {
    return this._replace;
  }
  get shouldRemove() {
    return this._remove;
  }
  get shouldUpdate() {
    return this._update;
  }
  get updateParams() {
    return this._updateParams;
  }
  static Remove() {
    return new UpdateAction(true, false, false, null);
  }
  static Update(newParams) {
    return new UpdateAction(false, true, false, newParams);
  }
  static Nothing() {
    return new UpdateAction(false, false, false, null);
  }
  static Replace(params) {
    return new UpdateAction(false, false, true, params);
  }
}
class TilesCollection extends BaseObservableList {
  constructor(entries, tileOptions) {
    super();
    this._entries = entries;
    this._tiles = null;
    this._entrySubscription = null;
    this._tileOptions = tileOptions;
    this._emitSpontanousUpdate = this._emitSpontanousUpdate.bind(this);
  }
  _createTile(entry) {
    const Tile = this._tileOptions.tileClassForEntry(entry);
    if (Tile) {
      return new Tile(entry, this._tileOptions);
    }
  }
  _emitSpontanousUpdate(tile, params) {
    const entry = tile.lowerEntry;
    const tileIdx = this._findTileIdx(entry);
    this.emitUpdate(tileIdx, tile, params);
  }
  onSubscribeFirst() {
    this._entrySubscription = this._entries.subscribe(this);
    this._populateTiles();
  }
  _populateTiles() {
    this._tiles = [];
    let currentTile = null;
    for (let entry of this._entries) {
      if (!currentTile || !currentTile.tryIncludeEntry(entry)) {
        currentTile = this._createTile(entry);
        if (currentTile) {
          this._tiles.push(currentTile);
        }
      }
    }
    let prevTile = null;
    for (let tile of this._tiles) {
      if (prevTile) {
        prevTile.updateNextSibling(tile);
      }
      tile.updatePreviousSibling(prevTile);
      prevTile = tile;
    }
    if (prevTile) {
      prevTile.updateNextSibling(null);
    }
    for (const tile of this._tiles) {
      tile.setUpdateEmit(this._emitSpontanousUpdate);
    }
  }
  _findTileIdx(entry) {
    return sortedIndex(this._tiles, entry, (entry2, tile) => {
      return -tile.compareEntry(entry2);
    });
  }
  _findTileAtIdx(entry, idx) {
    const tile = this._getTileAtIdx(idx);
    if (tile && tile.compareEntry(entry) === 0) {
      return tile;
    }
  }
  _getTileAtIdx(tileIdx) {
    if (tileIdx >= 0 && tileIdx < this._tiles.length) {
      return this._tiles[tileIdx];
    }
    return null;
  }
  onUnsubscribeLast() {
    this._entrySubscription = this._entrySubscription();
    for (let i = 0; i < this._tiles.length; i += 1) {
      this._tiles[i].dispose();
    }
    this._tiles = null;
  }
  onReset() {
    this._buildInitialTiles();
    this.emitReset();
  }
  onAdd(index, entry) {
    const tileIdx = this._findTileIdx(entry);
    const prevTile = this._getTileAtIdx(tileIdx - 1);
    if (prevTile && prevTile.tryIncludeEntry(entry)) {
      this.emitUpdate(tileIdx - 1, prevTile);
      return;
    }
    const nextTile = this._getTileAtIdx(tileIdx);
    if (nextTile && nextTile.tryIncludeEntry(entry)) {
      this.emitUpdate(tileIdx, nextTile);
      return;
    }
    const newTile = this._createTile(entry);
    if (newTile) {
      if (prevTile) {
        prevTile.updateNextSibling(newTile);
        newTile.updatePreviousSibling(prevTile);
      }
      if (nextTile) {
        newTile.updateNextSibling(nextTile);
        nextTile.updatePreviousSibling(newTile);
      }
      this._tiles.splice(tileIdx, 0, newTile);
      this.emitAdd(tileIdx, newTile);
      newTile.setUpdateEmit(this._emitSpontanousUpdate);
    }
  }
  onUpdate(index, entry, params) {
    if (!this._tiles) {
      return;
    }
    const tileIdx = this._findTileIdx(entry);
    const tile = this._findTileAtIdx(entry, tileIdx);
    if (tile) {
      const action = tile.updateEntry(entry, params);
      if (action.shouldReplace) {
        const newTile = this._createTile(entry);
        if (newTile) {
          this._replaceTile(tileIdx, tile, newTile, action.updateParams);
          newTile.setUpdateEmit(this._emitSpontanousUpdate);
        } else {
          this._removeTile(tileIdx, tile);
        }
      }
      if (action.shouldRemove) {
        this._removeTile(tileIdx, tile);
      }
      if (action.shouldUpdate) {
        this.emitUpdate(tileIdx, tile, action.updateParams);
      }
    }
  }
  _replaceTile(tileIdx, existingTile, newTile, updateParams) {
    existingTile.dispose();
    const prevTile = this._getTileAtIdx(tileIdx - 1);
    const nextTile = this._getTileAtIdx(tileIdx + 1);
    this._tiles[tileIdx] = newTile;
    prevTile == null ? void 0 : prevTile.updateNextSibling(newTile);
    newTile.updatePreviousSibling(prevTile);
    newTile.updateNextSibling(nextTile);
    nextTile == null ? void 0 : nextTile.updatePreviousSibling(newTile);
    this.emitUpdate(tileIdx, newTile, updateParams);
  }
  _removeTile(tileIdx, tile) {
    const prevTile = this._getTileAtIdx(tileIdx - 1);
    const nextTile = this._getTileAtIdx(tileIdx + 1);
    this._tiles.splice(tileIdx, 1);
    tile.dispose();
    this.emitRemove(tileIdx, tile);
    prevTile == null ? void 0 : prevTile.updateNextSibling(nextTile);
    nextTile == null ? void 0 : nextTile.updatePreviousSibling(prevTile);
  }
  onRemove(index, entry) {
    const tileIdx = this._findTileIdx(entry);
    const tile = this._findTileAtIdx(entry, tileIdx);
    if (tile) {
      const removeTile = tile.removeEntry(entry);
      if (removeTile) {
        this._removeTile(tileIdx, tile);
      } else {
        this.emitUpdate(tileIdx, tile);
      }
    }
  }
  onMove() {
  }
  [Symbol.iterator]() {
    return this._tiles.values();
  }
  get length() {
    return this._tiles.length;
  }
  getFirst() {
    return this._tiles[0];
  }
  getTileIndex(searchTile) {
    const idx = sortedIndex(this._tiles, searchTile, (searchTile2, tile) => {
      return searchTile2.compare(tile);
    });
    const foundTile = this._tiles[idx];
    if ((foundTile == null ? void 0 : foundTile.compare(searchTile)) === 0) {
      return idx;
    }
    return -1;
  }
  sliceIterator(start, end) {
    return this._tiles.slice(start, end)[Symbol.iterator]();
  }
}
class TimelineViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { timeline, tileOptions } = options;
    this._timeline = this.track(timeline);
    this._tiles = new TilesCollection(timeline.entries, tileOptions);
    this._startTile = null;
    this._endTile = null;
    this._topLoadingPromise = null;
    this._requestedStartTile = null;
    this._requestedEndTile = null;
    this._requestScheduled = false;
    this._showJumpDown = false;
  }
  setVisibleTileRange(startTile, endTile) {
    this._requestedStartTile = startTile;
    this._requestedEndTile = endTile;
    if (!this._requestScheduled) {
      Promise.resolve().then(() => {
        this._setVisibleTileRange(this._requestedStartTile, this._requestedEndTile);
        this._requestScheduled = false;
      });
      this._requestScheduled = true;
    }
  }
  _setVisibleTileRange(startTile, endTile) {
    let loadTop;
    if (startTile && endTile) {
      this._startTile = startTile;
      this._endTile = endTile;
      const startIndex = this._tiles.getTileIndex(this._startTile);
      const endIndex = this._tiles.getTileIndex(this._endTile);
      for (const tile of this._tiles.sliceIterator(startIndex, endIndex + 1)) {
        tile.notifyVisible();
      }
      loadTop = startIndex < 10;
      this._setShowJumpDown(endIndex < this._tiles.length - 1);
    } else {
      loadTop = true;
      this._setShowJumpDown(false);
    }
    if (loadTop && !this._topLoadingPromise) {
      this._topLoadingPromise = this._timeline.loadAtTop(10).then((hasReachedEnd) => {
        this._topLoadingPromise = null;
        if (!hasReachedEnd) {
          this.setVisibleTileRange(this._requestedStartTile, this._requestedEndTile);
        }
      });
    }
  }
  get tiles() {
    return this._tiles;
  }
  _setShowJumpDown(show) {
    if (this._showJumpDown !== show) {
      this._showJumpDown = show;
      this.emitChange("showJumpDown");
    }
  }
  get showJumpDown() {
    return this._showJumpDown;
  }
}
class ComposerViewModel extends ViewModel {
  constructor(roomVM) {
    super(roomVM.options);
    this._roomVM = roomVM;
    this._isEmpty = true;
    this._replyVM = null;
  }
  setReplyingTo(entry) {
    var _a;
    const changed = new Boolean(entry) !== new Boolean(this._replyVM) || !((_a = this._replyVM) == null ? void 0 : _a.id.equals(entry.asEventKey()));
    if (changed) {
      this._replyVM = this.disposeTracked(this._replyVM);
      if (entry) {
        this._replyVM = this.track(this._roomVM._createTile(entry));
        this._replyVM.notifyVisible();
      }
      this.emitChange("replyViewModel");
      this.emit("focus");
    }
  }
  clearReplyingTo() {
    this.setReplyingTo(null);
  }
  get replyViewModel() {
    return this._replyVM;
  }
  get isEncrypted() {
    return this._roomVM.isEncrypted;
  }
  async sendMessage(message) {
    const success = await this._roomVM._sendMessage(message, this._replyVM);
    if (success) {
      this._isEmpty = true;
      this.emitChange("canSend");
      this.clearReplyingTo();
    }
    return success;
  }
  sendPicture() {
    this._roomVM._pickAndSendPicture();
  }
  sendFile() {
    this._roomVM._pickAndSendFile();
  }
  sendVideo() {
    this._roomVM._pickAndSendVideo();
  }
  get canSend() {
    return !this._isEmpty;
  }
  async setInput(text2) {
    const wasEmpty = this._isEmpty;
    this._isEmpty = text2.length === 0;
    if (wasEmpty && !this._isEmpty) {
      this._roomVM._room.ensureMessageKeyIsShared();
    }
    if (wasEmpty !== this._isEmpty) {
      this.emitChange("canSend");
    }
  }
  get kind() {
    return "composer";
  }
}
function imageToInfo(image) {
  return {
    w: image.width,
    h: image.height,
    mimetype: image.blob.mimeType,
    size: image.blob.size
  };
}
class SimpleTile extends ViewModel {
  constructor(entry, options) {
    super(options);
    this._entry = entry;
    this._emitUpdate = void 0;
  }
  get shape() {
    return null;
  }
  get isContinuation() {
    return false;
  }
  get hasDateSeparator() {
    return false;
  }
  get id() {
    return this._entry.asEventKey();
  }
  get eventId() {
    return this._entry.id;
  }
  get isPending() {
    return this._entry.isPending;
  }
  get isUnsent() {
    return this._entry.isPending && this._entry.pendingEvent.status !== SendStatus.Sent;
  }
  get canAbortSending() {
    return this._entry.isPending && !this._entry.pendingEvent.hasStartedSending;
  }
  abortSending() {
    var _a;
    (_a = this._entry.pendingEvent) == null ? void 0 : _a.abort();
  }
  setUpdateEmit(emitUpdate) {
    this._emitUpdate = emitUpdate;
  }
  emitChange(changedProps) {
    if (this._emitUpdate) {
      this._emitUpdate(this, changedProps);
    }
    super.emitChange(changedProps);
  }
  get upperEntry() {
    return this._entry;
  }
  get lowerEntry() {
    return this._entry;
  }
  compare(tile) {
    return this.upperEntry.compare(tile.upperEntry);
  }
  compareEntry(entry) {
    return this._entry.compare(entry);
  }
  updateEntry(entry, param) {
    const renderedAsRedacted = this.shape === "redacted";
    if (!entry.isGap && entry.isRedacted !== renderedAsRedacted) {
      return UpdateAction.Replace("shape");
    } else {
      this._entry = entry;
      return UpdateAction.Update(param);
    }
  }
  removeEntry() {
    return true;
  }
  tryIncludeEntry() {
    return false;
  }
  updatePreviousSibling() {
  }
  updateNextSibling() {
  }
  notifyVisible() {
  }
  dispose() {
    this.setUpdateEmit(null);
    super.dispose();
  }
  get _room() {
    return this._roomVM.room;
  }
  get _roomVM() {
    return this._options.roomVM;
  }
  get _timeline() {
    return this._options.timeline;
  }
  get _powerLevels() {
    return this._timeline.powerLevels;
  }
  get _ownMember() {
    return this._options.timeline.me;
  }
}
class GapTile extends SimpleTile {
  constructor(entry, options) {
    super(entry, options);
    this._loading = false;
    this._error = null;
    this._isAtTop = true;
    this._siblingChanged = false;
    this._showSpinner = false;
  }
  async fill() {
    if (!this._loading && !this._entry.edgeReached) {
      this._loading = true;
      this._error = null;
      this._showSpinner = true;
      this.emitChange("isLoading");
      try {
        await this._room.fillGap(this._entry, 10);
      } catch (err) {
        console.error(`room.fillGap(): ${err.message}:
${err.stack}`);
        this._error = err;
        if (err instanceof ConnectionError) {
          this.emitChange("error");
          await this._waitForReconnection();
        }
        throw err;
      } finally {
        this._loading = false;
        this._showSpinner = false;
        this.emitChange("isLoading");
      }
      return true;
    }
    return false;
  }
  async notifyVisible() {
    let depth = 0;
    let canFillMore;
    this._siblingChanged = false;
    do {
      try {
        canFillMore = await this.fill();
      } catch (e) {
        if (e instanceof ConnectionError) {
          canFillMore = true;
          continue;
        } else {
          canFillMore = false;
        }
      }
      depth = depth + 1;
    } while (depth < 10 && !this._siblingChanged && canFillMore && !this.isDisposed);
  }
  get isAtTop() {
    return this._isAtTop;
  }
  updatePreviousSibling(prev) {
    super.updatePreviousSibling(prev);
    const isAtTop = !prev;
    if (this._isAtTop !== isAtTop) {
      this._isAtTop = isAtTop;
      this.emitChange("isAtTop");
    }
    this._siblingChanged = true;
  }
  updateNextSibling() {
    this._siblingChanged = true;
  }
  updateEntry(entry, params) {
    super.updateEntry(entry, params);
    if (!entry.isGap) {
      return UpdateAction.Remove();
    } else {
      return UpdateAction.Nothing();
    }
  }
  async _waitForReconnection() {
    await this.options.client.reconnector.connectionStatus.waitFor((status) => status === ConnectionStatus.Online).promise;
  }
  get shape() {
    return "gap";
  }
  get isLoading() {
    return this._loading;
  }
  get showSpinner() {
    return this._showSpinner;
  }
  get error() {
    if (this._error) {
      if (this._error instanceof ConnectionError) {
        return "Waiting for reconnection";
      }
      const dir = this._entry.prev_batch ? "previous" : "next";
      return `Could not load ${dir} messages: ${this._error.message}`;
    }
    return null;
  }
  get currentAction() {
    if (this.error) {
      return this.error;
    } else if (this.isLoading) {
      return "Loading";
    } else {
      return "Not Loading";
    }
  }
}
class ReactionsViewModel {
  constructor(parentTile) {
    this._parentTile = parentTile;
    this._map = new ObservableMap();
    this._reactions = this._map.sortValues((a, b) => a._compare(b));
  }
  update(annotations, pendingAnnotations) {
    if (annotations) {
      for (const key in annotations) {
        if (annotations.hasOwnProperty(key)) {
          const annotation = annotations[key];
          const reaction = this._map.get(key);
          if (reaction) {
            if (reaction._tryUpdate(annotation)) {
              this._map.update(key);
            }
          } else {
            this._map.add(key, new ReactionViewModel(key, annotation, null, this._parentTile));
          }
        }
      }
    }
    if (pendingAnnotations) {
      for (const [key, annotation] of pendingAnnotations.entries()) {
        const reaction = this._map.get(key);
        if (reaction) {
          reaction._tryUpdatePending(annotation);
          this._map.update(key);
        } else {
          this._map.add(key, new ReactionViewModel(key, null, annotation, this._parentTile));
        }
      }
    }
    for (const existingKey of this._map.keys()) {
      const hasPending = pendingAnnotations == null ? void 0 : pendingAnnotations.has(existingKey);
      const hasRemote = annotations == null ? void 0 : annotations.hasOwnProperty(existingKey);
      if (!hasRemote && !hasPending) {
        this._map.remove(existingKey);
      } else if (!hasRemote) {
        if (this._map.get(existingKey)._tryUpdate(null)) {
          this._map.update(existingKey);
        }
      } else if (!hasPending) {
        if (this._map.get(existingKey)._tryUpdatePending(null)) {
          this._map.update(existingKey);
        }
      }
    }
  }
  get reactions() {
    return this._reactions;
  }
  getReaction(key) {
    return this._map.get(key);
  }
}
class ReactionViewModel {
  constructor(key, annotation, pending, parentTile) {
    this._key = key;
    this._annotation = annotation;
    this._pending = pending;
    this._parentTile = parentTile;
    this._isToggling = false;
  }
  _tryUpdate(annotation) {
    const oneSetAndOtherNot = !!this._annotation !== !!annotation;
    const bothSet = this._annotation && annotation;
    const areDifferent = bothSet && (annotation.me !== this._annotation.me || annotation.count !== this._annotation.count || annotation.firstTimestamp !== this._annotation.firstTimestamp);
    if (oneSetAndOtherNot || areDifferent) {
      this._annotation = annotation;
      return true;
    }
    return false;
  }
  _tryUpdatePending(pending) {
    if (!pending && !this._pending) {
      return false;
    }
    this._pending = pending;
    return true;
  }
  get key() {
    return this._key;
  }
  get count() {
    var _a, _b;
    return (((_a = this._pending) == null ? void 0 : _a.count) || 0) + (((_b = this._annotation) == null ? void 0 : _b.count) || 0);
  }
  get isPending() {
    return this._pending !== null;
  }
  get isActive() {
    var _a;
    return ((_a = this._annotation) == null ? void 0 : _a.me) || this.isPending;
  }
  get firstTimestamp() {
    let ts = Number.MAX_SAFE_INTEGER;
    if (this._annotation) {
      ts = Math.min(ts, this._annotation.firstTimestamp);
    }
    if (this._pending) {
      ts = Math.min(ts, this._pending.firstTimestamp);
    }
    return ts;
  }
  _compare(other) {
    if (other === this) {
      return 0;
    }
    if (this.count !== other.count) {
      return other.count - this.count;
    } else {
      const cmp = this.firstTimestamp - other.firstTimestamp;
      if (cmp === 0) {
        return this.key < other.key ? -1 : 1;
      }
      return cmp;
    }
  }
  async toggle(log = null) {
    if (this._isToggling) {
      console.log("busy toggling reaction already");
      return;
    }
    this._isToggling = true;
    try {
      await this._parentTile.toggleReaction(this.key, log);
    } finally {
      this._isToggling = false;
    }
  }
}
class BaseMessageTile extends SimpleTile {
  constructor(entry, options) {
    super(entry, options);
    this._date = this._entry.timestamp ? new Date(this._entry.timestamp) : null;
    this._isContinuation = false;
    this._reactions = null;
    this._replyTile = null;
    if (this._entry.annotations || this._entry.pendingAnnotations) {
      this._updateReactions();
    }
    this._updateReplyTileIfNeeded(void 0);
  }
  notifyVisible() {
    var _a;
    super.notifyVisible();
    (_a = this._replyTile) == null ? void 0 : _a.notifyVisible();
  }
  get _mediaRepository() {
    return this._room.mediaRepository;
  }
  get permaLink() {
    return `https://matrix.to/#/${encodeURIComponent(this._room.id)}/${encodeURIComponent(this._entry.id)}`;
  }
  get senderProfileLink() {
    return `https://matrix.to/#/${encodeURIComponent(this.sender)}`;
  }
  get displayName() {
    return this._entry.displayName || this.sender;
  }
  get sender() {
    return this._entry.sender;
  }
  get memberPanelLink() {
    return `${this.urlCreator.urlUntilSegment("room")}/member/${this.sender}`;
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this._entry.sender);
  }
  avatarUrl(size) {
    return getAvatarHttpUrl(this._entry.avatarUrl, size, this.platform, this._mediaRepository);
  }
  get avatarLetter() {
    return avatarInitials(this.sender);
  }
  get avatarTitle() {
    return this.displayName;
  }
  get date() {
    return this._date && this._date.toLocaleDateString({}, { month: "numeric", day: "numeric" });
  }
  get time() {
    return this._date && this._date.toLocaleTimeString({}, { hour: "numeric", minute: "2-digit" });
  }
  get isOwn() {
    return this._entry.sender === this._ownMember.userId;
  }
  get isContinuation() {
    return this._isContinuation;
  }
  get isUnverified() {
    return this._entry.isUnverified;
  }
  get isReply() {
    return this._entry.isReply;
  }
  _getContent() {
    return this._entry.content;
  }
  updatePreviousSibling(prev) {
    super.updatePreviousSibling(prev);
    let isContinuation = false;
    if (prev && prev instanceof BaseMessageTile && prev.sender === this.sender) {
      const myTimestamp = this._entry.timestamp;
      const otherTimestamp = prev._entry.timestamp;
      isContinuation = myTimestamp - otherTimestamp < 5 * 60 * 1e3;
    }
    if (isContinuation !== this._isContinuation) {
      this._isContinuation = isContinuation;
      this.emitChange("isContinuation");
    }
  }
  updateEntry(entry, param) {
    const action = super.updateEntry(entry, param);
    if (action.shouldUpdate) {
      this._updateReactions();
    }
    this._updateReplyTileIfNeeded(param);
    return action;
  }
  _updateReplyTileIfNeeded(param) {
    var _a, _b;
    const replyEntry = this._entry.contextEntry;
    if (replyEntry) {
      const action = (_a = this._replyTile) == null ? void 0 : _a.updateEntry(replyEntry, param);
      if ((action == null ? void 0 : action.shouldReplace) || !this._replyTile) {
        this.disposeTracked(this._replyTile);
        const tileClassForEntry2 = this._options.tileClassForEntry;
        const ReplyTile = tileClassForEntry2(replyEntry);
        if (ReplyTile) {
          this._replyTile = new ReplyTile(replyEntry, this._options);
        }
      }
      if (action == null ? void 0 : action.shouldUpdate) {
        (_b = this._replyTile) == null ? void 0 : _b.emitChange();
      }
    }
  }
  startReply() {
    this._roomVM.startReply(this._entry);
  }
  reply(msgtype, body, log = null) {
    return this._room.sendEvent("m.room.message", this._entry.reply(msgtype, body), null, log);
  }
  redact(reason, log) {
    return this._room.sendRedaction(this._entry.id, reason, log);
  }
  get canRedact() {
    return this._powerLevels.canRedactFromSender(this._entry.sender);
  }
  get reactions() {
    if (this.shape !== "redacted") {
      return this._reactions;
    }
    return null;
  }
  get canReact() {
    return this._powerLevels.canSendType("m.reaction");
  }
  react(key, log = null) {
    return this.logger.wrapOrRun(log, "react", async (log2) => {
      var _a, _b;
      if (!this.canReact) {
        log2.set("powerlevel_lacking", true);
        return;
      }
      if (this._entry.haveAnnotation(key)) {
        log2.set("already_reacted", true);
        return;
      }
      const redaction = (_b = (_a = this._entry.pendingAnnotations) == null ? void 0 : _a.get(key)) == null ? void 0 : _b.redactionEntry;
      if (redaction && !redaction.pendingEvent.hasStartedSending) {
        log2.set("abort_redaction", true);
        await redaction.pendingEvent.abort();
      } else {
        await this._room.sendEvent("m.reaction", this._entry.annotate(key), null, log2);
      }
    });
  }
  redactReaction(key, log = null) {
    return this.logger.wrapOrRun(log, "redactReaction", async (log2) => {
      var _a, _b;
      if (!this._powerLevels.canRedactFromSender(this._ownMember.userId)) {
        log2.set("powerlevel_lacking", true);
        return;
      }
      if (!this._entry.haveAnnotation(key)) {
        log2.set("not_yet_reacted", true);
        return;
      }
      let entry = (_b = (_a = this._entry.pendingAnnotations) == null ? void 0 : _a.get(key)) == null ? void 0 : _b.annotationEntry;
      if (!entry) {
        entry = await this._timeline.getOwnAnnotationEntry(this._entry.id, key);
      }
      if (entry) {
        await this._room.sendRedaction(entry.id, null, log2);
      } else {
        log2.set("no_reaction", true);
      }
    });
  }
  toggleReaction(key, log = null) {
    return this.logger.wrapOrRun(log, "toggleReaction", async (log2) => {
      if (this._entry.haveAnnotation(key)) {
        await this.redactReaction(key, log2);
      } else {
        await this.react(key, log2);
      }
    });
  }
  _updateReactions() {
    const { annotations, pendingAnnotations } = this._entry;
    if (!annotations && !pendingAnnotations) {
      if (this._reactions) {
        this._reactions = null;
      }
    } else {
      if (!this._reactions) {
        this._reactions = new ReactionsViewModel(this);
      }
      this._reactions.update(annotations, pendingAnnotations);
    }
  }
  get replyTile() {
    if (!this._entry.contextEventId) {
      return null;
    }
    return this._replyTile;
  }
}
const scheme = "(?:https|http|ftp):\\/\\/";
const noSpaceNorPunctuation = "[^\\s.,?!)]";
const hostCharacter = "[a-zA-Z0-9:.\\[\\]-]";
const host = `${hostCharacter}*(?=${hostCharacter})${noSpaceNorPunctuation}`;
const pathOrFragment = `(?:[\\/#](?:[^\\s]*${noSpaceNorPunctuation})?)`;
const urlRegex = `${scheme}${host}${pathOrFragment}?`;
const regex = new RegExp(urlRegex, "gi");
function linkify(text2, callback) {
  const matches = text2.matchAll(regex);
  let curr = 0;
  for (let match of matches) {
    const precedingText = text2.slice(curr, match.index);
    callback(precedingText, false);
    callback(match[0], true);
    const len = match[0].length;
    curr = match.index + len;
  }
  const remainingText = text2.slice(curr);
  callback(remainingText, false);
}
function parsePlainBody(body) {
  const parts = [];
  const lines = body.split("\n");
  const linkifyCallback = (text2, isLink) => {
    if (isLink) {
      parts.push(new LinkPart(text2, [new TextPart(text2)]));
    } else {
      parts.push(new TextPart(text2));
    }
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length) {
      linkify(line, linkifyCallback);
    }
    const isLastLine = i >= lines.length - 1;
    if (!isLastLine) {
      parts.push(new NewLinePart());
    }
  }
  return new MessageBody(body, parts);
}
function stringAsBody(body) {
  return new MessageBody(body, [new TextPart(body)]);
}
class HeaderBlock {
  constructor(level, inlines) {
    this.level = level;
    this.inlines = inlines;
  }
  get type() {
    return "header";
  }
}
class CodeBlock {
  constructor(language, text2) {
    this.language = language;
    this.text = text2;
  }
  get type() {
    return "codeblock";
  }
}
class ListBlock {
  constructor(startOffset, items) {
    this.items = items;
    this.startOffset = startOffset;
  }
  get type() {
    return "list";
  }
}
class TableBlock {
  constructor(head, body) {
    this.head = head;
    this.body = body;
  }
  get type() {
    return "table";
  }
}
class RulePart {
  get type() {
    return "rule";
  }
}
class NewLinePart {
  get type() {
    return "newline";
  }
}
class FormatPart {
  constructor(format, children) {
    this.format = format.toLowerCase();
    this.children = children;
  }
  get type() {
    return "format";
  }
}
class ImagePart {
  constructor(src2, width, height, alt, title) {
    this.src = src2;
    this.width = width;
    this.height = height;
    this.alt = alt;
    this.title = title;
  }
  get type() {
    return "image";
  }
}
class PillPart {
  constructor(id, href, children) {
    this.id = id;
    this.href = href;
    this.children = children;
  }
  get type() {
    return "pill";
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this.id);
  }
  get avatarInitials() {
    return avatarInitials(this.id);
  }
}
class LinkPart {
  constructor(url, inlines) {
    this.url = url;
    this.inlines = inlines;
  }
  get type() {
    return "link";
  }
}
class TextPart {
  constructor(text2) {
    this.text = text2;
  }
  get type() {
    return "text";
  }
}
function isBlockquote(part) {
  return part.type === "format" && part.format === "blockquote";
}
class MessageBody {
  constructor(sourceString, parts) {
    this.sourceString = sourceString;
    this.parts = parts;
  }
  insertEmote(string) {
    let i = 0;
    for (; i < this.parts.length && isBlockquote(this.parts[i]); i++)
      ;
    this.parts.splice(i, 0, new TextPart(string));
  }
}
const BodyFormat = createEnum("Plain", "Html");
class BaseTextTile extends BaseMessageTile {
  constructor(entry, options) {
    super(entry, options);
    this._messageBody = null;
    this._format = null;
  }
  get shape() {
    return "message";
  }
  _parseBody(body) {
    return stringAsBody(body);
  }
  _getBodyFormat() {
    return BodyFormat.Plain;
  }
  get body() {
    const body = this._getBody();
    const format = this._getBodyFormat();
    if (!this._messageBody || this._messageBody.sourceString !== body || this._format !== format) {
      this._messageBody = this._parseBody(body, format);
      this._format = format;
    }
    return this._messageBody;
  }
}
const basicInline = ["EM", "STRONG", "CODE", "DEL", "SPAN"];
const basicBlock = ["DIV", "BLOCKQUOTE"];
const safeSchemas = ["https", "http", "ftp", "mailto", "magnet"].map((name) => `${name}://`);
const baseUrl = "https://matrix.to";
const linkPrefix = `${baseUrl}/#/`;
class Deserializer {
  constructor(result, mediaRepository) {
    this.result = result;
    this.mediaRepository = mediaRepository;
  }
  parsePillLink(link) {
    if (!link.startsWith(linkPrefix)) {
      return null;
    }
    const contents = link.substring(linkPrefix.length);
    if (contents[0] === "@") {
      return contents;
    }
    return null;
  }
  parseLink(node, children) {
    const href = this.result.getAttributeValue(node, "href");
    const lcUrl = href == null ? void 0 : href.toLowerCase();
    if (!lcUrl || !safeSchemas.some((schema2) => lcUrl.startsWith(schema2))) {
      return new FormatPart("span", children);
    }
    const pillId = this.parsePillLink(href);
    if (pillId) {
      return new PillPart(pillId, href, children);
    }
    return new LinkPart(href, children);
  }
  parseList(node) {
    const result = this.result;
    let start = null;
    if (result.getNodeElementName(node) === "OL") {
      start = parseInt(result.getAttributeValue(node, "start")) || 1;
    }
    const items = [];
    for (const child of result.getChildNodes(node)) {
      if (result.getNodeElementName(child) !== "LI") {
        continue;
      }
      const item = this.parseAnyNodes(result.getChildNodes(child));
      items.push(item);
    }
    return new ListBlock(start, items);
  }
  _ensureElement(node, tag2) {
    return node && this.result.isElementNode(node) && this.result.getNodeElementName(node) === tag2;
  }
  parseCodeBlock(node) {
    const result = this.result;
    let codeNode;
    for (const child of result.getChildNodes(node)) {
      codeNode = child;
      break;
    }
    let language = null;
    if (!this._ensureElement(codeNode, "CODE")) {
      return new CodeBlock(language, this.result.getNodeText(node));
    }
    const cl = result.getAttributeValue(codeNode, "class") || "";
    for (const clname of cl.split(" ")) {
      if (clname.startsWith("language-") && !clname.startsWith("language-_")) {
        language = clname.substring(9);
        break;
      }
    }
    return new CodeBlock(language, this.result.getNodeText(codeNode));
  }
  parseImage(node) {
    const result = this.result;
    const src2 = result.getAttributeValue(node, "src") || "";
    const url = this.mediaRepository.mxcUrl(src2);
    if (!url) {
      return null;
    }
    const width = parseInt(result.getAttributeValue(node, "width")) || null;
    const height = parseInt(result.getAttributeValue(node, "height")) || null;
    const alt = result.getAttributeValue(node, "alt");
    const title = result.getAttributeValue(node, "title");
    return new ImagePart(url, width, height, alt, title);
  }
  parseTableRow(row, tag2) {
    const cells = [];
    for (const node of this.result.getChildNodes(row)) {
      if (!this._ensureElement(node, tag2)) {
        continue;
      }
      const children = this.result.getChildNodes(node);
      const inlines = this.parseInlineNodes(children);
      cells.push(inlines);
    }
    return cells;
  }
  parseTableHead(head) {
    let headRow = null;
    for (const node of this.result.getChildNodes(head)) {
      headRow = node;
      break;
    }
    if (this._ensureElement(headRow, "TR")) {
      return this.parseTableRow(headRow, "TH");
    }
    return null;
  }
  parseTableBody(body) {
    const rows = [];
    for (const node of this.result.getChildNodes(body)) {
      if (!this._ensureElement(node, "TR")) {
        continue;
      }
      rows.push(this.parseTableRow(node, "TD"));
    }
    return rows;
  }
  parseTable(node) {
    const children = Array.from(this.result.getChildNodes(node));
    let head, body;
    if (this._ensureElement(children[0], "THEAD") && this._ensureElement(children[1], "TBODY")) {
      head = this.parseTableHead(children[0]);
      body = this.parseTableBody(children[1]);
    } else if (this._ensureElement(children[0], "TBODY")) {
      head = null;
      body = this.parseTableBody(children[0]);
    }
    return new TableBlock(head, body);
  }
  parseInlineElement(node) {
    const result = this.result;
    const tag2 = result.getNodeElementName(node);
    const children = result.getChildNodes(node);
    switch (tag2) {
      case "A": {
        const inlines = this.parseInlineNodes(children);
        return this.parseLink(node, inlines);
      }
      case "BR":
        return new NewLinePart();
      default: {
        if (!basicInline.includes(tag2)) {
          return null;
        }
        const inlines = this.parseInlineNodes(children);
        return new FormatPart(tag2, inlines);
      }
    }
  }
  parseInlineNode(node) {
    if (this.result.isElementNode(node)) {
      return this.parseInlineElement(node);
    }
    return null;
  }
  parseBlockElement(node) {
    const result = this.result;
    const tag2 = result.getNodeElementName(node);
    const children = result.getChildNodes(node);
    switch (tag2) {
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6": {
        const inlines = this.parseInlineNodes(children);
        return new HeaderBlock(parseInt(tag2[1]), inlines);
      }
      case "UL":
      case "OL":
        return this.parseList(node);
      case "PRE":
        return this.parseCodeBlock(node);
      case "HR":
        return new RulePart();
      case "IMG":
        return this.parseImage(node);
      case "P": {
        const inlines = this.parseInlineNodes(children);
        return new FormatPart(tag2, inlines);
      }
      case "TABLE":
        return this.parseTable(node);
      default: {
        if (!basicBlock.includes(tag2)) {
          return null;
        }
        const blocks = this.parseAnyNodes(children);
        return new FormatPart(tag2, blocks);
      }
    }
  }
  parseBlockNode(node) {
    if (this.result.isElementNode(node)) {
      return this.parseBlockElement(node);
    }
    return null;
  }
  _parseTextParts(node, into) {
    if (!this.result.isTextNode(node)) {
      return false;
    }
    const linkifyCallback = (text2, isLink) => {
      if (isLink) {
        into.push(new LinkPart(text2, [new TextPart(text2)]));
      } else {
        into.push(new TextPart(text2));
      }
    };
    linkify(this.result.getNodeText(node), linkifyCallback);
    return true;
  }
  _isAllowedNode(node) {
    return !this._ensureElement(node, "MX-REPLY");
  }
  _parseInlineNodes(nodes, into) {
    for (const htmlNode of nodes) {
      if (this._parseTextParts(htmlNode, into)) {
        continue;
      }
      const node = this.parseInlineNode(htmlNode);
      if (node) {
        into.push(node);
        continue;
      }
      if (this._isAllowedNode(htmlNode)) {
        this._parseInlineNodes(this.result.getChildNodes(htmlNode), into);
      }
    }
  }
  parseInlineNodes(nodes) {
    const into = [];
    this._parseInlineNodes(nodes, into);
    return into;
  }
  _parseAnyNodes(nodes, into) {
    for (const htmlNode of nodes) {
      if (this._parseTextParts(htmlNode, into)) {
        continue;
      }
      const node = this.parseInlineNode(htmlNode) || this.parseBlockNode(htmlNode);
      if (node) {
        into.push(node);
        continue;
      }
      if (this._isAllowedNode(htmlNode)) {
        this._parseAnyNodes(this.result.getChildNodes(htmlNode), into);
      }
    }
  }
  parseAnyNodes(nodes) {
    const into = [];
    this._parseAnyNodes(nodes, into);
    return into;
  }
}
function parseHTMLBody(platform2, mediaRepository, html2) {
  const parseResult = platform2.parseHTML(html2);
  const deserializer = new Deserializer(parseResult, mediaRepository);
  const parts = deserializer.parseAnyNodes(parseResult.rootNodes);
  return new MessageBody(html2, parts);
}
class TextTile extends BaseTextTile {
  _getContentString(key) {
    var _a;
    return ((_a = this._getContent()) == null ? void 0 : _a[key]) || "";
  }
  _getPlainBody() {
    return this._getContentString("body");
  }
  _getFormattedBody() {
    return this._getContentString("formatted_body");
  }
  _getBody() {
    if (this._getBodyFormat() === BodyFormat.Html) {
      return this._getFormattedBody();
    } else {
      return this._getPlainBody();
    }
  }
  _getBodyFormat() {
    var _a;
    if (((_a = this._getContent()) == null ? void 0 : _a.format) === "org.matrix.custom.html") {
      return BodyFormat.Html;
    } else {
      return BodyFormat.Plain;
    }
  }
  _parseBody(body, format) {
    var _a;
    let messageBody;
    if (format === BodyFormat.Html) {
      messageBody = parseHTMLBody(this.platform, this._mediaRepository, body);
    } else {
      messageBody = parsePlainBody(body);
    }
    if (((_a = this._getContent()) == null ? void 0 : _a.msgtype) === "m.emote") {
      messageBody.insertEmote(`* ${this.displayName} `);
    }
    return messageBody;
  }
}
class RedactedTile extends BaseMessageTile {
  get shape() {
    return "redacted";
  }
  get description() {
    const { redactionReason } = this._entry;
    if (this.isRedacting) {
      if (redactionReason) {
        return this.i18n`This message is being deleted (${redactionReason})…`;
      } else {
        return this.i18n`This message is being deleted…`;
      }
    } else {
      if (redactionReason) {
        return this.i18n`This message has been deleted (${redactionReason}).`;
      } else {
        return this.i18n`This message has been deleted.`;
      }
    }
  }
  get isRedacting() {
    return this._entry.isRedacting;
  }
  get canRedact() {
    return false;
  }
  abortPendingRedaction() {
    return this._entry.abortPendingRedaction();
  }
}
const MAX_HEIGHT = 300;
const MAX_WIDTH = 400;
class BaseMediaTile extends BaseMessageTile {
  constructor(entry, options) {
    super(entry, options);
    this._decryptedThumbnail = null;
    this._decryptedFile = null;
    this._isVisible = false;
    this._error = null;
    this._downloading = false;
    this._downloadError = null;
  }
  async downloadMedia() {
    if (this._downloading || this.isPending) {
      return;
    }
    const content = this._getContent();
    const filename = content.body;
    this._downloading = true;
    this.emitChange("status");
    let blob;
    try {
      blob = await this._mediaRepository.downloadAttachment(content);
      this.platform.saveFileAs(blob, filename);
    } catch (err) {
      this._downloadError = err;
    } finally {
      blob == null ? void 0 : blob.dispose();
      this._downloading = false;
    }
    this.emitChange("status");
  }
  get isUploading() {
    return this.isPending && this._entry.pendingEvent.status === SendStatus.UploadingAttachments;
  }
  get uploadPercentage() {
    const { pendingEvent } = this._entry;
    return pendingEvent && Math.round(pendingEvent.attachmentsSentBytes / pendingEvent.attachmentsTotalBytes * 100);
  }
  get status() {
    const { pendingEvent } = this._entry;
    switch (pendingEvent == null ? void 0 : pendingEvent.status) {
      case SendStatus.Waiting:
        return this.i18n`Waiting…`;
      case SendStatus.EncryptingAttachments:
      case SendStatus.Encrypting:
        return this.i18n`Encrypting…`;
      case SendStatus.UploadingAttachments:
        return this.i18n`Uploading…`;
      case SendStatus.Sending:
        return this.i18n`Sending…`;
      case SendStatus.Error:
        return this.i18n`Error: ${pendingEvent.error.message}`;
      default:
        if (this._downloadError) {
          return `Download failed`;
        }
        if (this._downloading) {
          return this.i18n`Downloading…`;
        }
        return "";
    }
  }
  get thumbnailUrl() {
    var _a, _b;
    if (!this._isVisible) {
      return "";
    }
    if (this._decryptedThumbnail) {
      return this._decryptedThumbnail.url;
    } else {
      const thumbnailMxc = (_a = this._getContent().info) == null ? void 0 : _a.thumbnail_url;
      if (thumbnailMxc) {
        return this._mediaRepository.mxcUrlThumbnail(thumbnailMxc, this.width, this.height, "scale");
      }
    }
    if (this._entry.isPending) {
      const attachment = this._entry.pendingEvent.getAttachment("info.thumbnail_url");
      return attachment && attachment.localPreview.url;
    }
    if (this._isMainResourceImage()) {
      if (this._decryptedFile) {
        return this._decryptedFile.url;
      } else {
        const mxcUrl = (_b = this._getContent()) == null ? void 0 : _b.url;
        if (typeof mxcUrl === "string") {
          return this._mediaRepository.mxcUrlThumbnail(mxcUrl, this.width, this.height, "scale");
        }
      }
    }
    return "";
  }
  notifyVisible() {
    super.notifyVisible();
    this._isVisible = true;
    this.emitChange("thumbnailUrl");
    if (!this.isPending) {
      this._tryLoadEncryptedThumbnail();
    }
  }
  get width() {
    var _a;
    const info = (_a = this._getContent()) == null ? void 0 : _a.info;
    return Math.round((info == null ? void 0 : info.w) * this._scaleFactor());
  }
  get height() {
    var _a;
    const info = (_a = this._getContent()) == null ? void 0 : _a.info;
    return Math.round((info == null ? void 0 : info.h) * this._scaleFactor());
  }
  get mimeType() {
    var _a;
    const info = (_a = this._getContent()) == null ? void 0 : _a.info;
    return info == null ? void 0 : info.mimetype;
  }
  get label() {
    return this._getContent().body;
  }
  get error() {
    if (this._error) {
      return `Could not load media: ${this._error.message}`;
    }
    return null;
  }
  setViewError(err) {
    this._error = err;
    this.emitChange("error");
  }
  async _loadEncryptedFile(file) {
    const blob = await this._mediaRepository.downloadEncryptedFile(file, true);
    if (this.isDisposed) {
      blob.dispose();
      return;
    }
    return this.track(blob);
  }
  async _tryLoadEncryptedThumbnail() {
    var _a;
    try {
      const thumbnailFile = (_a = this._getContent().info) == null ? void 0 : _a.thumbnail_file;
      const file = this._getContent().file;
      if (thumbnailFile) {
        this._decryptedThumbnail = await this._loadEncryptedFile(thumbnailFile);
        this.emitChange("thumbnailUrl");
      } else if (file && this._isMainResourceImage()) {
        this._decryptedFile = await this._loadEncryptedFile(file);
        this.emitChange("thumbnailUrl");
      }
    } catch (err) {
      this._error = err;
      this.emitChange("error");
    }
  }
  _scaleFactor() {
    var _a;
    const info = (_a = this._getContent()) == null ? void 0 : _a.info;
    const scaleHeightFactor = MAX_HEIGHT / (info == null ? void 0 : info.h);
    const scaleWidthFactor = MAX_WIDTH / (info == null ? void 0 : info.w);
    return Math.min(scaleWidthFactor, scaleHeightFactor, 1);
  }
  _isMainResourceImage() {
    return true;
  }
}
class ImageTile extends BaseMediaTile {
  constructor(entry, options) {
    super(entry, options);
    this._lightboxUrl = this.urlCreator.urlForSegments([
      this.navigation.segment("room", this._room.id),
      this.navigation.segment("lightbox", this._entry.id)
    ]);
  }
  get lightboxUrl() {
    if (!this.isPending) {
      return this._lightboxUrl;
    }
    return "";
  }
  get shape() {
    return "image";
  }
}
class VideoTile extends BaseMediaTile {
  async loadVideo() {
    const file = this._getContent().file;
    if (file && !this._decryptedFile) {
      this._decryptedFile = await this._loadEncryptedFile(file);
      this.emitChange("videoUrl");
    }
  }
  get videoUrl() {
    var _a;
    if (this._decryptedFile) {
      return this._decryptedFile.url;
    }
    const mxcUrl = (_a = this._getContent()) == null ? void 0 : _a.url;
    if (typeof mxcUrl === "string") {
      return this._mediaRepository.mxcUrl(mxcUrl);
    }
    return "";
  }
  get shape() {
    return "video";
  }
  _isMainResourceImage() {
    return false;
  }
}
function formatSize(size, decimals = 2) {
  if (Number.isSafeInteger(size)) {
    const base2 = Math.min(3, Math.floor(Math.log(size) / Math.log(1024)));
    const formattedSize = Math.round(size / Math.pow(1024, base2)).toFixed(decimals);
    switch (base2) {
      case 0:
        return `${formattedSize} bytes`;
      case 1:
        return `${formattedSize} KB`;
      case 2:
        return `${formattedSize} MB`;
      case 3:
        return `${formattedSize} GB`;
    }
  }
  return "";
}
class FileTile extends BaseMessageTile {
  constructor(entry, options) {
    super(entry, options);
    this._downloadError = null;
    this._downloading = false;
  }
  async download() {
    if (this._downloading || this.isPending) {
      return;
    }
    const content = this._getContent();
    const filename = content.body;
    this._downloading = true;
    this.emitChange("label");
    let blob;
    try {
      blob = await this._mediaRepository.downloadAttachment(content);
      this.platform.saveFileAs(blob, filename);
    } catch (err) {
      this._downloadError = err;
    } finally {
      blob == null ? void 0 : blob.dispose();
      this._downloading = false;
    }
    this.emitChange("label");
  }
  get label() {
    var _a;
    if (this._downloadError) {
      return `Could not download file: ${this._downloadError.message}`;
    }
    const content = this._getContent();
    const filename = content.body;
    if (this._entry.isPending) {
      const { pendingEvent } = this._entry;
      switch (pendingEvent == null ? void 0 : pendingEvent.status) {
        case SendStatus.Waiting:
          return this.i18n`Waiting to send ${filename}…`;
        case SendStatus.EncryptingAttachments:
        case SendStatus.Encrypting:
          return this.i18n`Encrypting ${filename}…`;
        case SendStatus.UploadingAttachments: {
          const percent = Math.round(pendingEvent.attachmentsSentBytes / pendingEvent.attachmentsTotalBytes * 100);
          return this.i18n`Uploading ${filename}: ${percent}%`;
        }
        case SendStatus.Sending:
        case SendStatus.Sent:
          return this.i18n`Sending ${filename}…`;
        case SendStatus.Error:
          return this.i18n`Error: could not send ${filename}: ${pendingEvent.error.message}`;
        default:
          return `Unknown send status for ${filename}`;
      }
    } else {
      const size = formatSize((_a = this._getContent().info) == null ? void 0 : _a.size);
      if (this._downloading) {
        return this.i18n`Downloading ${filename} (${size})…`;
      } else {
        return this.i18n`Download ${filename} (${size})`;
      }
    }
  }
  get shape() {
    return "file";
  }
}
class LocationTile extends BaseMessageTile {
  get shape() {
    return "location";
  }
  get mapsLink() {
    try {
      const url = new URL(this._getContent().geo_uri);
      if (url.protocol !== "geo:") {
        return "";
      }
      const [locationStr, ...namedParams] = url.pathname.split(";");
      const [latStr, longStr] = locationStr.split(",");
      const lat = parseFloat(latStr);
      const long = parseFloat(longStr);
      let uncertainty;
      for (const namedParam of namedParams) {
        const [name, value] = namedParam.split("=");
        if (name === "u") {
          uncertainty = parseFloat(value);
        }
      }
      if (this.platform.isIOS) {
        return `http://maps.apple.com/?ll=${lat},${long}`;
      } else {
        let uri = `geo:${lat},${long}`;
        if (uncertainty) {
          uri = uri + `;u=${uncertainty}`;
        }
        return uri;
      }
    } catch {
      return "";
    }
  }
  get label() {
    return this.i18n`${this.displayName} sent their location`;
  }
}
class RoomNameTile extends SimpleTile {
  get shape() {
    return "announcement";
  }
  get announcement() {
    const content = this._entry.content;
    return `${this._entry.displayName || this._entry.sender} named the room "${content == null ? void 0 : content.name}"`;
  }
}
class RoomMemberTile extends SimpleTile {
  get shape() {
    return "announcement";
  }
  get announcement() {
    var _a, _b;
    const { sender, content, prevContent, stateKey } = this._entry;
    const senderName = this._entry.displayName || sender;
    const targetName = sender === stateKey ? senderName : ((_a = this._entry.content) == null ? void 0 : _a.displayname) || stateKey;
    const membership = content && content.membership;
    const prevMembership = prevContent && prevContent.membership;
    if (prevMembership === "join" && membership === "join") {
      if (content.avatar_url !== prevContent.avatar_url) {
        return `${senderName} changed their avatar`;
      } else if (content.displayname !== prevContent.displayname) {
        if (!content.displayname) {
          return `${stateKey} removed their name (${prevContent.displayname})`;
        }
        return `${(_b = prevContent.displayname) != null ? _b : stateKey} changed their name to ${content.displayname}`;
      }
    } else if (membership === "join") {
      return `${targetName} joined the room`;
    } else if (membership === "invite") {
      return `${targetName} was invited to the room by ${senderName}`;
    } else if (prevMembership === "invite") {
      if (membership === "join") {
        return `${targetName} accepted the invitation to join the room`;
      } else if (membership === "leave") {
        return `${targetName} declined the invitation to join the room`;
      }
    } else if (membership === "leave") {
      if (stateKey === sender) {
        return `${targetName} left the room`;
      } else {
        const reason = content.reason;
        return `${targetName} was kicked from the room by ${senderName}${reason ? `: ${reason}` : ""}`;
      }
    } else if (membership === "ban") {
      return `${targetName} was banned from the room by ${senderName}`;
    }
    return `${sender} membership changed to ${content.membership}`;
  }
}
class EncryptedEventTile extends BaseTextTile {
  updateEntry(entry, params) {
    const parentResult = super.updateEntry(entry, params);
    if (entry.eventType !== "m.room.encrypted") {
      return UpdateAction.Replace("shape");
    } else {
      return parentResult;
    }
  }
  get shape() {
    return "message-status";
  }
  _getBody() {
    const decryptionError = this._entry.decryptionError;
    const code = decryptionError == null ? void 0 : decryptionError.code;
    let string;
    if (code === "MEGOLM_NO_SESSION") {
      string = this.i18n`The sender hasn't sent us the key for this message yet.`;
    } else {
      string = (decryptionError == null ? void 0 : decryptionError.message) || this.i18n`Could not decrypt message because of unknown reason.`;
    }
    return string;
  }
}
class EncryptionEnabledTile extends SimpleTile {
  get shape() {
    return "announcement";
  }
  get announcement() {
    const senderName = this._entry.displayName || this._entry.sender;
    return this.i18n`${senderName} has enabled end-to-end encryption`;
  }
}
class MissingAttachmentTile extends BaseMessageTile {
  get shape() {
    return "missing-attachment";
  }
  get label() {
    const name = this._getContent().body;
    const msgtype = this._getContent().msgtype;
    if (msgtype === "m.image") {
      return this.i18n`The image ${name} wasn't fully sent previously and could not be recovered.`;
    } else {
      return this.i18n`The file ${name} wasn't fully sent previously and could not be recovered.`;
    }
  }
}
function tileClassForEntry(entry) {
  if (entry.isGap) {
    return GapTile;
  } else if (entry.isPending && entry.pendingEvent.isMissingAttachments) {
    return MissingAttachmentTile;
  } else if (entry.eventType) {
    switch (entry.eventType) {
      case "m.room.message": {
        if (entry.isRedacted) {
          return RedactedTile;
        }
        const content = entry.content;
        const msgtype = content && content.msgtype;
        switch (msgtype) {
          case "m.text":
          case "m.notice":
          case "m.emote":
            return TextTile;
          case "m.image":
            return ImageTile;
          case "m.video":
            return VideoTile;
          case "m.file":
            return FileTile;
          case "m.location":
            return LocationTile;
          default:
            return void 0;
        }
      }
      case "m.room.name":
        return RoomNameTile;
      case "m.room.member":
        return RoomMemberTile;
      case "m.room.encrypted":
        if (entry.isRedacted) {
          return RedactedTile;
        }
        return EncryptedEventTile;
      case "m.room.encryption":
        return EncryptionEnabledTile;
      default:
        return void 0;
    }
  }
}
async function joinRoom(roomId, session) {
  var _a, _b, _c2, _d2;
  try {
    const internalRoomId = await session.joinRoom(roomId);
    const roomStatusObservable = await session.observeRoomStatus(internalRoomId);
    await roomStatusObservable.waitFor((status) => status === RoomStatus.Joined);
    return internalRoomId;
  } catch (e) {
    if (((_a = e.statusCode) != null ? _a : e.status) === 400) {
      throw new Error(`'${roomId}' is not a legal room ID or alias`);
    } else if (((_b = e.statusCode) != null ? _b : e.status) === 404 || ((_c2 = e.statusCode) != null ? _c2 : e.status) === 502 || e.message == "Internal Server eor") {
      throw new Error(`Room '${roomId}' could not be found`);
    } else if (((_d2 = e.statusCode) != null ? _d2 : e.status) === 403) {
      throw new Error(`You are not invited to join '${roomId}'`);
    } else {
      throw e;
    }
  }
}
class RoomViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { room, tileClassForEntry: tileClassForEntry$1 } = options;
    this._room = room;
    this._timelineVM = null;
    this._tileClassForEntry = tileClassForEntry$1 != null ? tileClassForEntry$1 : tileClassForEntry;
    this._tileOptions = void 0;
    this._onRoomChange = this._onRoomChange.bind(this);
    this._timelineError = null;
    this._sendError = null;
    this._composerVM = null;
    if (room.isArchived) {
      this._composerVM = this.track(new ArchivedViewModel(this.childOptions({ archivedRoom: room })));
    } else {
      this._recreateComposerOnPowerLevelChange();
    }
    this._clearUnreadTimout = null;
    this._closeUrl = this.urlCreator.urlUntilSegment("session");
  }
  async load() {
    this._room.on("change", this._onRoomChange);
    try {
      const timeline = await this._room.openTimeline();
      this._tileOptions = this.childOptions({
        roomVM: this,
        timeline,
        tileClassForEntry: this._tileClassForEntry
      });
      this._timelineVM = this.track(new TimelineViewModel(this.childOptions({
        tileOptions: this._tileOptions,
        timeline
      })));
      this.emitChange("timelineViewModel");
    } catch (err) {
      console.error(`room.openTimeline(): ${err.message}:
${err.stack}`);
      this._timelineError = err;
      this.emitChange("error");
    }
    this._clearUnreadAfterDelay();
  }
  async _recreateComposerOnPowerLevelChange() {
    const powerLevelObservable = await this._room.observePowerLevels();
    const canSendMessage = () => powerLevelObservable.get().canSendType("m.room.message");
    let oldCanSendMessage = canSendMessage();
    const recreateComposer = (newCanSendMessage) => {
      this._composerVM = this.disposeTracked(this._composerVM);
      if (newCanSendMessage) {
        this._composerVM = this.track(new ComposerViewModel(this));
      } else {
        this._composerVM = this.track(new LowerPowerLevelViewModel(this.childOptions()));
      }
      this.emitChange("powerLevelObservable");
    };
    this.track(powerLevelObservable.subscribe(() => {
      const newCanSendMessage = canSendMessage();
      if (oldCanSendMessage !== newCanSendMessage) {
        recreateComposer(newCanSendMessage);
        oldCanSendMessage = newCanSendMessage;
      }
    }));
    recreateComposer(oldCanSendMessage);
  }
  async _clearUnreadAfterDelay() {
    if (this._room.isArchived || this._clearUnreadTimout) {
      return;
    }
    this._clearUnreadTimout = this.clock.createTimeout(2e3);
    try {
      await this._clearUnreadTimout.elapsed();
      await this._room.clearUnread();
      this._clearUnreadTimout = null;
    } catch (err) {
      if (err.name !== "AbortError") {
        throw err;
      }
    }
  }
  focus() {
    this._clearUnreadAfterDelay();
  }
  dispose() {
    super.dispose();
    this._room.off("change", this._onRoomChange);
    if (this._room.isArchived) {
      this._room.release();
    }
    if (this._clearUnreadTimout) {
      this._clearUnreadTimout.abort();
      this._clearUnreadTimout = null;
    }
  }
  _onRoomChange() {
    var _a;
    (_a = this._composerVM) == null ? void 0 : _a.emitChange();
    this.emitChange();
  }
  get kind() {
    return "room";
  }
  get closeUrl() {
    return this._closeUrl;
  }
  get name() {
    return this._room.name || this.i18n`Empty Room`;
  }
  get id() {
    return this._room.id;
  }
  get timelineViewModel() {
    return this._timelineVM;
  }
  get isEncrypted() {
    return this._room.isEncrypted;
  }
  get error() {
    if (this._timelineError) {
      return `Something went wrong loading the timeline: ${this._timelineError.message}`;
    }
    if (this._sendError) {
      return `Something went wrong sending your message: ${this._sendError.message}`;
    }
    return "";
  }
  get avatarLetter() {
    return avatarInitials(this.name);
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this._room.avatarColorId);
  }
  avatarUrl(size) {
    return getAvatarHttpUrl(this._room.avatarUrl, size, this.platform, this._room.mediaRepository);
  }
  get avatarTitle() {
    return this.name;
  }
  get canLeave() {
    return this._room.isJoined;
  }
  leaveRoom() {
    this._room.leave();
  }
  get canForget() {
    return this._room.isArchived;
  }
  forgetRoom() {
    this._room.forget();
  }
  get canRejoin() {
    return this._room.isArchived;
  }
  rejoinRoom() {
    this._room.join();
  }
  _createTile(entry) {
    if (this._tileOptions) {
      const Tile = this._tileOptions.tileClassForEntry(entry);
      if (Tile) {
        return new Tile(entry, this._tileOptions);
      }
    }
  }
  async _processCommandJoin(roomName) {
    try {
      const session = this._options.client.session;
      const roomId = await joinRoom(roomName, session);
      this.navigation.push("room", roomId);
    } catch (err) {
      this._sendError = err;
      this._timelineError = null;
      this.emitChange("error");
    }
  }
  async _processCommand(message) {
    let msgtype;
    const [commandName, ...args] = message.substring(1).split(" ");
    switch (commandName) {
      case "me":
        message = args.join(" ");
        msgtype = "m.emote";
        break;
      case "join":
        if (args.length === 1) {
          const roomName = args[0];
          await this._processCommandJoin(roomName);
        } else {
          this._sendError = new Error("join syntax: /join <room-id>");
          this._timelineError = null;
          this.emitChange("error");
        }
        break;
      case "shrug":
        message = "\xAF\\_(\u30C4)_/\xAF " + args.join(" ");
        msgtype = "m.text";
        break;
      case "tableflip":
        message = "(\u256F\xB0\u25A1\xB0\uFF09\u256F\uFE35 \u253B\u2501\u253B " + args.join(" ");
        msgtype = "m.text";
        break;
      case "unflip":
        message = "\u252C\u2500\u2500\u252C \u30CE( \u309C-\u309C\u30CE) " + args.join(" ");
        msgtype = "m.text";
        break;
      case "lenny":
        message = "( \u0361\xB0 \u035C\u0296 \u0361\xB0) " + args.join(" ");
        msgtype = "m.text";
        break;
      default:
        this._sendError = new Error(`no command name "${commandName}". To send the message instead of executing, please type "/${message}"`);
        this._timelineError = null;
        this.emitChange("error");
        message = void 0;
    }
    return { type: msgtype, message };
  }
  async _sendMessage(message, replyingTo) {
    if (!this._room.isArchived && message) {
      let messinfo = { type: "m.text", message };
      if (message.startsWith("//")) {
        messinfo.message = message.substring(1).trim();
      } else if (message.startsWith("/")) {
        messinfo = await this._processCommand(message);
      }
      try {
        const msgtype = messinfo.type;
        const message2 = messinfo.message;
        if (msgtype && message2) {
          if (replyingTo) {
            await replyingTo.reply(msgtype, message2);
          } else {
            await this._room.sendEvent("m.room.message", { msgtype, body: message2 });
          }
        }
      } catch (err) {
        console.error(`room.sendMessage(): ${err.message}:
${err.stack}`);
        this._sendError = err;
        this._timelineError = null;
        this.emitChange("error");
        return false;
      }
      return true;
    }
    return false;
  }
  async _pickAndSendFile() {
    try {
      const file = await this.platform.openFile();
      if (!file) {
        return;
      }
      return this._sendFile(file);
    } catch (err) {
      console.error(err);
    }
  }
  async _sendFile(file) {
    const content = {
      body: file.name,
      msgtype: "m.file"
    };
    await this._room.sendEvent("m.room.message", content, {
      "url": this._room.createAttachment(file.blob, file.name)
    });
  }
  async _pickAndSendVideo() {
    try {
      if (!this.platform.hasReadPixelPermission()) {
        alert("Please allow canvas image data access, so we can scale your images down.");
        return;
      }
      const file = await this.platform.openFile("video/*");
      if (!file) {
        return;
      }
      if (!file.blob.mimeType.startsWith("video/")) {
        return this._sendFile(file);
      }
      let video;
      try {
        video = await this.platform.loadVideo(file.blob);
      } catch (err) {
        if (err instanceof window.MediaError && err.code === 4) {
          throw new Error(`this browser does not support videos of type ${file == null ? void 0 : file.blob.mimeType}.`);
        } else {
          throw err;
        }
      }
      const content = {
        body: file.name,
        msgtype: "m.video",
        info: videoToInfo(video)
      };
      const attachments = {
        "url": this._room.createAttachment(video.blob, file.name)
      };
      const limit = await this.platform.settingsStorage.getInt("sentImageSizeLimit");
      const maxDimension = limit || Math.min(video.maxDimension, 800);
      const thumbnail = await video.scale(maxDimension);
      content.info.thumbnail_info = imageToInfo(thumbnail);
      attachments["info.thumbnail_url"] = this._room.createAttachment(thumbnail.blob, file.name);
      await this._room.sendEvent("m.room.message", content, attachments);
    } catch (err) {
      this._sendError = err;
      this.emitChange("error");
      console.error(err.stack);
    }
  }
  async _pickAndSendPicture() {
    try {
      if (!this.platform.hasReadPixelPermission()) {
        alert("Please allow canvas image data access, so we can scale your images down.");
        return;
      }
      const file = await this.platform.openFile("image/*");
      if (!file) {
        return;
      }
      if (!file.blob.mimeType.startsWith("image/")) {
        return this._sendFile(file);
      }
      let image = await this.platform.loadImage(file.blob);
      const limit = await this.platform.settingsStorage.getInt("sentImageSizeLimit");
      if (limit && image.maxDimension > limit) {
        const scaledImage = await image.scale(limit);
        image.dispose();
        image = scaledImage;
      }
      const content = {
        body: file.name,
        msgtype: "m.image",
        info: imageToInfo(image)
      };
      const attachments = {
        "url": this._room.createAttachment(image.blob, file.name)
      };
      if (image.maxDimension > 600) {
        const thumbnail = await image.scale(400);
        content.info.thumbnail_info = imageToInfo(thumbnail);
        attachments["info.thumbnail_url"] = this._room.createAttachment(thumbnail.blob, file.name);
      }
      await this._room.sendEvent("m.room.message", content, attachments);
    } catch (err) {
      this._sendError = err;
      this.emitChange("error");
      console.error(err.stack);
    }
  }
  get room() {
    return this._room;
  }
  get composerViewModel() {
    return this._composerVM;
  }
  openDetailsPanel() {
    let path = this.navigation.path.until("room");
    path = path.with(this.navigation.segment("right-panel", true));
    path = path.with(this.navigation.segment("details", true));
    this.navigation.applyPath(path);
  }
  startReply(entry) {
    if (!this._room.isArchived) {
      this._composerVM.setReplyingTo(entry);
    }
  }
  dismissError() {
    this._sendError = null;
    this.emitChange("error");
  }
}
function videoToInfo(video) {
  const info = imageToInfo(video);
  info.duration = video.duration;
  return info;
}
class ArchivedViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._archivedRoom = options.archivedRoom;
  }
  get description() {
    if (this._archivedRoom.isKicked) {
      if (this._archivedRoom.kickReason) {
        return this.i18n`You were kicked from the room by ${this._archivedRoom.kickedBy.name} because: ${this._archivedRoom.kickReason}`;
      } else {
        return this.i18n`You were kicked from the room by ${this._archivedRoom.kickedBy.name}.`;
      }
    } else if (this._archivedRoom.isBanned) {
      if (this._archivedRoom.kickReason) {
        return this.i18n`You were banned from the room by ${this._archivedRoom.kickedBy.name} because: ${this._archivedRoom.kickReason}`;
      } else {
        return this.i18n`You were banned from the room by ${this._archivedRoom.kickedBy.name}.`;
      }
    } else {
      return this.i18n`You left this room`;
    }
  }
  get kind() {
    return "disabled";
  }
}
class LowerPowerLevelViewModel extends ViewModel {
  get description() {
    return this.i18n`You do not have the powerlevel necessary to send messages`;
  }
  get kind() {
    return "disabled";
  }
}
class UnknownRoomViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { roomIdOrAlias, session } = options;
    this._session = session;
    this.roomIdOrAlias = roomIdOrAlias;
    this._error = null;
    this._busy = false;
  }
  get error() {
    var _a;
    return (_a = this._error) == null ? void 0 : _a.message;
  }
  async join() {
    this._busy = true;
    this.emitChange("busy");
    try {
      const roomId = await this._session.joinRoom(this.roomIdOrAlias);
      this.navigation.push("room", roomId);
    } catch (err) {
      this._error = err;
      this._busy = false;
      this.emitChange("error");
    }
  }
  get busy() {
    return this._busy;
  }
  get kind() {
    return "unknown";
  }
}
class InviteViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { invite, mediaRepository } = options;
    this._invite = invite;
    this._mediaRepository = mediaRepository;
    this._onInviteChange = this._onInviteChange.bind(this);
    this._error = null;
    this._closeUrl = this.urlCreator.urlUntilSegment("session");
    this._invite.on("change", this._onInviteChange);
    this._inviter = null;
    if (this._invite.inviter) {
      this._inviter = new RoomMemberViewModel(this._invite.inviter, mediaRepository, this.platform);
    }
    this._roomDescription = this._createRoomDescription();
  }
  get kind() {
    return "invite";
  }
  get closeUrl() {
    return this._closeUrl;
  }
  get name() {
    return this._invite.name;
  }
  get id() {
    return this._invite.id;
  }
  get isEncrypted() {
    return this._invite.isEncrypted;
  }
  get isDirectMessage() {
    return this._invite.isDirectMessage;
  }
  get inviter() {
    return this._inviter;
  }
  get busy() {
    return this._invite.accepting || this._invite.rejecting;
  }
  get error() {
    if (this._error) {
      return `Something went wrong: ${this._error.message}`;
    }
    return "";
  }
  get avatarLetter() {
    return avatarInitials(this.name);
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this._invite.avatarColorId);
  }
  avatarUrl(size) {
    return getAvatarHttpUrl(this._invite.avatarUrl, size, this.platform, this._mediaRepository);
  }
  _createRoomDescription() {
    const parts = [];
    if (this._invite.isPublic) {
      parts.push("Public room");
    } else {
      parts.push("Private room");
    }
    if (this._invite.canonicalAlias) {
      parts.push(this._invite.canonicalAlias);
    }
    return parts.join(" \u2022 ");
  }
  get roomDescription() {
    return this._roomDescription;
  }
  get avatarTitle() {
    return this.name;
  }
  focus() {
  }
  async accept() {
    try {
      await this._invite.accept();
    } catch (err) {
      this._error = err;
      this.emitChange("error");
    }
  }
  async reject() {
    try {
      await this._invite.reject();
    } catch (err) {
      this._error = err;
      this.emitChange("error");
    }
  }
  _onInviteChange() {
    this.emitChange();
  }
  dispose() {
    super.dispose();
    this._invite.off("change", this._onInviteChange);
  }
}
class RoomMemberViewModel {
  constructor(member, mediaRepository, platform2) {
    this._member = member;
    this._mediaRepository = mediaRepository;
    this._platform = platform2;
  }
  get id() {
    return this._member.userId;
  }
  get name() {
    return this._member.name;
  }
  get avatarLetter() {
    return avatarInitials(this.name);
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this._member.userId);
  }
  avatarUrl(size) {
    return getAvatarHttpUrl(this._member.avatarUrl, size, this._platform, this._mediaRepository);
  }
  get avatarTitle() {
    return this.name;
  }
}
class RoomBeingCreatedViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { roomBeingCreated, mediaRepository } = options;
    this._roomBeingCreated = roomBeingCreated;
    this._mediaRepository = mediaRepository;
    this._onRoomChange = this._onRoomChange.bind(this);
    this._closeUrl = this.urlCreator.urlUntilSegment("session");
    this._roomBeingCreated.on("change", this._onRoomChange);
  }
  get kind() {
    return "roomBeingCreated";
  }
  get closeUrl() {
    return this._closeUrl;
  }
  get name() {
    return this._roomBeingCreated.name;
  }
  get id() {
    return this._roomBeingCreated.id;
  }
  get isEncrypted() {
    return this._roomBeingCreated.isEncrypted;
  }
  get error() {
    const { error } = this._roomBeingCreated;
    if (error) {
      if (error.name === "ConnectionError") {
        return this.i18n`You seem to be offline`;
      } else {
        return error.message;
      }
    }
    return "";
  }
  get avatarLetter() {
    return avatarInitials(this.name);
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this._roomBeingCreated.avatarColorId);
  }
  get avatarTitle() {
    return this.name;
  }
  avatarUrl(size) {
    var _a;
    return (_a = this._roomBeingCreated.avatarBlobUrl) != null ? _a : getAvatarHttpUrl(this._roomBeingCreated.avatarUrl, size, this.platform, this._mediaRepository);
  }
  focus() {
  }
  _onRoomChange() {
    this.emitChange();
  }
  cancel() {
    this._roomBeingCreated.cancel();
    this.navigation.applyPath(this.navigation.path.until("session"));
  }
  dispose() {
    super.dispose();
    this._roomBeingCreated.off("change", this._onRoomChange);
  }
}
class LightboxViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._eventId = options.eventId;
    this._unencryptedImageUrl = null;
    this._decryptedImage = null;
    this._closeUrl = this.urlCreator.urlUntilSegment("room");
    this._eventEntry = null;
    this._date = null;
    this._subscribeToEvent(options.room, options.eventId);
  }
  _subscribeToEvent(room, eventId) {
    const eventObservable = room.observeEvent(eventId);
    this.track(eventObservable.subscribe((eventEntry) => {
      this._loadEvent(room, eventEntry);
    }));
    this._loadEvent(room, eventObservable.get());
  }
  async _loadEvent(room, eventEntry) {
    if (!eventEntry) {
      return;
    }
    const { mediaRepository } = room;
    this._eventEntry = eventEntry;
    const { content } = this._eventEntry;
    this._date = this._eventEntry.timestamp ? new Date(this._eventEntry.timestamp) : null;
    if (content.url) {
      this._unencryptedImageUrl = mediaRepository.mxcUrl(content.url);
      this.emitChange("imageUrl");
    } else if (content.file) {
      this._decryptedImage = this.track(await mediaRepository.downloadEncryptedFile(content.file));
      this.emitChange("imageUrl");
    }
  }
  get imageWidth() {
    var _a, _b, _c2;
    return (_c2 = (_b = (_a = this._eventEntry) == null ? void 0 : _a.content) == null ? void 0 : _b.info) == null ? void 0 : _c2.w;
  }
  get imageHeight() {
    var _a, _b, _c2;
    return (_c2 = (_b = (_a = this._eventEntry) == null ? void 0 : _a.content) == null ? void 0 : _b.info) == null ? void 0 : _c2.h;
  }
  get name() {
    var _a, _b;
    return (_b = (_a = this._eventEntry) == null ? void 0 : _a.content) == null ? void 0 : _b.body;
  }
  get sender() {
    var _a;
    return (_a = this._eventEntry) == null ? void 0 : _a.displayName;
  }
  get imageUrl() {
    if (this._decryptedImage) {
      return this._decryptedImage.url;
    } else if (this._unencryptedImageUrl) {
      return this._unencryptedImageUrl;
    } else {
      return "";
    }
  }
  get date() {
    return this._date && this._date.toLocaleDateString({}, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  get time() {
    return this._date && this._date.toLocaleTimeString({}, { hour: "numeric", minute: "2-digit" });
  }
  get closeUrl() {
    return this._closeUrl;
  }
  close() {
    this.platform.history.pushUrl(this.closeUrl);
  }
}
const SessionStatus = createEnum("Disconnected", "Connecting", "FirstSync", "Sending", "Syncing", "SyncError");
class SessionStatusViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { sync, reconnector, session } = options;
    this._sync = sync;
    this._reconnector = reconnector;
    this._status = this._calculateState(reconnector.connectionStatus.get(), sync.status.get());
    this._session = session;
    this._setupKeyBackupUrl = this.urlCreator.urlForSegment("settings");
    this._dismissSecretStorage = false;
  }
  start() {
    const update = () => this._updateStatus();
    this.track(this._sync.status.subscribe(update));
    this.track(this._reconnector.connectionStatus.subscribe(update));
    this.track(this._session.needsKeyBackup.subscribe(() => {
      this.emitChange();
    }));
  }
  get setupKeyBackupUrl() {
    return this._setupKeyBackupUrl;
  }
  get isShown() {
    return this._session.needsKeyBackup.get() && !this._dismissSecretStorage || this._status !== SessionStatus.Syncing;
  }
  get statusLabel() {
    switch (this._status) {
      case SessionStatus.Disconnected: {
        const retryIn = Math.round(this._reconnector.retryIn / 1e3);
        return this.i18n`Disconnected, trying to reconnect in ${retryIn}s…`;
      }
      case SessionStatus.Connecting:
        return this.i18n`Trying to reconnect now…`;
      case SessionStatus.FirstSync:
        return this.i18n`Catching up with your conversations…`;
      case SessionStatus.SyncError:
        return this.i18n`Sync failed because of ${this._sync.error}`;
    }
    if (this._session.needsKeyBackup.get()) {
      return this.i18n`Set up session backup to decrypt older messages.`;
    }
    return "";
  }
  get isWaiting() {
    switch (this._status) {
      case SessionStatus.Connecting:
      case SessionStatus.FirstSync:
        return true;
      default:
        return false;
    }
  }
  _updateStatus() {
    const newStatus = this._calculateState(this._reconnector.connectionStatus.get(), this._sync.status.get());
    if (newStatus !== this._status) {
      if (newStatus === SessionStatus.Disconnected) {
        this._retryTimer = this.track(this.clock.createInterval(() => {
          this.emitChange("statusLabel");
        }, 1e3));
      } else {
        this._retryTimer = this.disposeTracked(this._retryTimer);
      }
      this._status = newStatus;
      this.emitChange();
    }
  }
  _calculateState(connectionStatus, syncStatus) {
    if (connectionStatus !== ConnectionStatus.Online) {
      switch (connectionStatus) {
        case ConnectionStatus.Reconnecting:
          return SessionStatus.Connecting;
        case ConnectionStatus.Waiting:
          return SessionStatus.Disconnected;
      }
    } else if (syncStatus !== SyncStatus.Syncing) {
      switch (syncStatus) {
        case SyncStatus.InitialSync:
        case SyncStatus.CatchupSync:
          return SessionStatus.FirstSync;
        case SyncStatus.Stopped:
          return SessionStatus.SyncError;
      }
    } else {
      return SessionStatus.Syncing;
    }
  }
  get isConnectNowShown() {
    return this._status === SessionStatus.Disconnected;
  }
  get isSecretStorageShown() {
    return this._status === SessionStatus.Syncing && this._session.needsKeyBackup.get() && !this._dismissSecretStorage;
  }
  get canDismiss() {
    return this.isSecretStorageShown;
  }
  dismiss() {
    if (this.isSecretStorageShown) {
      this._dismissSecretStorage = true;
      this.emitChange();
    }
  }
  connectNow() {
    if (this.isConnectNowShown) {
      this._reconnector.tryNow();
    }
  }
}
function dedupeSparse(roomIds) {
  return roomIds.map((id, idx) => {
    if (roomIds.slice(0, idx).includes(id)) {
      return void 0;
    } else {
      return id;
    }
  });
}
class RoomGridViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._width = options.width;
    this._height = options.height;
    this._createRoomViewModelObservable = options.createRoomViewModelObservable;
    this._selectedIndex = 0;
    this._viewModelsObservables = [];
    this._setupNavigation();
  }
  _setupNavigation() {
    const focusTileIndex = this.navigation.observe("empty-grid-tile");
    this.track(focusTileIndex.subscribe((index) => {
      if (typeof index === "number") {
        this._setFocusIndex(index);
      }
    }));
    if (typeof focusTileIndex.get() === "number") {
      this._selectedIndex = focusTileIndex.get();
    }
    const focusedRoom = this.navigation.observe("room");
    this.track(focusedRoom.subscribe((roomId) => {
      if (roomId) {
        this._setFocusRoom(roomId);
      }
    }));
  }
  roomViewModelAt(i) {
    var _a;
    return (_a = this._viewModelsObservables[i]) == null ? void 0 : _a.get();
  }
  get focusIndex() {
    return this._selectedIndex;
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  _switchToRoom(roomId) {
    let path = this.navigation.path.until("rooms");
    path = path.with(this.navigation.segment("room", roomId));
    path = addPanelIfNeeded(this.navigation, path);
    this.navigation.applyPath(path);
  }
  focusTile(index) {
    if (index === this._selectedIndex) {
      return;
    }
    const vmo = this._viewModelsObservables[index];
    if (vmo) {
      this._switchToRoom(vmo.id);
    } else {
      this.navigation.push("empty-grid-tile", index);
    }
  }
  initializeRoomIdsAndTransferVM(roomIds, existingRoomVM) {
    roomIds = dedupeSparse(roomIds);
    let transfered = false;
    if (existingRoomVM) {
      const index = roomIds.indexOf(existingRoomVM.id);
      if (index !== -1) {
        this._viewModelsObservables[index] = this.track(existingRoomVM);
        existingRoomVM.subscribe((viewModel) => this._refreshRoomViewModel(viewModel));
        transfered = true;
      }
    }
    this.setRoomIds(roomIds);
    const focusedRoom = this.navigation.path.get("room");
    if (focusedRoom) {
      const index = this._viewModelsObservables.findIndex((vmo) => vmo && vmo.id === focusedRoom.value);
      if (index !== -1) {
        this._selectedIndex = index;
      }
    }
    return transfered;
  }
  setRoomIds(roomIds) {
    roomIds = dedupeSparse(roomIds);
    let changed = false;
    const len = this._height * this._width;
    for (let i = 0; i < len; i += 1) {
      const newId = roomIds[i];
      const vmo = this._viewModelsObservables[i];
      if (!vmo && newId || vmo && vmo.id !== newId) {
        if (vmo) {
          this._viewModelsObservables[i] = this.disposeTracked(vmo);
        }
        if (newId) {
          const vmo2 = this._createRoomViewModelObservable(newId);
          this._viewModelsObservables[i] = this.track(vmo2);
          vmo2.subscribe((viewModel) => this._refreshRoomViewModel(viewModel));
          vmo2.initialize();
        }
        changed = true;
      }
    }
    if (changed) {
      this.emitChange();
    }
    return changed;
  }
  _refreshRoomViewModel(viewModel) {
    this.emitChange();
    viewModel == null ? void 0 : viewModel.focus();
  }
  releaseRoomViewModel(roomId) {
    const index = this._viewModelsObservables.findIndex((vmo) => vmo && vmo.id === roomId);
    if (index !== -1) {
      const vmo = this._viewModelsObservables[index];
      this.untrack(vmo);
      vmo.unsubscribeAll();
      this._viewModelsObservables[index] = null;
      return vmo;
    }
  }
  _setFocusIndex(idx) {
    var _a;
    if (idx === this._selectedIndex || idx >= this._width * this._height) {
      return;
    }
    this._selectedIndex = idx;
    const vmo = this._viewModelsObservables[this._selectedIndex];
    (_a = vmo == null ? void 0 : vmo.get()) == null ? void 0 : _a.focus();
    this.emitChange("focusIndex");
  }
  _setFocusRoom(roomId) {
    const index = this._viewModelsObservables.findIndex((vmo) => (vmo == null ? void 0 : vmo.id) === roomId);
    if (index >= 0) {
      this._setFocusIndex(index);
    }
  }
}
const Status = createEnum("Enabled", "SetupKey", "SetupPhrase", "Pending", "NewVersionAvailable");
const BackupWriteStatus = createEnum("Writing", "Stopped", "Done", "Pending");
class KeyBackupViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._session = options.session;
    this._error = null;
    this._isBusy = false;
    this._dehydratedDeviceId = void 0;
    this._status = void 0;
    this._backupOperation = this._session.keyBackup.flatMap((keyBackup) => keyBackup.operationInProgress);
    this._progress = this._backupOperation.flatMap((op) => op.progress);
    this.track(this._backupOperation.subscribe(() => {
      this._reevaluateStatus();
      this.emitChange("isBackingUp");
    }));
    this.track(this._progress.subscribe(() => this.emitChange("backupPercentage")));
    this._reevaluateStatus();
    this.track(this._session.keyBackup.subscribe(() => {
      if (this._reevaluateStatus()) {
        this.emitChange("status");
      }
    }));
  }
  _reevaluateStatus() {
    if (this._isBusy) {
      return false;
    }
    let status;
    const keyBackup = this._session.keyBackup.get();
    if (keyBackup) {
      status = keyBackup.needsNewKey ? Status.NewVersionAvailable : Status.Enabled;
    } else if (keyBackup === null) {
      status = this.showPhraseSetup() ? Status.SetupPhrase : Status.SetupKey;
    } else {
      status = Status.Pending;
    }
    const changed = status !== this._status;
    this._status = status;
    return changed;
  }
  get decryptAction() {
    return this.i18n`Set up`;
  }
  get purpose() {
    return this.i18n`set up key backup`;
  }
  offerDehydratedDeviceSetup() {
    return true;
  }
  get dehydratedDeviceId() {
    return this._dehydratedDeviceId;
  }
  get isBusy() {
    return this._isBusy;
  }
  get backupVersion() {
    var _a;
    return (_a = this._session.keyBackup.get()) == null ? void 0 : _a.version;
  }
  get backupWriteStatus() {
    const keyBackup = this._session.keyBackup.get();
    if (!keyBackup) {
      return BackupWriteStatus.Pending;
    } else if (keyBackup.hasStopped) {
      return BackupWriteStatus.Stopped;
    }
    const operation = keyBackup.operationInProgress.get();
    if (operation) {
      return BackupWriteStatus.Writing;
    } else if (keyBackup.hasBackedUpAllKeys) {
      return BackupWriteStatus.Done;
    } else {
      return BackupWriteStatus.Pending;
    }
  }
  get backupError() {
    var _a, _b;
    return (_b = (_a = this._session.keyBackup.get()) == null ? void 0 : _a.error) == null ? void 0 : _b.message;
  }
  get status() {
    return this._status;
  }
  get error() {
    var _a;
    return (_a = this._error) == null ? void 0 : _a.message;
  }
  showPhraseSetup() {
    if (this._status === Status.SetupKey) {
      this._status = Status.SetupPhrase;
      this.emitChange("status");
    }
  }
  showKeySetup() {
    if (this._status === Status.SetupPhrase) {
      this._status = Status.SetupKey;
      this.emitChange("status");
    }
  }
  async _enterCredentials(keyType, credential, setupDehydratedDevice) {
    if (credential) {
      try {
        this._isBusy = true;
        this.emitChange("isBusy");
        const key = await this._session.enableSecretStorage(keyType, credential);
        if (setupDehydratedDevice) {
          this._dehydratedDeviceId = await this._session.setupDehydratedDevice(key);
        }
      } catch (err) {
        console.error(err);
        this._error = err;
        this.emitChange("error");
      } finally {
        this._isBusy = false;
        this._reevaluateStatus();
        this.emitChange("");
      }
    }
  }
  enterSecurityPhrase(passphrase, setupDehydratedDevice) {
    this._enterCredentials(KeyType.Passphrase, passphrase, setupDehydratedDevice);
  }
  enterSecurityKey(securityKey, setupDehydratedDevice) {
    this._enterCredentials(KeyType.RecoveryKey, securityKey, setupDehydratedDevice);
  }
  async disable() {
    try {
      this._isBusy = true;
      this.emitChange("isBusy");
      await this._session.disableSecretStorage();
    } catch (err) {
      console.error(err);
      this._error = err;
      this.emitChange("error");
    } finally {
      this._isBusy = false;
      this._reevaluateStatus();
      this.emitChange("");
    }
  }
  get isBackingUp() {
    return !!this._backupOperation.get();
  }
  get backupPercentage() {
    const progress = this._progress.get();
    if (progress) {
      return Math.round(progress.finished / progress.total * 100);
    }
    return 0;
  }
  get backupInProgressLabel() {
    const progress = this._progress.get();
    if (progress) {
      return this.i18n`${progress.finished} of ${progress.total}`;
    }
    return this.i18n`…`;
  }
  cancelBackup() {
    var _a;
    (_a = this._backupOperation.get()) == null ? void 0 : _a.abort();
  }
  startBackup() {
    var _a;
    (_a = this._session.keyBackup.get()) == null ? void 0 : _a.flush();
  }
}
async function submitLogsToRageshakeServer(data, logsBlob, submitUrl, request) {
  const formData = /* @__PURE__ */ new Map();
  if (data.text) {
    formData.set("text", data.text);
  }
  formData.set("user_agent", data.userAgent);
  formData.set("app", data.app);
  formData.set("version", data.version);
  if (data.label) {
    formData.set("label", data.label);
  }
  formData.set("file", { name: "logs.json", blob: logsBlob });
  const headers = /* @__PURE__ */ new Map();
  headers.set("Accept", "application/json");
  const result = request(submitUrl, {
    method: "POST",
    body: formData,
    headers
  });
  let response;
  try {
    response = await result.response();
  } catch (err) {
    throw new Error(`Could not submit logs to ${submitUrl}, got error ${err.message}`);
  }
  const { status, body } = response;
  if (status < 200 || status >= 300) {
    throw new Error(`Could not submit logs to ${submitUrl}, got status code ${status} with body ${body}`);
  }
}
class PushNotificationStatus {
  constructor() {
    this.supported = null;
    this.enabled = false;
    this.updating = false;
    this.enabledOnServer = null;
    this.serverError = null;
  }
}
function formatKey(key) {
  const partLength = 4;
  const partCount = Math.ceil(key.length / partLength);
  let formattedKey = "";
  for (let i = 0; i < partCount; i += 1) {
    formattedKey += (formattedKey.length ? " " : "") + key.slice(i * partLength, (i + 1) * partLength);
  }
  return formattedKey;
}
class SettingsViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._updateService = options.updateService;
    const { client } = options;
    this._client = client;
    this._keyBackupViewModel = this.track(new KeyBackupViewModel(this.childOptions({ session: this._session })));
    this._closeUrl = this.urlCreator.urlUntilSegment("session");
    this._estimate = null;
    this.sentImageSizeLimit = null;
    this.minSentImageSizeLimit = 400;
    this.maxSentImageSizeLimit = 4e3;
    this.pushNotifications = new PushNotificationStatus();
    this._activeTheme = void 0;
    this._logsFeedbackMessage = void 0;
  }
  get _session() {
    return this._client.session;
  }
  async logout() {
    this.navigation.push("logout", this._client.sessionId);
  }
  setSentImageSizeLimit(size) {
    if (size > this.maxSentImageSizeLimit || size < this.minSentImageSizeLimit) {
      this.sentImageSizeLimit = null;
      this.platform.settingsStorage.remove("sentImageSizeLimit");
    } else {
      this.sentImageSizeLimit = Math.round(size);
      this.platform.settingsStorage.setInt("sentImageSizeLimit", size);
    }
    this.emitChange("sentImageSizeLimit");
  }
  async load() {
    this._estimate = await this.platform.estimateStorageUsage();
    this.sentImageSizeLimit = await this.platform.settingsStorage.getInt("sentImageSizeLimit");
    this.pushNotifications.supported = await this.platform.notificationService.supportsPush();
    this.pushNotifications.enabled = await this._session.arePushNotificationsEnabled();
    {
      this._activeTheme = await this.platform.themeLoader.getActiveTheme();
    }
    this.emitChange("");
  }
  get closeUrl() {
    return this._closeUrl;
  }
  get fingerprintKey() {
    const key = this._session.fingerprintKey;
    if (!key) {
      return null;
    }
    return formatKey(key);
  }
  get deviceId() {
    return this._session.deviceId;
  }
  get userId() {
    return this._session.userId;
  }
  get version() {
    const { updateService } = this.platform;
    if (updateService) {
      return `${updateService.version} (${updateService.buildHash})`;
    }
    return this.i18n`development version`;
  }
  checkForUpdate() {
    var _a;
    (_a = this.platform.updateService) == null ? void 0 : _a.checkForUpdate();
  }
  get showUpdateButton() {
    return !!this.platform.updateService;
  }
  get keyBackupViewModel() {
    return this._keyBackupViewModel;
  }
  get storageQuota() {
    var _a;
    return this._formatBytes((_a = this._estimate) == null ? void 0 : _a.quota);
  }
  get storageUsage() {
    var _a;
    return this._formatBytes((_a = this._estimate) == null ? void 0 : _a.usage);
  }
  get themeMapping() {
    return this.platform.themeLoader.themeMapping;
  }
  get activeTheme() {
    return this._activeTheme;
  }
  _formatBytes(n) {
    if (typeof n === "number") {
      return Math.round(n / (1024 * 1024)).toFixed(1) + " MB";
    } else {
      return this.i18n`unknown`;
    }
  }
  async exportLogs() {
    const logExport = await this.logger.export();
    this.platform.saveFileAs(logExport.asBlob(), `hydrogen-logs-${this.platform.clock.now()}.json`);
  }
  get canSendLogsToServer() {
    return !!this.platform.config.bugReportEndpointUrl;
  }
  get logsServer() {
    const { bugReportEndpointUrl } = this.platform.config;
    try {
      if (bugReportEndpointUrl) {
        return new URL(bugReportEndpointUrl).hostname;
      }
    } catch (e) {
    }
    return "";
  }
  async sendLogsToServer() {
    const { bugReportEndpointUrl } = this.platform.config;
    if (bugReportEndpointUrl) {
      this._logsFeedbackMessage = this.i18n`Sending logs…`;
      this.emitChange();
      try {
        const logExport = await this.logger.export();
        await submitLogsToRageshakeServer({
          app: "hydrogen",
          userAgent: this.platform.description,
          version: "0.3.3",
          text: `Submit logs from settings for user ${this._session.userId} on device ${this._session.deviceId}`
        }, logExport.asBlob(), bugReportEndpointUrl, this.platform.request);
        this._logsFeedbackMessage = this.i18n`Logs sent succesfully!`;
        this.emitChange();
      } catch (err) {
        this._logsFeedbackMessage = err.message;
        this.emitChange();
      }
    }
  }
  get logsFeedbackMessage() {
    return this._logsFeedbackMessage;
  }
  async togglePushNotifications() {
    this.pushNotifications.updating = true;
    this.pushNotifications.enabledOnServer = null;
    this.pushNotifications.serverError = null;
    this.emitChange("pushNotifications.updating");
    try {
      if (await this._session.enablePushNotifications(!this.pushNotifications.enabled)) {
        this.pushNotifications.enabled = !this.pushNotifications.enabled;
        if (this.pushNotifications.enabled) {
          this.platform.notificationService.showNotification(this.i18n`Push notifications are now enabled`);
        }
      }
    } finally {
      this.pushNotifications.updating = false;
      this.emitChange("pushNotifications.updating");
    }
  }
  async checkPushEnabledOnServer() {
    this.pushNotifications.enabledOnServer = null;
    this.pushNotifications.serverError = null;
    try {
      this.pushNotifications.enabledOnServer = await this._session.checkPusherEnabledOnHomeserver();
      this.emitChange("pushNotifications.enabledOnServer");
    } catch (err) {
      this.pushNotifications.serverError = err;
      this.emitChange("pushNotifications.serverError");
    }
  }
  changeThemeOption(themeName, themeVariant) {
    this.platform.themeLoader.setTheme(themeName, themeVariant);
    this.emitChange("themeOption");
  }
}
class CreateRoomViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { session } = options;
    this._session = session;
    this._name = void 0;
    this._topic = void 0;
    this._roomAlias = void 0;
    this._isPublic = false;
    this._isEncrypted = true;
    this._isAdvancedShown = false;
    this._isFederationDisabled = false;
    this._avatarScaledBlob = void 0;
    this._avatarFileName = void 0;
    this._avatarInfo = void 0;
  }
  get isPublic() {
    return this._isPublic;
  }
  get isEncrypted() {
    return this._isEncrypted;
  }
  get canCreate() {
    return !!this._name;
  }
  avatarUrl() {
    return this._avatarScaledBlob.url;
  }
  get avatarTitle() {
    return this._name;
  }
  get avatarLetter() {
    return "";
  }
  get avatarColorNumber() {
    return 0;
  }
  get hasAvatar() {
    return !!this._avatarScaledBlob;
  }
  get isFederationDisabled() {
    return this._isFederationDisabled;
  }
  get isAdvancedShown() {
    return this._isAdvancedShown;
  }
  setName(name) {
    this._name = name;
    this.emitChange("canCreate");
  }
  setRoomAlias(roomAlias) {
    this._roomAlias = roomAlias;
  }
  setTopic(topic) {
    this._topic = topic;
  }
  setPublic(isPublic) {
    this._isPublic = isPublic;
    this.emitChange("isPublic");
  }
  setEncrypted(isEncrypted) {
    this._isEncrypted = isEncrypted;
    this.emitChange("isEncrypted");
  }
  setFederationDisabled(disable) {
    this._isFederationDisabled = disable;
    this.emitChange("isFederationDisabled");
  }
  toggleAdvancedShown() {
    this._isAdvancedShown = !this._isAdvancedShown;
    this.emitChange("isAdvancedShown");
  }
  create() {
    var _a, _b;
    let avatar;
    if (this._avatarScaledBlob) {
      avatar = {
        info: this._avatarInfo,
        name: this._avatarFileName,
        blob: this._avatarScaledBlob
      };
    }
    const roomBeingCreated = this._session.createRoom({
      type: this.isPublic ? RoomType.Public : RoomType.Private,
      name: (_a = this._name) != null ? _a : void 0,
      topic: (_b = this._topic) != null ? _b : void 0,
      isEncrypted: !this.isPublic && this._isEncrypted,
      isFederationDisabled: this._isFederationDisabled,
      alias: this.isPublic ? ensureAliasIsLocalPart(this._roomAlias) : void 0,
      avatar
    });
    this.navigation.push("room", roomBeingCreated.id);
  }
  async selectAvatar() {
    if (!this.platform.hasReadPixelPermission()) {
      alert("Please allow canvas image data access, so we can scale your images down.");
      return;
    }
    if (this._avatarScaledBlob) {
      this._avatarScaledBlob.dispose();
    }
    this._avatarScaledBlob = void 0;
    this._avatarFileName = void 0;
    this._avatarInfo = void 0;
    const file = await this.platform.openFile("image/*");
    if (!file || !file.blob.mimeType.startsWith("image/")) {
      this.emitChange("hasAvatar");
      return;
    }
    let image = await this.platform.loadImage(file.blob);
    const limit = 800;
    if (image.maxDimension > limit) {
      const scaledImage = await image.scale(limit);
      image.dispose();
      image = scaledImage;
    }
    this._avatarScaledBlob = image.blob;
    this._avatarInfo = imageToInfo(image);
    this._avatarFileName = file.name;
    this.emitChange("hasAvatar");
  }
}
function ensureAliasIsLocalPart(roomAliasLocalPart) {
  if (roomAliasLocalPart.startsWith("#")) {
    roomAliasLocalPart = roomAliasLocalPart.substr(1);
  }
  const colonIdx = roomAliasLocalPart.indexOf(":");
  if (colonIdx !== -1) {
    roomAliasLocalPart = roomAliasLocalPart.substr(0, colonIdx);
  }
  return roomAliasLocalPart;
}
class JoinRoomViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._joinInProgress = false;
    this._session = options.session;
  }
  async join(roomId) {
    this._error = void 0;
    this._joinInProgress = true;
    this.emitChange("joinInProgress");
    try {
      const id = await joinRoom(roomId, this._session);
      this.navigation.push("room", id);
    } catch (e) {
      this._error = e;
      this._joinInProgress = false;
      this.emitChange("error");
    }
  }
  get joinInProgress() {
    return this._joinInProgress;
  }
  get status() {
    if (this._error) {
      return this._error.message;
    } else if (this._joinInProgress) {
      return "Joining room";
    }
  }
}
class RoomViewModelObservable extends ObservableValue {
  constructor(sessionViewModel, roomIdOrLocalId) {
    super(null);
    this._statusSubscription = null;
    this._sessionViewModel = sessionViewModel;
    this.id = roomIdOrLocalId;
  }
  async initialize() {
    const { session } = this._sessionViewModel._client;
    const statusObservable = await session.observeRoomStatus(this.id);
    this.set(await this._statusToViewModel(statusObservable.get()));
    this._statusSubscription = statusObservable.subscribe(async (status) => {
      var _a;
      (_a = this.get()) == null ? void 0 : _a.dispose();
      this.set(await this._statusToViewModel(status));
    });
  }
  async _statusToViewModel(status) {
    if (status & RoomStatus.Replaced) {
      if (status & RoomStatus.BeingCreated) {
        const { session } = this._sessionViewModel._client;
        const roomBeingCreated = session.roomsBeingCreated.get(this.id);
        this._sessionViewModel.notifyRoomReplaced(roomBeingCreated.id, roomBeingCreated.roomId);
      } else {
        throw new Error("Don't know how to replace a room with this status: " + (status ^ RoomStatus.Replaced));
      }
    } else if (status & RoomStatus.BeingCreated) {
      return this._sessionViewModel._createRoomBeingCreatedViewModel(this.id);
    } else if (status & RoomStatus.Invited) {
      return this._sessionViewModel._createInviteViewModel(this.id);
    } else if (status & RoomStatus.Joined) {
      return this._sessionViewModel._createRoomViewModelInstance(this.id);
    } else if (status & RoomStatus.Archived) {
      return await this._sessionViewModel._createArchivedRoomViewModel(this.id);
    } else {
      return this._sessionViewModel._createUnknownRoomViewModel(this.id);
    }
  }
  dispose() {
    var _a;
    if (this._statusSubscription) {
      this._statusSubscription = this._statusSubscription();
    }
    this.unsubscribeAll();
    (_a = this.get()) == null ? void 0 : _a.dispose();
  }
}
class RoomDetailsViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._room = options.room;
    this._onRoomChange = this._onRoomChange.bind(this);
    this._room.on("change", this._onRoomChange);
  }
  get type() {
    return "room-details";
  }
  get shouldShowBackButton() {
    return false;
  }
  get previousSegmentName() {
    return false;
  }
  get roomId() {
    return this._room.id;
  }
  get canonicalAlias() {
    return this._room.canonicalAlias;
  }
  get name() {
    return this._room.name;
  }
  get isEncrypted() {
    return !!this._room.isEncrypted;
  }
  get memberCount() {
    return this._room.joinedMemberCount;
  }
  get avatarLetter() {
    return avatarInitials(this.name);
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this._room.avatarColorId);
  }
  avatarUrl(size) {
    return getAvatarHttpUrl(this._room.avatarUrl, size, this.platform, this._room.mediaRepository);
  }
  get avatarTitle() {
    return this.name;
  }
  _onRoomChange() {
    this.emitChange();
  }
  dispose() {
    super.dispose();
    this._room.off("change", this._onRoomChange);
  }
  openPanel(segment) {
    let path = this.navigation.path.until("room");
    path = path.with(this.navigation.segment("right-panel", true));
    path = path.with(this.navigation.segment(segment, true));
    this.navigation.applyPath(path);
  }
}
class MemberTileViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._member = this._options.member;
    this._mediaRepository = options.mediaRepository;
    this._previousName = null;
    this._nameChanged = true;
  }
  get name() {
    return `${this._member.name}${this._disambiguationPart}`;
  }
  get _disambiguationPart() {
    return this._disambiguate ? ` (${this.userId})` : "";
  }
  get userId() {
    return this._member.userId;
  }
  get previousName() {
    return this._previousName;
  }
  get nameChanged() {
    return this._nameChanged;
  }
  get detailsUrl() {
    const roomId = this.navigation.path.get("room").value;
    return `${this.urlCreator.openRoomActionUrl(roomId)}/member/${this._member.userId}`;
  }
  _updatePreviousName(newName) {
    const currentName = this._member.name;
    if (currentName !== newName) {
      this._previousName = currentName;
      this._nameChanged = true;
    } else {
      this._nameChanged = false;
    }
  }
  setDisambiguation(status) {
    this._disambiguate = status;
    this.emitChange();
  }
  updateFrom(newMember) {
    this._updatePreviousName(newMember.name);
    this._member = newMember;
  }
  get avatarLetter() {
    return avatarInitials(this.name);
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this.userId);
  }
  avatarUrl(size) {
    return getAvatarHttpUrl(this._member.avatarUrl, size, this.platform, this._mediaRepository);
  }
  get avatarTitle() {
    return this.name;
  }
}
function createMemberComparator(powerLevels) {
  const collator = new Intl.Collator();
  const removeCharacter = (string) => string.charAt(0) === "@" ? string.slice(1) : string;
  return function comparator(member, otherMember) {
    const p1 = powerLevels.getUserLevel(member.userId);
    const p2 = powerLevels.getUserLevel(otherMember.userId);
    if (p1 !== p2) {
      return p2 - p1;
    }
    const name = removeCharacter(member.name);
    const otherName = removeCharacter(otherMember.name);
    return collator.compare(name, otherName);
  };
}
class Disambiguator {
  constructor() {
    this._map = /* @__PURE__ */ new Map();
  }
  _unDisambiguate(vm, array) {
    const idx = array.indexOf(vm);
    if (idx !== -1) {
      const [removed] = array.splice(idx, 1);
      removed.setDisambiguation(false);
    }
  }
  _handlePreviousName(vm) {
    const previousName = vm.previousName;
    if (typeof previousName !== "string") {
      return;
    }
    const value = this._map.get(previousName);
    if (Array.isArray(value)) {
      this._unDisambiguate(vm, value);
      if (value.length === 1) {
        const vm2 = value[0];
        vm2.setDisambiguation(false);
        this._map.set(previousName, vm2);
      }
    } else {
      this._map.delete(previousName);
    }
  }
  _updateMap(vm) {
    const name = vm.name;
    const value = this._map.get(name);
    if (value) {
      if (Array.isArray(value)) {
        if (value.findIndex((member) => member.userId === vm.userId) !== -1) {
          return;
        }
        value.push(vm);
        return value;
      } else if (vm.userId !== value.userId) {
        const array = [value, vm];
        this._map.set(name, array);
        return array;
      }
    } else {
      this._map.set(name, vm);
    }
  }
  disambiguate(vm) {
    if (!vm.nameChanged) {
      return;
    }
    this._handlePreviousName(vm);
    const value = this._updateMap(vm);
    value == null ? void 0 : value.forEach((vm2) => vm2.setDisambiguation(true));
  }
}
class MemberListViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const list = options.members;
    const powerLevelsObservable = options.powerLevelsObservable;
    this.track(powerLevelsObservable.subscribe(() => {
    }));
    const powerLevels = powerLevelsObservable.get();
    this.memberTileViewModels = this._mapTileViewModels(list.members.filterValues((member) => member.membership === "join")).sortValues(createMemberComparator(powerLevels));
    this.nameDisambiguator = new Disambiguator();
    this.mediaRepository = options.mediaRepository;
  }
  get type() {
    return "member-list";
  }
  get shouldShowBackButton() {
    return true;
  }
  get previousSegmentName() {
    return "details";
  }
  _mapTileViewModels(members) {
    const mapper = (member, emitChange) => {
      const mediaRepository = this.mediaRepository;
      const vm = new MemberTileViewModel(this.childOptions({ member, emitChange, mediaRepository }));
      this.nameDisambiguator.disambiguate(vm);
      return vm;
    };
    const updater = (params, vm, newMember) => {
      vm.updateFrom(newMember);
      this.nameDisambiguator.disambiguate(vm);
    };
    return members.mapValues(mapper, updater);
  }
}
class MemberDetailsViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._observableMember = options.observableMember;
    this._mediaRepository = options.mediaRepository;
    this._member = this._observableMember.get();
    this._isEncrypted = options.isEncrypted;
    this._powerLevelsObservable = options.powerLevelsObservable;
    this._session = options.session;
    this.track(this._powerLevelsObservable.subscribe(() => this._onPowerLevelsChange()));
    this.track(this._observableMember.subscribe(() => this._onMemberChange()));
  }
  get name() {
    return this._member.name;
  }
  get userId() {
    return this._member.userId;
  }
  get type() {
    return "member-details";
  }
  get shouldShowBackButton() {
    return true;
  }
  get previousSegmentName() {
    return "members";
  }
  get role() {
    if (this.powerLevel >= 100) {
      return this.i18n`Admin`;
    } else if (this.powerLevel >= 50) {
      return this.i18n`Moderator`;
    } else if (this.powerLevel === 0) {
      return this.i18n`Default`;
    } else {
      return this.i18n`Custom (${this.powerLevel})`;
    }
  }
  _onMemberChange() {
    this._member = this._observableMember.get();
    this.emitChange("member");
  }
  _onPowerLevelsChange() {
    this.emitChange("role");
  }
  get avatarLetter() {
    return avatarInitials(this.name);
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this.userId);
  }
  avatarUrl(size) {
    return getAvatarHttpUrl(this._member.avatarUrl, size, this.platform, this._mediaRepository);
  }
  get avatarTitle() {
    return this.name;
  }
  get isEncrypted() {
    return this._isEncrypted;
  }
  get powerLevel() {
    var _a;
    return (_a = this._powerLevelsObservable.get()) == null ? void 0 : _a.getUserLevel(this._member.userId);
  }
  get linkToUser() {
    return `https://matrix.to/#/${encodeURIComponent(this._member.userId)}`;
  }
  async openDirectMessage() {
    const room = this._session.findDirectMessageForUserId(this.userId);
    let roomId = room == null ? void 0 : room.id;
    if (!roomId) {
      const roomBeingCreated = await this._session.createRoom({
        type: RoomType.DirectMessage,
        invites: [this.userId]
      });
      roomId = roomBeingCreated.id;
    }
    this.navigation.push("room", roomId);
  }
}
class RightPanelViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._room = options.room;
    this._session = options.session;
    this._members = null;
    this._setupNavigation();
  }
  get activeViewModel() {
    return this._activeViewModel;
  }
  async _getMemberListArguments() {
    if (!this._members) {
      this._members = await this._room.loadMemberList();
      this.track(() => this._members.release());
    }
    const room = this._room;
    const powerLevelsObservable = await this._room.observePowerLevels();
    return { members: this._members, powerLevelsObservable, mediaRepository: room.mediaRepository };
  }
  async _getMemberDetailsArguments() {
    const segment = this.navigation.path.get("member");
    const userId = segment.value;
    const observableMember = await this._room.observeMember(userId);
    if (!observableMember) {
      return false;
    }
    const isEncrypted = this._room.isEncrypted;
    const powerLevelsObservable = await this._room.observePowerLevels();
    return {
      observableMember,
      isEncrypted,
      powerLevelsObservable,
      mediaRepository: this._room.mediaRepository,
      session: this._session
    };
  }
  _setupNavigation() {
    this._hookUpdaterToSegment("details", RoomDetailsViewModel, () => {
      return { room: this._room };
    });
    this._hookUpdaterToSegment("members", MemberListViewModel, () => this._getMemberListArguments());
    this._hookUpdaterToSegment("member", MemberDetailsViewModel, () => this._getMemberDetailsArguments(), () => {
      const url = `${this.urlCreator.urlUntilSegment("room")}/members`;
      this.urlCreator.pushUrl(url);
    });
  }
  _hookUpdaterToSegment(segment, viewmodel, argCreator, failCallback) {
    const observable = this.navigation.observe(segment);
    const updater = this._setupUpdater(segment, viewmodel, argCreator, failCallback);
    this.track(observable.subscribe(updater));
  }
  _setupUpdater(segment, viewmodel, argCreator, failCallback) {
    const updater = async (skipDispose = false) => {
      var _a;
      if (!skipDispose) {
        this._activeViewModel = this.disposeTracked(this._activeViewModel);
      }
      const enable = !!((_a = this.navigation.path.get(segment)) == null ? void 0 : _a.value);
      if (enable) {
        const args = await argCreator();
        if (!args && failCallback) {
          failCallback();
          return;
        }
        this._activeViewModel = this.track(new viewmodel(this.childOptions(args)));
      }
      this.emitChange("activeViewModel");
    };
    updater(true);
    return updater;
  }
  closePanel() {
    const path = this.navigation.path.until("room");
    this.navigation.applyPath(path);
  }
  showPreviousPanel() {
    const segmentName = this.activeViewModel.previousSegmentName;
    if (segmentName) {
      let path = this.navigation.path.until("room");
      path = path.with(this.navigation.segment("right-panel", true));
      path = path.with(this.navigation.segment(segmentName, true));
      this.navigation.applyPath(path);
    }
  }
}
class SessionViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { client } = options;
    this._client = this.track(client);
    this._sessionStatusViewModel = this.track(new SessionStatusViewModel(this.childOptions({
      sync: client.sync,
      reconnector: client.reconnector,
      session: client.session
    })));
    this._leftPanelViewModel = this.track(new LeftPanelViewModel(this.childOptions({ session: this._client.session })));
    this._settingsViewModel = null;
    this._roomViewModelObservable = null;
    this._gridViewModel = null;
    this._createRoomViewModel = null;
    this._joinRoomViewModel = null;
    this._setupNavigation();
    this._setupForcedLogoutOnAccessTokenInvalidation();
  }
  _setupNavigation() {
    const gridRooms = this.navigation.observe("rooms");
    this.track(gridRooms.subscribe((roomIds) => {
      this._updateGrid(roomIds);
    }));
    if (gridRooms.get()) {
      this._updateGrid(gridRooms.get());
    }
    const currentRoomId = this.navigation.observe("room");
    this.track(currentRoomId.subscribe((roomId) => {
      if (!this._gridViewModel) {
        this._updateRoom(roomId);
      }
      this._updateRightPanel();
    }));
    if (!this._gridViewModel) {
      this._updateRoom(currentRoomId.get());
    }
    const settings = this.navigation.observe("settings");
    this.track(settings.subscribe((settingsOpen) => {
      this._updateSettings(settingsOpen);
    }));
    this._updateSettings(settings.get());
    const createRoom = this.navigation.observe("create-room");
    this.track(createRoom.subscribe((createRoomOpen) => {
      this._updateCreateRoom(createRoomOpen);
    }));
    this._updateCreateRoom(createRoom.get());
    const joinRoom2 = this.navigation.observe("join-room");
    this.track(joinRoom2.subscribe((joinRoomOpen) => {
      this._updateJoinRoom(joinRoomOpen);
    }));
    this._updateJoinRoom(joinRoom2.get());
    const lightbox = this.navigation.observe("lightbox");
    this.track(lightbox.subscribe((eventId) => {
      this._updateLightbox(eventId);
    }));
    this._updateLightbox(lightbox.get());
    const rightpanel = this.navigation.observe("right-panel");
    this.track(rightpanel.subscribe(() => this._updateRightPanel()));
    this._updateRightPanel();
  }
  _setupForcedLogoutOnAccessTokenInvalidation() {
    this.track(this._client.sync.status.subscribe((status) => {
      if (status === SyncStatus.Stopped) {
        const error = this._client.sync.error;
        if ((error == null ? void 0 : error.errcode) === "M_UNKNOWN_TOKEN") {
          const segments = [
            this.navigation.segment("logout", this.id),
            this.navigation.segment("forced", true)
          ];
          const path = this.navigation.pathFrom(segments);
          this.navigation.applyPath(path);
        }
      }
    }));
  }
  get id() {
    return this._client.sessionId;
  }
  start() {
    this._sessionStatusViewModel.start();
  }
  get activeMiddleViewModel() {
    var _a;
    return ((_a = this._roomViewModelObservable) == null ? void 0 : _a.get()) || this._gridViewModel || this._settingsViewModel || this._createRoomViewModel || this._joinRoomViewModel;
  }
  get roomGridViewModel() {
    return this._gridViewModel;
  }
  get leftPanelViewModel() {
    return this._leftPanelViewModel;
  }
  get sessionStatusViewModel() {
    return this._sessionStatusViewModel;
  }
  get settingsViewModel() {
    return this._settingsViewModel;
  }
  get currentRoomViewModel() {
    var _a;
    return (_a = this._roomViewModelObservable) == null ? void 0 : _a.get();
  }
  get rightPanelViewModel() {
    return this._rightPanelViewModel;
  }
  get createRoomViewModel() {
    return this._createRoomViewModel;
  }
  get joinRoomViewModel() {
    return this._joinRoomViewModel;
  }
  _updateGrid(roomIds) {
    var _a;
    const changed = !(this._gridViewModel && roomIds);
    const currentRoomId = this.navigation.path.get("room");
    if (roomIds) {
      if (!this._gridViewModel) {
        this._gridViewModel = this.track(new RoomGridViewModel(this.childOptions({
          width: 3,
          height: 2,
          createRoomViewModelObservable: (roomId) => new RoomViewModelObservable(this, roomId)
        })));
        (_a = this._roomViewModelObservable) == null ? void 0 : _a.unsubscribeAll();
        if (this._gridViewModel.initializeRoomIdsAndTransferVM(roomIds, this._roomViewModelObservable)) {
          this._roomViewModelObservable = this.untrack(this._roomViewModelObservable);
        } else if (this._roomViewModelObservable) {
          this._roomViewModelObservable = this.disposeTracked(this._roomViewModelObservable);
        }
      } else {
        this._gridViewModel.setRoomIds(roomIds);
      }
    } else if (this._gridViewModel && !roomIds) {
      if (currentRoomId) {
        const vmo = this._gridViewModel.releaseRoomViewModel(currentRoomId.value);
        if (vmo) {
          this._roomViewModelObservable = this.track(vmo);
          this._roomViewModelObservable.subscribe(() => {
            this.emitChange("activeMiddleViewModel");
          });
        }
      }
      this._gridViewModel = this.disposeTracked(this._gridViewModel);
    }
    if (changed) {
      this.emitChange("activeMiddleViewModel");
    }
  }
  _createRoomViewModelInstance(roomId) {
    const room = this._client.session.rooms.get(roomId);
    if (room) {
      const roomVM = new RoomViewModel(this.childOptions({ room }));
      roomVM.load();
      return roomVM;
    }
    return null;
  }
  _createUnknownRoomViewModel(roomIdOrAlias) {
    return new UnknownRoomViewModel(this.childOptions({
      roomIdOrAlias,
      session: this._client.session
    }));
  }
  async _createArchivedRoomViewModel(roomId) {
    const room = await this._client.session.loadArchivedRoom(roomId);
    if (room) {
      const roomVM = new RoomViewModel(this.childOptions({ room }));
      roomVM.load();
      return roomVM;
    }
    return null;
  }
  _createInviteViewModel(roomId) {
    const invite = this._client.session.invites.get(roomId);
    if (invite) {
      return new InviteViewModel(this.childOptions({
        invite,
        mediaRepository: this._client.session.mediaRepository
      }));
    }
    return null;
  }
  _createRoomBeingCreatedViewModel(localId) {
    const roomBeingCreated = this._client.session.roomsBeingCreated.get(localId);
    if (roomBeingCreated) {
      return new RoomBeingCreatedViewModel(this.childOptions({
        roomBeingCreated,
        mediaRepository: this._client.session.mediaRepository
      }));
    }
    return null;
  }
  _updateRoom(roomId) {
    var _a;
    if (((_a = this._roomViewModelObservable) == null ? void 0 : _a.id) === roomId) {
      return;
    }
    if (this._roomViewModelObservable) {
      this._roomViewModelObservable = this.disposeTracked(this._roomViewModelObservable);
    }
    if (!roomId) {
      this.emitChange("activeMiddleViewModel");
      return;
    }
    const vmo = new RoomViewModelObservable(this, roomId);
    this._roomViewModelObservable = this.track(vmo);
    this._roomViewModelObservable.subscribe(() => {
      this.emitChange("activeMiddleViewModel");
    });
    vmo.initialize();
  }
  _updateSettings(settingsOpen) {
    if (this._settingsViewModel) {
      this._settingsViewModel = this.disposeTracked(this._settingsViewModel);
    }
    if (settingsOpen) {
      this._settingsViewModel = this.track(new SettingsViewModel(this.childOptions({
        client: this._client
      })));
      this._settingsViewModel.load();
    }
    this.emitChange("activeMiddleViewModel");
  }
  _updateCreateRoom(createRoomOpen) {
    if (this._createRoomViewModel) {
      this._createRoomViewModel = this.disposeTracked(this._createRoomViewModel);
    }
    if (createRoomOpen) {
      this._createRoomViewModel = this.track(new CreateRoomViewModel(this.childOptions({ session: this._client.session })));
    }
    this.emitChange("activeMiddleViewModel");
  }
  _updateJoinRoom(joinRoomOpen) {
    if (this._joinRoomViewModel) {
      this._joinRoomViewModel = this.disposeTracked(this._joinRoomViewModel);
    }
    if (joinRoomOpen) {
      this._joinRoomViewModel = this.track(new JoinRoomViewModel(this.childOptions({ session: this._client.session })));
    }
    this.emitChange("activeMiddleViewModel");
  }
  _updateLightbox(eventId) {
    if (this._lightboxViewModel) {
      this._lightboxViewModel = this.disposeTracked(this._lightboxViewModel);
    }
    if (eventId) {
      const room = this._roomFromNavigation();
      this._lightboxViewModel = this.track(new LightboxViewModel(this.childOptions({ eventId, room })));
    }
    this.emitChange("lightboxViewModel");
  }
  get lightboxViewModel() {
    return this._lightboxViewModel;
  }
  _roomFromNavigation() {
    var _a;
    const roomId = (_a = this.navigation.path.get("room")) == null ? void 0 : _a.value;
    const room = this._client.session.rooms.get(roomId);
    return room;
  }
  _updateRightPanel() {
    var _a;
    this._rightPanelViewModel = this.disposeTracked(this._rightPanelViewModel);
    const enable = !!((_a = this.navigation.path.get("right-panel")) == null ? void 0 : _a.value);
    if (enable) {
      const room = this._roomFromNavigation();
      this._rightPanelViewModel = this.track(new RightPanelViewModel(this.childOptions({ room, session: this._client.session })));
    }
    this.emitChange("rightPanelViewModel");
  }
  notifyRoomReplaced(oldId, newId) {
    this.navigation.push("room", newId);
  }
}
class AccountSetupViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._accountSetup = options.accountSetup;
    this._dehydratedDevice = void 0;
    this._decryptDehydratedDeviceViewModel = void 0;
    if (this._accountSetup.encryptedDehydratedDevice) {
      this._decryptDehydratedDeviceViewModel = new DecryptDehydratedDeviceViewModel(this, (dehydratedDevice) => {
        this._dehydratedDevice = dehydratedDevice;
        this._decryptDehydratedDeviceViewModel = void 0;
        this.emitChange("deviceDecrypted");
      });
    }
  }
  get decryptDehydratedDeviceViewModel() {
    return this._decryptDehydratedDeviceViewModel;
  }
  get deviceDecrypted() {
    return !!this._dehydratedDevice;
  }
  get dehydratedDeviceId() {
    return this._accountSetup.encryptedDehydratedDevice.deviceId;
  }
  finish() {
    this._accountSetup.finish(this._dehydratedDevice);
  }
}
class DecryptDehydratedDeviceViewModel extends ViewModel {
  constructor(accountSetupViewModel, decryptedCallback) {
    super(accountSetupViewModel.options);
    this._accountSetupViewModel = accountSetupViewModel;
    this._isBusy = false;
    this._status = Status.SetupKey;
    this._error = void 0;
    this._decryptedCallback = decryptedCallback;
  }
  get decryptAction() {
    return this.i18n`Restore`;
  }
  get purpose() {
    return this.i18n`claim your dehydrated device`;
  }
  get offerDehydratedDeviceSetup() {
    return false;
  }
  get dehydratedDeviceId() {
    var _a;
    return (_a = this._accountSetupViewModel._dehydratedDevice) == null ? void 0 : _a.deviceId;
  }
  get isBusy() {
    return this._isBusy;
  }
  get backupVersion() {
    return 0;
  }
  get status() {
    return this._status;
  }
  get error() {
    var _a;
    return (_a = this._error) == null ? void 0 : _a.message;
  }
  showPhraseSetup() {
    if (this._status === Status.SetupKey) {
      this._status = Status.SetupPhrase;
      this.emitChange("status");
    }
  }
  showKeySetup() {
    if (this._status === Status.SetupPhrase) {
      this._status = Status.SetupKey;
      this.emitChange("status");
    }
  }
  async _enterCredentials(keyType, credential) {
    if (credential) {
      try {
        this._isBusy = true;
        this.emitChange("isBusy");
        const { encryptedDehydratedDevice } = this._accountSetupViewModel._accountSetup;
        const dehydratedDevice = await encryptedDehydratedDevice.decrypt(keyType, credential);
        this._decryptedCallback(dehydratedDevice);
      } catch (err) {
        console.error(err);
        this._error = err;
        this.emitChange("error");
      } finally {
        this._isBusy = false;
        this.emitChange("");
      }
    }
  }
  enterSecurityPhrase(passphrase) {
    this._enterCredentials(KeyType.Passphrase, passphrase);
  }
  enterSecurityKey(securityKey) {
    this._enterCredentials(KeyType.RecoveryKey, securityKey);
  }
  disable() {
  }
}
class SessionLoadViewModel extends ViewModel {
  constructor(options) {
    super(options);
    const { client, ready, homeserver, deleteSessionOnCancel } = options;
    this._client = client;
    this._ready = ready;
    this._homeserver = homeserver;
    this._deleteSessionOnCancel = deleteSessionOnCancel;
    this._loading = false;
    this._error = null;
    this.backUrl = this.urlCreator.urlForSegment("session", true);
    this._accountSetupViewModel = void 0;
  }
  async start() {
    if (this._loading) {
      return;
    }
    try {
      this._loading = true;
      this.emitChange("loading");
      this._waitHandle = this._client.loadStatus.waitFor((s) => {
        if (s === LoadStatus.AccountSetup) {
          this._accountSetupViewModel = new AccountSetupViewModel(this.childOptions({ accountSetup: this._client.accountSetup }));
        } else {
          this._accountSetupViewModel = void 0;
        }
        this.emitChange("loadLabel");
        const isCatchupSync = s === LoadStatus.FirstSync && this._client.sync.status.get() === SyncStatus.CatchupSync;
        return isCatchupSync || s === LoadStatus.LoginFailed || s === LoadStatus.Error || s === LoadStatus.Ready;
      });
      try {
        await this._waitHandle.promise;
      } catch (err) {
        return;
      }
      const loadStatus = this._client.loadStatus.get();
      const loadError = this._client.loadError;
      if (loadStatus === LoadStatus.FirstSync || loadStatus === LoadStatus.Ready) {
        const client = this._client;
        this._client = null;
        this._ready(client);
      }
      if (loadError) {
        console.error("session load error", loadError);
      }
    } catch (err) {
      this._error = err;
      console.error("error thrown during session load", err.stack);
    } finally {
      this._loading = false;
      this.emitChange("loading");
    }
  }
  dispose() {
    if (this._client) {
      this._client.dispose();
      this._client = null;
    }
    if (this._waitHandle) {
      this._waitHandle.dispose();
      this._waitHandle = null;
    }
  }
  get loading() {
    const client = this._client;
    if (client && client.loadStatus.get() === LoadStatus.AccountSetup) {
      return false;
    }
    return this._loading;
  }
  get loadLabel() {
    const client = this._client;
    const error = this._getError();
    if (error || client && client.loadStatus.get() === LoadStatus.Error) {
      return `Something went wrong: ${error && error.message}.`;
    }
    if (client) {
      switch (client.loadStatus.get()) {
        case LoadStatus.QueryAccount:
          return `Querying account encryption setup\u2026`;
        case LoadStatus.AccountSetup:
          return "";
        case LoadStatus.SessionSetup:
          return `Setting up your encryption keys\u2026`;
        case LoadStatus.Loading:
          return `Loading your conversations\u2026`;
        case LoadStatus.FirstSync:
          return `Getting your conversations from the server\u2026`;
        default:
          return this._client.loadStatus.get();
      }
    }
    return `Preparing\u2026`;
  }
  _getError() {
    var _a;
    return this._error || ((_a = this._client) == null ? void 0 : _a.loadError);
  }
  get hasError() {
    return !!this._getError();
  }
  async exportLogs() {
    const logExport = await this.logger.export();
    this.platform.saveFileAs(logExport.asBlob(), `hydrogen-logs-${this.platform.clock.now()}.json`);
  }
  async logout() {
    await this._client.logout();
    this.navigation.push("session", true);
  }
  get accountSetupViewModel() {
    return this._accountSetupViewModel;
  }
}
class PasswordLoginViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._isBusy = false;
    this._errorMessage = "";
    const { loginOptions, attemptLogin } = options;
    this._loginOptions = loginOptions;
    this._attemptLogin = attemptLogin;
  }
  get isBusy() {
    return this._isBusy;
  }
  get errorMessage() {
    return this._errorMessage;
  }
  setBusy(status) {
    this._isBusy = status;
    this.emitChange("isBusy");
  }
  _showError(message) {
    this._errorMessage = message;
    this.emitChange("errorMessage");
  }
  async login(username, password) {
    this._errorMessage = "";
    this.emitChange("errorMessage");
    const status = await this._attemptLogin(this._loginOptions.password(username, password));
    let error = "";
    switch (status) {
      case LoginFailure.Credentials:
        error = this.i18n`Your username and/or password don't seem to be correct.`;
        break;
      case LoginFailure.Connection:
        error = this.i18n`Can't connect to ${this._loginOptions.homeserver}.`;
        break;
      case LoginFailure.Unknown:
        error = this.i18n`Something went wrong while checking your login and password.`;
        break;
    }
    if (error) {
      this._showError(error);
    }
  }
}
class StartSSOLoginViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._isBusy = false;
    this._sso = options.loginOptions.sso;
    this._isBusy = false;
  }
  get isBusy() {
    return this._isBusy;
  }
  setBusy(status) {
    this._isBusy = status;
    this.emitChange("isBusy");
  }
  async startSSOLogin() {
    await this.platform.settingsStorage.setString("sso_ongoing_login_homeserver", this._sso.homeserver);
    const link = this._sso.createSSORedirectURL(this.urlCreator.createSSOCallbackURL());
    this.platform.openUrl(link);
  }
}
class CompleteSSOLoginViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._errorMessage = "";
    const {
      loginToken,
      client,
      attemptLogin
    } = options;
    this._loginToken = loginToken;
    this._client = client;
    this._attemptLogin = attemptLogin;
    this._errorMessage = "";
    void this.performSSOLoginCompletion();
  }
  get errorMessage() {
    return this._errorMessage;
  }
  _showError(message) {
    this._errorMessage = message;
    this.emitChange("errorMessage");
  }
  async performSSOLoginCompletion() {
    if (!this._loginToken) {
      return;
    }
    const homeserver = await this.platform.settingsStorage.getString("sso_ongoing_login_homeserver");
    let loginOptions;
    try {
      loginOptions = await this._client.queryLogin(homeserver).result;
    } catch (err) {
      this._showError(err.message);
      return;
    }
    if (!loginOptions.token) {
      this.navigation.push("session");
      return;
    }
    const status = await this._attemptLogin(loginOptions.token(this._loginToken));
    let error = "";
    switch (status) {
      case LoginFailure.Credentials:
        error = this.i18n`Your login token is invalid.`;
        break;
      case LoginFailure.Connection:
        error = this.i18n`Can't connect to ${homeserver}.`;
        break;
      case LoginFailure.Unknown:
        error = this.i18n`Something went wrong while checking your login token.`;
        break;
    }
    if (error) {
      this._showError(error);
    }
  }
}
class LoginViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._hideHomeserver = false;
    this._isBusy = false;
    this._errorMessage = "";
    const { ready, defaultHomeserver, loginToken } = options;
    this._ready = ready;
    this._loginToken = loginToken;
    this._client = new Client(this.platform);
    this._homeserver = defaultHomeserver;
    this._initViewModels();
  }
  get passwordLoginViewModel() {
    return this._passwordLoginViewModel;
  }
  get startSSOLoginViewModel() {
    return this._startSSOLoginViewModel;
  }
  get completeSSOLoginViewModel() {
    return this._completeSSOLoginViewModel;
  }
  get homeserver() {
    return this._homeserver;
  }
  get resolvedHomeserver() {
    var _a;
    return (_a = this._loginOptions) == null ? void 0 : _a.homeserver;
  }
  get errorMessage() {
    return this._errorMessage;
  }
  get showHomeserver() {
    return !this._hideHomeserver;
  }
  get loadViewModel() {
    return this._loadViewModel;
  }
  get isBusy() {
    return this._isBusy;
  }
  get isFetchingLoginOptions() {
    return !!this._abortQueryOperation;
  }
  goBack() {
    this.navigation.push("session");
  }
  _initViewModels() {
    if (this._loginToken) {
      this._hideHomeserver = true;
      this._completeSSOLoginViewModel = this.track(new CompleteSSOLoginViewModel(this.childOptions({
        client: this._client,
        attemptLogin: (loginMethod) => this.attemptLogin(loginMethod),
        loginToken: this._loginToken
      })));
      this.emitChange("completeSSOLoginViewModel");
    } else {
      void this.queryHomeserver();
    }
  }
  _showPasswordLogin() {
    this._passwordLoginViewModel = this.track(new PasswordLoginViewModel(this.childOptions({
      loginOptions: this._loginOptions,
      attemptLogin: (loginMethod) => this.attemptLogin(loginMethod)
    })));
    this.emitChange("passwordLoginViewModel");
  }
  _showSSOLogin() {
    this._startSSOLoginViewModel = this.track(new StartSSOLoginViewModel(this.childOptions({ loginOptions: this._loginOptions })));
    this.emitChange("startSSOLoginViewModel");
  }
  _showError(message) {
    this._errorMessage = message;
    this.emitChange("errorMessage");
  }
  _setBusy(status) {
    var _a, _b;
    this._isBusy = status;
    (_a = this._passwordLoginViewModel) == null ? void 0 : _a.setBusy(status);
    (_b = this._startSSOLoginViewModel) == null ? void 0 : _b.setBusy(status);
    this.emitChange("isBusy");
  }
  async attemptLogin(loginMethod) {
    this._setBusy(true);
    void this._client.startWithLogin(loginMethod, { inspectAccountSetup: true });
    const loadStatus = this._client.loadStatus;
    const handle = loadStatus.waitFor((status2) => status2 !== LoadStatus.Login);
    await handle.promise;
    this._setBusy(false);
    const status = loadStatus.get();
    if (status === LoadStatus.LoginFailed) {
      return this._client.loginFailure;
    }
    this._hideHomeserver = true;
    this.emitChange("hideHomeserver");
    this._disposeViewModels();
    void this._createLoadViewModel();
    return null;
  }
  _createLoadViewModel() {
    this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);
    this._loadViewModel = this.disposeTracked(this._loadViewModel);
    this._loadViewModel = this.track(new SessionLoadViewModel(this.childOptions({
      ready: (client) => {
        this._client = null;
        this._ready(client);
      },
      client: this._client,
      homeserver: this._homeserver
    })));
    void this._loadViewModel.start();
    this.emitChange("loadViewModel");
    this._loadViewModelSubscription = this.track(this._loadViewModel.disposableOn("change", () => {
      if (!this._loadViewModel.loading) {
        this._loadViewModelSubscription = this.disposeTracked(this._loadViewModelSubscription);
      }
      this._setBusy(false);
    }));
  }
  _disposeViewModels() {
    this._startSSOLoginViewModel = this.disposeTracked(this._startSSOLoginViewModel);
    this._passwordLoginViewModel = this.disposeTracked(this._passwordLoginViewModel);
    this._completeSSOLoginViewModel = this.disposeTracked(this._completeSSOLoginViewModel);
    this.emitChange("disposeViewModels");
  }
  async setHomeserver(newHomeserver) {
    this._homeserver = newHomeserver;
    this._loginOptions = void 0;
    this._queriedHomeserver = void 0;
    this._showError("");
    this._disposeViewModels();
    this._abortQueryOperation = this.disposeTracked(this._abortQueryOperation);
    this.emitChange("loginViewModels");
    this.disposeTracked(this._abortHomeserverQueryTimeout);
    const timeout = this.clock.createTimeout(1e3);
    this._abortHomeserverQueryTimeout = this.track(() => timeout.abort());
    try {
      await timeout.elapsed();
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      } else {
        throw err;
      }
    }
    this._abortHomeserverQueryTimeout = this.disposeTracked(this._abortHomeserverQueryTimeout);
    void this.queryHomeserver();
  }
  async queryHomeserver() {
    if (this._homeserver === this._queriedHomeserver || this._homeserver === "") {
      return;
    }
    this._queriedHomeserver = this._homeserver;
    this._abortHomeserverQueryTimeout = this.disposeTracked(this._abortHomeserverQueryTimeout);
    this._abortQueryOperation = this.disposeTracked(this._abortQueryOperation);
    try {
      const queryOperation = this._client.queryLogin(this._homeserver);
      this._abortQueryOperation = this.track(() => queryOperation.abort());
      this.emitChange("isFetchingLoginOptions");
      this._loginOptions = await queryOperation.result;
      this.emitChange("resolvedHomeserver");
    } catch (e) {
      if (e.name === "AbortError") {
        return;
      } else {
        this._loginOptions = void 0;
      }
    } finally {
      this._abortQueryOperation = this.disposeTracked(this._abortQueryOperation);
      this.emitChange("isFetchingLoginOptions");
    }
    if (this._loginOptions) {
      if (this._loginOptions.sso) {
        this._showSSOLogin();
      }
      if (this._loginOptions.password) {
        this._showPasswordLogin();
      }
      if (!this._loginOptions.sso && !this._loginOptions.password) {
        this._showError("This homeserver supports neither SSO nor password based login flows");
      }
    } else {
      this._showError(`Could not query login methods supported by ${this.homeserver}`);
    }
  }
  dispose() {
    super.dispose();
    if (this._client) {
      void this._client.deleteSession();
    }
  }
}
class LogoutViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._sessionId = options.sessionId;
    this._busy = false;
    this._showConfirm = true;
    this._error = void 0;
  }
  get showConfirm() {
    return this._showConfirm;
  }
  get busy() {
    return this._busy;
  }
  get cancelUrl() {
    return this.urlCreator.urlForSegment("session", true);
  }
  async logout() {
    this._busy = true;
    this._showConfirm = false;
    this.emitChange("busy");
    try {
      const client = new Client(this.platform);
      await client.startLogout(this._sessionId);
      this.navigation.push("session", true);
    } catch (err) {
      this._error = err;
      this._busy = false;
      this.emitChange("busy");
    }
  }
  get status() {
    if (this._error) {
      return this.i18n`Could not log out of device: ${this._error.message}`;
    } else {
      return this.i18n`Logging out… Please don't close the app.`;
    }
  }
}
class ForcedLogoutViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._showStatus = false;
    this._showSpinner = false;
    this._sessionId = options.sessionId;
    this._logoutPromise = this.forceLogout();
  }
  async forceLogout() {
    try {
      const client = new Client(this.platform);
      await client.startForcedLogout(this._sessionId);
    } catch (err) {
      this._error = err;
      this._showSpinner = false;
      this._showStatus = true;
      this.emitChange("error");
    }
  }
  async proceed() {
    this._showSpinner = true;
    this._showStatus = true;
    this.emitChange("showStatus");
    await this._logoutPromise;
    if (!this._error) {
      this.navigation.push("login", true);
    }
  }
  get status() {
    if (this._error) {
      return this.i18n`Could not log out of device: ${this._error.message}`;
    } else {
      return this.i18n`Logging out… Please don't close the app.`;
    }
  }
  get showStatus() {
    return this._showStatus;
  }
  get showSpinner() {
    return this._showSpinner;
  }
}
class SessionItemViewModel extends ViewModel {
  constructor(options, pickerVM) {
    super(options);
    this._pickerVM = pickerVM;
    this._sessionInfo = options.sessionInfo;
    this._isDeleting = false;
    this._isClearing = false;
    this._error = null;
    this._exportDataUrl = null;
  }
  get error() {
    return this._error && this._error.message;
  }
  get id() {
    return this._sessionInfo.id;
  }
  get openUrl() {
    return this.urlCreator.urlForSegment("session", this.id);
  }
  get label() {
    const { userId, comment } = this._sessionInfo;
    if (comment) {
      return `${userId} (${comment})`;
    } else {
      return userId;
    }
  }
  get sessionInfo() {
    return this._sessionInfo;
  }
  get exportDataUrl() {
    return this._exportDataUrl;
  }
  get avatarColorNumber() {
    return getIdentifierColorNumber(this._sessionInfo.userId);
  }
  get avatarInitials() {
    return avatarInitials(this._sessionInfo.userId);
  }
}
class SessionPickerViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._sessions = new SortedArray((s1, s2) => s1.id.localeCompare(s2.id));
    this._loadViewModel = null;
    this._error = null;
  }
  async load() {
    const sessions = await this.platform.sessionInfoStorage.getAll();
    this._sessions.setManyUnsorted(sessions.map((s) => {
      return new SessionItemViewModel(this.childOptions({ sessionInfo: s }), this);
    }));
  }
  get loadViewModel() {
    return this._loadViewModel;
  }
  get sessions() {
    return this._sessions;
  }
  get cancelUrl() {
    return this.urlCreator.urlForSegment("login");
  }
}
class RootViewModel extends ViewModel {
  constructor(options) {
    super(options);
    this._error = null;
    this._sessionPickerViewModel = null;
    this._sessionLoadViewModel = null;
    this._loginViewModel = null;
    this._logoutViewModel = null;
    this._forcedLogoutViewModel = null;
    this._sessionViewModel = null;
    this._pendingClient = null;
  }
  async load() {
    this.track(this.navigation.observe("login").subscribe(() => this._applyNavigation()));
    this.track(this.navigation.observe("session").subscribe(() => this._applyNavigation()));
    this.track(this.navigation.observe("sso").subscribe(() => this._applyNavigation()));
    this.track(this.navigation.observe("logout").subscribe(() => this._applyNavigation()));
    this._applyNavigation(true);
  }
  async _applyNavigation(shouldRestoreLastUrl) {
    var _a, _b, _c2, _d2;
    const isLogin = this.navigation.path.get("login");
    const logoutSessionId = (_a = this.navigation.path.get("logout")) == null ? void 0 : _a.value;
    const isForcedLogout = (_b = this.navigation.path.get("forced")) == null ? void 0 : _b.value;
    const sessionId = (_c2 = this.navigation.path.get("session")) == null ? void 0 : _c2.value;
    const loginToken = (_d2 = this.navigation.path.get("sso")) == null ? void 0 : _d2.value;
    if (isLogin) {
      if (this.activeSection !== "login") {
        this._showLogin();
      }
    } else if (logoutSessionId && isForcedLogout) {
      if (this.activeSection !== "forced-logout") {
        this._showForcedLogout(logoutSessionId);
      }
    } else if (logoutSessionId) {
      if (this.activeSection !== "logout") {
        this._showLogout(logoutSessionId);
      }
    } else if (sessionId === true) {
      if (this.activeSection !== "picker") {
        this._showPicker();
      }
    } else if (sessionId) {
      if (!this._sessionViewModel || this._sessionViewModel.id !== sessionId) {
        if (this._pendingClient && this._pendingClient.sessionId === sessionId) {
          const client = this._pendingClient;
          this._pendingClient = null;
          this._showSession(client);
        } else {
          if (this._pendingClient) {
            this._pendingClient.dispose();
            this._pendingClient = null;
          }
          this._showSessionLoader(sessionId);
        }
      }
    } else if (loginToken) {
      this.urlCreator.normalizeUrl();
      if (this.activeSection !== "login") {
        this._showLogin(loginToken);
      }
    } else {
      try {
        if (!(shouldRestoreLastUrl && this.urlCreator.tryRestoreLastUrl())) {
          const sessionInfos = await this.platform.sessionInfoStorage.getAll();
          if (sessionInfos.length === 0) {
            this.navigation.push("login");
          } else if (sessionInfos.length === 1) {
            this.navigation.push("session", sessionInfos[0].id);
          } else {
            this.navigation.push("session");
          }
        }
      } catch (err) {
        this._setSection(() => this._error = err);
      }
    }
  }
  async _showPicker() {
    this._setSection(() => {
      this._sessionPickerViewModel = new SessionPickerViewModel(this.childOptions());
    });
    try {
      await this._sessionPickerViewModel.load();
    } catch (err) {
      this._setSection(() => this._error = err);
    }
  }
  _showLogin(loginToken) {
    this._setSection(() => {
      this._loginViewModel = new LoginViewModel(this.childOptions({
        defaultHomeserver: this.platform.config["defaultHomeServer"],
        ready: (client) => {
          this._pendingClient = client;
          this.navigation.push("session", client.sessionId);
        },
        loginToken
      }));
    });
  }
  _showLogout(sessionId) {
    this._setSection(() => {
      this._logoutViewModel = new LogoutViewModel(this.childOptions({ sessionId }));
    });
  }
  _showForcedLogout(sessionId) {
    this._setSection(() => {
      this._forcedLogoutViewModel = new ForcedLogoutViewModel(this.childOptions({ sessionId }));
    });
  }
  _showSession(client) {
    this._setSection(() => {
      this._sessionViewModel = new SessionViewModel(this.childOptions({ client }));
      this._sessionViewModel.start();
    });
  }
  _showSessionLoader(sessionId) {
    const client = new Client(this.platform);
    client.startWithExistingSession(sessionId);
    this._setSection(() => {
      this._sessionLoadViewModel = new SessionLoadViewModel(this.childOptions({
        client,
        ready: (client2) => this._showSession(client2)
      }));
      this._sessionLoadViewModel.start();
    });
  }
  get activeSection() {
    if (this._error) {
      return "error";
    } else if (this._sessionViewModel) {
      return "session";
    } else if (this._loginViewModel) {
      return "login";
    } else if (this._logoutViewModel) {
      return "logout";
    } else if (this._forcedLogoutViewModel) {
      return "forced-logout";
    } else if (this._sessionPickerViewModel) {
      return "picker";
    } else if (this._sessionLoadViewModel) {
      return "loading";
    } else {
      return "redirecting";
    }
  }
  _setSection(setter) {
    this._error = null;
    this._sessionPickerViewModel = this.disposeTracked(this._sessionPickerViewModel);
    this._sessionLoadViewModel = this.disposeTracked(this._sessionLoadViewModel);
    this._loginViewModel = this.disposeTracked(this._loginViewModel);
    this._logoutViewModel = this.disposeTracked(this._logoutViewModel);
    this._forcedLogoutViewModel = this.disposeTracked(this._forcedLogoutViewModel);
    this._sessionViewModel = this.disposeTracked(this._sessionViewModel);
    setter();
    this._sessionPickerViewModel && this.track(this._sessionPickerViewModel);
    this._sessionLoadViewModel && this.track(this._sessionLoadViewModel);
    this._loginViewModel && this.track(this._loginViewModel);
    this._logoutViewModel && this.track(this._logoutViewModel);
    this._forcedLogoutViewModel && this.track(this._forcedLogoutViewModel);
    this._sessionViewModel && this.track(this._sessionViewModel);
    this.emitChange("activeSection");
  }
  get error() {
    return this._error;
  }
  get sessionViewModel() {
    return this._sessionViewModel;
  }
  get loginViewModel() {
    return this._loginViewModel;
  }
  get logoutViewModel() {
    return this._logoutViewModel;
  }
  get forcedLogoutViewModel() {
    return this._forcedLogoutViewModel;
  }
  get sessionPickerViewModel() {
    return this._sessionPickerViewModel;
  }
  get sessionLoadViewModel() {
    return this._sessionLoadViewModel;
  }
}
async function main(platform2) {
  await platform2.init();
  const navigation = createNavigation();
  platform2.setNavigation(navigation);
  const urlRouter = createRouter({ navigation, history: platform2.history });
  urlRouter.attach();
  const vm = new RootViewModel({
    platform: platform2,
    urlCreator: urlRouter,
    navigation
  });
  await vm.load();
  platform2.createAndMountRootView(vm);
}
function abortOnTimeout(createTimeout, timeoutAmount, requestResult, responsePromise) {
  const timeout = createTimeout(timeoutAmount);
  let timedOut = false;
  timeout.elapsed().then(() => {
    timedOut = true;
    requestResult.abort();
  }, () => {
  });
  return responsePromise.then((response) => {
    timeout.abort();
    return response;
  }, (err) => {
    timeout.abort();
    if (err.name === "AbortError" && timedOut) {
      throw new ConnectionError(`Request timed out after ${timeoutAmount}ms`, true);
    } else {
      throw err;
    }
  });
}
function addCacheBuster(urlStr, random = Math.random) {
  if (urlStr.includes("?")) {
    urlStr = urlStr + "&";
  } else {
    urlStr = urlStr + "?";
  }
  return urlStr + `_cacheBuster=${Math.ceil(random() * Number.MAX_SAFE_INTEGER)}`;
}
function mapAsFormData(map) {
  var _a;
  const formData = new FormData();
  for (const [name, value] of map) {
    if (((_a = value.blob) == null ? void 0 : _a.nativeBlob) && value.name) {
      formData.set(name, value.blob.nativeBlob, value.name);
    } else {
      formData.set(name, value);
    }
  }
  return formData;
}
class RequestResult$1 {
  constructor(promise, xhr) {
    this._promise = promise;
    this._xhr = xhr;
  }
  abort() {
    this._xhr.abort();
  }
  response() {
    return this._promise;
  }
}
function createXhr(url, { method, headers, timeout, format, uploadProgress }) {
  const xhr = new XMLHttpRequest();
  if (uploadProgress) {
    xhr.upload.addEventListener("progress", (evt) => uploadProgress(evt.loaded));
  }
  xhr.open(method, url);
  if (format === "buffer") {
    xhr.responseType = "arraybuffer";
  }
  if (headers) {
    for (const [name, value] of headers.entries()) {
      try {
        xhr.setRequestHeader(name, value);
      } catch (err) {
        console.info(`Could not set ${name} header: ${err.message}`);
      }
    }
  }
  if (timeout) {
    xhr.timeout = timeout;
  }
  return xhr;
}
function xhrAsPromise(xhr, method, url) {
  return new Promise((resolve, reject) => {
    xhr.addEventListener("load", () => resolve(xhr));
    xhr.addEventListener("abort", () => reject(new AbortError()));
    xhr.addEventListener("error", () => reject(new ConnectionError(`Error ${method} ${url}`)));
    xhr.addEventListener("timeout", () => reject(new ConnectionError(`Timeout ${method} ${url}`, true)));
  });
}
function xhrRequest(url, options) {
  let { cache, format, body, method } = options;
  if (!cache) {
    url = addCacheBuster(url);
  }
  const xhr = createXhr(url, options);
  const promise = xhrAsPromise(xhr, method, url).then((xhr2) => {
    const { status } = xhr2;
    let body2 = null;
    if (format === "buffer") {
      body2 = xhr2.response;
    } else if (xhr2.getResponseHeader("Content-Type") === "application/json") {
      body2 = JSON.parse(xhr2.responseText);
    }
    return { status, body: body2 };
  });
  if (body == null ? void 0 : body.nativeBlob) {
    body = body.nativeBlob;
  }
  if (body instanceof Map) {
    body = mapAsFormData(body);
  }
  xhr.send(body || null);
  return new RequestResult$1(promise, xhr);
}
class RequestResult {
  constructor(promise, controller) {
    if (!controller) {
      const abortPromise = new Promise((_, reject) => {
        this._controller = {
          abort() {
            const err = new Error("fetch request aborted");
            err.name = "AbortError";
            reject(err);
          }
        };
      });
      this.promise = Promise.race([promise, abortPromise]);
    } else {
      this.promise = promise;
      this._controller = controller;
    }
  }
  abort() {
    this._controller.abort();
  }
  response() {
    return this.promise;
  }
}
function createFetchRequest(createTimeout, serviceWorkerHandler) {
  return function fetchRequest(url, requestOptions) {
    if (serviceWorkerHandler == null ? void 0 : serviceWorkerHandler.haltRequests) {
      return new RequestResult(new Promise(() => {
      }), {});
    }
    if (requestOptions == null ? void 0 : requestOptions.uploadProgress) {
      return xhrRequest(url, requestOptions);
    }
    let { method, headers, body, timeout, format, cache = false } = requestOptions;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    if (body == null ? void 0 : body.nativeBlob) {
      body = body.nativeBlob;
    }
    if (body instanceof Map) {
      body = mapAsFormData(body);
    }
    let options = { method, body };
    if (controller) {
      options = Object.assign(options, {
        signal: controller.signal
      });
    }
    if (!cache) {
      url = addCacheBuster(url);
    }
    options = Object.assign(options, {
      mode: "cors",
      credentials: "omit",
      referrer: "no-referrer",
      cache: "default"
    });
    if (headers) {
      const fetchHeaders = new Headers();
      for (const [name, value] of headers.entries()) {
        fetchHeaders.append(name, value);
      }
      options.headers = fetchHeaders;
    }
    const promise = fetch(url, options).then(async (response) => {
      const { status } = response;
      let body2;
      try {
        if (format === "json") {
          body2 = await response.json();
        } else if (format === "buffer") {
          body2 = await response.arrayBuffer();
        } else if (format === "text") {
          body2 = await response.text();
        }
      } catch (err) {
        if (!(err.name === "SyntaxError" && status >= 400)) {
          throw err;
        }
      }
      return { status, body: body2 };
    }, (err) => {
      if (err.name === "AbortError") {
        throw new AbortError();
      } else if (err instanceof TypeError) {
        throw new ConnectionError(`${method} ${url}: ${err.message}`);
      }
      throw err;
    });
    const result = new RequestResult(promise, controller);
    if (timeout) {
      result.promise = abortOnTimeout(createTimeout, timeout, result, result.promise);
    }
    return result;
  };
}
class SessionInfoStorage {
  constructor(name) {
    this._name = name;
  }
  getAll() {
    const sessionsJson = localStorage.getItem(this._name);
    if (sessionsJson) {
      const sessions = JSON.parse(sessionsJson);
      if (Array.isArray(sessions)) {
        return Promise.resolve(sessions);
      }
    }
    return Promise.resolve([]);
  }
  async updateLastUsed(id, timestamp) {
    const sessions = await this.getAll();
    if (sessions) {
      const session = sessions.find((session2) => session2.id === id);
      if (session) {
        session.lastUsed = timestamp;
        localStorage.setItem(this._name, JSON.stringify(sessions));
      }
    }
  }
  async get(id) {
    const sessions = await this.getAll();
    if (sessions) {
      return sessions.find((session) => session.id === id);
    }
  }
  async add(sessionInfo) {
    const sessions = await this.getAll();
    sessions.push(sessionInfo);
    localStorage.setItem(this._name, JSON.stringify(sessions));
  }
  async delete(sessionId) {
    let sessions = await this.getAll();
    sessions = sessions.filter((s) => s.id !== sessionId);
    localStorage.setItem(this._name, JSON.stringify(sessions));
  }
}
class SettingsStorage {
  constructor(prefix) {
    this._prefix = prefix;
  }
  async setInt(key, value) {
    this._set(key, value);
  }
  async getInt(key, defaultValue = 0) {
    const value = window.localStorage.getItem(`${this._prefix}${key}`);
    if (typeof value === "string") {
      return parseInt(value, 10);
    }
    return defaultValue;
  }
  async setBool(key, value) {
    this._set(key, value);
  }
  async getBool(key, defaultValue = false) {
    const value = window.localStorage.getItem(`${this._prefix}${key}`);
    if (typeof value === "string") {
      return value === "true";
    }
    return defaultValue;
  }
  async setString(key, value) {
    this._set(key, value);
  }
  async getString(key) {
    return window.localStorage.getItem(`${this._prefix}${key}`);
  }
  async remove(key) {
    window.localStorage.removeItem(`${this._prefix}${key}`);
  }
  async _set(key, value) {
    window.localStorage.setItem(`${this._prefix}${key}`, value);
  }
}
class UTF8 {
  constructor() {
    this._encoder = null;
    this._decoder = null;
  }
  encode(str) {
    if (!this._encoder) {
      this._encoder = new TextEncoder();
    }
    return this._encoder.encode(str);
  }
  decode(buffer) {
    if (!this._decoder) {
      this._decoder = new TextDecoder();
    }
    return this._decoder.decode(buffer);
  }
}
var base64Arraybuffer = {};
(function() {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var lookup = new Uint8Array(256);
  for (var i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  base64Arraybuffer.encode = function(arraybuffer) {
    var bytes = new Uint8Array(arraybuffer), i2, len = bytes.length, base64 = "";
    for (i2 = 0; i2 < len; i2 += 3) {
      base64 += chars[bytes[i2] >> 2];
      base64 += chars[(bytes[i2] & 3) << 4 | bytes[i2 + 1] >> 4];
      base64 += chars[(bytes[i2 + 1] & 15) << 2 | bytes[i2 + 2] >> 6];
      base64 += chars[bytes[i2 + 2] & 63];
    }
    if (len % 3 === 2) {
      base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + "==";
    }
    return base64;
  };
  base64Arraybuffer.decode = function(base64) {
    var bufferLength = base64.length * 0.75, len = base64.length, i2, p = 0, encoded1, encoded2, encoded3, encoded4;
    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }
    var arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
    for (i2 = 0; i2 < len; i2 += 4) {
      encoded1 = lookup[base64.charCodeAt(i2)];
      encoded2 = lookup[base64.charCodeAt(i2 + 1)];
      encoded3 = lookup[base64.charCodeAt(i2 + 2)];
      encoded4 = lookup[base64.charCodeAt(i2 + 3)];
      bytes[p++] = encoded1 << 2 | encoded2 >> 4;
      bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
      bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
    }
    return arraybuffer;
  };
})();
class Base64 {
  encodeUnpadded(buffer) {
    const str = base64Arraybuffer.encode(buffer);
    const paddingIdx = str.indexOf("=");
    if (paddingIdx !== -1) {
      return str.substr(0, paddingIdx);
    } else {
      return str;
    }
  }
  encode(buffer) {
    return base64Arraybuffer.encode(buffer);
  }
  decode(str) {
    return base64Arraybuffer.decode(str);
  }
}
var Buffer2 = {
  isBuffer: function(array) {
    return array instanceof Uint8Array;
  },
  from: function(arrayBuffer) {
    return arrayBuffer;
  },
  allocUnsafe: function(size) {
    return Buffer2.alloc(size);
  },
  alloc: function(size) {
    return new Uint8Array(size);
  }
};
var safeBuffer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Buffer: Buffer2
}, Symbol.toStringTag, { value: "Module" }));
var require$$0 = /* @__PURE__ */ getAugmentedNamespace(safeBuffer);
var _Buffer = require$$0.Buffer;
function base(ALPHABET2) {
  if (ALPHABET2.length >= 255) {
    throw new TypeError("Alphabet too long");
  }
  var BASE_MAP = new Uint8Array(256);
  for (var j = 0; j < BASE_MAP.length; j++) {
    BASE_MAP[j] = 255;
  }
  for (var i = 0; i < ALPHABET2.length; i++) {
    var x = ALPHABET2.charAt(i);
    var xc = x.charCodeAt(0);
    if (BASE_MAP[xc] !== 255) {
      throw new TypeError(x + " is ambiguous");
    }
    BASE_MAP[xc] = i;
  }
  var BASE = ALPHABET2.length;
  var LEADER = ALPHABET2.charAt(0);
  var FACTOR = Math.log(BASE) / Math.log(256);
  var iFACTOR = Math.log(256) / Math.log(BASE);
  function encode(source) {
    if (Array.isArray(source) || source instanceof Uint8Array) {
      source = _Buffer.from(source);
    }
    if (!_Buffer.isBuffer(source)) {
      throw new TypeError("Expected Buffer");
    }
    if (source.length === 0) {
      return "";
    }
    var zeroes = 0;
    var length = 0;
    var pbegin = 0;
    var pend = source.length;
    while (pbegin !== pend && source[pbegin] === 0) {
      pbegin++;
      zeroes++;
    }
    var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
    var b58 = new Uint8Array(size);
    while (pbegin !== pend) {
      var carry = source[pbegin];
      var i2 = 0;
      for (var it1 = size - 1; (carry !== 0 || i2 < length) && it1 !== -1; it1--, i2++) {
        carry += 256 * b58[it1] >>> 0;
        b58[it1] = carry % BASE >>> 0;
        carry = carry / BASE >>> 0;
      }
      if (carry !== 0) {
        throw new Error("Non-zero carry");
      }
      length = i2;
      pbegin++;
    }
    var it2 = size - length;
    while (it2 !== size && b58[it2] === 0) {
      it2++;
    }
    var str = LEADER.repeat(zeroes);
    for (; it2 < size; ++it2) {
      str += ALPHABET2.charAt(b58[it2]);
    }
    return str;
  }
  function decodeUnsafe(source) {
    if (typeof source !== "string") {
      throw new TypeError("Expected String");
    }
    if (source.length === 0) {
      return _Buffer.alloc(0);
    }
    var psz = 0;
    if (source[psz] === " ") {
      return;
    }
    var zeroes = 0;
    var length = 0;
    while (source[psz] === LEADER) {
      zeroes++;
      psz++;
    }
    var size = (source.length - psz) * FACTOR + 1 >>> 0;
    var b256 = new Uint8Array(size);
    while (source[psz]) {
      var carry = BASE_MAP[source.charCodeAt(psz)];
      if (carry === 255) {
        return;
      }
      var i2 = 0;
      for (var it3 = size - 1; (carry !== 0 || i2 < length) && it3 !== -1; it3--, i2++) {
        carry += BASE * b256[it3] >>> 0;
        b256[it3] = carry % 256 >>> 0;
        carry = carry / 256 >>> 0;
      }
      if (carry !== 0) {
        throw new Error("Non-zero carry");
      }
      length = i2;
      psz++;
    }
    if (source[psz] === " ") {
      return;
    }
    var it4 = size - length;
    while (it4 !== size && b256[it4] === 0) {
      it4++;
    }
    var vch = _Buffer.allocUnsafe(zeroes + (size - it4));
    vch.fill(0, 0, zeroes);
    var j2 = zeroes;
    while (it4 !== size) {
      vch[j2++] = b256[it4++];
    }
    return vch;
  }
  function decode(string) {
    var buffer = decodeUnsafe(string);
    if (buffer) {
      return buffer;
    }
    throw new Error("Non-base" + BASE + " character");
  }
  return {
    encode,
    decodeUnsafe,
    decode
  };
}
var src = base;
var basex = src;
var ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var bs58 = basex(ALPHABET);
class Base58 {
  encode(buffer) {
    return bs58.encode(buffer);
  }
  decode(str) {
    return bs58.decode(str);
  }
}
class Encoding {
  constructor() {
    this.utf8 = new UTF8();
    this.base64 = new Base64();
    this.base58 = new Base58();
  }
}
class OlmWorker {
  constructor(workerPool) {
    this._workerPool = workerPool;
  }
  megolmDecrypt(session, ciphertext) {
    const sessionKey = session.export_session(session.first_known_index());
    return this._workerPool.send({ type: "megolm_decrypt", ciphertext, sessionKey });
  }
  async createAccountAndOTKs(account, otkAmount) {
    let randomValues;
    if (window.msCrypto) {
      randomValues = [
        window.msCrypto.getRandomValues(new Uint8Array(64)),
        window.msCrypto.getRandomValues(new Uint8Array(otkAmount * 32))
      ];
    }
    const pickle = await this._workerPool.send({ type: "olm_create_account_otks", randomValues, otkAmount }).response();
    account.unpickle("", pickle);
  }
  async createOutboundOlmSession(account, newSession, theirIdentityKey, theirOneTimeKey) {
    const accountPickle = account.pickle("");
    let randomValues;
    if (window.msCrypto) {
      randomValues = [
        window.msCrypto.getRandomValues(new Uint8Array(64))
      ];
    }
    const sessionPickle = await this._workerPool.send({ type: "olm_create_outbound", accountPickle, theirIdentityKey, theirOneTimeKey, randomValues }).response();
    newSession.unpickle("", sessionPickle);
  }
  dispose() {
    this._workerPool.dispose();
  }
}
class LogItem {
  constructor(labelOrValues, logLevel, logger, filterCreator) {
    this._logger = logger;
    this.start = logger._now();
    this._values = typeof labelOrValues === "string" ? { l: labelOrValues } : labelOrValues;
    this.logLevel = logLevel;
    this._filterCreator = filterCreator;
  }
  runDetached(labelOrValues, callback, logLevel, filterCreator) {
    return this._logger.runDetached(labelOrValues, callback, logLevel, filterCreator);
  }
  wrapDetached(labelOrValues, callback, logLevel, filterCreator) {
    this.refDetached(this.runDetached(labelOrValues, callback, logLevel, filterCreator));
  }
  refDetached(logItem, logLevel) {
    logItem.ensureRefId();
    this.log({ ref: logItem.values.refId }, logLevel);
  }
  ensureRefId() {
    if (!this._values.refId) {
      this.set("refId", this._logger._createRefId());
    }
  }
  wrap(labelOrValues, callback, logLevel, filterCreator) {
    const item = this.child(labelOrValues, logLevel, filterCreator);
    return item.run(callback);
  }
  get duration() {
    if (this.end) {
      return this.end - this.start;
    } else {
      return void 0;
    }
  }
  durationWithoutType(type) {
    const durationOfType = this.durationOfType(type);
    if (this.duration && durationOfType) {
      return this.duration - durationOfType;
    }
  }
  durationOfType(type) {
    if (this._values.t === type) {
      return this.duration;
    } else if (this._children) {
      return this._children.reduce((sum, c) => {
        const duration = c.durationOfType(type);
        return sum + (duration != null ? duration : 0);
      }, 0);
    } else {
      return 0;
    }
  }
  log(labelOrValues, logLevel) {
    const item = this.child(labelOrValues, logLevel);
    item.end = item.start;
    return item;
  }
  set(key, value) {
    if (typeof key === "object") {
      const values = key;
      Object.assign(this._values, values);
    } else {
      this._values[key] = value;
    }
    return this;
  }
  serialize(filter, parentStartTime, forced) {
    if (this._filterCreator) {
      try {
        filter = this._filterCreator(new LogFilter(filter), this);
      } catch (err) {
        console.error("Error creating log filter", err);
      }
    }
    let children = null;
    if (this._children) {
      children = this._children.reduce((array, c) => {
        const s = c.serialize(filter, this.start, false);
        if (s) {
          if (array === null) {
            array = [];
          }
          array.push(s);
        }
        return array;
      }, null);
    }
    if (filter && !filter.filter(this, children)) {
      return;
    }
    const item = {
      s: typeof parentStartTime === "number" ? this.start - parentStartTime : this.start,
      d: this.duration,
      v: this._values,
      l: this.logLevel
    };
    if (this.error) {
      item.e = {
        stack: this.error.stack,
        name: this.error.name,
        message: this.error.message.split("\n")[0]
      };
    }
    if (forced) {
      item.f = true;
    }
    if (children) {
      item.c = children;
    }
    return item;
  }
  run(callback) {
    if (this.end !== void 0) {
      console.trace("log item is finished, additional logs will likely not be recorded");
    }
    try {
      const result = callback(this);
      if (result instanceof Promise) {
        return result.then((promiseResult) => {
          this.finish();
          return promiseResult;
        }, (err) => {
          throw this.catch(err);
        });
      } else {
        this.finish();
        return result;
      }
    } catch (err) {
      throw this.catch(err);
    }
  }
  finish() {
    if (this.end === void 0) {
      if (this._children) {
        for (const c of this._children) {
          c.finish();
        }
      }
      this.end = this._logger._now();
    }
  }
  get level() {
    return LogLevel;
  }
  catch(err) {
    this.error = err;
    this.logLevel = LogLevel.Error;
    this.finish();
    return err;
  }
  child(labelOrValues, logLevel, filterCreator) {
    if (this.end) {
      console.trace("log item is finished, additional logs will likely not be recorded");
    }
    if (!logLevel) {
      logLevel = this.logLevel || LogLevel.Info;
    }
    const item = new LogItem(labelOrValues, logLevel, this._logger, filterCreator);
    if (!this._children) {
      this._children = [];
    }
    this._children.push(item);
    return item;
  }
  get logger() {
    return this._logger;
  }
  get values() {
    return this._values;
  }
  get children() {
    return this._children;
  }
}
class BaseLogger {
  constructor({ platform: platform2, serializedTransformer = (item) => item }) {
    this._openItems = /* @__PURE__ */ new Set();
    this._platform = platform2;
    this._serializedTransformer = serializedTransformer;
  }
  log(labelOrValues, logLevel = LogLevel.Info) {
    const item = new LogItem(labelOrValues, logLevel, this);
    item.end = item.start;
    this._persistItem(item, void 0, false);
  }
  wrapOrRun(item, labelOrValues, callback, logLevel, filterCreator) {
    if (item) {
      return item.wrap(labelOrValues, callback, logLevel, filterCreator);
    } else {
      return this.run(labelOrValues, callback, logLevel, filterCreator);
    }
  }
  runDetached(labelOrValues, callback, logLevel, filterCreator) {
    if (!logLevel) {
      logLevel = LogLevel.Info;
    }
    const item = new LogItem(labelOrValues, logLevel, this);
    this._run(item, callback, logLevel, false, filterCreator);
    return item;
  }
  run(labelOrValues, callback, logLevel, filterCreator) {
    if (logLevel === void 0) {
      logLevel = LogLevel.Info;
    }
    const item = new LogItem(labelOrValues, logLevel, this);
    return this._run(item, callback, logLevel, true, filterCreator);
  }
  _run(item, callback, logLevel, wantResult, filterCreator) {
    this._openItems.add(item);
    const finishItem = () => {
      let filter = new LogFilter();
      if (filterCreator) {
        try {
          filter = filterCreator(filter, item);
        } catch (err) {
          console.error("Error while creating log filter", err);
        }
      } else {
        filter = filter.minLevel(logLevel);
      }
      try {
        this._persistItem(item, filter, false);
      } catch (err) {
        console.error("Could not persist log item", err);
      }
      this._openItems.delete(item);
    };
    try {
      let result = item.run(callback);
      if (result instanceof Promise) {
        result = result.then((promiseResult) => {
          finishItem();
          return promiseResult;
        }, (err) => {
          finishItem();
          if (wantResult) {
            throw err;
          }
        });
        if (wantResult) {
          return result;
        }
      } else {
        finishItem();
        if (wantResult) {
          return result;
        }
      }
    } catch (err) {
      finishItem();
      if (wantResult) {
        throw err;
      }
    }
  }
  _finishOpenItems() {
    for (const openItem of this._openItems) {
      openItem.finish();
      try {
        this._persistItem(openItem, new LogFilter(), true);
      } catch (err) {
        console.error("Could not serialize log item", err);
      }
    }
    this._openItems.clear();
  }
  get level() {
    return LogLevel;
  }
  _now() {
    return this._platform.clock.now();
  }
  _createRefId() {
    return Math.round(this._platform.random() * Number.MAX_SAFE_INTEGER);
  }
}
class IDBLogger extends BaseLogger {
  constructor(options) {
    super(options);
    const { name, flushInterval = 60 * 1e3, limit = 3e3 } = options;
    this._name = name;
    this._limit = limit;
    this._queuedItems = this._loadQueuedItems();
    window.addEventListener("pagehide", this, false);
    this._flushInterval = this._platform.clock.createInterval(() => this._tryFlush(), flushInterval);
  }
  dispose() {
    window.removeEventListener("pagehide", this, false);
    this._flushInterval.dispose();
  }
  handleEvent(evt) {
    if (evt.type === "pagehide") {
      this._finishAllAndFlush();
    }
  }
  async _tryFlush() {
    const db = await this._openDB();
    try {
      const txn = db.transaction(["logs"], "readwrite");
      const logs = txn.objectStore("logs");
      const amount = this._queuedItems.length;
      for (const i of this._queuedItems) {
        logs.add(i);
      }
      const itemCount = await reqAsPromise(logs.count());
      if (itemCount > this._limit) {
        let deleteAmount = itemCount - this._limit + Math.round(0.1 * this._limit);
        await iterateCursor(logs.openCursor(), (_, __, cursor) => {
          cursor.delete();
          deleteAmount -= 1;
          return { done: deleteAmount === 0 };
        });
      }
      await txnAsPromise(txn);
      this._queuedItems.splice(0, amount);
    } catch (err) {
      console.error("Could not flush logs", err);
    } finally {
      try {
        db.close();
      } catch (e) {
      }
    }
  }
  _finishAllAndFlush() {
    this._finishOpenItems();
    this.log({ l: "pagehide, closing logs", t: "navigation" });
    this._persistQueuedItems(this._queuedItems);
  }
  _loadQueuedItems() {
    const key = `${this._name}_queuedItems`;
    try {
      const json = window.localStorage.getItem(key);
      if (json) {
        window.localStorage.removeItem(key);
        return JSON.parse(json);
      }
    } catch (err) {
      console.error("Could not load queued log items", err);
    }
    return [];
  }
  _openDB() {
    return openDatabase(this._name, (db) => db.createObjectStore("logs", { keyPath: "id", autoIncrement: true }), 1);
  }
  _persistItem(logItem, filter, forced) {
    const serializedItem = logItem.serialize(filter, void 0, forced);
    if (serializedItem) {
      const transformedSerializedItem = this._serializedTransformer(serializedItem);
      this._queuedItems.push({
        json: JSON.stringify(transformedSerializedItem)
      });
    }
  }
  _persistQueuedItems(items) {
    try {
      window.localStorage.setItem(`${this._name}_queuedItems`, JSON.stringify(items));
    } catch (e) {
      console.error("Could not persist queued log items in localStorage, they will likely be lost", e);
    }
  }
  async export() {
    const db = await this._openDB();
    try {
      const txn = db.transaction(["logs"], "readonly");
      const logs = txn.objectStore("logs");
      const storedItems = await fetchResults(logs.openCursor(), () => false);
      const allItems = storedItems.concat(this._queuedItems);
      return new IDBLogExport(allItems, this, this._platform);
    } finally {
      try {
        db.close();
      } catch (e) {
      }
    }
  }
  async _removeItems(items) {
    const db = await this._openDB();
    try {
      const txn = db.transaction(["logs"], "readwrite");
      const logs = txn.objectStore("logs");
      for (const item of items) {
        if (typeof item.id === "number") {
          logs.delete(item.id);
        } else {
          const queuedIdx = this._queuedItems.indexOf(item);
          if (queuedIdx === -1) {
            this._queuedItems.splice(queuedIdx, 1);
          }
        }
      }
      await txnAsPromise(txn);
    } finally {
      try {
        db.close();
      } catch (e) {
      }
    }
  }
}
class IDBLogExport {
  constructor(items, logger, platform2) {
    this._items = items;
    this._logger = logger;
    this._platform = platform2;
  }
  get count() {
    return this._items.length;
  }
  removeFromStore() {
    return this._logger._removeItems(this._items);
  }
  asBlob() {
    var _a;
    const log = {
      formatVersion: 1,
      appVersion: (_a = this._platform.updateService) == null ? void 0 : _a.version,
      items: this._items.map((i) => JSON.parse(i.json))
    };
    const json = JSON.stringify(log);
    const buffer = this._platform.encoding.utf8.encode(json);
    const blob = this._platform.createBlob(buffer, "application/json");
    return blob;
  }
}
class ConsoleLogger extends BaseLogger {
  _persistItem(item) {
    printToConsole(item);
  }
  async export() {
    return void 0;
  }
}
const excludedKeysFromTable = ["l", "id"];
function filterValues(values) {
  return Object.entries(values).filter(([key]) => !excludedKeysFromTable.includes(key)).reduce((obj, [key, value]) => {
    obj = obj || {};
    obj[key] = value;
    return obj;
  }, null);
}
function printToConsole(item) {
  const label = `${itemCaption(item)} (${item.duration}ms)`;
  const filteredValues = filterValues(item.values);
  const shouldGroup = item.children || filteredValues;
  if (shouldGroup) {
    if (item.error) {
      console.group(label);
    } else {
      console.groupCollapsed(label);
    }
    if (item.error) {
      console.error(item.error);
    }
  } else {
    if (item.error) {
      console.error(item.error);
    } else {
      console.log(label);
    }
  }
  if (filteredValues) {
    console.table(filteredValues);
  }
  if (item.children) {
    for (const c of item.children) {
      printToConsole(c);
    }
  }
  if (shouldGroup) {
    console.groupEnd();
  }
}
function itemCaption(item) {
  if (item.values.t === "network") {
    return `${item.values.method} ${item.values.url}`;
  } else if (item.values.l && typeof item.values.id !== "undefined") {
    return `${item.values.l} ${item.values.id}`;
  } else if (item.values.l && typeof item.values.status !== "undefined") {
    return `${item.values.l} (${item.values.status})`;
  } else if (item.values.l && item.error) {
    return `${item.values.l} failed`;
  } else if (typeof item.values.ref !== "undefined") {
    return `ref ${item.values.ref}`;
  } else {
    return item.values.l || item.values.type;
  }
}
function isChildren(children) {
  return typeof children !== "object" || "nodeType" in children || Array.isArray(children);
}
function classNames(obj, value) {
  return Object.entries(obj).reduce((cn, [name, enabled]) => {
    if (typeof enabled === "function") {
      enabled = enabled(value);
    }
    if (enabled) {
      return cn + (cn.length ? " " : "") + name;
    } else {
      return cn;
    }
  }, "");
}
function setAttribute(el2, name, value) {
  if (name === "className") {
    name = "class";
  }
  if (value === false) {
    el2.removeAttribute(name);
  } else {
    if (value === true) {
      value = name;
    }
    el2.setAttribute(name, value);
  }
}
function el(elementName, attributes, children) {
  return elNS(HTML_NS, elementName, attributes, children);
}
function elNS(ns, elementName, attributes, children) {
  if (attributes && isChildren(attributes)) {
    children = attributes;
    attributes = void 0;
  }
  const e = document.createElementNS(ns, elementName);
  if (attributes) {
    for (let [name, value] of Object.entries(attributes)) {
      if (typeof value === "object") {
        value = value !== null && name === "className" ? classNames(value, void 0) : false;
      }
      setAttribute(e, name, value);
    }
  }
  if (children) {
    if (!Array.isArray(children)) {
      children = [children];
    }
    for (let c of children) {
      if (typeof c === "string") {
        c = text$1(c);
      }
      e.appendChild(c);
    }
  }
  return e;
}
function text$1(str) {
  return document.createTextNode(str);
}
const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";
const TAG_NAMES = {
  [HTML_NS]: [
    "br",
    "a",
    "ol",
    "ul",
    "li",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "strong",
    "em",
    "span",
    "img",
    "section",
    "header",
    "main",
    "footer",
    "article",
    "aside",
    "del",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "pre",
    "code",
    "button",
    "time",
    "input",
    "textarea",
    "select",
    "option",
    "label",
    "form",
    "progress",
    "output",
    "video",
    "style"
  ],
  [SVG_NS]: ["svg", "g", "path", "circle", "ellipse", "rect", "use"]
};
const tag = {};
for (const [ns, tags] of Object.entries(TAG_NAMES)) {
  for (const tagName of tags) {
    tag[tagName] = function(attributes, children) {
      return elNS(ns, tagName, attributes, children);
    };
  }
}
function mountView(view, mountArgs) {
  let node;
  try {
    node = view.mount(mountArgs);
  } catch (err) {
    console.error(err);
    node = errorToDOM(err);
  }
  return node;
}
function errorToDOM(error) {
  const stack = new Error().stack;
  let callee = null;
  if (stack) {
    callee = stack.split("\n")[1];
  }
  return tag.div([
    tag.h2("Something went wrong\u2026"),
    tag.h3(error.message),
    tag.p(`This occurred while running ${callee}.`),
    tag.pre(error.stack)
  ]);
}
function insertAt(parentNode, idx, childNode) {
  const isLast = idx === parentNode.childElementCount;
  if (isLast) {
    parentNode.appendChild(childNode);
  } else {
    const nextDomNode = parentNode.children[idx];
    parentNode.insertBefore(childNode, nextDomNode);
  }
}
function removeChildren(parentNode) {
  parentNode.innerHTML = "";
}
function disableTargetCallback(callback) {
  return async (evt) => {
    var _a, _b;
    (_a = evt.target) == null ? void 0 : _a.setAttribute("disabled", "disabled");
    await callback(evt);
    (_b = evt.target) == null ? void 0 : _b.removeAttribute("disabled");
  };
}
class ListView {
  constructor({ list, onItemClick, className, tagName = "ul", parentProvidesUpdates = true }, childCreator) {
    this._onItemClick = onItemClick;
    this._list = list;
    this._className = className;
    this._tagName = tagName;
    this._root = void 0;
    this._subscription = void 0;
    this._childCreator = childCreator;
    this._childInstances = void 0;
    this._mountArgs = { parentProvidesUpdates };
  }
  root() {
    return this._root;
  }
  update(attributes) {
    if (attributes.list) {
      if (this._subscription) {
        this._unloadList();
        while (this._root.lastChild) {
          this._root.lastChild.remove();
        }
      }
      this._list = attributes.list;
      this.loadList();
    }
  }
  mount() {
    const attr = {};
    if (this._className) {
      attr.className = this._className;
    }
    const root = this._root = el(this._tagName, attr);
    this.loadList();
    if (this._onItemClick) {
      root.addEventListener("click", this);
    }
    return root;
  }
  handleEvent(evt) {
    if (evt.type === "click") {
      this._handleClick(evt);
    }
  }
  unmount() {
    if (this._list) {
      this._unloadList();
    }
  }
  _handleClick(event2) {
    if (event2.target === this._root || !this._onItemClick) {
      return;
    }
    let childNode = event2.target;
    while (childNode.parentNode !== this._root) {
      childNode = childNode.parentNode;
    }
    const index = Array.prototype.indexOf.call(this._root.childNodes, childNode);
    const childView = this._childInstances[index];
    if (childView) {
      this._onItemClick(childView, event2);
    }
  }
  _unloadList() {
    this._subscription = this._subscription();
    for (let child of this._childInstances) {
      child.unmount();
    }
    this._childInstances = void 0;
  }
  loadList() {
    if (!this._list) {
      return;
    }
    this._subscription = this._list.subscribe(this);
    this._childInstances = [];
    const fragment = document.createDocumentFragment();
    for (let item of this._list) {
      const child = this._childCreator(item);
      this._childInstances.push(child);
      fragment.appendChild(mountView(child, this._mountArgs));
    }
    this._root.appendChild(fragment);
  }
  onReset() {
    for (const child of this._childInstances) {
      child.root().remove();
      child.unmount();
    }
    this._childInstances.length = 0;
  }
  onAdd(idx, value) {
    this.addChild(idx, value);
  }
  onRemove(idx, value) {
    this.removeChild(idx);
  }
  onMove(fromIdx, toIdx, value) {
    this.moveChild(fromIdx, toIdx);
  }
  onUpdate(i, value, params) {
    this.updateChild(i, value, params);
  }
  addChild(childIdx, value) {
    const child = this._childCreator(value);
    this._childInstances.splice(childIdx, 0, child);
    insertAt(this._root, childIdx, mountView(child, this._mountArgs));
  }
  removeChild(childIdx) {
    const [child] = this._childInstances.splice(childIdx, 1);
    child.root().remove();
    child.unmount();
  }
  moveChild(fromChildIdx, toChildIdx) {
    const [child] = this._childInstances.splice(fromChildIdx, 1);
    this._childInstances.splice(toChildIdx, 0, child);
    child.root().remove();
    insertAt(this._root, toChildIdx, child.root());
  }
  updateChild(childIdx, value, params) {
    if (this._childInstances) {
      const instance = this._childInstances[childIdx];
      instance && instance.update(value, params);
    }
  }
  recreateItem(index, value) {
    if (this._childInstances) {
      const child = this._childCreator(value);
      if (!child) {
        this.onRemove(index, value);
      } else {
        const [oldChild] = this._childInstances.splice(index, 1, child);
        this._root.replaceChild(child.mount(this._mountArgs), oldChild.root());
        oldChild.unmount();
      }
    }
  }
  getChildInstanceByIndex(idx) {
    var _a;
    return (_a = this._childInstances) == null ? void 0 : _a[idx];
  }
}
class BaseUpdateView {
  constructor(value) {
    this._value = value;
    this._boundUpdateFromValue = null;
  }
  subscribeOnMount(options) {
    const parentProvidesUpdates = options && options.parentProvidesUpdates;
    if (!parentProvidesUpdates) {
      this._subscribe();
    }
  }
  unmount() {
    this._unsubscribe();
  }
  get value() {
    return this._value;
  }
  _updateFromValue(changedProps) {
    this.update(this._value, changedProps);
  }
  _subscribe() {
    var _a;
    if (typeof ((_a = this._value) == null ? void 0 : _a.on) === "function") {
      this._boundUpdateFromValue = this._updateFromValue.bind(this);
      this._value.on("change", this._boundUpdateFromValue);
    }
  }
  _unsubscribe() {
    if (this._boundUpdateFromValue) {
      if (typeof this._value.off === "function") {
        this._value.off("change", this._boundUpdateFromValue);
      }
      this._boundUpdateFromValue = null;
    }
  }
}
function objHasFns(obj) {
  for (const value of Object.values(obj)) {
    if (typeof value === "function") {
      return true;
    }
  }
  return false;
}
class TemplateView extends BaseUpdateView {
  constructor() {
    super(...arguments);
    this._eventListeners = void 0;
    this._bindings = void 0;
    this._root = void 0;
    this._subViews = void 0;
  }
  _attach() {
    if (this._eventListeners) {
      for (let { node, name, fn, useCapture } of this._eventListeners) {
        node.addEventListener(name, fn, useCapture);
      }
    }
  }
  _detach() {
    if (this._eventListeners) {
      for (let { node, name, fn, useCapture } of this._eventListeners) {
        node.removeEventListener(name, fn, useCapture);
      }
    }
  }
  mount(options) {
    const builder = new TemplateBuilder(this);
    try {
      this._root = this.render(builder, this._value);
    } finally {
      builder.close();
    }
    this.subscribeOnMount(options);
    this._attach();
    return this._root;
  }
  unmount() {
    this._detach();
    super.unmount();
    if (this._subViews) {
      for (const v of this._subViews) {
        v.unmount();
      }
    }
  }
  root() {
    return this._root;
  }
  update(value, props) {
    this._value = value;
    if (this._bindings) {
      for (const binding of this._bindings) {
        binding();
      }
    }
  }
  _addEventListener(node, name, fn, useCapture = false) {
    if (!this._eventListeners) {
      this._eventListeners = [];
    }
    this._eventListeners.push({ node, name, fn, useCapture });
  }
  _addBinding(bindingFn) {
    if (!this._bindings) {
      this._bindings = [];
    }
    this._bindings.push(bindingFn);
  }
  addSubView(view) {
    if (!this._subViews) {
      this._subViews = [];
    }
    this._subViews.push(view);
  }
  removeSubView(view) {
    if (!this._subViews) {
      return;
    }
    const idx = this._subViews.indexOf(view);
    if (idx !== -1) {
      this._subViews.splice(idx, 1);
    }
  }
  updateSubViews(value, props) {
    if (this._subViews) {
      for (const v of this._subViews) {
        v.update(value, props);
      }
    }
  }
}
class TemplateBuilder {
  constructor(templateView) {
    this._closed = false;
    this._templateView = templateView;
  }
  close() {
    this._closed = true;
  }
  _addBinding(fn) {
    if (this._closed) {
      console.trace("Adding a binding after render will likely cause memory leaks");
    }
    this._templateView._addBinding(fn);
  }
  get _value() {
    return this._templateView.value;
  }
  addEventListener(node, name, fn, useCapture = false) {
    this._templateView._addEventListener(node, name, fn, useCapture);
  }
  _addAttributeBinding(node, name, fn) {
    let prevValue = void 0;
    const binding = () => {
      const newValue = fn(this._value);
      if (prevValue !== newValue) {
        prevValue = newValue;
        setAttribute(node, name, newValue);
      }
    };
    this._addBinding(binding);
    binding();
  }
  _addClassNamesBinding(node, obj) {
    this._addAttributeBinding(node, "className", (value) => classNames(obj, value));
  }
  _addTextBinding(fn) {
    const initialValue = fn(this._value) + "";
    const node = text$1(initialValue);
    let prevValue = initialValue;
    const binding = () => {
      const newValue = fn(this._value) + "";
      if (prevValue !== newValue) {
        prevValue = newValue;
        node.textContent = newValue;
      }
    };
    this._addBinding(binding);
    return node;
  }
  _isEventHandler(key, value) {
    return key.startsWith("on") && key.length > 2 && typeof value === "function";
  }
  _setNodeAttributes(node, attributes) {
    for (let [key, value] of Object.entries(attributes)) {
      if (typeof value === "object") {
        if (key !== "className" || value === null) {
          continue;
        }
        if (objHasFns(value)) {
          this._addClassNamesBinding(node, value);
        } else {
          setAttribute(node, key, classNames(value, this._value));
        }
      } else if (this._isEventHandler(key, value)) {
        const eventName = key.substr(2, 1).toLowerCase() + key.substr(3);
        const handler = value;
        this._templateView._addEventListener(node, eventName, handler);
      } else if (typeof value === "function") {
        this._addAttributeBinding(node, key, value);
      } else {
        setAttribute(node, key, value);
      }
    }
  }
  _setNodeChildren(node, children) {
    if (!Array.isArray(children)) {
      children = [children];
    }
    for (let child of children) {
      if (typeof child === "function") {
        child = this._addTextBinding(child);
      } else if (typeof child === "string") {
        child = text$1(child);
      }
      node.appendChild(child);
    }
  }
  _addReplaceNodeBinding(fn, renderNode) {
    let prevValue = fn(this._value);
    let node = renderNode(null);
    const binding = () => {
      const newValue = fn(this._value);
      if (prevValue !== newValue) {
        prevValue = newValue;
        const newNode = renderNode(node);
        if (node.parentNode) {
          node.parentNode.replaceChild(newNode, node);
        }
        node = newNode;
      }
    };
    this._addBinding(binding);
    return node;
  }
  el(name, attributes, children) {
    return this.elNS(HTML_NS, name, attributes, children);
  }
  elNS(ns, name, attributesOrChildren, children) {
    let attributes;
    if (attributesOrChildren) {
      if (isChildren(attributesOrChildren)) {
        children = attributesOrChildren;
      } else {
        attributes = attributesOrChildren;
      }
    }
    const node = document.createElementNS(ns, name);
    if (attributes) {
      this._setNodeAttributes(node, attributes);
    }
    if (children) {
      this._setNodeChildren(node, children);
    }
    return node;
  }
  view(view, mountOptions) {
    this._templateView.addSubView(view);
    return mountView(view, mountOptions);
  }
  mapView(mapFn, viewCreator) {
    return this._addReplaceNodeBinding(mapFn, (prevNode) => {
      if (prevNode && prevNode.nodeType !== Node.COMMENT_NODE) {
        const subViews = this._templateView._subViews;
        if (subViews) {
          const viewIdx = subViews.findIndex((v) => v.root() === prevNode);
          if (viewIdx !== -1) {
            const [view2] = subViews.splice(viewIdx, 1);
            view2.unmount();
          }
        }
      }
      const view = viewCreator(mapFn(this._value));
      if (view) {
        return this.view(view);
      } else {
        return document.createComment("node binding placeholder");
      }
    });
  }
  map(mapFn, renderFn) {
    return this.mapView(mapFn, (mappedValue) => {
      return new InlineTemplateView(this._value, (t, vm) => {
        const rootNode = renderFn(mappedValue, t, vm);
        if (!rootNode) {
          return document.createComment("map placeholder");
        }
        return rootNode;
      });
    });
  }
  ifView(predicate, viewCreator) {
    return this.mapView((value) => !!predicate(value), (enabled) => enabled ? viewCreator(this._value) : null);
  }
  if(predicate, renderFn) {
    return this.ifView(predicate, (vm) => new InlineTemplateView(vm, renderFn));
  }
  mapSideEffect(mapFn, sideEffect) {
    let prevValue = mapFn(this._value);
    const binding = () => {
      const newValue = mapFn(this._value);
      if (prevValue !== newValue) {
        sideEffect(newValue, prevValue);
        prevValue = newValue;
      }
    };
    this._addBinding(binding);
    sideEffect(prevValue, void 0);
  }
}
for (const [ns, tags] of Object.entries(TAG_NAMES)) {
  for (const tag2 of tags) {
    TemplateBuilder.prototype[tag2] = function(attributes, children) {
      return this.elNS(ns, tag2, attributes, children);
    };
  }
}
class InlineTemplateView extends TemplateView {
  constructor(value, render) {
    super(value);
    this._render = render;
  }
  render(t, value) {
    return this._render(t, value);
  }
}
function renderStaticAvatar(vm, size, extraClasses = void 0) {
  const hasAvatar = !!vm.avatarUrl(size);
  let avatarClasses = classNames({
    avatar: true,
    [`size-${size}`]: true,
    [`usercolor${vm.avatarColorNumber}`]: !hasAvatar
  });
  if (extraClasses) {
    avatarClasses += ` ${extraClasses}`;
  }
  const avatarContent = hasAvatar ? renderImg(vm, size) : text$1(vm.avatarLetter);
  const avatar = tag.div({ className: avatarClasses, "data-testid": "avatar" }, [avatarContent]);
  if (hasAvatar) {
    setAttribute(avatar, "data-avatar-letter", vm.avatarLetter);
    setAttribute(avatar, "data-avatar-color", vm.avatarColorNumber);
  }
  return avatar;
}
function renderImg(vm, size) {
  const sizeStr = size.toString();
  return tag.img({ src: vm.avatarUrl(size), width: sizeStr, height: sizeStr, title: vm.avatarTitle });
}
function isAvatarEvent(e) {
  const element = e.target;
  const parent = element.parentElement;
  return element.tagName === "IMG" && parent.classList.contains("avatar");
}
function handleAvatarError(e) {
  if (!isAvatarEvent(e)) {
    return;
  }
  const parent = e.target.parentElement;
  const avatarColorNumber = parent.getAttribute("data-avatar-color");
  parent.classList.add(`usercolor${avatarColorNumber}`);
  const avatarLetter = parent.getAttribute("data-avatar-letter");
  parent.textContent = avatarLetter;
}
class AvatarView extends BaseUpdateView {
  constructor(value, size) {
    super(value);
    this._root = null;
    this._avatarUrl = null;
    this._avatarTitle = null;
    this._avatarLetter = null;
    this._size = size;
  }
  _avatarUrlChanged() {
    if (this.value.avatarUrl(this._size) !== this._avatarUrl) {
      this._avatarUrl = this.value.avatarUrl(this._size);
      return true;
    }
    return false;
  }
  _avatarTitleChanged() {
    if (this.value.avatarTitle !== this._avatarTitle) {
      this._avatarTitle = this.value.avatarTitle;
      return true;
    }
    return false;
  }
  _avatarLetterChanged() {
    if (this.value.avatarLetter !== this._avatarLetter) {
      this._avatarLetter = this.value.avatarLetter;
      return true;
    }
    return false;
  }
  mount(options) {
    this._avatarUrlChanged();
    this._avatarLetterChanged();
    this._avatarTitleChanged();
    this._root = renderStaticAvatar(this.value, this._size);
    this.subscribeOnMount(options);
    return this._root;
  }
  root() {
    return this._root;
  }
  update(vm) {
    if (this._avatarUrlChanged()) {
      const bgColorClass = `usercolor${vm.avatarColorNumber}`;
      if (vm.avatarUrl(this._size)) {
        this._root.replaceChild(renderImg(vm, this._size), this._root.firstChild);
        this._root.classList.remove(bgColorClass);
      } else {
        this._root.textContent = vm.avatarLetter;
        this._root.classList.add(bgColorClass);
      }
    }
    const hasAvatar = !!vm.avatarUrl(this._size);
    if (this._avatarTitleChanged() && hasAvatar) {
      const element = this._root.firstChild;
      if (element.tagName === "IMG") {
        element.setAttribute("title", vm.avatarTitle);
      }
    }
    if (this._avatarLetterChanged() && !hasAvatar) {
      this._root.textContent = vm.avatarLetter;
    }
  }
}
let container;
function spinner(t, extraClasses = void 0) {
  if (container === void 0) {
    container = document.querySelector(".hydrogen");
  }
  const classes = Object.assign({ "spinner": true }, extraClasses);
  if (container == null ? void 0 : container.classList.contains("legacy")) {
    return t.div({ className: classes }, [
      t.div(),
      t.div(),
      t.div(),
      t.div()
    ]);
  } else {
    return t.svg({ className: classes, viewBox: "0 0 100 100" }, t.circle({ cx: "50%", cy: "50%", r: "45%", pathLength: "100" }));
  }
}
class RoomTileView extends TemplateView {
  render(t, vm) {
    const classes = {
      "active": (vm2) => vm2.isOpen,
      "hidden": (vm2) => vm2.hidden
    };
    return t.li({ "className": classes }, [
      t.a({ href: vm.url }, [
        t.view(new AvatarView(vm, 32), { parentProvidesUpdates: true }),
        t.div({ className: "description" }, [
          t.div({ className: { "name": true, unread: (vm2) => vm2.isUnread } }, (vm2) => vm2.name),
          t.map((vm2) => vm2.busy, (busy) => {
            if (busy) {
              return spinner(t);
            } else {
              return t.div({
                className: {
                  badge: true,
                  highlighted: (vm2) => vm2.isHighlighted,
                  hidden: (vm2) => !vm2.badgeCount
                }
              }, (vm2) => vm2.badgeCount);
            }
          })
        ])
      ])
    ]);
  }
  update(value, props) {
    super.update(value);
    this.updateSubViews(value, props);
  }
}
class Menu extends TemplateView {
  static option(label, callback) {
    return new MenuOption(label, callback);
  }
  constructor(options) {
    super();
    this._options = options;
  }
  render(t) {
    return t.ul({ className: "menu", role: "menu" }, this._options.map((o) => o.toDOM(t)));
  }
}
class MenuOption {
  constructor(label, callback) {
    this.label = label;
    this.callback = callback;
    this.icon = null;
    this.destructive = false;
  }
  setIcon(className) {
    this.icon = className;
    return this;
  }
  setDestructive() {
    this.destructive = true;
    return this;
  }
  toDOM(t) {
    const className = {
      destructive: this.destructive
    };
    if (this.icon) {
      className.icon = true;
      className[this.icon] = true;
    }
    return t.li({
      className
    }, t.button({ className: "menu-item", onClick: this.callback }, this.label));
  }
}
class Popup {
  constructor(view, closeCallback = null) {
    this._view = view;
    this._target = null;
    this._arrangement = null;
    this._scroller = null;
    this._fakeRoot = null;
    this._trackingTemplateView = null;
    this._closeCallback = closeCallback;
  }
  _getPopupContainer() {
    const appContainer = this._target.closest(".hydrogen");
    let popupContainer = appContainer.querySelector(".popupContainer");
    if (!popupContainer) {
      popupContainer = tag.div({ className: "popupContainer" });
      appContainer.appendChild(popupContainer);
    }
    return popupContainer;
  }
  trackInTemplateView(templateView) {
    this._trackingTemplateView = templateView;
    this._trackingTemplateView.addSubView(this);
  }
  showRelativeTo(target, verticalPadding = 0) {
    this._target = target;
    this._verticalPadding = verticalPadding;
    this._scroller = findScrollParent(this._target);
    this._view.mount();
    this._getPopupContainer().appendChild(this._popup);
    this._position();
    if (this._scroller) {
      document.body.addEventListener("scroll", this, true);
    }
    setTimeout(() => {
      document.body.addEventListener("click", this, false);
    }, 10);
  }
  get isOpen() {
    return !!this._view;
  }
  close() {
    if (this._view) {
      this._view.unmount();
      this._trackingTemplateView.removeSubView(this);
      if (this._scroller) {
        document.body.removeEventListener("scroll", this, true);
      }
      document.body.removeEventListener("click", this, false);
      this._popup.remove();
      this._view = null;
      if (this._closeCallback) {
        this._closeCallback();
      }
    }
  }
  get _popup() {
    return this._view.root();
  }
  handleEvent(evt) {
    if (evt.type === "scroll") {
      if (!this._position()) {
        this.close();
      }
    } else if (evt.type === "click") {
      this._onClick(evt);
    }
  }
  _onClick() {
    this.close();
  }
  _position() {
    const targetPosition = this._target.getBoundingClientRect();
    const popupWidth = this._popup.clientWidth;
    const popupHeight = this._popup.clientHeight;
    const viewport = (this._scroller ? this._scroller : document.documentElement).getBoundingClientRect();
    if (targetPosition.top > viewport.bottom || targetPosition.left > viewport.right || targetPosition.bottom < viewport.top || targetPosition.right < viewport.left) {
      return false;
    }
    if (viewport.bottom >= targetPosition.bottom + popupHeight) {
      this._popup.style.top = `${targetPosition.bottom + this._verticalPadding}px`;
    } else if (viewport.top <= targetPosition.top - popupHeight) {
      this._popup.style.top = `${targetPosition.top - popupHeight - this._verticalPadding}px`;
    } else {
      return false;
    }
    if (viewport.right >= targetPosition.right + popupWidth) {
      this._popup.style.left = `${targetPosition.left}px`;
    } else if (viewport.left <= targetPosition.left - popupWidth) {
      this._popup.style.left = `${targetPosition.right - popupWidth}px`;
    } else {
      return false;
    }
    return true;
  }
  root() {
    return this._fakeRoot;
  }
  mount() {
    this._fakeRoot = document.createComment("popup");
    return this._fakeRoot;
  }
  unmount() {
    this.close();
  }
  update() {
  }
}
function findScrollParent(el2) {
  let parent = el2;
  do {
    parent = parent.parentElement;
    if (parent.scrollHeight > parent.clientHeight) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.getPropertyValue("overflow-y");
      if (overflowY === "auto" || overflowY === "scroll") {
        return parent;
      }
    }
  } while (parent !== document.body);
}
class FilterField extends TemplateView {
  render(t, options) {
    const clear = () => {
      filterInput.value = "";
      filterInput.blur();
      clearButton.blur();
      options.clear();
    };
    const filterInput = t.input({
      type: "text",
      placeholder: options == null ? void 0 : options.label,
      "aria-label": options == null ? void 0 : options.label,
      autocomplete: options == null ? void 0 : options.autocomplete,
      enterkeyhint: "search",
      name: options == null ? void 0 : options.name,
      onInput: (event2) => options.set(event2.target.value),
      onKeydown: (event2) => {
        if (event2.key === "Escape" || event2.key === "Esc") {
          clear();
        }
      },
      onFocus: () => filterInput.select()
    });
    const clearButton = t.button({
      onClick: clear,
      title: options.i18n`Clear`,
      "aria-label": options.i18n`Clear`
    });
    return t.div({ className: "FilterField" }, [filterInput, clearButton]);
  }
}
class LeftPanelView extends TemplateView {
  constructor(vm) {
    super(vm);
    this._createMenuPopup = null;
  }
  render(t, vm) {
    const gridButtonLabel = (vm2) => {
      return vm2.gridEnabled ? vm2.i18n`Show single room` : vm2.i18n`Enable grid layout`;
    };
    const roomList = t.view(new ListView({
      className: "RoomList",
      list: vm.tileViewModels
    }, (tileVM) => new RoomTileView(tileVM)));
    const utilitiesRow = t.div({ className: "utilities" }, [
      t.a({ className: "button-utility close-session", href: vm.closeUrl, "aria-label": vm.i18n`Back to account list`, title: vm.i18n`Back to account list` }),
      t.view(new FilterField({
        i18n: vm.i18n,
        label: vm.i18n`Filter rooms…`,
        name: "room-filter",
        autocomplete: true,
        set: (query) => {
          if (vm.setFilter(query)) {
            roomList.scrollTop = 0;
          }
        },
        clear: () => vm.clearFilter()
      })),
      t.button({
        onClick: () => vm.toggleGrid(),
        className: {
          "button-utility": true,
          grid: true,
          on: (vm2) => vm2.gridEnabled
        },
        title: gridButtonLabel,
        "aria-label": gridButtonLabel
      }),
      t.a({ className: "button-utility settings", href: vm.settingsUrl, "aria-label": vm.i18n`Settings`, title: vm.i18n`Settings` }),
      t.button({
        className: "button-utility create",
        "aria-label": vm.i18n`Create room`,
        onClick: (evt) => this._toggleCreateMenu(evt)
      })
    ]);
    return t.div({ className: "LeftPanel" }, [
      utilitiesRow,
      roomList
    ]);
  }
  _toggleCreateMenu(evt) {
    if (this._createMenuPopup && this._createMenuPopup.isOpen) {
      this._createMenuPopup.close();
    } else {
      const vm = this.value;
      const options = [];
      options.push(Menu.option(vm.i18n`Create Room`, () => vm.showCreateRoomView()));
      options.push(Menu.option(vm.i18n`Join Room`, () => vm.showJoinRoomView()));
      this._createMenuPopup = new Popup(new Menu(options));
      this._createMenuPopup.trackInTemplateView(this);
      this._createMenuPopup.showRelativeTo(evt.target, 10);
    }
  }
}
function bottom(node) {
  return node.offsetTop + node.clientHeight;
}
function findFirstNodeIndexAtOrBelow(tiles, top, startIndex = tiles.children.length - 1) {
  for (var i = startIndex; i >= 0; i--) {
    const node = tiles.children[i];
    if (node.offsetTop < top) {
      return i;
    }
  }
  return 0;
}
class TimelineView extends TemplateView {
  constructor(vm, viewClassForTile2) {
    super(vm);
    this.viewClassForTile = viewClassForTile2;
    this.anchoredBottom = 0;
    this.stickToBottom = true;
  }
  render(t, vm) {
    requestAnimationFrame(() => {
      this.restoreScrollPosition();
    });
    this.tilesView = new TilesListView(vm.tiles, () => this.restoreScrollPosition(), this.viewClassForTile);
    const root = t.div({ className: "Timeline" }, [
      t.div({
        className: "Timeline_scroller bottom-aligned-scroll",
        onScroll: () => this.onScroll()
      }, t.view(this.tilesView)),
      t.button({
        className: {
          "Timeline_jumpDown": true,
          hidden: (vm2) => !vm2.showJumpDown
        },
        title: "Jump down",
        onClick: () => this.jumpDown()
      })
    ]);
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => {
        this.restoreScrollPosition();
      });
      this.resizeObserver.observe(root);
    }
    return root;
  }
  get scrollNode() {
    return this.root().firstElementChild;
  }
  get tilesNode() {
    return this.tilesView.root();
  }
  jumpDown() {
    const { scrollNode } = this;
    this.stickToBottom = true;
    scrollNode.scrollTop = scrollNode.scrollHeight;
  }
  unmount() {
    super.unmount();
    if (this.resizeObserver) {
      this.resizeObserver.unobserve(this.root());
      this.resizeObserver = void 0;
    }
  }
  restoreScrollPosition() {
    const { scrollNode, tilesNode } = this;
    const missingTilesHeight = scrollNode.clientHeight - tilesNode.clientHeight;
    if (missingTilesHeight > 0) {
      tilesNode.style.setProperty("margin-top", `${missingTilesHeight}px`);
      const len = this.value.tiles.length;
      this.updateVisibleRange(0, len - 1);
    } else {
      tilesNode.style.removeProperty("margin-top");
      if (this.stickToBottom) {
        scrollNode.scrollTop = scrollNode.scrollHeight;
      } else if (this.anchoredNode) {
        const newAnchoredBottom = bottom(this.anchoredNode);
        if (newAnchoredBottom !== this.anchoredBottom) {
          const bottomDiff = newAnchoredBottom - this.anchoredBottom;
          if (typeof scrollNode.scrollBy === "function") {
            scrollNode.scrollBy(0, bottomDiff);
          } else {
            scrollNode.scrollTop = scrollNode.scrollTop + bottomDiff;
          }
          this.anchoredBottom = newAnchoredBottom;
        }
      }
    }
  }
  onScroll() {
    const { scrollNode, tilesNode } = this;
    const { scrollHeight, scrollTop, clientHeight } = scrollNode;
    let bottomNodeIndex;
    this.stickToBottom = Math.abs(scrollHeight - (scrollTop + clientHeight)) < 1;
    if (this.stickToBottom) {
      const len = this.value.tiles.length;
      bottomNodeIndex = len - 1;
    } else {
      const viewportBottom = scrollTop + clientHeight;
      const anchoredNodeIndex = findFirstNodeIndexAtOrBelow(tilesNode, viewportBottom);
      this.anchoredNode = tilesNode.childNodes[anchoredNodeIndex];
      this.anchoredBottom = bottom(this.anchoredNode);
      bottomNodeIndex = anchoredNodeIndex;
    }
    let topNodeIndex = findFirstNodeIndexAtOrBelow(tilesNode, scrollTop, bottomNodeIndex);
    this.updateVisibleRange(topNodeIndex, bottomNodeIndex);
  }
  updateVisibleRange(startIndex, endIndex) {
    const firstVisibleChild = this.tilesView.getChildInstanceByIndex(startIndex);
    const lastVisibleChild = this.tilesView.getChildInstanceByIndex(endIndex);
    this.value.setVisibleTileRange(firstVisibleChild == null ? void 0 : firstVisibleChild.value, lastVisibleChild == null ? void 0 : lastVisibleChild.value);
  }
}
class TilesListView extends ListView {
  constructor(tiles, onChanged, viewClassForTile2) {
    super({
      list: tiles,
      onItemClick: (tileView, evt) => tileView.onClick(evt)
    }, (tile) => {
      const TileView = viewClassForTile2(tile);
      return new TileView(tile, viewClassForTile2);
    });
    this.viewClassForTile = viewClassForTile2;
    this.onChanged = onChanged;
  }
  onReset() {
    super.onReset();
    this.onChanged();
  }
  onUpdate(index, value, param) {
    if (param === "shape") {
      const ExpectedClass = this.viewClassForTile(value);
      const child = this.getChildInstanceByIndex(index);
      if (!ExpectedClass || !(child instanceof ExpectedClass)) {
        super.recreateItem(index, value);
        return;
      }
    }
    super.onUpdate(index, value, param);
    this.onChanged();
  }
  onAdd(idx, value) {
    super.onAdd(idx, value);
    this.onChanged();
  }
  onRemove(idx, value) {
    super.onRemove(idx, value);
    this.onChanged();
  }
  onMove(fromIdx, toIdx, value) {
    super.onMove(fromIdx, toIdx, value);
    this.onChanged();
  }
}
class TimelineLoadingView extends TemplateView {
  render(t, vm) {
    return t.div({ className: "TimelineLoadingView" }, [
      spinner(t),
      t.div(vm.isEncrypted ? vm.i18n`Loading encrypted messages…` : vm.i18n`Loading messages…`)
    ]);
  }
}
class MessageComposer extends TemplateView {
  constructor(viewModel, viewClassForTile2) {
    super(viewModel);
    this._viewClassForTile = viewClassForTile2;
    this._input = null;
    this._attachmentPopup = null;
    this._focusInput = null;
    this._rafResizeHandle = void 0;
  }
  render(t, vm) {
    this._input = t.textarea({
      onKeydown: (e) => this._onKeyDown(e),
      onInput: () => {
        vm.setInput(this._input.value);
        if (this._input.value) {
          this._adjustHeight();
        } else {
          this._clearHeight();
        }
      },
      placeholder: (vm2) => vm2.isEncrypted ? "Send an encrypted message\u2026" : "Send a message\u2026",
      rows: "1"
    });
    this._focusInput = () => this._input.focus();
    this.value.on("focus", this._focusInput);
    const replyPreview = t.map((vm2) => vm2.replyViewModel, (rvm, t2) => {
      const TileView = rvm && this._viewClassForTile(rvm);
      if (!TileView) {
        return null;
      }
      return t2.div({
        className: "MessageComposer_replyPreview"
      }, [
        t2.span({ className: "replying" }, "Replying"),
        t2.button({
          className: "cancel",
          onClick: () => this._clearReplyingTo()
        }, "Close"),
        t2.view(new TileView(rvm, this._viewClassForTile, { interactive: false }, "div"))
      ]);
    });
    const input = t.div({ className: "MessageComposer_input" }, [
      this._input,
      t.button({
        className: "sendFile",
        title: vm.i18n`Pick attachment`,
        onClick: (evt) => this._toggleAttachmentMenu(evt)
      }, vm.i18n`Send file`),
      t.button({
        className: "send",
        title: vm.i18n`Send`,
        onClick: () => this._trySend()
      }, vm.i18n`Send`)
    ]);
    return t.div({ className: {
      MessageComposer: true,
      MessageComposer_canSend: (vm2) => vm2.canSend
    } }, [replyPreview, input]);
  }
  unmount() {
    if (this._focusInput) {
      this.value.off("focus", this._focusInput);
    }
    super.unmount();
  }
  _clearReplyingTo() {
    this.value.clearReplyingTo();
  }
  async _trySend() {
    this._input.focus();
    const { value } = this._input;
    const restoreValue = () => {
      this._input.value = value;
      this._adjustHeight();
    };
    this._input.value = "";
    this._clearHeight();
    try {
      if (!await this.value.sendMessage(value)) {
        restoreValue();
      }
    } catch (err) {
      restoreValue();
      console.error(err);
    }
  }
  _onKeyDown(event2) {
    if (event2.key === "Enter" && !event2.shiftKey) {
      event2.preventDefault();
      this._trySend();
    }
  }
  _toggleAttachmentMenu(evt) {
    if (this._attachmentPopup && this._attachmentPopup.isOpen) {
      this._attachmentPopup.close();
    } else {
      const vm = this.value;
      this._attachmentPopup = new Popup(new Menu([
        Menu.option(vm.i18n`Send video`, () => vm.sendVideo()).setIcon("video"),
        Menu.option(vm.i18n`Send picture`, () => vm.sendPicture()).setIcon("picture"),
        Menu.option(vm.i18n`Send file`, () => vm.sendFile()).setIcon("file")
      ]));
      this._attachmentPopup.trackInTemplateView(this);
      this._attachmentPopup.showRelativeTo(evt.target, 12);
    }
  }
  _adjustHeight() {
    if (this._rafResizeHandle) {
      return;
    }
    this._rafResizeHandle = window.requestAnimationFrame(() => {
      const scrollHeight = this._input.scrollHeight;
      this._input.style.height = `${scrollHeight}px`;
      this._rafResizeHandle = void 0;
    });
  }
  _clearHeight() {
    this._input.style.removeProperty("height");
  }
}
class DisabledComposerView extends TemplateView {
  render(t) {
    return t.div({ className: "DisabledComposerView" }, t.h3((vm) => vm.description));
  }
}
class RoomView extends TemplateView {
  constructor(vm, viewClassForTile2) {
    super(vm);
    this._viewClassForTile = viewClassForTile2;
    this._optionsPopup = null;
  }
  render(t, vm) {
    return t.main({ className: "RoomView middle" }, [
      t.div({ className: "RoomHeader middle-header" }, [
        t.a({ className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close room` }),
        t.view(new AvatarView(vm, 32)),
        t.div({ className: "room-description" }, [
          t.h2((vm2) => vm2.name)
        ]),
        t.button({
          className: "button-utility room-options",
          "aria-label": vm.i18n`Room options`,
          onClick: (evt) => this._toggleOptionsMenu(evt)
        })
      ]),
      t.div({ className: "RoomView_body" }, [
        t.div({ className: "RoomView_error" }, [
          t.if((vm2) => vm2.error, (t2) => t2.div([
            t2.p({}, (vm2) => vm2.error),
            t2.button({ className: "RoomView_error_closerButton", onClick: (evt) => vm.dismissError(evt) })
          ]))
        ]),
        t.mapView((vm2) => vm2.timelineViewModel, (timelineViewModel) => {
          return timelineViewModel ? new TimelineView(timelineViewModel, this._viewClassForTile) : new TimelineLoadingView(vm);
        }),
        t.mapView((vm2) => vm2.composerViewModel, (composerViewModel) => {
          switch (composerViewModel == null ? void 0 : composerViewModel.kind) {
            case "composer":
              return new MessageComposer(vm.composerViewModel, this._viewClassForTile);
            case "disabled":
              return new DisabledComposerView(vm.composerViewModel);
          }
        })
      ])
    ]);
  }
  _toggleOptionsMenu(evt) {
    if (this._optionsPopup && this._optionsPopup.isOpen) {
      this._optionsPopup.close();
    } else {
      const vm = this.value;
      const options = [];
      options.push(Menu.option(vm.i18n`Room details`, () => vm.openDetailsPanel()));
      if (vm.canLeave) {
        options.push(Menu.option(vm.i18n`Leave room`, () => this._confirmToLeaveRoom()).setDestructive());
      }
      if (vm.canForget) {
        options.push(Menu.option(vm.i18n`Forget room`, () => vm.forgetRoom()).setDestructive());
      }
      if (vm.canRejoin) {
        options.push(Menu.option(vm.i18n`Rejoin room`, () => vm.rejoinRoom()));
      }
      if (!options.length) {
        return;
      }
      this._optionsPopup = new Popup(new Menu(options));
      this._optionsPopup.trackInTemplateView(this);
      this._optionsPopup.showRelativeTo(evt.target, 10);
    }
  }
  _confirmToLeaveRoom() {
    if (confirm(this.value.i18n`Are you sure you want to leave "${this.value.name}"?`)) {
      this.value.leaveRoom();
    }
  }
}
class UnknownRoomView extends TemplateView {
  render(t, vm) {
    return t.main({ className: "UnknownRoomView middle" }, t.div([
      t.h2([
        vm.i18n`You are currently not in ${vm.roomIdOrAlias}.`,
        t.br(),
        vm.i18n`Want to join it?`
      ]),
      t.button({
        className: "button-action primary",
        onClick: () => vm.join(),
        disabled: (vm2) => vm2.busy
      }, vm.i18n`Join room`),
      t.if((vm2) => vm2.error, (t2) => t2.p({ className: "error" }, vm.error))
    ]));
  }
}
class StaticView {
  constructor(value, render = void 0) {
    if (typeof value === "function" && !render) {
      render = value;
      value = null;
    }
    this._root = render ? render(tag, value) : this.render(tag, value);
  }
  mount() {
    return this._root;
  }
  root() {
    return this._root;
  }
  unmount() {
  }
  update() {
  }
}
class LoadingView extends StaticView {
  constructor(label = "Loading") {
    super(label, (t, label2) => {
      return t.div({ className: "LoadingView" }, [spinner(t), label2]);
    });
  }
}
class RoomBeingCreatedView extends TemplateView {
  render(t, vm) {
    return t.main({ className: "RoomView middle" }, [
      t.div({ className: "RoomHeader middle-header" }, [
        t.a({ className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close room` }),
        t.view(new AvatarView(vm, 32)),
        t.div({ className: "room-description" }, [
          t.h2((vm2) => vm2.name)
        ])
      ]),
      t.div({ className: "RoomView_body" }, [
        t.mapView((vm2) => vm2.error, (error) => {
          if (error) {
            return new ErrorView(vm);
          } else {
            return new LoadingView(vm.i18n`Setting up the room…`);
          }
        })
      ])
    ]);
  }
}
class ErrorView extends TemplateView {
  render(t, vm) {
    return t.div({ className: "RoomBeingCreated_error centered-column" }, [
      t.h3(vm.i18n`Could not create the room, something went wrong:`),
      t.div({ className: "RoomView_error form-group" }, vm.error),
      t.div({ className: "button-row" }, t.button({
        className: "button-action primary destructive",
        onClick: () => vm.cancel()
      }, vm.i18n`Cancel`))
    ]);
  }
}
class InviteView extends TemplateView {
  render(t, vm) {
    var _a;
    let inviteNodes = [];
    if (vm.isDirectMessage) {
      inviteNodes.push(renderStaticAvatar(vm, 128, "InviteView_dmAvatar"));
    }
    let inviterNodes;
    if (vm.isDirectMessage) {
      inviterNodes = [t.strong(vm.name), ` (${(_a = vm.inviter) == null ? void 0 : _a.id}) wants to chat with you.`];
    } else if (vm.inviter) {
      inviterNodes = [renderStaticAvatar(vm.inviter, 24), t.strong(vm.inviter.name), ` (${vm.inviter.id}) invited you.`];
    } else {
      inviterNodes = `You were invited to join.`;
    }
    inviteNodes.push(t.p({ className: "InviteView_inviter" }, inviterNodes));
    if (!vm.isDirectMessage) {
      inviteNodes.push(t.div({ className: "InviteView_roomProfile" }, [
        renderStaticAvatar(vm, 64, "InviteView_roomAvatar"),
        t.h3(vm.name),
        t.p({ className: "InviteView_roomDescription" }, vm.roomDescription)
      ]));
    }
    return t.main({ className: "InviteView middle" }, [
      t.div({ className: "RoomHeader middle-header" }, [
        t.a({ className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close invite` }),
        renderStaticAvatar(vm, 32),
        t.div({ className: "room-description" }, [
          t.h2((vm2) => vm2.name)
        ])
      ]),
      t.if((vm2) => vm2.error, (t2) => t2.div({ className: "RoomView_error" }, (vm2) => vm2.error)),
      t.div({ className: "InviteView_body" }, [
        t.div({ className: "InviteView_invite" }, [
          ...inviteNodes,
          t.div({ className: "InviteView_buttonRow" }, t.button({
            className: "button-action primary",
            disabled: (vm2) => vm2.busy,
            onClick: () => vm.accept()
          }, vm.i18n`Accept`)),
          t.div({ className: "InviteView_buttonRow" }, t.button({
            className: "button-action primary destructive",
            disabled: (vm2) => vm2.busy,
            onClick: () => vm.reject()
          }, vm.i18n`Reject`))
        ])
      ])
    ]);
  }
}
class LightboxView extends TemplateView {
  render(t, vm) {
    const close = t.a({ href: vm.closeUrl, title: vm.i18n`Close`, className: "close" });
    const image = t.div({
      role: "img",
      "aria-label": (vm2) => vm2.name,
      title: (vm2) => vm2.name,
      className: {
        picture: true,
        hidden: (vm2) => !vm2.imageUrl
      },
      style: (vm2) => `background-image: url('${vm2.imageUrl}'); max-width: ${vm2.imageWidth}px; max-height: ${vm2.imageHeight}px;`
    });
    const loading = t.div({
      className: {
        loading: true,
        hidden: (vm2) => !!vm2.imageUrl
      }
    }, [
      spinner(t),
      t.div(vm.i18n`Loading image…`)
    ]);
    const details = t.div({
      className: "details"
    }, [t.strong((vm2) => vm2.name), t.br(), "uploaded by ", t.strong((vm2) => vm2.sender), (vm2) => ` at ${vm2.time} on ${vm2.date}.`]);
    const dialog = t.div({
      role: "dialog",
      className: "lightbox",
      onClick: (evt) => this.clickToClose(evt),
      onKeydown: (evt) => this.closeOnEscKey(evt)
    }, [image, loading, details, close]);
    trapFocus(t, dialog);
    return dialog;
  }
  clickToClose(evt) {
    if (evt.target === this.root()) {
      this.value.close();
    }
  }
  closeOnEscKey(evt) {
    if (evt.key === "Escape" || evt.key === "Esc") {
      this.value.close();
    }
  }
}
function trapFocus(t, element) {
  const elements = focusables(element);
  const first = elements[0];
  const last = elements[elements.length - 1];
  t.addEventListener(element, "keydown", (evt) => {
    if (evt.key === "Tab") {
      if (evt.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          evt.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          evt.preventDefault();
        }
      }
    }
  }, true);
  Promise.resolve().then(() => {
    first.focus();
  });
}
function focusables(element) {
  return element.querySelectorAll("a[href], button, textarea, input, select");
}
class SessionStatusView extends TemplateView {
  render(t, vm) {
    return t.div({ className: {
      "SessionStatusView": true,
      "hidden": (vm2) => !vm2.isShown
    } }, [
      spinner(t, { hidden: (vm2) => !vm2.isWaiting }),
      t.p((vm2) => vm2.statusLabel),
      t.if((vm2) => vm2.isConnectNowShown, (t2) => t2.button({ className: "link", onClick: () => vm.connectNow() }, "Retry now")),
      t.if((vm2) => vm2.isSecretStorageShown, (t2) => t2.a({ href: vm.setupKeyBackupUrl }, "Go to settings")),
      t.if((vm2) => vm2.canDismiss, (t2) => t2.div({ className: "end" }, t2.button({ className: "dismiss", onClick: () => vm.dismiss() })))
    ]);
  }
}
class RoomGridView extends TemplateView {
  constructor(vm, viewClassForTile2) {
    super(vm);
    this._viewClassForTile = viewClassForTile2;
  }
  render(t, vm) {
    const children = [];
    for (let i = 0; i < vm.height * vm.width; i += 1) {
      children.push(t.div({
        onClick: () => vm.focusTile(i),
        onFocusin: () => vm.focusTile(i),
        className: {
          "container": true,
          [`tile${i}`]: true,
          "focused": (vm2) => vm2.focusIndex === i
        }
      }, t.mapView((vm2) => vm2.roomViewModelAt(i), (roomVM) => {
        if (roomVM) {
          if (roomVM.kind === "roomBeingCreated") {
            return new RoomBeingCreatedView(roomVM);
          } else if (roomVM.kind === "invite") {
            return new InviteView(roomVM);
          } else {
            return new RoomView(roomVM, this._viewClassForTile);
          }
        } else {
          return new StaticView((t2) => t2.div({ className: "room-placeholder" }, [
            t2.h2({ className: "focused" }, vm.i18n`Select a room on the left`),
            t2.h2({ className: "unfocused" }, vm.i18n`Click to select this tile`)
          ]));
        }
      })));
    }
    children.push(t.div({ className: (vm2) => `focus-ring tile${vm2.focusIndex}` }));
    return t.div({ className: "RoomGridView middle layout3x2" }, children);
  }
}
class KeyBackupSettingsView extends TemplateView {
  render(t) {
    return t.div([
      t.map((vm) => vm.status, (status, t2, vm) => {
        switch (status) {
          case "Enabled":
            return renderEnabled(t2, vm);
          case "NewVersionAvailable":
            return renderNewVersionAvailable(t2, vm);
          case "SetupKey":
            return renderEnableFromKey(t2, vm);
          case "SetupPhrase":
            return renderEnableFromPhrase(t2, vm);
          case "Pending":
            return t2.p(vm.i18n`Waiting to go online…`);
        }
      }),
      t.map((vm) => vm.backupWriteStatus, (status, t2, vm) => {
        switch (status) {
          case "Writing": {
            const progress = t2.progress({
              min: 0,
              max: 100,
              value: (vm2) => vm2.backupPercentage
            });
            return t2.div([`Backup in progress `, progress, " ", (vm2) => vm2.backupInProgressLabel]);
          }
          case "Stopped": {
            let label;
            const error = vm.backupError;
            if (error) {
              label = `Backup has stopped because of an error: ${vm.backupError}`;
            } else {
              label = `Backup has stopped`;
            }
            return t2.p(label, " ", t2.button({ onClick: () => vm.startBackup() }, `Backup now`));
          }
          case "Done":
            return t2.p(`All keys are backed up.`);
          default:
            return null;
        }
      })
    ]);
  }
}
function renderEnabled(t, vm) {
  const items = [
    t.p([vm.i18n`Key backup is enabled, using backup version ${vm.backupVersion}. `, t.button({ onClick: () => vm.disable() }, vm.i18n`Disable`)])
  ];
  if (vm.dehydratedDeviceId) {
    items.push(t.p(vm.i18n`A dehydrated device id was set up with id ${vm.dehydratedDeviceId} which you can use during your next login with your secret storage key.`));
  }
  return t.div(items);
}
function renderNewVersionAvailable(t, vm) {
  const items = [
    t.p([vm.i18n`A new backup version has been created from another device. Disable key backup and enable it again with the new key.`, t.button({ onClick: () => vm.disable() }, vm.i18n`Disable`)])
  ];
  return t.div(items);
}
function renderEnableFromKey(t, vm) {
  const useASecurityPhrase = t.button({ className: "link", onClick: () => vm.showPhraseSetup() }, vm.i18n`use a security phrase`);
  return t.div([
    t.p(vm.i18n`Enter your secret storage security key below to ${vm.purpose}, which will enable you to decrypt messages received before you logged into this session. The security key is a code of 12 groups of 4 characters separated by a space that Element created for you when setting up security.`),
    renderError(t),
    renderEnableFieldRow(t, vm, vm.i18n`Security key`, (key, setupDehydratedDevice) => vm.enterSecurityKey(key, setupDehydratedDevice)),
    t.p([vm.i18n`Alternatively, you can `, useASecurityPhrase, vm.i18n` if you have one.`])
  ]);
}
function renderEnableFromPhrase(t, vm) {
  const useASecurityKey = t.button({ className: "link", onClick: () => vm.showKeySetup() }, vm.i18n`use your security key`);
  return t.div([
    t.p(vm.i18n`Enter your secret storage security phrase below to ${vm.purpose}, which will enable you to decrypt messages received before you logged into this session. The security phrase is a freeform secret phrase you optionally chose when setting up security in Element. It is different from your password to login, unless you chose to set them to the same value.`),
    renderError(t),
    renderEnableFieldRow(t, vm, vm.i18n`Security phrase`, (phrase, setupDehydratedDevice) => vm.enterSecurityPhrase(phrase, setupDehydratedDevice)),
    t.p([vm.i18n`You can also `, useASecurityKey, vm.i18n`.`])
  ]);
}
function renderEnableFieldRow(t, vm, label, callback) {
  let setupDehydrationCheck;
  const eventHandler = () => callback(input.value, (setupDehydrationCheck == null ? void 0 : setupDehydrationCheck.checked) || false);
  const input = t.input({ type: "password", disabled: (vm2) => vm2.isBusy, placeholder: label });
  const children = [
    t.p([
      input,
      t.button({ disabled: (vm2) => vm2.isBusy, onClick: eventHandler }, vm.decryptAction)
    ])
  ];
  if (vm.offerDehydratedDeviceSetup) {
    setupDehydrationCheck = t.input({ type: "checkbox", id: "enable-dehydrated-device" });
    const moreInfo = t.a({ href: "https://github.com/uhoreg/matrix-doc/blob/dehydration/proposals/2697-device-dehydration.md", target: "_blank", rel: "noopener" }, "more info");
    children.push(t.p([
      setupDehydrationCheck,
      t.label({ for: setupDehydrationCheck.id }, [vm.i18n`Back up my device as well (`, moreInfo, ")"])
    ]));
  }
  return t.div({ className: `row` }, [
    t.div({ className: "label" }, label),
    t.div({ className: "content" }, children)
  ]);
}
function renderError(t) {
  return t.if((vm) => vm.error, (t2, vm) => {
    return t2.div([
      t2.p({ className: "error" }, (vm2) => vm2.i18n`Could not enable key backup: ${vm2.error}.`),
      t2.p(vm.i18n`Try double checking that you did not mix up your security key, security phrase and login password as explained above.`)
    ]);
  });
}
class SettingsView extends TemplateView {
  render(t, vm) {
    let version = vm.version;
    if (vm.showUpdateButton) {
      version = t.span([
        vm.version,
        t.button({ onClick: () => vm.checkForUpdate() }, vm.i18n`Check for updates`)
      ]);
    }
    const row = (t2, label, content, extraClass = "") => {
      return t2.div({ className: `row ${extraClass}` }, [
        t2.div({ className: "label" }, label),
        t2.div({ className: "content" }, content)
      ]);
    };
    const settingNodes = [];
    settingNodes.push(t.h3("Session"), row(t, vm.i18n`User ID`, vm.userId), row(t, vm.i18n`Session ID`, vm.deviceId, "code"), row(t, vm.i18n`Session key`, vm.fingerprintKey, "code"), row(t, "", t.button({
      onClick: () => vm.logout(),
      disabled: (vm2) => vm2.isLoggingOut
    }, vm.i18n`Log out`)));
    settingNodes.push(t.h3("Key backup"), t.view(new KeyBackupSettingsView(vm.keyBackupViewModel)));
    settingNodes.push(t.h3("Notifications"), t.map((vm2) => vm2.pushNotifications.supported, (supported, t2) => {
      if (supported === null) {
        return t2.p(vm.i18n`Loading…`);
      } else if (supported) {
        const label = (vm2) => vm2.pushNotifications.enabled ? vm2.i18n`Push notifications are enabled` : vm2.i18n`Push notifications are disabled`;
        const buttonLabel = (vm2) => vm2.pushNotifications.enabled ? vm2.i18n`Disable` : vm2.i18n`Enable`;
        return row(t2, label, t2.button({
          onClick: () => vm.togglePushNotifications(),
          disabled: (vm2) => vm2.pushNotifications.updating
        }, buttonLabel));
      } else {
        return t2.p(vm.i18n`Push notifications are not supported on this browser`);
      }
    }), t.if((vm2) => vm2.pushNotifications.supported && vm2.pushNotifications.enabled, (t2) => {
      return t2.div([
        t2.p([
          "If you think push notifications are not being delivered, ",
          t2.button({ className: "link", onClick: () => vm.checkPushEnabledOnServer() }, "check"),
          " if they got disabled on the server"
        ]),
        t2.map((vm2) => vm2.pushNotifications.enabledOnServer, (enabled, t3) => {
          if (enabled === true) {
            return t3.p("Push notifications are still enabled on the server, so everything should be working. Sometimes notifications can get dropped if they can't be delivered within a given time.");
          } else if (enabled === false) {
            return t3.p("Push notifications have been disabled on the server, likely due to a bug. Please re-enable them by clicking Disable and then Enable again above.");
          }
        }),
        t2.map((vm2) => vm2.pushNotifications.serverError, (err, t3) => {
          if (err) {
            return t3.p("Couldn't not check on server: " + err.message);
          }
        })
      ]);
    }));
    settingNodes.push(t.h3("Preferences"), row(t, vm.i18n`Scale down images when sending`, this._imageCompressionRange(t, vm)), t.if((vm2) => vm2.activeTheme, (t2, vm2) => {
      return row(t2, vm2.i18n`Use the following theme`, this._themeOptions(t2, vm2));
    }));
    const logButtons = [];
    if (vm.canSendLogsToServer) {
      logButtons.push(t.button({ onClick: disableTargetCallback(() => vm.sendLogsToServer()) }, `Submit logs to ${vm.logsServer}`));
    }
    logButtons.push(t.button({ onClick: () => vm.exportLogs() }, "Download logs"));
    settingNodes.push(t.h3("Application"), row(t, vm.i18n`Version`, version), row(t, vm.i18n`Storage usage`, (vm2) => `${vm2.storageUsage} / ${vm2.storageQuota}`), row(t, vm.i18n`Debug logs`, logButtons), t.p({ className: { hidden: (vm2) => !vm2.logsFeedbackMessage } }, (vm2) => vm2.logsFeedbackMessage), t.p([
      "Debug logs contain application usage data including your username, the IDs or aliases of the rooms or groups you have visited, the usernames of other users and the names of files you send. They do not contain messages. For more information, review our ",
      t.a({ href: "https://element.io/privacy", target: "_blank", rel: "noopener" }, "privacy policy"),
      "."
    ]));
    return t.main({ className: "Settings middle" }, [
      t.div({ className: "middle-header" }, [
        t.a({ className: "button-utility close-middle", href: vm.closeUrl, title: vm.i18n`Close settings` }),
        t.h2("Settings")
      ]),
      t.div({ className: "SettingsBody" }, settingNodes)
    ]);
  }
  _imageCompressionRange(t, vm) {
    const step = 32;
    const min = Math.ceil(vm.minSentImageSizeLimit / step) * step;
    const max = (Math.floor(vm.maxSentImageSizeLimit / step) + 1) * step;
    const updateSetting = (evt) => vm.setSentImageSizeLimit(parseInt(evt.target.value, 10));
    return [t.input({
      type: "range",
      step,
      min,
      max,
      value: (vm2) => vm2.sentImageSizeLimit || max,
      onInput: updateSetting,
      onChange: updateSetting
    }), " ", t.output((vm2) => {
      return vm2.sentImageSizeLimit ? vm2.i18n`resize to ${vm2.sentImageSizeLimit}px` : vm2.i18n`no resizing`;
    })];
  }
  _themeOptions(t, vm) {
    const { themeName: activeThemeName, themeVariant: activeThemeVariant } = vm.activeTheme;
    const optionTags = [];
    for (const name of Object.keys(vm.themeMapping)) {
      optionTags.push(t.option({ value: name, selected: name === activeThemeName }, name));
    }
    const select = t.select({
      onChange: (e) => {
        const themeName = e.target.value;
        if (!("id" in vm.themeMapping[themeName])) {
          const colorScheme = darkRadioButton.checked ? "dark" : lightRadioButton.checked ? "light" : "default";
          radioButtonCallback(colorScheme);
          return;
        }
        vm.changeThemeOption(themeName);
      }
    }, optionTags);
    const radioButtonCallback = (colorScheme) => {
      const selectedThemeName = select.options[select.selectedIndex].value;
      vm.changeThemeOption(selectedThemeName, colorScheme);
    };
    const isDarkSelected = activeThemeVariant === "dark";
    const isLightSelected = activeThemeVariant === "light";
    const darkRadioButton = t.input({ type: "radio", name: "radio-chooser", value: "dark", id: "dark", checked: isDarkSelected });
    const defaultRadioButton = t.input({ type: "radio", name: "radio-chooser", value: "default", id: "default", checked: !(isDarkSelected || isLightSelected) });
    const lightRadioButton = t.input({ type: "radio", name: "radio-chooser", value: "light", id: "light", checked: isLightSelected });
    const radioButtons = t.form({
      className: {
        hidden: () => {
          const themeName = select.options[select.selectedIndex].value;
          return "id" in vm.themeMapping[themeName];
        }
      },
      onChange: (e) => radioButtonCallback(e.target.value)
    }, [
      defaultRadioButton,
      t.label({ for: "default" }, "Match system theme"),
      darkRadioButton,
      t.label({ for: "dark" }, "dark"),
      lightRadioButton,
      t.label({ for: "light" }, "light")
    ]);
    return t.div({ className: "theme-chooser" }, [select, radioButtons]);
  }
}
class CreateRoomView extends TemplateView {
  render(t, vm) {
    return t.main({ className: "middle" }, t.div({ className: "CreateRoomView centered-column" }, [
      t.h2("Create room"),
      t.form({ className: "CreateRoomView_detailsForm form", onChange: (evt) => this.onFormChange(evt), onSubmit: (evt) => this.onSubmit(evt) }, [
        t.div({ className: "vertical-layout" }, [
          t.button({ type: "button", className: "CreateRoomView_selectAvatar", onClick: () => vm.selectAvatar() }, t.mapView((vm2) => vm2.hasAvatar, (hasAvatar) => {
            if (hasAvatar) {
              return new AvatarView(vm, 64);
            } else {
              return new StaticView(void 0, (t2) => {
                return t2.div({ className: "CreateRoomView_selectAvatarPlaceholder" });
              });
            }
          })),
          t.div({ className: "stretch form-row text" }, [
            t.label({ for: "name" }, vm.i18n`Room name`),
            t.input({
              onInput: (evt) => vm.setName(evt.target.value),
              type: "text",
              name: "name",
              id: "name",
              placeholder: vm.i18n`Enter a room name`
            })
          ])
        ]),
        t.div({ className: "form-row text" }, [
          t.label({ for: "topic" }, vm.i18n`Topic (optional)`),
          t.textarea({
            onInput: (evt) => vm.setTopic(evt.target.value),
            name: "topic",
            id: "topic",
            placeholder: vm.i18n`Topic`
          })
        ]),
        t.div({ className: "form-group" }, [
          t.div({ className: "form-row check" }, [
            t.input({ type: "radio", name: "isPublic", id: "isPrivate", value: "false", checked: !vm.isPublic }),
            t.label({ for: "isPrivate" }, vm.i18n`Private room, only upon invitation.`)
          ]),
          t.div({ className: "form-row check" }, [
            t.input({ type: "radio", name: "isPublic", id: "isPublic", value: "true", checked: vm.isPublic }),
            t.label({ for: "isPublic" }, vm.i18n`Public room, anyone can join`)
          ])
        ]),
        t.div({ className: { "form-row check": true, hidden: (vm2) => vm2.isPublic } }, [
          t.input({ type: "checkbox", name: "isEncrypted", id: "isEncrypted", checked: vm.isEncrypted }),
          t.label({ for: "isEncrypted" }, vm.i18n`Enable end-to-end encryption`)
        ]),
        t.div({ className: { "form-row text": true, hidden: (vm2) => !vm2.isPublic } }, [
          t.label({ for: "roomAlias" }, vm.i18n`Room alias`),
          t.input({
            onInput: (evt) => vm.setRoomAlias(evt.target.value),
            type: "text",
            name: "roomAlias",
            id: "roomAlias",
            placeholder: vm.i18n`Room alias (<alias>, or #<alias> or #<alias>:hs.tld`
          })
        ]),
        t.div({ className: "form-group" }, [
          t.div(t.button({ className: "link", type: "button", onClick: () => vm.toggleAdvancedShown() }, (vm2) => vm2.isAdvancedShown ? vm2.i18n`Hide advanced settings` : vm2.i18n`Show advanced settings`)),
          t.div({ className: { "form-row check": true, hidden: (vm2) => !vm2.isAdvancedShown } }, [
            t.input({ type: "checkbox", name: "isFederationDisabled", id: "isFederationDisabled", checked: vm.isFederationDisabled }),
            t.label({ for: "isFederationDisabled" }, [
              vm.i18n`Disable federation`,
              t.p({ className: "form-row-description" }, vm.i18n`Can't be changed later. This will prevent people on other homeservers from joining the room. This is typically used when only people from your own organisation (if applicable) should be allowed in the room, and is otherwise not needed.`)
            ])
          ])
        ]),
        t.div({ className: "button-row" }, [
          t.button({
            className: "button-action primary",
            type: "submit",
            disabled: (vm2) => !vm2.canCreate
          }, vm.i18n`Create room`)
        ])
      ])
    ]));
  }
  onFormChange(evt) {
    switch (evt.target.name) {
      case "isEncrypted":
        this.value.setEncrypted(evt.target.checked);
        break;
      case "isPublic":
        this.value.setPublic(evt.currentTarget.isPublic.value === "true");
        break;
      case "isFederationDisabled":
        this.value.setFederationDisabled(evt.target.checked);
        break;
    }
  }
  onSubmit(evt) {
    evt.preventDefault();
    this.value.create();
  }
}
class RoomDetailsView extends TemplateView {
  render(t, vm) {
    const encryptionString = () => vm.isEncrypted ? vm.i18n`On` : vm.i18n`Off`;
    return t.div({ className: "RoomDetailsView" }, [
      t.div({ className: "RoomDetailsView_avatar" }, [
        t.view(new AvatarView(vm, 52)),
        t.mapView((vm2) => vm2.isEncrypted, (isEncrypted) => new EncryptionIconView(isEncrypted))
      ]),
      t.div({ className: "RoomDetailsView_name" }, [t.h2((vm2) => vm2.name)]),
      this._createRoomAliasDisplay(vm),
      t.div({ className: "RoomDetailsView_rows" }, [
        this._createRightPanelButtonRow(t, vm.i18n`People`, { MemberCount: true }, (vm2) => vm2.memberCount, () => vm.openPanel("members")),
        this._createRightPanelRow(t, vm.i18n`Encryption`, { EncryptionStatus: true }, encryptionString)
      ])
    ]);
  }
  _createRoomAliasDisplay(vm) {
    return vm.canonicalAlias ? tag.div({ className: "RoomDetailsView_id" }, [vm.canonicalAlias]) : "";
  }
  _createRightPanelRow(t, label, labelClass, value) {
    const labelClassString = classNames(__spreadValues({ RoomDetailsView_label: true }, labelClass));
    return t.div({ className: "RoomDetailsView_row" }, [
      t.div({ className: labelClassString }, [label]),
      t.div({ className: "RoomDetailsView_value" }, value)
    ]);
  }
  _createRightPanelButtonRow(t, label, labelClass, value, onClick) {
    const labelClassString = classNames(__spreadValues({ RoomDetailsView_label: true }, labelClass));
    return t.button({ className: "RoomDetailsView_row", onClick }, [
      t.div({ className: labelClassString }, [label]),
      t.div({ className: "RoomDetailsView_value" }, value)
    ]);
  }
}
class EncryptionIconView extends TemplateView {
  render(t, isEncrypted) {
    return t.div({ className: "EncryptionIconView" }, [t.div({ className: isEncrypted ? "EncryptionIconView_encrypted" : "EncryptionIconView_unencrypted" })]);
  }
}
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
  get length() {
    return this.end - this.start;
  }
  contains(range) {
    return range.start >= this.start && range.end <= this.end;
  }
  containsIndex(idx) {
    return idx >= this.start && idx < this.end;
  }
  toLocalIndex(idx) {
    return idx - this.start;
  }
  intersects(range) {
    return range.start < this.end && this.start < range.end;
  }
  forEachInIterator(it, callback) {
    let i = 0;
    for (i = 0; i < this.start; i += 1) {
      it.next();
    }
    for (i = 0; i < this.length; i += 1) {
      const result = it.next();
      if (result.done) {
        break;
      } else {
        callback(result.value, this.start + i);
      }
    }
  }
  [Symbol.iterator]() {
    return new RangeIterator(this);
  }
  reverseIterable() {
    return new ReverseRangeIterator(this);
  }
  clampIndex(idx, end = this.end - 1) {
    return Math.min(Math.max(this.start, idx), end);
  }
  getIndexZone(idx) {
    if (idx < this.start) {
      return RangeZone.Before;
    } else if (idx < this.end) {
      return RangeZone.Inside;
    } else {
      return RangeZone.After;
    }
  }
}
var RangeZone = /* @__PURE__ */ ((RangeZone2) => {
  RangeZone2[RangeZone2["Before"] = 1] = "Before";
  RangeZone2[RangeZone2["Inside"] = 2] = "Inside";
  RangeZone2[RangeZone2["After"] = 3] = "After";
  return RangeZone2;
})(RangeZone || {});
class RangeIterator {
  constructor(range) {
    this.range = range;
    this.idx = range.start - 1;
  }
  next() {
    if (this.idx < this.range.end - 1) {
      this.idx += 1;
      return { value: this.idx, done: false };
    } else {
      return { value: void 0, done: true };
    }
  }
}
class ReverseRangeIterator {
  constructor(range) {
    this.range = range;
    this.idx = range.end;
  }
  [Symbol.iterator]() {
    return this;
  }
  next() {
    if (this.idx > this.range.start) {
      this.idx -= 1;
      return { value: this.idx, done: false };
    } else {
      return { value: void 0, done: true };
    }
  }
}
function skipOnIterator(it, pos) {
  let i = 0;
  while (i < pos) {
    i += 1;
    if (it.next().done) {
      return false;
    }
  }
  return true;
}
function getIteratorValueAtIdx(it, idx) {
  if (skipOnIterator(it, idx)) {
    const result = it.next();
    if (!result.done) {
      return result.value;
    }
  }
  return void 0;
}
var ResultType = /* @__PURE__ */ ((ResultType2) => {
  ResultType2[ResultType2["Move"] = 0] = "Move";
  ResultType2[ResultType2["Add"] = 1] = "Add";
  ResultType2[ResultType2["Remove"] = 2] = "Remove";
  ResultType2[ResultType2["RemoveAndAdd"] = 3] = "RemoveAndAdd";
  ResultType2[ResultType2["UpdateRange"] = 4] = "UpdateRange";
  return ResultType2;
})(ResultType || {});
class ListRange extends Range {
  constructor(start, end, _totalLength, _viewportItemCount = end - start) {
    super(start, end);
    this._totalLength = _totalLength;
    this._viewportItemCount = _viewportItemCount;
  }
  expand(amount) {
    if (this.length === 0) {
      return this;
    }
    const newStart = Math.max(0, this.start - amount);
    const newEnd = Math.min(this.totalLength, this.end + amount);
    return new ListRange(newStart, newEnd, this.totalLength, this._viewportItemCount);
  }
  get totalLength() {
    return this._totalLength;
  }
  get viewportItemCount() {
    return this._viewportItemCount;
  }
  static fromViewport(listLength, itemHeight, listHeight, scrollTop) {
    const topCount = Math.min(Math.max(0, Math.floor(scrollTop / itemHeight)), listLength);
    const itemsAfterTop = listLength - topCount;
    const viewportItemCount = listHeight !== 0 ? Math.ceil(listHeight / itemHeight) : 0;
    const renderCount = Math.min(viewportItemCount, itemsAfterTop);
    return new ListRange(topCount, topCount + renderCount, listLength, viewportItemCount);
  }
  queryAdd(idx, value, list) {
    const maxAddIdx = this.viewportItemCount > this.length ? this.end : this.end - 1;
    if (idx <= maxAddIdx) {
      const addIdx = this.clampIndex(idx, maxAddIdx);
      const addValue = addIdx === idx ? value : getIteratorValueAtIdx(list[Symbol.iterator](), addIdx);
      return this.createAddResult(addIdx, addValue);
    } else {
      return { type: 4, newRange: this.deriveRange(1, 0) };
    }
  }
  queryRemove(idx, list) {
    if (idx < this.end) {
      const removeIdx = this.clampIndex(idx);
      return this.createRemoveResult(removeIdx, list);
    } else {
      return { type: 4, newRange: this.deriveRange(-1, 0) };
    }
  }
  queryMove(fromIdx, toIdx, value, list) {
    const fromZone = this.getIndexZone(fromIdx);
    const toZone = this.getIndexZone(toIdx);
    if (fromZone === toZone) {
      if (fromZone === RangeZone.Before || fromZone === RangeZone.After) {
        return;
      } else if (fromZone === RangeZone.Inside) {
        return { type: 0, fromIdx, toIdx };
      }
    } else {
      const addIdx = this.clampIndex(toIdx);
      const removeIdx = this.clampIndex(fromIdx);
      const addValue = addIdx === toIdx ? value : getIteratorValueAtIdx(list[Symbol.iterator](), addIdx);
      return { type: 3, removeIdx, addIdx, value: addValue };
    }
  }
  createAddResult(addIdx, value) {
    if (this.viewportItemCount > this.length) {
      return { type: 1, addIdx, value, newRange: this.deriveRange(1, 1) };
    } else {
      const removeIdx = this.clampIndex(Number.MAX_SAFE_INTEGER);
      return { type: 3, removeIdx, addIdx, value, newRange: this.deriveRange(1, 0) };
    }
  }
  createRemoveResult(removeIdx, list) {
    if (this.end < this.totalLength) {
      const addIdx = this.clampIndex(Number.MAX_SAFE_INTEGER);
      const value = getIteratorValueAtIdx(list[Symbol.iterator](), addIdx);
      return { type: 3, removeIdx, value, addIdx, newRange: this.deriveRange(-1, 0) };
    } else if (this.start !== 0) {
      const newRange = this.deriveRange(-1, 0, 1);
      const addIdx = newRange.start;
      const value = getIteratorValueAtIdx(list[Symbol.iterator](), addIdx);
      return { type: 3, removeIdx, value, addIdx, newRange };
    } else {
      return { type: 2, removeIdx, newRange: this.deriveRange(-1, 0) };
    }
  }
  deriveRange(totalLengthInc, viewportItemCountDecr, startDecr = 0) {
    const start = this.start - startDecr;
    const totalLength = this.totalLength + totalLengthInc;
    const end = Math.min(Math.max(start, this.end - startDecr + viewportItemCountDecr), totalLength);
    return new ListRange(start, end, totalLength, this.viewportItemCount);
  }
}
class LazyListView extends ListView {
  constructor(_a, childCreator) {
    var _b = _a, { itemHeight, overflowItems = 20 } = _b, options = __objRest(_b, ["itemHeight", "overflowItems"]);
    super(options, childCreator);
    this.itemHeight = itemHeight;
    this.overflowItems = overflowItems;
  }
  handleEvent(e) {
    if (e.type === "scroll") {
      this.handleScroll();
    } else {
      super.handleEvent(e);
    }
  }
  handleScroll() {
    const visibleRange = this._getVisibleRange();
    if (visibleRange.length !== 0 && !this.renderRange.contains(visibleRange)) {
      const prevRenderRange = this.renderRange;
      this.renderRange = visibleRange.expand(this.overflowItems);
      this.renderUpdate(prevRenderRange, this.renderRange);
    }
  }
  async loadList() {
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    if (!this._list) {
      return;
    }
    this._subscription = this._list.subscribe(this);
    const visibleRange = this._getVisibleRange();
    this.renderRange = visibleRange.expand(this.overflowItems);
    this._childInstances = [];
    this.reRenderFullRange(this.renderRange);
  }
  _getVisibleRange() {
    const { clientHeight, scrollTop } = this.root();
    if (clientHeight === 0) {
      throw new Error("LazyListView height is 0");
    }
    return ListRange.fromViewport(this._list.length, this.itemHeight, clientHeight, scrollTop);
  }
  reRenderFullRange(range) {
    removeChildren(this._listElement);
    const fragment = document.createDocumentFragment();
    const it = this._list[Symbol.iterator]();
    this._childInstances.length = 0;
    range.forEachInIterator(it, (item) => {
      const child = this._childCreator(item);
      this._childInstances.push(child);
      fragment.appendChild(mountView(child, this._mountArgs));
    });
    this._listElement.appendChild(fragment);
    this.adjustPadding(range);
  }
  renderUpdate(prevRange, newRange) {
    if (newRange.intersects(prevRange)) {
      for (const idxInList of prevRange.reverseIterable()) {
        if (!newRange.containsIndex(idxInList)) {
          const localIdx = idxInList - prevRange.start;
          this.removeChild(localIdx);
        }
      }
      newRange.forEachInIterator(this._list[Symbol.iterator](), (item, idxInList) => {
        if (!prevRange.containsIndex(idxInList)) {
          const localIdx = idxInList - newRange.start;
          this.addChild(localIdx, item);
        }
      });
      this.adjustPadding(newRange);
    } else {
      this.reRenderFullRange(newRange);
    }
  }
  adjustPadding(range) {
    const paddingTop = range.start * this.itemHeight;
    const paddingBottom = (range.totalLength - range.end) * this.itemHeight;
    const style = this._listElement.style;
    style.paddingTop = `${paddingTop}px`;
    style.paddingBottom = `${paddingBottom}px`;
  }
  mount() {
    const listElement = super.mount();
    this.scrollContainer = tag.div({ className: "LazyListParent" }, listElement);
    this.scrollContainer.addEventListener("scroll", this);
    return this.scrollContainer;
  }
  unmount() {
    this.root().removeEventListener("scroll", this);
    this.scrollContainer = void 0;
    super.unmount();
  }
  root() {
    return this.scrollContainer;
  }
  get _listElement() {
    return super.root();
  }
  onAdd(idx, value) {
    const result = this.renderRange.queryAdd(idx, value, this._list);
    this.applyRemoveAddResult(result);
  }
  onRemove(idx, value) {
    const result = this.renderRange.queryRemove(idx, this._list);
    this.applyRemoveAddResult(result);
  }
  onMove(fromIdx, toIdx, value) {
    const result = this.renderRange.queryMove(fromIdx, toIdx, value, this._list);
    if (result) {
      if (result.type === ResultType.Move) {
        this.moveChild(this.renderRange.toLocalIndex(result.fromIdx), this.renderRange.toLocalIndex(result.toIdx));
      } else {
        this.applyRemoveAddResult(result);
      }
    }
  }
  onUpdate(i, value, params) {
    if (this.renderRange.containsIndex(i)) {
      this.updateChild(this.renderRange.toLocalIndex(i), value, params);
    }
  }
  applyRemoveAddResult(result) {
    if (result.type === ResultType.Remove || result.type === ResultType.RemoveAndAdd) {
      this.removeChild(this.renderRange.toLocalIndex(result.removeIdx));
    }
    if (result.newRange) {
      this.renderRange = result.newRange;
      this.adjustPadding(this.renderRange);
    }
    if (result.type === ResultType.Add || result.type === ResultType.RemoveAndAdd) {
      this.addChild(this.renderRange.toLocalIndex(result.addIdx), result.value);
    }
  }
}
class MemberTileView extends TemplateView {
  render(t, vm) {
    return t.li({ className: "MemberTileView" }, t.a({ href: vm.detailsUrl }, [
      t.view(new AvatarView(vm, 32)),
      t.div({ className: "MemberTileView_name" }, (vm2) => vm2.name)
    ]));
  }
}
class MemberListView extends LazyListView {
  constructor(vm) {
    super({
      list: vm.memberTileViewModels,
      className: "MemberListView",
      itemHeight: 40
    }, (tileViewModel) => new MemberTileView(tileViewModel));
  }
}
class MemberDetailsView extends TemplateView {
  render(t, vm) {
    return t.div({ className: "MemberDetailsView" }, [
      t.view(new AvatarView(vm, 128)),
      t.div({ className: "MemberDetailsView_name" }, t.h2((vm2) => vm2.name)),
      t.div({ className: "MemberDetailsView_id" }, vm.userId),
      this._createSection(t, vm.i18n`Role`, (vm2) => vm2.role),
      this._createSection(t, vm.i18n`Security`, vm.isEncrypted ? vm.i18n`Messages in this room are end-to-end encrypted.` : vm.i18n`Messages in this room are not end-to-end encrypted.`),
      this._createOptions(t, vm)
    ]);
  }
  _createSection(t, label, value) {
    return t.div({ className: "MemberDetailsView_section" }, [
      t.div({ className: "MemberDetailsView_label" }, label),
      t.div({ className: "MemberDetailsView_value" }, value)
    ]);
  }
  _createOptions(t, vm) {
    return t.div({ className: "MemberDetailsView_section" }, [
      t.div({ className: "MemberDetailsView_label" }, vm.i18n`Options`),
      t.div({ className: "MemberDetailsView_options" }, [
        t.a({ href: vm.linkToUser, target: "_blank", rel: "noopener" }, vm.i18n`Open Link to User`),
        t.button({ className: "text", onClick: () => vm.openDirectMessage() }, vm.i18n`Open direct message`)
      ])
    ]);
  }
}
class RightPanelView extends TemplateView {
  render(t) {
    return t.div({ className: "RightPanelView" }, [
      t.ifView((vm) => vm.activeViewModel, (vm) => new ButtonsView(vm)),
      t.mapView((vm) => vm.activeViewModel, (vm) => this._viewFromType(vm))
    ]);
  }
  _viewFromType(vm) {
    const type = vm == null ? void 0 : vm.type;
    switch (type) {
      case "room-details":
        return new RoomDetailsView(vm);
      case "member-list":
        return new MemberListView(vm);
      case "member-details":
        return new MemberDetailsView(vm);
      default:
        return new LoadingView();
    }
  }
}
class ButtonsView extends TemplateView {
  render(t, vm) {
    return t.div({ className: "RightPanelView_buttons" }, [
      t.button({
        className: {
          "back": true,
          "button-utility": true,
          "hide": !vm.activeViewModel.shouldShowBackButton
        },
        onClick: () => vm.showPreviousPanel()
      }),
      t.button({ className: "close button-utility", onClick: () => vm.closePanel() })
    ]);
  }
}
class ReactionsView extends ListView {
  constructor(reactionsViewModel) {
    const options = {
      className: "Timeline_messageReactions",
      tagName: "div",
      list: reactionsViewModel.reactions,
      onItemClick: (reactionView) => reactionView.onClick()
    };
    super(options, (reactionVM) => new ReactionView(reactionVM));
  }
}
class ReactionView extends TemplateView {
  render(t, vm) {
    return t.button({
      className: {
        active: (vm2) => vm2.isActive,
        pending: (vm2) => vm2.isPending
      }
    }, [vm.key, " ", (vm2) => `${vm2.count}`]);
  }
  onClick() {
    this.value.toggle();
  }
}
class BaseMessageView extends TemplateView {
  constructor(value, viewClassForTile2, renderFlags, tagName = "li") {
    super(value);
    this._menuPopup = null;
    this._tagName = tagName;
    this._viewClassForTile = viewClassForTile2;
    this._renderFlags = renderFlags;
  }
  get _interactive() {
    var _a, _b;
    return (_b = (_a = this._renderFlags) == null ? void 0 : _a.interactive) != null ? _b : true;
  }
  get _isReplyPreview() {
    var _a;
    return (_a = this._renderFlags) == null ? void 0 : _a.reply;
  }
  render(t, vm) {
    const children = [this.renderMessageBody(t, vm)];
    if (this._interactive) {
      children.push(t.button({ className: "Timeline_messageOptions" }, "\u22EF"));
    }
    const li = t.el(this._tagName, {
      className: {
        "Timeline_message": true,
        own: vm.isOwn,
        unsent: vm.isUnsent,
        unverified: (vm2) => vm2.isUnverified,
        disabled: !this._interactive,
        continuation: (vm2) => vm2.isContinuation
      },
      "data-event-id": vm.eventId
    }, children);
    t.mapSideEffect((vm2) => vm2.isContinuation, (isContinuation, wasContinuation) => {
      if (isContinuation && wasContinuation === false) {
        li.removeChild(li.querySelector(".Timeline_messageAvatar"));
        li.removeChild(li.querySelector(".Timeline_messageSender"));
      } else if (!isContinuation && !this._isReplyPreview) {
        const avatar = tag.a({ href: vm.memberPanelLink, className: "Timeline_messageAvatar" }, [renderStaticAvatar(vm, 30)]);
        const sender = tag.div({ className: `Timeline_messageSender usercolor${vm.avatarColorNumber}` }, vm.displayName);
        li.insertBefore(avatar, li.firstChild);
        li.insertBefore(sender, li.firstChild);
      }
    });
    let reactionsView = null;
    t.mapSideEffect((vm2) => vm2.reactions, (reactions) => {
      if (reactions && this._interactive && !reactionsView) {
        reactionsView = new ReactionsView(reactions);
        this.addSubView(reactionsView);
        li.appendChild(mountView(reactionsView));
      } else if (!reactions && reactionsView) {
        li.removeChild(reactionsView.root());
        reactionsView.unmount();
        this.removeSubView(reactionsView);
        reactionsView = null;
      }
    });
    return li;
  }
  onClick(evt) {
    if (evt.target.className === "Timeline_messageOptions") {
      this._toggleMenu(evt.target);
    }
  }
  _toggleMenu(button) {
    if (this._menuPopup && this._menuPopup.isOpen) {
      this._menuPopup.close();
    } else {
      const options = this.createMenuOptions(this.value);
      if (!options.length) {
        return;
      }
      this.root().classList.add("menuOpen");
      const onClose = () => this.root().classList.remove("menuOpen");
      this._menuPopup = new Popup(new Menu(options), onClose);
      this._menuPopup.trackInTemplateView(this);
      this._menuPopup.showRelativeTo(button, 2);
    }
  }
  createMenuOptions(vm) {
    const options = [];
    if (vm.canReact && vm.shape !== "redacted" && !vm.isPending) {
      options.push(new QuickReactionsMenuOption(vm));
      options.push(Menu.option(vm.i18n`Reply`, () => vm.startReply()));
    }
    if (vm.canAbortSending) {
      options.push(Menu.option(vm.i18n`Cancel`, () => vm.abortSending()));
    } else if (vm.canRedact) {
      options.push(Menu.option(vm.i18n`Delete`, () => vm.redact()).setDestructive());
    }
    return options;
  }
  renderMessageBody() {
  }
}
class QuickReactionsMenuOption {
  constructor(vm) {
    this._vm = vm;
  }
  toDOM(t) {
    const emojiButtons = ["\u{1F44D}", "\u{1F44E}", "\u{1F604}", "\u{1F389}", "\u{1F615}", "\u2764\uFE0F", "\u{1F680}", "\u{1F440}"].map((emoji) => {
      return t.button({ onClick: () => this._vm.react(emoji) }, emoji);
    });
    const customButton = t.button({ onClick: () => {
      const key = prompt("Enter your reaction (emoji)");
      if (key) {
        this._vm.react(key);
      }
    } }, "\u2026");
    return t.li({ className: "quick-reactions" }, [...emojiButtons, customButton]);
  }
}
class ReplyPreviewView extends TemplateView {
  constructor(vm, viewClassForTile2) {
    super(vm);
    this._viewClassForTile = viewClassForTile2;
  }
  render(t, vm) {
    const TileView = this._viewClassForTile(vm);
    if (!TileView) {
      throw new Error(`Shape ${vm.shape} is unrecognized.`);
    }
    const view = new TileView(vm, this._viewClassForTile, { reply: true, interactive: false });
    return t.div({ className: "ReplyPreviewView" }, t.blockquote([
      t.a({ className: "link", href: vm.permaLink }, "In reply to"),
      t.a({ className: "pill", href: vm.senderProfileLink }, [
        renderStaticAvatar(vm, 12, void 0),
        vm.displayName
      ]),
      t.br(),
      t.view(view)
    ]));
  }
}
class ReplyPreviewError extends TemplateView {
  render(t) {
    return t.blockquote({ className: "ReplyPreviewView" }, [
      t.div({ className: "Timeline_messageBody statusMessage" }, "This reply could not be found.")
    ]);
  }
}
class TextMessageView extends BaseMessageView {
  renderMessageBody(t, vm) {
    const time = t.time({ className: { hidden: !vm.date } }, vm.date + " " + vm.time);
    const container2 = t.div({
      className: {
        "Timeline_messageBody": true,
        statusMessage: (vm2) => vm2.shape === "message-status"
      }
    }, t.mapView((vm2) => vm2.replyTile, (replyTile) => {
      if (this._isReplyPreview) {
        return null;
      } else if (vm.isReply && !replyTile) {
        return new ReplyPreviewError();
      } else if (replyTile) {
        return new ReplyPreviewView(replyTile, this._viewClassForTile);
      } else {
        return null;
      }
    }));
    const shouldRemove = (element) => (element == null ? void 0 : element.nodeType) !== Node.COMMENT_NODE && element.className !== "ReplyPreviewView";
    t.mapSideEffect((vm2) => vm2.body, (body) => {
      while (shouldRemove(container2.lastChild)) {
        container2.removeChild(container2.lastChild);
      }
      for (const part of body.parts) {
        container2.appendChild(renderPart(part));
      }
      container2.appendChild(time);
    });
    return container2;
  }
}
function renderList(listBlock) {
  const items = listBlock.items.map((item) => tag.li(renderParts(item)));
  const start = listBlock.startOffset;
  if (start) {
    return tag.ol({ start }, items);
  } else {
    return tag.ul(items);
  }
}
function renderImage(imagePart) {
  const attributes = { src: imagePart.src };
  if (imagePart.width) {
    attributes.width = imagePart.width;
  }
  if (imagePart.height) {
    attributes.height = imagePart.height;
  }
  if (imagePart.alt) {
    attributes.alt = imagePart.alt;
  }
  if (imagePart.title) {
    attributes.title = imagePart.title;
  }
  return tag.img(attributes);
}
function renderPill(pillPart) {
  const classes = `avatar size-12 usercolor${pillPart.avatarColorNumber}`;
  const avatar = tag.div({ class: classes }, text$1(pillPart.avatarInitials));
  const children = renderParts(pillPart.children);
  children.unshift(avatar);
  return tag.a({ class: "pill", href: pillPart.href, rel: "noopener", target: "_blank" }, children);
}
function renderTable(tablePart) {
  const children = [];
  if (tablePart.head) {
    const headers = tablePart.head.map((cell) => tag.th(renderParts(cell)));
    children.push(tag.thead(tag.tr(headers)));
  }
  const rows = [];
  for (const row of tablePart.body) {
    const data = row.map((cell) => tag.td(renderParts(cell)));
    rows.push(tag.tr(data));
  }
  children.push(tag.tbody(rows));
  return tag.table(children);
}
const formatFunction = {
  header: (headerBlock) => tag["h" + Math.min(6, headerBlock.level)](renderParts(headerBlock.inlines)),
  codeblock: (codeBlock) => tag.pre(tag.code(text$1(codeBlock.text))),
  table: (tableBlock) => renderTable(tableBlock),
  code: (codePart) => tag.code(text$1(codePart.text)),
  text: (textPart) => text$1(textPart.text),
  link: (linkPart) => tag.a({ href: linkPart.url, className: "link", target: "_blank", rel: "noopener" }, renderParts(linkPart.inlines)),
  pill: renderPill,
  format: (formatPart) => tag[formatPart.format](renderParts(formatPart.children)),
  rule: () => tag.hr(),
  list: renderList,
  image: renderImage,
  newline: () => tag.br()
};
function renderPart(part) {
  const f = formatFunction[part.type];
  if (!f) {
    return text$1(`[unknown part type ${part.type}]`);
  }
  return f(part);
}
function renderParts(parts) {
  return Array.from(parts, renderPart);
}
class BaseMediaView extends BaseMessageView {
  renderMessageBody(t, vm) {
    const heightRatioPercent = vm.height / vm.width * 100;
    let spacerStyle = `padding-top: ${heightRatioPercent}%;`;
    if (vm.platform.isIE11) {
      spacerStyle = `height: ${vm.height}px`;
    }
    const children = [
      t.div({ className: "spacer", style: spacerStyle }),
      this.renderMedia(t, vm),
      t.time(vm.date + " " + vm.time)
    ];
    const status = t.div({
      className: {
        status: true,
        hidden: (vm2) => !vm2.status
      }
    }, (vm2) => vm2.status);
    children.push(status);
    if (vm.isPending) {
      const progress = t.progress({
        min: 0,
        max: 100,
        value: (vm2) => vm2.uploadPercentage,
        className: { hidden: (vm2) => !vm2.isUploading }
      });
      children.push(progress);
    }
    return t.div({ className: "Timeline_messageBody" }, [
      t.div({ className: "media", style: `max-width: ${vm.width}px`, "data-testid": "media" }, children),
      t.if((vm2) => vm2.error, (t2) => t2.p({ className: "error" }, vm.error))
    ]);
  }
  createMenuOptions(vm) {
    const options = super.createMenuOptions(vm);
    if (!vm.isPending) {
      let label;
      switch (vm.shape) {
        case "image":
          label = vm.i18n`Download image`;
          break;
        case "video":
          label = vm.i18n`Download video`;
          break;
        default:
          label = vm.i18n`Download media`;
          break;
      }
      options.push(Menu.option(label, () => vm.downloadMedia()));
    }
    return options;
  }
}
class ImageView extends BaseMediaView {
  renderMedia(t, vm) {
    const img = t.img({
      src: (vm2) => vm2.thumbnailUrl,
      alt: (vm2) => vm2.label,
      title: (vm2) => vm2.label,
      style: `max-width: ${vm.width}px; max-height: ${vm.height}px;`
    });
    return vm.isPending || !vm.lightboxUrl ? img : t.a({ href: vm.lightboxUrl }, img);
  }
}
function domEventAsPromise(element, successEvent) {
  return new Promise((resolve, reject) => {
    let detach;
    const handleError = (evt) => {
      detach();
      reject(evt.target.error);
    };
    const handleSuccess = () => {
      detach();
      resolve();
    };
    detach = () => {
      element.removeEventListener(successEvent, handleSuccess);
      element.removeEventListener("error", handleError);
    };
    element.addEventListener(successEvent, handleSuccess);
    element.addEventListener("error", handleError);
  });
}
class VideoView extends BaseMediaView {
  renderMedia(t) {
    const video = t.video({
      src: (vm) => vm.videoUrl || `data:${vm.mimeType},`,
      title: (vm) => vm.label,
      controls: true,
      preload: "none",
      poster: (vm) => vm.thumbnailUrl,
      onPlay: this._onPlay.bind(this),
      style: (vm) => `max-width: ${vm.width}px; max-height: ${vm.height}px;${vm.isPending ? "z-index: -1" : ""}`
    });
    video.addEventListener("error", this._onError.bind(this));
    return video;
  }
  async _onPlay(evt) {
    const vm = this.value;
    if (!vm.videoUrl) {
      try {
        const video = evt.target;
        await vm.loadVideo();
        const loadPromise = domEventAsPromise(video, "loadeddata");
        video.load();
        await loadPromise;
        video.play();
      } catch (err) {
      }
    }
  }
  _onError(evt) {
    const vm = this.value;
    const video = evt.target;
    const err = video.error;
    if (err instanceof window.MediaError && err.code === 4) {
      if (!video.src.startsWith("data:")) {
        vm.setViewError(new Error(`this browser does not support videos of type ${vm.mimeType}.`));
      } else {
        return;
      }
    } else {
      vm.setViewError(err);
    }
  }
}
class FileView extends BaseMessageView {
  renderMessageBody(t, vm) {
    const children = [];
    if (vm.isPending) {
      children.push((vm2) => vm2.label);
    } else {
      children.push(t.button({ className: "link", onClick: () => vm.download() }, (vm2) => vm2.label), t.time(vm.date + " " + vm.time));
    }
    return t.p({ className: "Timeline_messageBody statusMessage" }, children);
  }
}
class LocationView extends BaseMessageView {
  renderMessageBody(t, vm) {
    return t.p({ className: "Timeline_messageBody statusMessage" }, [
      t.span(vm.label),
      t.a({ className: "Timeline_locationLink", href: vm.mapsLink, target: "_blank", rel: "noopener" }, vm.i18n`Open in maps`),
      t.time(vm.date + " " + vm.time)
    ]);
  }
}
class MissingAttachmentView extends BaseMessageView {
  renderMessageBody(t, vm) {
    return t.p({ className: "Timeline_messageBody statusMessage" }, vm.label);
  }
}
class AnnouncementView extends TemplateView {
  constructor(vm) {
    super(vm);
  }
  render(t, vm) {
    return t.li({
      className: "AnnouncementView",
      "data-event-id": vm.eventId
    }, t.div((vm2) => vm2.announcement));
  }
  onClick() {
  }
}
class RedactedView extends BaseMessageView {
  renderMessageBody(t) {
    return t.p({ className: "Timeline_messageBody statusMessage" }, (vm) => vm.description);
  }
  createMenuOptions(vm) {
    const options = super.createMenuOptions(vm);
    if (vm.isRedacting) {
      options.push(Menu.option(vm.i18n`Cancel`, () => vm.abortPendingRedaction()));
    }
    return options;
  }
}
class GapView extends TemplateView {
  constructor(vm) {
    super(vm);
  }
  render(t) {
    const className = {
      GapView: true,
      isLoading: (vm) => vm.isLoading,
      isAtTop: (vm) => vm.isAtTop
    };
    return t.li({ className }, [
      t.if((vm) => vm.showSpinner, (t2) => spinner(t2)),
      t.span((vm) => vm.currentAction)
    ]);
  }
  onClick() {
  }
}
function viewClassForTile(vm) {
  switch (vm.shape) {
    case "gap":
      return GapView;
    case "announcement":
      return AnnouncementView;
    case "message":
    case "message-status":
      return TextMessageView;
    case "image":
      return ImageView;
    case "video":
      return VideoView;
    case "file":
      return FileView;
    case "location":
      return LocationView;
    case "missing-attachment":
      return MissingAttachmentView;
    case "redacted":
      return RedactedView;
    default:
      throw new Error(`Tiles of shape "${vm.shape}" are not supported, check the tileClassForEntry function in the view model`);
  }
}
class JoinRoomView extends TemplateView {
  render(t, vm) {
    const input = t.input({
      type: "text",
      name: "id",
      id: "id",
      placeholder: vm.i18n`Enter a room id or alias`,
      disabled: (vm2) => vm2.joinInProgress
    });
    return t.main({ className: "middle" }, t.div({ className: "JoinRoomView centered-column" }, [
      t.h2("Join room"),
      t.form({ className: "JoinRoomView_detailsForm form", onSubmit: (evt) => this.onSubmit(evt, input.value) }, [
        t.div({ className: "vertical-layout" }, [
          t.div({ className: "stretch form-row text" }, [
            t.label({ for: "id" }, vm.i18n`Room id`),
            input
          ])
        ]),
        t.div({ className: "button-row" }, [
          t.button({
            className: "button-action primary",
            type: "submit",
            disabled: (vm2) => vm2.joinInProgress
          }, vm.i18n`Join`)
        ]),
        t.map((vm2) => vm2.status, (status, t2) => {
          return t2.div({ className: "JoinRoomView_status" }, [
            spinner(t2, { hidden: (vm2) => !vm2.joinInProgress }),
            t2.span(status)
          ]);
        })
      ])
    ]));
  }
  onSubmit(evt, id) {
    evt.preventDefault();
    this.value.join(id);
  }
}
class SessionView extends TemplateView {
  render(t, vm) {
    return t.div({
      className: {
        "SessionView": true,
        "middle-shown": (vm2) => !!vm2.activeMiddleViewModel,
        "right-shown": (vm2) => !!vm2.rightPanelViewModel
      }
    }, [
      t.view(new SessionStatusView(vm.sessionStatusViewModel)),
      t.view(new LeftPanelView(vm.leftPanelViewModel)),
      t.mapView((vm2) => vm2.activeMiddleViewModel, () => {
        if (vm.roomGridViewModel) {
          return new RoomGridView(vm.roomGridViewModel, viewClassForTile);
        } else if (vm.settingsViewModel) {
          return new SettingsView(vm.settingsViewModel);
        } else if (vm.createRoomViewModel) {
          return new CreateRoomView(vm.createRoomViewModel);
        } else if (vm.joinRoomViewModel) {
          return new JoinRoomView(vm.joinRoomViewModel);
        } else if (vm.currentRoomViewModel) {
          if (vm.currentRoomViewModel.kind === "invite") {
            return new InviteView(vm.currentRoomViewModel);
          } else if (vm.currentRoomViewModel.kind === "room") {
            return new RoomView(vm.currentRoomViewModel, viewClassForTile);
          } else if (vm.currentRoomViewModel.kind === "roomBeingCreated") {
            return new RoomBeingCreatedView(vm.currentRoomViewModel);
          } else {
            return new UnknownRoomView(vm.currentRoomViewModel);
          }
        } else {
          return new StaticView((t2) => t2.div({ className: "room-placeholder" }, t2.h2(vm.i18n`Choose a room on the left side.`)));
        }
      }),
      t.mapView((vm2) => vm2.lightboxViewModel, (lightboxViewModel) => lightboxViewModel ? new LightboxView(lightboxViewModel) : null),
      t.mapView((vm2) => vm2.rightPanelViewModel, (rightPanelViewModel) => rightPanelViewModel ? new RightPanelView(rightPanelViewModel) : null)
    ]);
  }
}
function hydrogenGithubLink(t) {
  if ("395679932") {
    return t.a({
      target: "_blank",
      href: `https://github.com/vector-im/hydrogen-web/releases/tag/v${"0.3.3"}`
    }, `Hydrogen v${"0.3.3"} (${"395679932"}) on Github`);
  } else {
    return t.a({ target: "_blank", href: "https://github.com/vector-im/hydrogen-web" }, "Hydrogen on Github");
  }
}
class PasswordLoginView extends TemplateView {
  render(t, vm) {
    const disabled = (vm2) => !!vm2.isBusy;
    const username = t.input({
      id: "username",
      type: "text",
      placeholder: vm.i18n`Username`,
      disabled
    });
    const password = t.input({
      id: "password",
      type: "password",
      placeholder: vm.i18n`Password`,
      disabled
    });
    return t.div({ className: "PasswordLoginView form" }, [
      t.if((vm2) => vm2.error, (t2) => t2.div({ className: "error" }, (vm2) => vm2.error)),
      t.form({
        onSubmit: (evnt) => {
          evnt.preventDefault();
          vm.login(username.value, password.value);
        }
      }, [
        t.if((vm2) => vm2.errorMessage, (t2, vm2) => t2.p({ className: "error" }, vm2.i18n(vm2.errorMessage))),
        t.div({ className: "form-row text" }, [t.label({ for: "username" }, vm.i18n`Username`), username]),
        t.div({ className: "form-row text" }, [t.label({ for: "password" }, vm.i18n`Password`), password]),
        t.div({ className: "button-row" }, [
          t.button({
            className: "button-action primary",
            type: "submit",
            disabled
          }, vm.i18n`Log In`)
        ])
      ])
    ]);
  }
}
class AccountSetupView extends TemplateView {
  render(t, vm) {
    return t.div({ className: "Settings" }, [
      t.h3(vm.i18n`Restore your encrypted history?`),
      t.ifView((vm2) => vm2.decryptDehydratedDeviceViewModel, (vm2) => new KeyBackupSettingsView(vm2.decryptDehydratedDeviceViewModel)),
      t.map((vm2) => vm2.deviceDecrypted, (decrypted, t2) => {
        if (decrypted) {
          return t2.p(vm.i18n`That worked out, you're good to go!`);
        } else {
          return t2.p(vm.i18n`This will claim the dehydrated device ${vm.dehydratedDeviceId}, and will set up a new one.`);
        }
      }),
      t.div({ className: "button-row" }, [
        t.button({
          className: "button-action primary",
          onClick: () => {
            vm.finish();
          },
          type: "button"
        }, (vm2) => vm2.deviceDecrypted ? vm2.i18n`Continue` : vm2.i18n`Continue without restoring`)
      ])
    ]);
  }
}
class SessionLoadStatusView extends TemplateView {
  render(t) {
    const exportLogsButtonIfFailed = t.if((vm) => vm.hasError, (t2, vm) => {
      return t2.button({
        onClick: () => vm.exportLogs()
      }, vm.i18n`Export logs`);
    });
    const logoutButtonIfFailed = t.if((vm) => vm.hasError, (t2, vm) => {
      return t2.button({
        onClick: () => vm.logout()
      }, vm.i18n`Log out`);
    });
    return t.div({ className: "SessionLoadStatusView" }, [
      t.p({ className: "status" }, [
        spinner(t, { hidden: (vm) => !vm.loading }),
        t.p((vm) => vm.loadLabel),
        exportLogsButtonIfFailed,
        logoutButtonIfFailed
      ]),
      t.ifView((vm) => vm.accountSetupViewModel, (vm) => new AccountSetupView(vm.accountSetupViewModel))
    ]);
  }
}
class CompleteSSOView extends TemplateView {
  render(t) {
    return t.div({ className: "CompleteSSOView" }, [
      t.p({ className: "CompleteSSOView_title" }, "Finishing up your SSO Login"),
      t.if((vm) => vm.errorMessage, (t2, vm) => t2.p({ className: "error" }, vm.i18n(vm.errorMessage))),
      t.mapView((vm) => vm.loadViewModel, (loadViewModel) => loadViewModel ? new SessionLoadStatusView(loadViewModel) : null)
    ]);
  }
}
class LoginView extends TemplateView {
  render(t, vm) {
    const disabled = (vm2) => vm2.isBusy;
    return t.div({ className: "PreSessionScreen" }, [
      t.button({
        className: "button-utility LoginView_back",
        onClick: () => vm.goBack(),
        disabled
      }),
      t.div({ className: "logo" }),
      t.h1([vm.i18n`Sign In`]),
      t.mapView((vm2) => vm2.completeSSOLoginViewModel, (vm2) => vm2 ? new CompleteSSOView(vm2) : null),
      t.if((vm2) => vm2.showHomeserver, (t2, vm2) => t2.div({ className: "LoginView_sso form-row text" }, [
        t2.label({ for: "homeserver" }, vm2.i18n`Homeserver`),
        t2.input({
          id: "homeserver",
          type: "text",
          placeholder: vm2.i18n`Your matrix homeserver`,
          value: vm2.homeserver,
          disabled,
          onInput: (event2) => vm2.setHomeserver(event2.target.value),
          onChange: () => vm2.queryHomeserver()
        }),
        t2.p({ className: {
          LoginView_forwardInfo: true,
          hidden: (vm3) => !vm3.resolvedHomeserver
        } }, (vm3) => vm3.i18n`You will connect to ${vm3.resolvedHomeserver}.`),
        t2.if((vm3) => vm3.errorMessage, (t3, vm3) => t3.p({ className: "error" }, vm3.i18n(vm3.errorMessage)))
      ])),
      t.if((vm2) => vm2.isFetchingLoginOptions, (t2) => t2.div({ className: "LoginView_query-spinner" }, [spinner(t2), t2.p("Fetching available login options...")])),
      t.mapView((vm2) => vm2.passwordLoginViewModel, (vm2) => vm2 ? new PasswordLoginView(vm2) : null),
      t.if((vm2) => vm2.passwordLoginViewModel && vm2.startSSOLoginViewModel, (t2) => t2.p({ className: "LoginView_separator" }, vm.i18n`or`)),
      t.mapView((vm2) => vm2.startSSOLoginViewModel, (vm2) => vm2 ? new StartSSOLoginView(vm2) : null),
      t.mapView((vm2) => vm2.loadViewModel, (loadViewModel) => loadViewModel ? new SessionLoadStatusView(loadViewModel) : null),
      t.p(hydrogenGithubLink(t))
    ]);
  }
}
class StartSSOLoginView extends TemplateView {
  render(t, vm) {
    return t.div({ className: "StartSSOLoginView" }, t.button({
      className: "StartSSOLoginView_button button-action secondary",
      type: "button",
      onClick: () => vm.startSSOLogin(),
      disabled: (vm2) => vm2.isBusy
    }, vm.i18n`Log in with SSO`));
  }
}
class LogoutView extends TemplateView {
  render(t, vm) {
    const confirmView = new InlineTemplateView(vm, (t2) => {
      return t2.div([
        t2.p("Are you sure you want to log out?"),
        t2.div({ className: "button-row" }, [
          t2.a({
            className: "button-action",
            type: "submit",
            href: vm.cancelUrl
          }, ["Cancel"]),
          t2.button({
            className: "button-action primary destructive",
            type: "submit",
            onClick: () => vm.logout()
          }, vm.i18n`Log out`)
        ])
      ]);
    });
    const progressView = new InlineTemplateView(vm, (t2) => {
      return t2.p({ className: "status", hidden: (vm2) => !vm2.showStatus }, [
        spinner(t2, { hidden: (vm2) => !vm2.busy }),
        t2.span((vm2) => vm2.status)
      ]);
    });
    return t.div({ className: "LogoutScreen" }, [
      t.div({ className: "content" }, [
        t.mapView((vm2) => vm2.showConfirm, (showConfirm) => {
          return showConfirm ? confirmView : progressView;
        })
      ])
    ]);
  }
}
class ForcedLogoutView extends TemplateView {
  render(t) {
    return t.div({ className: "LogoutScreen" }, [
      t.div({ className: "content" }, t.map((vm) => vm.showStatus, (showStatus, t2, vm) => {
        if (showStatus) {
          return t2.p({ className: "status" }, [
            spinner(t2, { hidden: (vm2) => !vm2.showSpinner }),
            t2.span((vm2) => vm2.status)
          ]);
        } else {
          return t2.div([
            t2.p("Your access token is no longer valid! You can reauthenticate in the next screen."),
            t2.div({ className: "button-row" }, [
              t2.button({
                className: "button-action primary",
                type: "submit",
                onClick: () => vm.proceed()
              }, vm.i18n`Proceed`)
            ])
          ]);
        }
      }))
    ]);
  }
}
class SessionLoadView extends TemplateView {
  render(t, vm) {
    return t.div({ className: "PreSessionScreen" }, [
      t.div({ className: "logo" }),
      t.div({ className: "SessionLoadView" }, [
        t.view(new SessionLoadStatusView(vm))
      ]),
      t.div({ className: { "button-row": true, hidden: (vm2) => vm2.loading } }, t.a({ className: "button-action primary", href: vm.backUrl }, vm.i18n`Go back`))
    ]);
  }
}
class SessionPickerItemView extends TemplateView {
  _onDeleteClick() {
    if (confirm("Are you sure?")) {
      this.value.delete();
    }
  }
  _onClearClick() {
    if (confirm("Are you sure?")) {
      this.value.clear();
    }
  }
  render(t, vm) {
    return t.li([
      t.a({ className: "session-info", href: vm.openUrl }, [
        t.div({ className: `avatar usercolor${vm.avatarColorNumber}` }, (vm2) => vm2.avatarInitials),
        t.div({ className: "user-id" }, (vm2) => vm2.label)
      ])
    ]);
  }
}
class SessionPickerView extends TemplateView {
  render(t, vm) {
    const sessionList = new ListView({
      list: vm.sessions,
      parentProvidesUpdates: false
    }, (sessionInfo) => {
      return new SessionPickerItemView(sessionInfo);
    });
    return t.div({ className: "PreSessionScreen" }, [
      t.div({ className: "logo" }),
      t.div({ className: "SessionPickerView" }, [
        t.h1(["Continue as \u2026"]),
        t.view(sessionList),
        t.div({ className: "button-row" }, [
          t.a({
            className: "button-action primary",
            href: vm.cancelUrl
          }, vm.i18n`Sign In`)
        ]),
        t.ifView((vm2) => vm2.loadViewModel, () => new SessionLoadStatusView(vm.loadViewModel)),
        t.p(hydrogenGithubLink(t))
      ])
    ]);
  }
}
class RootView extends TemplateView {
  render(t, vm) {
    return t.mapView((vm2) => vm2.activeSection, (activeSection) => {
      switch (activeSection) {
        case "error":
          return new StaticView((t2) => {
            return t2.div({ className: "StatusView" }, [
              t2.h1("Something went wrong"),
              t2.p(vm.errorText)
            ]);
          });
        case "session":
          return new SessionView(vm.sessionViewModel);
        case "login":
          return new LoginView(vm.loginViewModel);
        case "logout":
          return new LogoutView(vm.logoutViewModel);
        case "forced-logout":
          return new ForcedLogoutView(vm.forcedLogoutViewModel);
        case "picker":
          return new SessionPickerView(vm.sessionPickerViewModel);
        case "redirecting":
          return new StaticView((t2) => t2.p("Redirecting..."));
        case "loading":
          return new SessionLoadView(vm.sessionLoadViewModel);
        default:
          throw new Error(`Unknown section: ${vm.activeSection}`);
      }
    });
  }
}
class Timeout {
  constructor(ms) {
    this._reject = null;
    this._handle = null;
    this._promise = new Promise((resolve, reject) => {
      this._reject = reject;
      this._handle = setTimeout(() => {
        this._reject = null;
        resolve();
      }, ms);
    });
  }
  elapsed() {
    return this._promise;
  }
  abort() {
    if (this._reject) {
      this._reject(new AbortError());
      clearTimeout(this._handle);
      this._handle = null;
      this._reject = null;
    }
  }
  dispose() {
    this.abort();
  }
}
class Interval {
  constructor(ms, callback) {
    this._handle = setInterval(callback, ms);
  }
  dispose() {
    if (this._handle) {
      clearInterval(this._handle);
      this._handle = null;
    }
  }
}
class TimeMeasure {
  constructor() {
    this._start = window.performance.now();
  }
  measure() {
    return window.performance.now() - this._start;
  }
}
class Clock {
  createMeasure() {
    return new TimeMeasure();
  }
  createTimeout(ms) {
    return new Timeout(ms);
  }
  createInterval(callback, ms) {
    return new Interval(ms, callback);
  }
  now() {
    return Date.now();
  }
}
class ServiceWorkerHandler {
  constructor() {
    this._waitingForReply = /* @__PURE__ */ new Map();
    this._messageIdCounter = 0;
    this._navigation = null;
    this._registration = null;
    this._registrationPromise = null;
    this._currentController = null;
    this.haltRequests = false;
  }
  setNavigation(navigation) {
    this._navigation = navigation;
  }
  registerAndStart(path) {
    this._registrationPromise = (async () => {
      navigator.serviceWorker.addEventListener("message", this);
      navigator.serviceWorker.addEventListener("controllerchange", this);
      this._registration = await navigator.serviceWorker.register(path);
      await navigator.serviceWorker.ready;
      this._currentController = navigator.serviceWorker.controller;
      this._registration.addEventListener("updatefound", this);
      this._registrationPromise = null;
      if (this._registration.waiting && this._registration.active) {
        this._proposeUpdate();
      }
      console.log("Service Worker registered");
    })();
  }
  _onMessage(event2) {
    const { data } = event2;
    const replyTo = data.replyTo;
    if (replyTo) {
      const resolve = this._waitingForReply.get(replyTo);
      if (resolve) {
        this._waitingForReply.delete(replyTo);
        resolve(data.payload);
      }
    }
    if (data.type === "hasSessionOpen") {
      const hasOpen = this._navigation.observe("session").get() === data.payload.sessionId;
      event2.source.postMessage({ replyTo: data.id, payload: hasOpen });
    } else if (data.type === "hasRoomOpen") {
      const hasSessionOpen = this._navigation.observe("session").get() === data.payload.sessionId;
      const hasRoomOpen = this._navigation.observe("room").get() === data.payload.roomId;
      event2.source.postMessage({ replyTo: data.id, payload: hasSessionOpen && hasRoomOpen });
    } else if (data.type === "closeSession") {
      const { sessionId } = data.payload;
      this._closeSessionIfNeeded(sessionId).finally(() => {
        event2.source.postMessage({ replyTo: data.id });
      });
    } else if (data.type === "haltRequests") {
      this.haltRequests = true;
      event2.source.postMessage({ replyTo: data.id });
    } else if (data.type === "openRoom") {
      this._navigation.push("room", data.payload.roomId);
    }
  }
  _closeSessionIfNeeded(sessionId) {
    var _a;
    const currentSession = (_a = this._navigation) == null ? void 0 : _a.path.get("session");
    if (sessionId && (currentSession == null ? void 0 : currentSession.value) === sessionId) {
      return new Promise((resolve) => {
        const unsubscribe = this._navigation.pathObservable.subscribe((path) => {
          const session = path.get("session");
          if (!session || session.value !== sessionId) {
            unsubscribe();
            resolve();
          }
        });
        this._navigation.push("session");
      });
    } else {
      return Promise.resolve();
    }
  }
  async _proposeUpdate() {
    if (document.hidden) {
      return;
    }
    const version = await this._sendAndWaitForReply("version", null, this._registration.waiting);
    if (confirm(`Version ${version.version} (${version.buildHash}) is available. Reload to apply?`)) {
      await this._sendAndWaitForReply("haltRequests");
      this._send("skipWaiting", null, this._registration.waiting);
    }
  }
  handleEvent(event2) {
    switch (event2.type) {
      case "message":
        this._onMessage(event2);
        break;
      case "updatefound":
        this._registration.installing.addEventListener("statechange", this);
        break;
      case "statechange": {
        if (event2.target.state === "installed") {
          this._proposeUpdate();
          event2.target.removeEventListener("statechange", this);
        }
        break;
      }
      case "controllerchange":
        if (!this._currentController) {
          this._currentController = navigator.serviceWorker.controller;
        } else {
          document.location.reload();
        }
        break;
    }
  }
  async _send(type, payload, worker = void 0) {
    if (this._registrationPromise) {
      await this._registrationPromise;
    }
    if (!worker) {
      worker = this._registration.active;
    }
    worker.postMessage({ type, payload });
  }
  async _sendAndWaitForReply(type, payload, worker = void 0) {
    if (this._registrationPromise) {
      await this._registrationPromise;
    }
    if (!worker) {
      worker = this._registration.active;
    }
    this._messageIdCounter += 1;
    const id = this._messageIdCounter;
    const promise = new Promise((resolve) => {
      this._waitingForReply.set(id, resolve);
    });
    worker.postMessage({ type, id, payload });
    return await promise;
  }
  async checkForUpdate() {
    if (this._registrationPromise) {
      await this._registrationPromise;
    }
    this._registration.update();
  }
  get version() {
    return "0.3.3";
  }
  get buildHash() {
    return "395679932";
  }
  async preventConcurrentSessionAccess(sessionId) {
    return this._sendAndWaitForReply("closeSession", { sessionId });
  }
  async getRegistration() {
    if (this._registrationPromise) {
      await this._registrationPromise;
    }
    return this._registration;
  }
}
class NotificationService {
  constructor(serviceWorkerHandler, pushConfig) {
    this._serviceWorkerHandler = serviceWorkerHandler;
    this._pushConfig = pushConfig;
  }
  async enablePush(pusherFactory, defaultPayload) {
    var _a;
    const registration = await ((_a = this._serviceWorkerHandler) == null ? void 0 : _a.getRegistration());
    if (registration == null ? void 0 : registration.pushManager) {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._pushConfig.applicationServerKey
      });
      const subscriptionData = subscription.toJSON();
      const pushkey = subscriptionData.keys.p256dh;
      const data = {
        endpoint: subscriptionData.endpoint,
        auth: subscriptionData.keys.auth,
        events_only: true,
        default_payload: defaultPayload
      };
      return pusherFactory.httpPusher(this._pushConfig.gatewayUrl, this._pushConfig.appId, pushkey, data);
    }
  }
  async disablePush() {
    var _a;
    const registration = await ((_a = this._serviceWorkerHandler) == null ? void 0 : _a.getRegistration());
    if (registration == null ? void 0 : registration.pushManager) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    }
  }
  async isPushEnabled() {
    var _a;
    const registration = await ((_a = this._serviceWorkerHandler) == null ? void 0 : _a.getRegistration());
    if (registration == null ? void 0 : registration.pushManager) {
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    }
    return false;
  }
  async supportsPush() {
    var _a;
    if (!this._pushConfig) {
      return false;
    }
    const registration = await ((_a = this._serviceWorkerHandler) == null ? void 0 : _a.getRegistration());
    return registration && "pushManager" in registration;
  }
  async enableNotifications() {
    if ("Notification" in window) {
      return await Notification.requestPermission() === "granted";
    }
    return false;
  }
  async supportsNotifications() {
    return "Notification" in window;
  }
  async areNotificationsEnabled() {
    if ("Notification" in window) {
      return Notification.permission === "granted";
    } else {
      return false;
    }
  }
  async showNotification(title, body = void 0) {
    var _a;
    if ("Notification" in window) {
      new Notification(title, { body });
      return;
    }
    const registration = await ((_a = this._serviceWorkerHandler) == null ? void 0 : _a.getRegistration());
    registration == null ? void 0 : registration.showNotification(title, { body });
  }
}
class History extends BaseObservableValue {
  constructor() {
    super();
    this._lastSessionHash = void 0;
  }
  handleEvent(event2) {
    if (event2.type === "hashchange") {
      this.emit(this.get());
      this._storeHash(this.get());
    }
  }
  get() {
    if (document.location.search.includes("loginToken")) {
      return document.location.search;
    }
    return document.location.hash;
  }
  replaceUrlSilently(url) {
    window.history.replaceState(null, null, url);
    this._storeHash(url);
  }
  pushUrlSilently(url) {
    window.history.pushState(null, null, url);
    this._storeHash(url);
  }
  pushUrl(url) {
    document.location.hash = url;
  }
  urlAsPath(url) {
    if (url.startsWith("#")) {
      return url.substr(1);
    } else {
      return url;
    }
  }
  pathAsUrl(path) {
    return `#${path}`;
  }
  onSubscribeFirst() {
    var _a;
    this._lastSessionHash = (_a = window.localStorage) == null ? void 0 : _a.getItem("hydrogen_last_url_hash");
    window.addEventListener("hashchange", this);
  }
  onUnsubscribeLast() {
    window.removeEventListener("hashchange", this);
  }
  _storeHash(hash) {
    var _a;
    (_a = window.localStorage) == null ? void 0 : _a.setItem("hydrogen_last_url_hash", hash);
  }
  getLastSessionUrl() {
    return this._lastSessionHash;
  }
}
class OnlineStatus extends BaseObservableValue {
  constructor() {
    super();
    this._onOffline = this._onOffline.bind(this);
    this._onOnline = this._onOnline.bind(this);
  }
  _onOffline() {
    this.emit(false);
  }
  _onOnline() {
    this.emit(true);
  }
  get() {
    return navigator.onLine;
  }
  onSubscribeFirst() {
    window.addEventListener("offline", this._onOffline);
    window.addEventListener("online", this._onOnline);
  }
  onUnsubscribeLast() {
    window.removeEventListener("offline", this._onOffline);
    window.removeEventListener("online", this._onOnline);
  }
}
function subtleCryptoResult(promiseOrOp, method) {
  if (promiseOrOp instanceof Promise) {
    return promiseOrOp;
  } else {
    return new Promise((resolve, reject) => {
      promiseOrOp.oncomplete = (e) => resolve(e.target.result);
      promiseOrOp.onerror = () => reject(new Error("Crypto error on " + method));
    });
  }
}
class HMACCrypto {
  constructor(subtleCrypto) {
    this._subtleCrypto = subtleCrypto;
  }
  async verify(key, mac, data, hash) {
    const opts = {
      name: "HMAC",
      hash: { name: hashName(hash) }
    };
    const hmacKey = await subtleCryptoResult(this._subtleCrypto.importKey("raw", key, opts, false, ["verify"]), "importKey");
    const isVerified = await subtleCryptoResult(this._subtleCrypto.verify(opts, hmacKey, mac, data), "verify");
    return isVerified;
  }
  async compute(key, data, hash) {
    const opts = {
      name: "HMAC",
      hash: { name: hashName(hash) }
    };
    const hmacKey = await subtleCryptoResult(this._subtleCrypto.importKey("raw", key, opts, false, ["sign"]), "importKey");
    const buffer = await subtleCryptoResult(this._subtleCrypto.sign(opts, hmacKey, data), "sign");
    return new Uint8Array(buffer);
  }
}
class DeriveCrypto {
  constructor(subtleCrypto, crypto2, cryptoExtras) {
    this._subtleCrypto = subtleCrypto;
    this._crypto = crypto2;
    this._cryptoExtras = cryptoExtras;
  }
  async pbkdf2(password, iterations, salt, hash, length) {
    if (!this._subtleCrypto.deriveBits) {
      throw new Error("PBKDF2 is not supported");
    }
    const key = await subtleCryptoResult(this._subtleCrypto.importKey("raw", password, { name: "PBKDF2" }, false, ["deriveBits"]), "importKey");
    const keybits = await subtleCryptoResult(this._subtleCrypto.deriveBits({
      name: "PBKDF2",
      salt,
      iterations,
      hash: hashName(hash)
    }, key, length), "deriveBits");
    return new Uint8Array(keybits);
  }
  async hkdf(key, salt, info, hash, length) {
    if (!this._subtleCrypto.deriveBits) {
      return this._cryptoExtras.hkdf(this._crypto, key, salt, info, hash, length);
    }
    const hkdfkey = await subtleCryptoResult(this._subtleCrypto.importKey("raw", key, { name: "HKDF" }, false, ["deriveBits"]), "importKey");
    const keybits = await subtleCryptoResult(this._subtleCrypto.deriveBits({
      name: "HKDF",
      salt,
      info,
      hash: hashName(hash)
    }, hkdfkey, length), "deriveBits");
    return new Uint8Array(keybits);
  }
}
class AESCrypto {
  constructor(subtleCrypto, crypto2) {
    this._subtleCrypto = subtleCrypto;
    this._crypto = crypto2;
  }
  async decryptCTR({ key, jwkKey, iv, data, counterLength = 64 }) {
    const opts = {
      name: "AES-CTR",
      counter: iv,
      length: counterLength
    };
    let aesKey;
    try {
      const selectedKey = key || jwkKey;
      const format = jwkKey ? "jwk" : "raw";
      aesKey = await subtleCryptoResult(this._subtleCrypto.importKey(format, selectedKey, opts, false, ["decrypt"]), "importKey");
    } catch (err) {
      throw new Error(`Could not import key for AES-CTR decryption: ${err.message}`);
    }
    try {
      const plaintext = await subtleCryptoResult(this._subtleCrypto.decrypt(opts, aesKey, data), "decrypt");
      return new Uint8Array(plaintext);
    } catch (err) {
      throw new Error(`Could not decrypt with AES-CTR: ${err.message}`);
    }
  }
  async encryptCTR({ key, jwkKey, iv, data }) {
    const opts = {
      name: "AES-CTR",
      counter: iv,
      length: 64
    };
    let aesKey;
    const selectedKey = key || jwkKey;
    const format = jwkKey ? "jwk" : "raw";
    try {
      aesKey = await subtleCryptoResult(this._subtleCrypto.importKey(format, selectedKey, opts, false, ["encrypt"]), "importKey");
    } catch (err) {
      throw new Error(`Could not import key for AES-CTR encryption: ${err.message}`);
    }
    try {
      const ciphertext = await subtleCryptoResult(this._subtleCrypto.encrypt(opts, aesKey, data), "encrypt");
      return new Uint8Array(ciphertext);
    } catch (err) {
      throw new Error(`Could not encrypt with AES-CTR: ${err.message}`);
    }
  }
  async generateKey(format, length = 256) {
    const cryptoKey = await subtleCryptoResult(this._subtleCrypto.generateKey({ "name": "AES-CTR", length }, true, ["encrypt", "decrypt"]));
    return subtleCryptoResult(this._subtleCrypto.exportKey(format, cryptoKey));
  }
  async generateIV() {
    return generateIV(this._crypto);
  }
}
function generateIV(crypto2) {
  const randomBytes = crypto2.getRandomValues(new Uint8Array(8));
  const ivArray = new Uint8Array(16);
  for (let i = 0; i < randomBytes.length; i += 1) {
    ivArray[i] = randomBytes[i];
  }
  return ivArray;
}
function jwkKeyToRaw(jwkKey) {
  if (jwkKey.alg !== "A256CTR") {
    throw new Error(`Unknown algorithm: ${jwkKey.alg}`);
  }
  if (!jwkKey.key_ops.includes("decrypt")) {
    throw new Error(`decrypt missing from key_ops`);
  }
  if (jwkKey.kty !== "oct") {
    throw new Error(`Invalid key type, "oct" expected: ${jwkKey.kty}`);
  }
  const base64UrlKey = jwkKey.k;
  const base64Key = base64UrlKey.replace(/-/g, "+").replace(/_/g, "/");
  return base64Arraybuffer.decode(base64Key);
}
function encodeUnpaddedBase64(buffer) {
  const str = base64Arraybuffer.encode(buffer);
  const paddingIdx = str.indexOf("=");
  if (paddingIdx !== -1) {
    return str.substr(0, paddingIdx);
  } else {
    return str;
  }
}
function encodeUrlBase64(buffer) {
  const unpadded = encodeUnpaddedBase64(buffer);
  return unpadded.replace(/\+/g, "-").replace(/\//g, "_");
}
function rawKeyToJwk(key) {
  return {
    "alg": "A256CTR",
    "ext": true,
    "k": encodeUrlBase64(key),
    "key_ops": [
      "encrypt",
      "decrypt"
    ],
    "kty": "oct"
  };
}
class AESLegacyCrypto {
  constructor(aesjs, crypto2) {
    this._aesjs = aesjs;
    this._crypto = crypto2;
  }
  async decryptCTR({ key, jwkKey, iv, data, counterLength = 64 }) {
    if (counterLength !== 64) {
      throw new Error(`Unsupported counter length: ${counterLength}`);
    }
    if (jwkKey) {
      key = jwkKeyToRaw(jwkKey);
    }
    const aesjs = this._aesjs;
    var aesCtr = new aesjs.ModeOfOperation.ctr(new Uint8Array(key), new aesjs.Counter(new Uint8Array(iv)));
    return aesCtr.decrypt(new Uint8Array(data));
  }
  async encryptCTR({ key, jwkKey, iv, data }) {
    if (jwkKey) {
      key = jwkKeyToRaw(jwkKey);
    }
    const aesjs = this._aesjs;
    var aesCtr = new aesjs.ModeOfOperation.ctr(new Uint8Array(key), new aesjs.Counter(new Uint8Array(iv)));
    return aesCtr.encrypt(new Uint8Array(data));
  }
  async generateKey(format, length = 256) {
    let key = crypto.getRandomValues(new Uint8Array(length / 8));
    if (format === "jwk") {
      key = rawKeyToJwk(key);
    }
    return key;
  }
  async generateIV() {
    return generateIV(this._crypto);
  }
}
function hashName(name) {
  if (name !== "SHA-256" && name !== "SHA-512") {
    throw new Error(`Invalid hash name: ${name}`);
  }
  return name;
}
class Crypto {
  constructor(cryptoExtras) {
    const crypto2 = window.crypto || window.msCrypto;
    const subtleCrypto = crypto2.subtle || crypto2.webkitSubtle;
    this._subtleCrypto = subtleCrypto;
    if (!subtleCrypto.deriveBits && (cryptoExtras == null ? void 0 : cryptoExtras.aesjs)) {
      this.aes = new AESLegacyCrypto(cryptoExtras.aesjs, crypto2);
    } else {
      this.aes = new AESCrypto(subtleCrypto, crypto2);
    }
    this.hmac = new HMACCrypto(subtleCrypto);
    this.derive = new DeriveCrypto(subtleCrypto, this, cryptoExtras);
  }
  async digest(hash, data) {
    return await subtleCryptoResult(this._subtleCrypto.digest(hashName(hash), data));
  }
  digestSize(hash) {
    switch (hashName(hash)) {
      case "SHA-512":
        return 64;
      case "SHA-256":
        return 32;
      default:
        throw new Error(`Not implemented for ${hashName(hash)}`);
    }
  }
}
async function estimateStorageUsage() {
  var _a;
  if ((_a = navigator == null ? void 0 : navigator.storage) == null ? void 0 : _a.estimate) {
    const { quota, usage } = await navigator.storage.estimate();
    return { quota, usage };
  } else {
    return { quota: null, usage: null };
  }
}
class WorkerState {
  constructor(worker) {
    this.worker = worker;
    this.busy = false;
  }
  attach(pool) {
    this.worker.addEventListener("message", pool);
    this.worker.addEventListener("error", pool);
  }
  detach(pool) {
    this.worker.removeEventListener("message", pool);
    this.worker.removeEventListener("error", pool);
  }
}
class Request {
  constructor(message, pool) {
    this._promise = new Promise((_resolve, _reject) => {
      this._resolve = _resolve;
      this._reject = _reject;
    });
    this._message = message;
    this._pool = pool;
    this._worker = null;
  }
  abort() {
    if (this._isNotDisposed) {
      this._pool._abortRequest(this);
      this._dispose();
    }
  }
  response() {
    return this._promise;
  }
  _dispose() {
    this._reject = null;
    this._resolve = null;
  }
  get _isNotDisposed() {
    return this._resolve && this._reject;
  }
}
class WorkerPool {
  constructor(path, amount) {
    this._workers = [];
    for (let i = 0; i < amount; ++i) {
      const worker = new WorkerState(new Worker(path));
      worker.attach(this);
      this._workers[i] = worker;
    }
    this._requests = /* @__PURE__ */ new Map();
    this._counter = 0;
    this._pendingFlag = false;
    this._init = null;
  }
  init() {
    const promise = new Promise((resolve, reject) => {
      this._init = { resolve, reject };
    });
    this.sendAll({ type: "ping" }).then(this._init.resolve, this._init.reject).finally(() => {
      this._init = null;
    });
    return promise;
  }
  handleEvent(e) {
    if (e.type === "message") {
      const message = e.data;
      const request = this._requests.get(message.replyToId);
      if (request) {
        request._worker.busy = false;
        if (request._isNotDisposed) {
          if (message.type === "success") {
            request._resolve(message.payload);
          } else if (message.type === "error") {
            const err = new Error(message.message);
            err.stack = message.stack;
            request._reject(err);
          }
          request._dispose();
        }
        this._requests.delete(message.replyToId);
      }
      this._sendPending();
    } else if (e.type === "error") {
      if (this._init) {
        this._init.reject(new Error("worker error during init"));
      }
      console.error("worker error", e);
    }
  }
  _getPendingRequest() {
    for (const r of this._requests.values()) {
      if (!r._worker) {
        return r;
      }
    }
  }
  _getFreeWorker() {
    for (const w of this._workers) {
      if (!w.busy) {
        return w;
      }
    }
  }
  _sendPending() {
    this._pendingFlag = false;
    let success;
    do {
      success = false;
      const request = this._getPendingRequest();
      if (request) {
        const worker = this._getFreeWorker();
        if (worker) {
          this._sendWith(request, worker);
          success = true;
        }
      }
    } while (success);
  }
  _sendWith(request, worker) {
    request._worker = worker;
    worker.busy = true;
    worker.worker.postMessage(request._message);
  }
  _enqueueRequest(message) {
    this._counter += 1;
    message.id = this._counter;
    const request = new Request(message, this);
    this._requests.set(message.id, request);
    return request;
  }
  send(message) {
    const request = this._enqueueRequest(message);
    const worker = this._getFreeWorker();
    if (worker) {
      this._sendWith(request, worker);
    }
    return request;
  }
  sendAll(message) {
    const promises = this._workers.map((worker) => {
      const request = this._enqueueRequest(Object.assign({}, message));
      this._sendWith(request, worker);
      return request.response();
    });
    return Promise.all(promises);
  }
  dispose() {
    for (const w of this._workers) {
      w.detach(this);
      w.worker.terminate();
    }
  }
  _trySendPendingInNextTick() {
    if (!this._pendingFlag) {
      this._pendingFlag = true;
      Promise.resolve().then(() => {
        this._sendPending();
      });
    }
  }
  _abortRequest(request) {
    request._reject(new AbortError());
    if (request._worker) {
      request._worker.busy = false;
    }
    this._requests.delete(request._message.id);
    this._trySendPendingInNextTick();
  }
}
class ImageHandle {
  static async fromBlob(blob) {
    const img = await loadImgFromBlob(blob);
    const { width, height } = img;
    return new ImageHandle(blob, width, height, img);
  }
  constructor(blob, width, height, imgElement) {
    this.blob = blob;
    this.width = width;
    this.height = height;
    this._domElement = imgElement;
  }
  get maxDimension() {
    return Math.max(this.width, this.height);
  }
  async _getDomElement() {
    if (!this._domElement) {
      this._domElement = await loadImgFromBlob(this.blob);
    }
    return this._domElement;
  }
  async scale(maxDimension) {
    const aspectRatio = this.width / this.height;
    const scaleFactor = Math.min(1, maxDimension / (aspectRatio >= 1 ? this.width : this.height));
    const scaledWidth = Math.round(this.width * scaleFactor);
    const scaledHeight = Math.round(this.height * scaleFactor);
    const canvas = document.createElement("canvas");
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext("2d");
    const drawableElement = await this._getDomElement();
    ctx.drawImage(drawableElement, 0, 0, scaledWidth, scaledHeight);
    let mimeType = this.blob.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
    let nativeBlob;
    if (canvas.toBlob) {
      nativeBlob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType));
    } else if (canvas.msToBlob) {
      mimeType = "image/png";
      nativeBlob = canvas.msToBlob();
    } else {
      throw new Error("canvas can't be turned into blob");
    }
    const blob = BlobHandle.fromBlob(nativeBlob);
    return new ImageHandle(blob, scaledWidth, scaledHeight, null);
  }
  dispose() {
    this.blob.dispose();
  }
}
class VideoHandle extends ImageHandle {
  get duration() {
    if (typeof this._domElement.duration === "number") {
      return Math.round(this._domElement.duration * 1e3);
    }
    return void 0;
  }
  static async fromBlob(blob) {
    const video = await loadVideoFromBlob(blob);
    const { videoWidth, videoHeight } = video;
    return new VideoHandle(blob, videoWidth, videoHeight, video);
  }
}
function hasReadPixelPermission() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const rgb = [
    Math.round(Math.random() * 255),
    Math.round(Math.random() * 255),
    Math.round(Math.random() * 255)
  ];
  ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return data[0] === rgb[0] && data[1] === rgb[1] && data[2] === rgb[2];
}
async function loadImgFromBlob(blob) {
  const img = document.createElement("img");
  const loadPromise = domEventAsPromise(img, "load");
  img.src = blob.url;
  await loadPromise;
  return img;
}
async function loadVideoFromBlob(blob) {
  const video = document.createElement("video");
  video.muted = true;
  const loadPromise = domEventAsPromise(video, "loadedmetadata");
  video.src = blob.url;
  video.load();
  await loadPromise;
  const seekPromise = domEventAsPromise(video, "seeked");
  await new Promise((r) => setTimeout(r, 200));
  video.currentTime = 0.1;
  await seekPromise;
  return video;
}
async function downloadInIframe(container2, iframeSrc, blobHandle, filename, isIOS) {
  let iframe = container2.querySelector("iframe.downloadSandbox");
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-downloads allow-downloads-without-user-activation");
    iframe.setAttribute("src", iframeSrc);
    iframe.className = "hidden downloadSandbox";
    container2.appendChild(iframe);
    let detach;
    await new Promise((resolve, reject) => {
      detach = () => {
        iframe.removeEventListener("load", resolve);
        iframe.removeEventListener("error", reject);
      };
      iframe.addEventListener("load", resolve);
      iframe.addEventListener("error", reject);
    });
    detach();
  }
  if (isIOS) {
    const buffer = await blobHandle.readAsBuffer();
    iframe.contentWindow.postMessage({
      type: "downloadBuffer",
      buffer,
      mimeType: blobHandle.mimeType,
      filename
    }, "*");
  } else {
    iframe.contentWindow.postMessage({
      type: "downloadBlob",
      blob: blobHandle.nativeBlob,
      filename
    }, "*");
  }
}
/*! @license DOMPurify 2.3.0 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/2.3.0/LICENSE */
function _toConsumableArray(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
      arr2[i] = arr[i];
    }
    return arr2;
  } else {
    return Array.from(arr);
  }
}
var hasOwnProperty = Object.hasOwnProperty, setPrototypeOf = Object.setPrototypeOf, isFrozen = Object.isFrozen, getPrototypeOf = Object.getPrototypeOf, getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var freeze = Object.freeze, seal = Object.seal, create = Object.create;
var _ref = typeof Reflect !== "undefined" && Reflect, apply = _ref.apply, construct = _ref.construct;
if (!apply) {
  apply = function apply2(fun, thisValue, args) {
    return fun.apply(thisValue, args);
  };
}
if (!freeze) {
  freeze = function freeze2(x) {
    return x;
  };
}
if (!seal) {
  seal = function seal2(x) {
    return x;
  };
}
if (!construct) {
  construct = function construct2(Func, args) {
    return new (Function.prototype.bind.apply(Func, [null].concat(_toConsumableArray(args))))();
  };
}
var arrayForEach = unapply(Array.prototype.forEach);
var arrayPop = unapply(Array.prototype.pop);
var arrayPush = unapply(Array.prototype.push);
var stringToLowerCase = unapply(String.prototype.toLowerCase);
var stringMatch = unapply(String.prototype.match);
var stringReplace = unapply(String.prototype.replace);
var stringIndexOf = unapply(String.prototype.indexOf);
var stringTrim = unapply(String.prototype.trim);
var regExpTest = unapply(RegExp.prototype.test);
var typeErrorCreate = unconstruct(TypeError);
function unapply(func) {
  return function(thisArg) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    return apply(func, thisArg, args);
  };
}
function unconstruct(func) {
  return function() {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }
    return construct(func, args);
  };
}
function addToSet(set, array) {
  if (setPrototypeOf) {
    setPrototypeOf(set, null);
  }
  var l = array.length;
  while (l--) {
    var element = array[l];
    if (typeof element === "string") {
      var lcElement = stringToLowerCase(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) {
          array[l] = lcElement;
        }
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function clone(object) {
  var newObject = create(null);
  var property = void 0;
  for (property in object) {
    if (apply(hasOwnProperty, object, [property])) {
      newObject[property] = object[property];
    }
  }
  return newObject;
}
function lookupGetter(object, prop) {
  while (object !== null) {
    var desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) {
        return unapply(desc.get);
      }
      if (typeof desc.value === "function") {
        return unapply(desc.value);
      }
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue(element) {
    console.warn("fallback value for", element);
    return null;
  }
  return fallbackValue;
}
var html = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "section", "select", "shadow", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
var svg = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
var svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
var svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "fedropshadow", "feimage", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
var mathMl = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover"]);
var mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
var text = freeze(["#text"]);
var html$1 = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "noshade", "novalidate", "nowrap", "open", "optimum", "pattern", "placeholder", "playsinline", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "xmlns", "slot"]);
var svg$1 = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "targetx", "targety", "transform", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
var mathMl$1 = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnsalign", "columnlines", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lspace", "lquote", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
var xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
var MUSTACHE_EXPR = seal(/\{\{[\s\S]*|[\s\S]*\}\}/gm);
var ERB_EXPR = seal(/<%[\s\S]*|[\s\S]*%>/gm);
var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]/);
var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
var IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
var ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
  return typeof obj;
} : function(obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};
function _toConsumableArray$1(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
      arr2[i] = arr[i];
    }
    return arr2;
  } else {
    return Array.from(arr);
  }
}
var getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
};
var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, document2) {
  if ((typeof trustedTypes === "undefined" ? "undefined" : _typeof(trustedTypes)) !== "object" || typeof trustedTypes.createPolicy !== "function") {
    return null;
  }
  var suffix = null;
  var ATTR_NAME = "data-tt-policy-suffix";
  if (document2.currentScript && document2.currentScript.hasAttribute(ATTR_NAME)) {
    suffix = document2.currentScript.getAttribute(ATTR_NAME);
  }
  var policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML: function createHTML(html$$1) {
        return html$$1;
      }
    });
  } catch (_) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
};
function createDOMPurify() {
  var window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
  var DOMPurify = function DOMPurify2(root) {
    return createDOMPurify(root);
  };
  DOMPurify.version = "2.3.0";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== 9) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  var originalDocument = window2.document;
  var document2 = window2.document;
  var DocumentFragment = window2.DocumentFragment, HTMLTemplateElement = window2.HTMLTemplateElement, Node2 = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter, _window$NamedNodeMap = window2.NamedNodeMap, NamedNodeMap = _window$NamedNodeMap === void 0 ? window2.NamedNodeMap || window2.MozNamedAttrMap : _window$NamedNodeMap, Text = window2.Text, Comment = window2.Comment, DOMParser2 = window2.DOMParser, trustedTypes = window2.trustedTypes;
  var ElementPrototype = Element.prototype;
  var cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  var getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  var getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  var getParentNode = lookupGetter(ElementPrototype, "parentNode");
  if (typeof HTMLTemplateElement === "function") {
    var template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) {
      document2 = template.content.ownerDocument;
    }
  }
  var trustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, originalDocument);
  var emptyHTML = trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML("") : "";
  var _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
  var importNode = originalDocument.importNode;
  var documentMode = {};
  try {
    documentMode = clone(document2).documentMode ? document2.documentMode : {};
  } catch (_) {
  }
  var hooks = {};
  DOMPurify.isSupported = typeof getParentNode === "function" && implementation && typeof implementation.createHTMLDocument !== "undefined" && documentMode !== 9;
  var MUSTACHE_EXPR$$1 = MUSTACHE_EXPR, ERB_EXPR$$1 = ERB_EXPR, DATA_ATTR$$1 = DATA_ATTR, ARIA_ATTR$$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$$1 = ATTR_WHITESPACE;
  var IS_ALLOWED_URI$$1 = IS_ALLOWED_URI;
  var ALLOWED_TAGS = null;
  var DEFAULT_ALLOWED_TAGS = addToSet({}, [].concat(_toConsumableArray$1(html), _toConsumableArray$1(svg), _toConsumableArray$1(svgFilters), _toConsumableArray$1(mathMl), _toConsumableArray$1(text)));
  var ALLOWED_ATTR = null;
  var DEFAULT_ALLOWED_ATTR = addToSet({}, [].concat(_toConsumableArray$1(html$1), _toConsumableArray$1(svg$1), _toConsumableArray$1(mathMl$1), _toConsumableArray$1(xml)));
  var FORBID_TAGS = null;
  var FORBID_ATTR = null;
  var ALLOW_ARIA_ATTR = true;
  var ALLOW_DATA_ATTR = true;
  var ALLOW_UNKNOWN_PROTOCOLS = false;
  var SAFE_FOR_TEMPLATES = false;
  var WHOLE_DOCUMENT = false;
  var SET_CONFIG = false;
  var FORCE_BODY = false;
  var RETURN_DOM = false;
  var RETURN_DOM_FRAGMENT = false;
  var RETURN_DOM_IMPORT = true;
  var RETURN_TRUSTED_TYPE = false;
  var SANITIZE_DOM = true;
  var KEEP_CONTENT = true;
  var IN_PLACE = false;
  var USE_PROFILES = {};
  var FORBID_CONTENTS = addToSet({}, ["annotation-xml", "audio", "colgroup", "desc", "foreignobject", "head", "iframe", "math", "mi", "mn", "mo", "ms", "mtext", "noembed", "noframes", "noscript", "plaintext", "script", "style", "svg", "template", "thead", "title", "video", "xmp"]);
  var DATA_URI_TAGS = null;
  var DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
  var URI_SAFE_ATTRIBUTES = null;
  var DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "summary", "title", "value", "style", "xmlns"]);
  var MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  var NAMESPACE = HTML_NAMESPACE;
  var IS_EMPTY_INPUT = false;
  var CONFIG = null;
  var formElement = document2.createElement("form");
  var _parseConfig = function _parseConfig2(cfg) {
    if (CONFIG && CONFIG === cfg) {
      return;
    }
    if (!cfg || (typeof cfg === "undefined" ? "undefined" : _typeof(cfg)) !== "object") {
      cfg = {};
    }
    cfg = clone(cfg);
    ALLOWED_TAGS = "ALLOWED_TAGS" in cfg ? addToSet({}, cfg.ALLOWED_TAGS) : DEFAULT_ALLOWED_TAGS;
    ALLOWED_ATTR = "ALLOWED_ATTR" in cfg ? addToSet({}, cfg.ALLOWED_ATTR) : DEFAULT_ALLOWED_ATTR;
    URI_SAFE_ATTRIBUTES = "ADD_URI_SAFE_ATTR" in cfg ? addToSet(clone(DEFAULT_URI_SAFE_ATTRIBUTES), cfg.ADD_URI_SAFE_ATTR) : DEFAULT_URI_SAFE_ATTRIBUTES;
    DATA_URI_TAGS = "ADD_DATA_URI_TAGS" in cfg ? addToSet(clone(DEFAULT_DATA_URI_TAGS), cfg.ADD_DATA_URI_TAGS) : DEFAULT_DATA_URI_TAGS;
    FORBID_TAGS = "FORBID_TAGS" in cfg ? addToSet({}, cfg.FORBID_TAGS) : {};
    FORBID_ATTR = "FORBID_ATTR" in cfg ? addToSet({}, cfg.FORBID_ATTR) : {};
    USE_PROFILES = "USE_PROFILES" in cfg ? cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_DOM_IMPORT = cfg.RETURN_DOM_IMPORT !== false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$$1 = cfg.ALLOWED_URI_REGEXP || IS_ALLOWED_URI$$1;
    NAMESPACE = cfg.NAMESPACE || HTML_NAMESPACE;
    if (SAFE_FOR_TEMPLATES) {
      ALLOW_DATA_ATTR = false;
    }
    if (RETURN_DOM_FRAGMENT) {
      RETURN_DOM = true;
    }
    if (USE_PROFILES) {
      ALLOWED_TAGS = addToSet({}, [].concat(_toConsumableArray$1(text)));
      ALLOWED_ATTR = [];
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS, html);
        addToSet(ALLOWED_ATTR, html$1);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS, svg);
        addToSet(ALLOWED_ATTR, svg$1);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS, svgFilters);
        addToSet(ALLOWED_ATTR, svg$1);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS, mathMl);
        addToSet(ALLOWED_ATTR, mathMl$1);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    if (cfg.ADD_TAGS) {
      if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
        ALLOWED_TAGS = clone(ALLOWED_TAGS);
      }
      addToSet(ALLOWED_TAGS, cfg.ADD_TAGS);
    }
    if (cfg.ADD_ATTR) {
      if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
        ALLOWED_ATTR = clone(ALLOWED_ATTR);
      }
      addToSet(ALLOWED_ATTR, cfg.ADD_ATTR);
    }
    if (cfg.ADD_URI_SAFE_ATTR) {
      addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR);
    }
    if (KEEP_CONTENT) {
      ALLOWED_TAGS["#text"] = true;
    }
    if (WHOLE_DOCUMENT) {
      addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
    }
    if (ALLOWED_TAGS.table) {
      addToSet(ALLOWED_TAGS, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (freeze) {
      freeze(cfg);
    }
    CONFIG = cfg;
  };
  var MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
  var HTML_INTEGRATION_POINTS = addToSet({}, ["foreignobject", "desc", "title", "annotation-xml"]);
  var ALL_SVG_TAGS = addToSet({}, svg);
  addToSet(ALL_SVG_TAGS, svgFilters);
  addToSet(ALL_SVG_TAGS, svgDisallowed);
  var ALL_MATHML_TAGS = addToSet({}, mathMl);
  addToSet(ALL_MATHML_TAGS, mathMlDisallowed);
  var _checkValidNamespace = function _checkValidNamespace2(element) {
    var parent = getParentNode(element);
    if (!parent || !parent.tagName) {
      parent = {
        namespaceURI: HTML_NAMESPACE,
        tagName: "template"
      };
    }
    var tagName = stringToLowerCase(element.tagName);
    var parentTagName = stringToLowerCase(parent.tagName);
    if (element.namespaceURI === SVG_NAMESPACE) {
      if (parent.namespaceURI === HTML_NAMESPACE) {
        return tagName === "svg";
      }
      if (parent.namespaceURI === MATHML_NAMESPACE) {
        return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
      }
      return Boolean(ALL_SVG_TAGS[tagName]);
    }
    if (element.namespaceURI === MATHML_NAMESPACE) {
      if (parent.namespaceURI === HTML_NAMESPACE) {
        return tagName === "math";
      }
      if (parent.namespaceURI === SVG_NAMESPACE) {
        return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
      }
      return Boolean(ALL_MATHML_TAGS[tagName]);
    }
    if (element.namespaceURI === HTML_NAMESPACE) {
      if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
        return false;
      }
      if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
        return false;
      }
      var commonSvgAndHTMLElements = addToSet({}, ["title", "style", "font", "a", "script"]);
      return !ALL_MATHML_TAGS[tagName] && (commonSvgAndHTMLElements[tagName] || !ALL_SVG_TAGS[tagName]);
    }
    return false;
  };
  var _forceRemove = function _forceRemove2(node) {
    arrayPush(DOMPurify.removed, { element: node });
    try {
      node.parentNode.removeChild(node);
    } catch (_) {
      try {
        node.outerHTML = emptyHTML;
      } catch (_2) {
        node.remove();
      }
    }
  };
  var _removeAttribute = function _removeAttribute2(name, node) {
    try {
      arrayPush(DOMPurify.removed, {
        attribute: node.getAttributeNode(name),
        from: node
      });
    } catch (_) {
      arrayPush(DOMPurify.removed, {
        attribute: null,
        from: node
      });
    }
    node.removeAttribute(name);
    if (name === "is" && !ALLOWED_ATTR[name]) {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
        try {
          _forceRemove(node);
        } catch (_) {
        }
      } else {
        try {
          node.setAttribute(name, "");
        } catch (_) {
        }
      }
    }
  };
  var _initDocument = function _initDocument2(dirty) {
    var doc = void 0;
    var leadingWhitespace = void 0;
    if (FORCE_BODY) {
      dirty = "<remove></remove>" + dirty;
    } else {
      var matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    var dirtyPayload = trustedTypesPolicy ? trustedTypesPolicy.createHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) {
      try {
        doc = new DOMParser2().parseFromString(dirtyPayload, "text/html");
      } catch (_) {
      }
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? "" : dirtyPayload;
      } catch (_) {
      }
    }
    var body = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) {
      body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
    }
    if (NAMESPACE === HTML_NAMESPACE) {
      return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    }
    return WHOLE_DOCUMENT ? doc.documentElement : body;
  };
  var _createIterator = function _createIterator2(root) {
    return createNodeIterator.call(root.ownerDocument || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT, null, false);
  };
  var _isClobbered = function _isClobbered2(elm) {
    if (elm instanceof Text || elm instanceof Comment) {
      return false;
    }
    if (typeof elm.nodeName !== "string" || typeof elm.textContent !== "string" || typeof elm.removeChild !== "function" || !(elm.attributes instanceof NamedNodeMap) || typeof elm.removeAttribute !== "function" || typeof elm.setAttribute !== "function" || typeof elm.namespaceURI !== "string" || typeof elm.insertBefore !== "function") {
      return true;
    }
    return false;
  };
  var _isNode = function _isNode2(object) {
    return (typeof Node2 === "undefined" ? "undefined" : _typeof(Node2)) === "object" ? object instanceof Node2 : object && (typeof object === "undefined" ? "undefined" : _typeof(object)) === "object" && typeof object.nodeType === "number" && typeof object.nodeName === "string";
  };
  var _executeHook = function _executeHook2(entryPoint, currentNode, data) {
    if (!hooks[entryPoint]) {
      return;
    }
    arrayForEach(hooks[entryPoint], function(hook) {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  };
  var _sanitizeElements = function _sanitizeElements2(currentNode) {
    var content = void 0;
    _executeHook("beforeSanitizeElements", currentNode, null);
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if (stringMatch(currentNode.nodeName, /[\u0080-\uFFFF]/)) {
      _forceRemove(currentNode);
      return true;
    }
    var tagName = stringToLowerCase(currentNode.nodeName);
    _executeHook("uponSanitizeElement", currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS
    });
    if (!_isNode(currentNode.firstElementChild) && (!_isNode(currentNode.content) || !_isNode(currentNode.content.firstElementChild)) && regExpTest(/<[/\w]/g, currentNode.innerHTML) && regExpTest(/<[/\w]/g, currentNode.textContent)) {
      _forceRemove(currentNode);
      return true;
    }
    if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
      if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
        var parentNode = getParentNode(currentNode) || currentNode.parentNode;
        var childNodes = getChildNodes(currentNode) || currentNode.childNodes;
        if (childNodes && parentNode) {
          var childCount = childNodes.length;
          for (var i = childCount - 1; i >= 0; --i) {
            parentNode.insertBefore(cloneNode(childNodes[i], true), getNextSibling(currentNode));
          }
        }
      }
      _forceRemove(currentNode);
      return true;
    }
    if (currentNode instanceof Element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed") && regExpTest(/<\/no(script|embed)/i, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === 3) {
      content = currentNode.textContent;
      content = stringReplace(content, MUSTACHE_EXPR$$1, " ");
      content = stringReplace(content, ERB_EXPR$$1, " ");
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
        currentNode.textContent = content;
      }
    }
    _executeHook("afterSanitizeElements", currentNode, null);
    return false;
  };
  var _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
      return false;
    }
    if (ALLOW_DATA_ATTR && !FORBID_ATTR[lcName] && regExpTest(DATA_ATTR$$1, lcName))
      ;
    else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$$1, lcName))
      ;
    else if (!ALLOWED_ATTR[lcName] || FORBID_ATTR[lcName]) {
      return false;
    } else if (URI_SAFE_ATTRIBUTES[lcName])
      ;
    else if (regExpTest(IS_ALLOWED_URI$$1, stringReplace(value, ATTR_WHITESPACE$$1, "")))
      ;
    else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag])
      ;
    else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$$1, stringReplace(value, ATTR_WHITESPACE$$1, "")))
      ;
    else if (!value)
      ;
    else {
      return false;
    }
    return true;
  };
  var _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
    var attr = void 0;
    var value = void 0;
    var lcName = void 0;
    var l = void 0;
    _executeHook("beforeSanitizeAttributes", currentNode, null);
    var attributes = currentNode.attributes;
    if (!attributes) {
      return;
    }
    var hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR
    };
    l = attributes.length;
    while (l--) {
      attr = attributes[l];
      var _attr = attr, name = _attr.name, namespaceURI = _attr.namespaceURI;
      value = stringTrim(attr.value);
      lcName = stringToLowerCase(name);
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = void 0;
      _executeHook("uponSanitizeAttribute", currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (hookEvent.forceKeepAttr) {
        continue;
      }
      _removeAttribute(name, currentNode);
      if (!hookEvent.keepAttr) {
        continue;
      }
      if (regExpTest(/\/>/i, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) {
        value = stringReplace(value, MUSTACHE_EXPR$$1, " ");
        value = stringReplace(value, ERB_EXPR$$1, " ");
      }
      var lcTag = currentNode.nodeName.toLowerCase();
      if (!_isValidAttribute(lcTag, lcName, value)) {
        continue;
      }
      try {
        if (namespaceURI) {
          currentNode.setAttributeNS(namespaceURI, name, value);
        } else {
          currentNode.setAttribute(name, value);
        }
        arrayPop(DOMPurify.removed);
      } catch (_) {
      }
    }
    _executeHook("afterSanitizeAttributes", currentNode, null);
  };
  var _sanitizeShadowDOM = function _sanitizeShadowDOM2(fragment) {
    var shadowNode = void 0;
    var shadowIterator = _createIterator(fragment);
    _executeHook("beforeSanitizeShadowDOM", fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHook("uponSanitizeShadowNode", shadowNode, null);
      if (_sanitizeElements(shadowNode)) {
        continue;
      }
      if (shadowNode.content instanceof DocumentFragment) {
        _sanitizeShadowDOM2(shadowNode.content);
      }
      _sanitizeAttributes(shadowNode);
    }
    _executeHook("afterSanitizeShadowDOM", fragment, null);
  };
  DOMPurify.sanitize = function(dirty, cfg) {
    var body = void 0;
    var importedNode = void 0;
    var currentNode = void 0;
    var oldNode = void 0;
    var returnNode = void 0;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) {
      dirty = "<!-->";
    }
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      if (typeof dirty.toString !== "function") {
        throw typeErrorCreate("toString is not a function");
      } else {
        dirty = dirty.toString();
        if (typeof dirty !== "string") {
          throw typeErrorCreate("dirty is not a string, aborting");
        }
      }
    }
    if (!DOMPurify.isSupported) {
      if (_typeof(window2.toStaticHTML) === "object" || typeof window2.toStaticHTML === "function") {
        if (typeof dirty === "string") {
          return window2.toStaticHTML(dirty);
        }
        if (_isNode(dirty)) {
          return window2.toStaticHTML(dirty.outerHTML);
        }
      }
      return dirty;
    }
    if (!SET_CONFIG) {
      _parseConfig(cfg);
    }
    DOMPurify.removed = [];
    if (typeof dirty === "string") {
      IN_PLACE = false;
    }
    if (IN_PLACE)
      ;
    else if (dirty instanceof Node2) {
      body = _initDocument("<!---->");
      importedNode = body.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === 1 && importedNode.nodeName === "BODY") {
        body = importedNode;
      } else if (importedNode.nodeName === "HTML") {
        body = importedNode;
      } else {
        body.appendChild(importedNode);
      }
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) {
        return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(dirty) : dirty;
      }
      body = _initDocument(dirty);
      if (!body) {
        return RETURN_DOM ? null : emptyHTML;
      }
    }
    if (body && FORCE_BODY) {
      _forceRemove(body.firstChild);
    }
    var nodeIterator = _createIterator(IN_PLACE ? dirty : body);
    while (currentNode = nodeIterator.nextNode()) {
      if (currentNode.nodeType === 3 && currentNode === oldNode) {
        continue;
      }
      if (_sanitizeElements(currentNode)) {
        continue;
      }
      if (currentNode.content instanceof DocumentFragment) {
        _sanitizeShadowDOM(currentNode.content);
      }
      _sanitizeAttributes(currentNode);
      oldNode = currentNode;
    }
    oldNode = null;
    if (IN_PLACE) {
      return dirty;
    }
    if (RETURN_DOM) {
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body.ownerDocument);
        while (body.firstChild) {
          returnNode.appendChild(body.firstChild);
        }
      } else {
        returnNode = body;
      }
      if (RETURN_DOM_IMPORT) {
        returnNode = importNode.call(originalDocument, returnNode, true);
      }
      return returnNode;
    }
    var serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
    if (SAFE_FOR_TEMPLATES) {
      serializedHTML = stringReplace(serializedHTML, MUSTACHE_EXPR$$1, " ");
      serializedHTML = stringReplace(serializedHTML, ERB_EXPR$$1, " ");
    }
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function(cfg) {
    _parseConfig(cfg);
    SET_CONFIG = true;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
  };
  DOMPurify.isValidAttribute = function(tag2, attr, value) {
    if (!CONFIG) {
      _parseConfig({});
    }
    var lcTag = stringToLowerCase(tag2);
    var lcName = stringToLowerCase(attr);
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") {
      return;
    }
    hooks[entryPoint] = hooks[entryPoint] || [];
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint) {
    if (hooks[entryPoint]) {
      arrayPop(hooks[entryPoint]);
    }
  };
  DOMPurify.removeHooks = function(entryPoint) {
    if (hooks[entryPoint]) {
      hooks[entryPoint] = [];
    }
  };
  DOMPurify.removeAllHooks = function() {
    hooks = {};
  };
  return DOMPurify;
}
var purify = createDOMPurify();
class HTMLParseResult {
  constructor(bodyNode) {
    this._bodyNode = bodyNode;
  }
  get rootNodes() {
    return Array.from(this._bodyNode.childNodes);
  }
  getChildNodes(node) {
    return Array.from(node.childNodes);
  }
  getAttributeNames(node) {
    return Array.from(node.getAttributeNames());
  }
  getAttributeValue(node, attr) {
    return node.getAttribute(attr);
  }
  isTextNode(node) {
    return node.nodeType === Node.TEXT_NODE;
  }
  getNodeText(node) {
    return node.textContent;
  }
  isElementNode(node) {
    return node.nodeType === Node.ELEMENT_NODE;
  }
  getNodeElementName(node) {
    return node.tagName;
  }
}
const sanitizeConfig = {
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx|mxc):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  FORBID_TAGS: ["mx-reply"],
  KEEP_CONTENT: false
};
function parseHTML(html2) {
  const sanitized = purify.sanitize(html2, sanitizeConfig);
  const bodyNode = new DOMParser().parseFromString(`<!DOCTYPE html><html><body>${sanitized}</body></html>`, "text/html").body;
  return new HTMLParseResult(bodyNode);
}
var ColorSchemePreference = /* @__PURE__ */ ((ColorSchemePreference2) => {
  ColorSchemePreference2[ColorSchemePreference2["Dark"] = 0] = "Dark";
  ColorSchemePreference2[ColorSchemePreference2["Light"] = 1] = "Light";
  return ColorSchemePreference2;
})(ColorSchemePreference || {});
function getColoredSvgString(svgString, primaryColor, secondaryColor) {
  let coloredSVGCode = svgString.replaceAll("#ff00ff", primaryColor);
  coloredSVGCode = coloredSVGCode.replaceAll("#00ffff", secondaryColor);
  if (svgString === coloredSVGCode) {
    throw new Error("svg-colorizer made no color replacements! The input svg should only contain colors #ff00ff (primary, case-sensitive) and #00ffff (secondary, case-sensitive).");
  }
  return coloredSVGCode;
}
class IconColorizer {
  constructor(platform2, iconVariables, resolvedVariables, manifestLocation) {
    this._platform = platform2;
    this._iconVariables = iconVariables;
    this._resolvedVariables = resolvedVariables;
    this._manifestLocation = manifestLocation;
  }
  async toVariables() {
    const { parsedStructure, promises } = await this._fetchAndParseIcons();
    await Promise.all(promises);
    return this._produceColoredIconVariables(parsedStructure);
  }
  async _fetchAndParseIcons() {
    const promises = [];
    const parsedStructure = {};
    for (const [variable, url] of Object.entries(this._iconVariables)) {
      const urlObject = new URL(`https://${url}`);
      const pathWithoutQueryParams = urlObject.hostname;
      const relativePath = new URL(pathWithoutQueryParams, new URL(this._manifestLocation, window.location.origin));
      const responsePromise = this._platform.request(relativePath, { method: "GET", format: "text", cache: true }).response();
      promises.push(responsePromise);
      const searchParams = urlObject.searchParams;
      parsedStructure[variable] = {
        svg: responsePromise,
        primary: searchParams.get("primary"),
        secondary: searchParams.get("secondary")
      };
    }
    return { parsedStructure, promises };
  }
  async _produceColoredIconVariables(parsedStructure) {
    let coloredVariables = {};
    for (const [variable, { svg: svg2, primary, secondary }] of Object.entries(parsedStructure)) {
      const { body: svgCode } = await svg2;
      if (!primary) {
        throw new Error(`Primary color variable ${primary} not in list of variables!`);
      }
      const primaryColor = this._resolvedVariables[primary], secondaryColor = this._resolvedVariables[secondary];
      const coloredSvgCode = getColoredSvgString(svgCode, primaryColor, secondaryColor);
      const dataURI = `url('data:image/svg+xml;utf8,${encodeURIComponent(coloredSvgCode)}')`;
      coloredVariables[variable] = dataURI;
    }
    return coloredVariables;
  }
}
var offColor$2 = { exports: {} };
var index_min = function(n) {
  var t = {};
  function r(e) {
    if (t[e])
      return t[e].exports;
    var o = t[e] = { i: e, l: false, exports: {} };
    return n[e].call(o.exports, o, o.exports, r), o.l = true, o.exports;
  }
  return r.m = n, r.c = t, r.d = function(n2, t2, e) {
    r.o(n2, t2) || Object.defineProperty(n2, t2, { enumerable: true, get: e });
  }, r.r = function(n2) {
    typeof Symbol != "undefined" && Symbol.toStringTag && Object.defineProperty(n2, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(n2, "__esModule", { value: true });
  }, r.t = function(n2, t2) {
    if (1 & t2 && (n2 = r(n2)), 8 & t2)
      return n2;
    if (4 & t2 && typeof n2 == "object" && n2 && n2.__esModule)
      return n2;
    var e = /* @__PURE__ */ Object.create(null);
    if (r.r(e), Object.defineProperty(e, "default", { enumerable: true, value: n2 }), 2 & t2 && typeof n2 != "string")
      for (var o in n2)
        r.d(e, o, function(t3) {
          return n2[t3];
        }.bind(null, o));
    return e;
  }, r.n = function(n2) {
    var t2 = n2 && n2.__esModule ? function() {
      return n2.default;
    } : function() {
      return n2;
    };
    return r.d(t2, "a", t2), t2;
  }, r.o = function(n2, t2) {
    return Object.prototype.hasOwnProperty.call(n2, t2);
  }, r.p = "", r(r.s = 0);
}([function(n, t, r) {
  function e(n2) {
    let t2, r2;
    const e2 = { light: function() {
      return !a();
    }, dark: a, lighten: d, darken: l, saturate: p, desaturate: function(n3 = 0) {
      return p(n3 *= -1);
    }, increaseContrast: function(n3 = 0) {
      return b(n3 *= -1);
    }, decreaseContrast: b, active: function() {
      return b(0.123);
    }, highlight: function() {
      return b(0.1);
    }, selected: function() {
      return b(0.066);
    }, text: function() {
      return r2 = s() ? o("#333333") : o("#FFFFFF"), e2;
    }, shadow: function() {
      return r2 = s() ? o("#000000") : o("#FFFFFF"), e2;
    }, hex: function() {
      const n3 = r2;
      return r2 = t2, "#" + n3.map((n4) => parseInt(n4 + "", 10).toString(16).padStart(2, "0")).join("");
    }, rgb: function() {
      const n3 = r2;
      return r2 = t2, `rgb(${n3.join()})`;
    }, rgba: function(n3 = 1) {
      const e3 = r2;
      return r2 = t2, `rgba(${e3.join()}, ${n3})`;
    }, setHex: c2, setRgb: function(n3 = [0, 0, 0]) {
      let [o2, u2, c3] = n3;
      return o2 = f(o2, 0, 255), u2 = f(u2, 0, 255), c3 = f(c3, 0, 255), t2 = [o2, u2, c3], r2 = [o2, u2, c3], e2;
    } };
    function c2(n3 = "#000000") {
      return t2 = o(n3), r2 = t2, e2;
    }
    function a() {
      const [n3, e3, o2] = r2;
      return r2 = t2, (299 * n3 + 587 * e3 + 114 * o2) / 1e3 < 128;
    }
    function s() {
      const [n3, t3, e3] = r2;
      return (299 * n3 + 587 * t3 + 114 * e3) / 1e3 >= 128;
    }
    function l(n3 = 0) {
      return d(n3 *= -1);
    }
    function d(n3 = 0) {
      let [t3, o2, c3] = i(r2);
      return c3 = f(c3 + n3, 0, 1), r2 = u([t3, o2, c3]), e2;
    }
    function p(n3 = 0) {
      let [t3, o2, c3] = i(r2);
      return o2 = f(o2 + n3, 0, 1), r2 = u([t3, o2, c3]), e2;
    }
    function b(n3 = 0) {
      return s() ? l(n3) : d(n3);
    }
    return c2(n2), e2;
  }
  function o(n2) {
    if (typeof n2 != "string")
      throw new TypeError("Expected a string");
    (n2 = n2.replace(/^#/, "")).length === 3 && (n2 = n2[0] + n2[0] + n2[1] + n2[1] + n2[2] + n2[2]);
    var t2 = parseInt(n2, 16);
    return [t2 >> 16, t2 >> 8 & 255, 255 & t2];
  }
  function u(n2) {
    const [t2, r2, e2] = n2;
    let o2, u2, c2;
    if (r2 === 0)
      o2 = u2 = c2 = e2;
    else {
      const n3 = function(n4, t3, r3) {
        return r3 < 0 && (r3 += 1), r3 > 1 && (r3 -= 1), r3 < 1 / 6 ? n4 + 6 * (t3 - n4) * r3 : r3 < 0.5 ? t3 : r3 < 2 / 3 ? n4 + (t3 - n4) * (2 / 3 - r3) * 6 : n4;
      }, i2 = e2 < 0.5 ? e2 * (1 + r2) : e2 + r2 - e2 * r2, a = 2 * e2 - i2;
      o2 = f(n3(a, i2, t2 + 1 / 3), 0, 1), u2 = f(n3(a, i2, t2), 0, 1), c2 = f(n3(a, i2, t2 - 1 / 3), 0, 1);
    }
    return [Math.round(255 * o2), Math.round(255 * u2), Math.round(255 * c2)];
  }
  r.r(t), r.d(t, "offColor", function() {
    return e;
  }), r.d(t, "hexRgb", function() {
    return o;
  }), r.d(t, "hslToRgb", function() {
    return u;
  }), r.d(t, "color", function() {
    return c;
  }), r.d(t, "rgbToHsl", function() {
    return i;
  });
  const c = e;
  function i(n2) {
    const t2 = n2[0] / 255, r2 = n2[1] / 255, e2 = n2[2] / 255, o2 = Math.max(t2, r2, e2), u2 = Math.min(t2, r2, e2);
    let c2 = (o2 + u2) / 2, i2 = (o2 + u2) / 2;
    const f2 = (o2 + u2) / 2;
    if (o2 === u2)
      c2 = i2 = 0;
    else {
      const n3 = o2 - u2;
      switch (i2 = f2 > 0.5 ? n3 / (2 - o2 - u2) : n3 / (o2 + u2), o2) {
        case t2:
          c2 = (r2 - e2) / n3 + (r2 < e2 ? 6 : 0);
          break;
        case r2:
          c2 = (e2 - t2) / n3 + 2;
          break;
        case e2:
          c2 = (t2 - r2) / n3 + 4;
      }
      c2 /= 6;
    }
    return [c2, i2, f2];
  }
  function f(n2, t2, r2) {
    return n2 = (n2 = n2 <= r2 ? n2 : r2) >= t2 ? n2 : t2;
  }
}]);
{
  offColor$2.exports = index_min;
}
var offColor$1 = offColor$2.exports;
const offColor = (_c = offColor$2.exports.offColor) != null ? _c : offColor$1.offColor;
function derive(value, operation, argument, isDark) {
  const argumentAsNumber = parseInt(argument);
  if (isDark) {
    if (operation === "darker") {
      operation = "lighter";
    } else if (operation === "lighter") {
      operation = "darker";
    }
  }
  switch (operation) {
    case "darker": {
      const newColorString = offColor(value).darken(argumentAsNumber / 100).hex();
      return newColorString;
    }
    case "lighter": {
      const newColorString = offColor(value).lighten(argumentAsNumber / 100).hex();
      return newColorString;
    }
  }
}
class DerivedVariables {
  constructor(baseVariables, variablesToDerive, isDark) {
    this._aliases = {};
    this._derivedAliases = [];
    this._baseVariables = baseVariables;
    this._variablesToDerive = variablesToDerive;
    this._isDark = isDark;
  }
  toVariables() {
    var _a;
    const resolvedVariables = {};
    this._detectAliases();
    for (const variable of this._variablesToDerive) {
      const resolvedValue = this._derive(variable);
      if (resolvedValue) {
        resolvedVariables[variable] = resolvedValue;
      }
    }
    for (const [alias, variable] of Object.entries(this._aliases)) {
      resolvedVariables[alias] = (_a = this._baseVariables[variable]) != null ? _a : resolvedVariables[variable];
    }
    for (const variable of this._derivedAliases) {
      const resolvedValue = this._deriveAlias(variable, resolvedVariables);
      if (resolvedValue) {
        resolvedVariables[variable] = resolvedValue;
      }
    }
    return resolvedVariables;
  }
  _detectAliases() {
    const newVariablesToDerive = [];
    for (const variable of this._variablesToDerive) {
      const [alias, value] = variable.split("=");
      if (value) {
        this._aliases[alias] = value;
      } else {
        newVariablesToDerive.push(variable);
      }
    }
    this._variablesToDerive = newVariablesToDerive;
  }
  _derive(variable) {
    const RE_VARIABLE_VALUE = /(.+)--(.+)-(.+)/;
    const matches = variable.match(RE_VARIABLE_VALUE);
    if (matches) {
      const [, baseVariable, operation, argument] = matches;
      const value = this._baseVariables[baseVariable];
      if (!value) {
        if (this._aliases[baseVariable]) {
          this._derivedAliases.push(variable);
          return;
        } else {
          throw new Error(`Cannot find value for base variable "${baseVariable}"!`);
        }
      }
      const resolvedValue = derive(value, operation, argument, this._isDark);
      return resolvedValue;
    }
  }
  _deriveAlias(variable, resolvedVariables) {
    const RE_VARIABLE_VALUE = /(.+)--(.+)-(.+)/;
    const matches = variable.match(RE_VARIABLE_VALUE);
    if (matches) {
      const [, baseVariable, operation, argument] = matches;
      const value = resolvedVariables[baseVariable];
      if (!value) {
        throw new Error(`Cannot find value for alias "${baseVariable}" when trying to derive ${variable}!`);
      }
      const resolvedValue = derive(value, operation, argument, this._isDark);
      return resolvedValue;
    }
  }
}
(_d = offColor$2.exports.offColor) != null ? _d : offColor$1.offColor;
class RuntimeThemeParser {
  constructor(platform2, preferredColorScheme) {
    this._themeMapping = {};
    this._preferredColorScheme = preferredColorScheme;
    this._platform = platform2;
  }
  async parse(manifest, baseManifest, baseManifestLocation, log) {
    await log.wrap("RuntimeThemeParser.parse", async () => {
      var _a;
      const { cssLocation, derivedVariables, icons } = this._getSourceData(baseManifest, baseManifestLocation, log);
      const themeName = manifest.name;
      if (!themeName) {
        throw new Error(`Theme name not found in manifest!`);
      }
      let defaultDarkVariant = {}, defaultLightVariant = {};
      for (const [variant, variantDetails] of Object.entries((_a = manifest.values) == null ? void 0 : _a.variants)) {
        try {
          const themeId = `${manifest.id}-${variant}`;
          const { name: variantName, default: isDefault, dark, variables } = variantDetails;
          const resolvedVariables = new DerivedVariables(variables, derivedVariables, dark).toVariables();
          Object.assign(variables, resolvedVariables);
          const iconVariables = await new IconColorizer(this._platform, icons, variables, baseManifestLocation).toVariables();
          Object.assign(variables, resolvedVariables, iconVariables);
          const themeDisplayName = `${themeName} ${variantName}`;
          if (isDefault) {
            const defaultVariant = dark ? defaultDarkVariant : defaultLightVariant;
            Object.assign(defaultVariant, { variantName, id: themeId, cssLocation, variables });
            continue;
          }
          this._themeMapping[themeDisplayName] = { cssLocation, id: themeId, variables };
        } catch (e) {
          console.error(e);
          continue;
        }
      }
      if (defaultDarkVariant.id && defaultLightVariant.id) {
        const defaultVariant = this._preferredColorScheme === ColorSchemePreference.Dark ? defaultDarkVariant : defaultLightVariant;
        this._themeMapping[themeName] = { dark: defaultDarkVariant, light: defaultLightVariant, default: defaultVariant };
      } else {
        const variant = defaultDarkVariant.id ? defaultDarkVariant : defaultLightVariant;
        this._themeMapping[`${themeName} ${variant.variantName}`] = { id: variant.id, cssLocation: variant.cssLocation };
      }
    });
  }
  _getSourceData(manifest, location2, log) {
    return log.wrap("getSourceData", () => {
      var _a, _b, _c2;
      const runtimeCSSLocation = (_a = manifest.source) == null ? void 0 : _a["runtime-asset"];
      if (!runtimeCSSLocation) {
        throw new Error(`Run-time asset not found in source section for theme at ${location2}`);
      }
      const cssLocation = new URL(runtimeCSSLocation, new URL(location2, window.location.origin)).href;
      const derivedVariables = (_b = manifest.source) == null ? void 0 : _b["derived-variables"];
      if (!derivedVariables) {
        throw new Error(`Derived variables not found in source section for theme at ${location2}`);
      }
      const icons = (_c2 = manifest.source) == null ? void 0 : _c2["icon"];
      if (!icons) {
        throw new Error(`Icon mapping not found in source section for theme at ${location2}`);
      }
      return { cssLocation, derivedVariables, icons };
    });
  }
  get themeMapping() {
    return this._themeMapping;
  }
}
class BuiltThemeParser {
  constructor(preferredColorScheme) {
    this._themeMapping = {};
    this._preferredColorScheme = preferredColorScheme;
  }
  parse(manifest, manifestLocation, log) {
    log.wrap("BuiltThemeParser.parse", () => {
      var _a, _b, _c2;
      const builtAssets = (_a = manifest.source) == null ? void 0 : _a["built-assets"];
      const themeName = manifest.name;
      if (!themeName) {
        throw new Error(`Theme name not found in manifest at ${manifestLocation}`);
      }
      let defaultDarkVariant = {}, defaultLightVariant = {};
      for (let [themeId, cssLocation] of Object.entries(builtAssets)) {
        try {
          cssLocation = new URL(cssLocation, new URL(manifestLocation, window.location.origin)).href;
        } catch {
          continue;
        }
        const variant = (_b = themeId.match(/.+-(.+)/)) == null ? void 0 : _b[1];
        const variantDetails = (_c2 = manifest.values) == null ? void 0 : _c2.variants[variant];
        if (!variantDetails) {
          throw new Error(`Variant ${variant} is missing in manifest at ${manifestLocation}`);
        }
        const { name: variantName, default: isDefault, dark } = variantDetails;
        const themeDisplayName = `${themeName} ${variantName}`;
        if (isDefault) {
          const defaultVariant = dark ? defaultDarkVariant : defaultLightVariant;
          defaultVariant.variantName = variantName;
          defaultVariant.id = themeId;
          defaultVariant.cssLocation = cssLocation;
          continue;
        }
        this._themeMapping[themeDisplayName] = {
          cssLocation,
          id: themeId
        };
      }
      if (defaultDarkVariant.id && defaultLightVariant.id) {
        const defaultVariant = this._preferredColorScheme === ColorSchemePreference.Dark ? defaultDarkVariant : defaultLightVariant;
        this._themeMapping[themeName] = { dark: defaultDarkVariant, light: defaultLightVariant, default: defaultVariant };
      } else {
        const variant = defaultDarkVariant.id ? defaultDarkVariant : defaultLightVariant;
        this._themeMapping[`${themeName} ${variant.variantName}`] = { id: variant.id, cssLocation: variant.cssLocation };
      }
    });
  }
  get themeMapping() {
    return this._themeMapping;
  }
}
class ThemeLoader {
  constructor(platform2) {
    this._platform = platform2;
  }
  async init(manifestLocations, log) {
    await this._platform.logger.wrapOrRun(log, "ThemeLoader.init", async (log2) => {
      let noManifestsAvailable = true;
      const failedManifestLoads = [];
      const parseErrors = [];
      const results = await Promise.all(manifestLocations.map((location2) => this._platform.request(location2, { method: "GET", format: "json", cache: true }).response()));
      const runtimeThemeParser = new RuntimeThemeParser(this._platform, this.preferredColorScheme);
      const builtThemeParser = new BuiltThemeParser(this.preferredColorScheme);
      const runtimeThemePromises = [];
      for (let i = 0; i < results.length; ++i) {
        const result = results[i];
        const { status, body } = result;
        if (!(status >= 200 && status <= 299)) {
          console.error(`Failed to load manifest at ${manifestLocations[i]}, status: ${status}`);
          log2.log({ l: "Manifest fetch failed", location: manifestLocations[i], status }, LogLevel.Error);
          failedManifestLoads.push(manifestLocations[i]);
          continue;
        }
        noManifestsAvailable = false;
        try {
          if (body.extends) {
            const indexOfBaseManifest = results.findIndex((result2) => "value" in result2 && result2.value.body.id === body.extends);
            if (indexOfBaseManifest === -1) {
              throw new Error(`Base manifest for derived theme at ${manifestLocations[i]} not found!`);
            }
            const { body: baseManifest } = results[indexOfBaseManifest].value;
            const baseManifestLocation = manifestLocations[indexOfBaseManifest];
            const promise = runtimeThemeParser.parse(body, baseManifest, baseManifestLocation, log2);
            runtimeThemePromises.push(promise);
          } else {
            builtThemeParser.parse(body, manifestLocations[i], log2);
          }
        } catch (e) {
          console.error(e);
          parseErrors.push(e.message);
        }
      }
      await Promise.all(runtimeThemePromises);
      this._themeMapping = __spreadValues(__spreadValues({}, builtThemeParser.themeMapping), runtimeThemeParser.themeMapping);
      if (noManifestsAvailable) {
        throw new Error(`All configured theme manifests failed to load, the following were tried: ${failedManifestLoads.join(", ")}`);
      } else if (Object.keys(this._themeMapping).length === 0 && parseErrors.length) {
        throw new Error(`Failed to parse theme manifests, the following errors were encountered: ${parseErrors.join(", ")}`);
      }
      this._addDefaultThemeToMapping(log2);
      log2.log({ l: "Preferred colorscheme", scheme: this.preferredColorScheme === ColorSchemePreference.Dark ? "dark" : "light" });
      log2.log({ l: "Result", themeMapping: this._themeMapping });
    });
  }
  async setTheme(themeName, themeVariant, log) {
    await this._platform.logger.wrapOrRun(log, { l: "change theme", name: themeName, variant: themeVariant }, async (l) => {
      let cssLocation, variables;
      let themeDetails = this._themeMapping[themeName];
      if ("id" in themeDetails) {
        cssLocation = themeDetails.cssLocation;
        variables = themeDetails.variables;
      } else {
        if (!themeVariant) {
          throw new Error("themeVariant is undefined!");
        }
        cssLocation = themeDetails[themeVariant].cssLocation;
        variables = themeDetails[themeVariant].variables;
      }
      await this._platform.replaceStylesheet(cssLocation, l);
      if (variables) {
        log == null ? void 0 : log.log({ l: "Derived Theme", variables });
        this._injectCSSVariables(variables);
      } else {
        this._removePreviousCSSVariables();
      }
      this._platform.settingsStorage.setString("theme-name", themeName);
      if (themeVariant) {
        this._platform.settingsStorage.setString("theme-variant", themeVariant);
      } else {
        this._platform.settingsStorage.remove("theme-variant");
      }
    });
  }
  _injectCSSVariables(variables) {
    const root = document.documentElement;
    for (const [variable, value] of Object.entries(variables)) {
      root.style.setProperty(`--${variable}`, value);
    }
    this._injectedVariables = variables;
  }
  _removePreviousCSSVariables() {
    if (!this._injectedVariables) {
      return;
    }
    const root = document.documentElement;
    for (const variable of Object.keys(this._injectedVariables)) {
      root.style.removeProperty(`--${variable}`);
    }
    this._injectedVariables = void 0;
  }
  get themeMapping() {
    return this._themeMapping;
  }
  async getActiveTheme() {
    let themeName = await this._platform.settingsStorage.getString("theme-name");
    let themeVariant = await this._platform.settingsStorage.getString("theme-variant");
    if (!themeName || !this._themeMapping[themeName]) {
      themeName = "Default" in this._themeMapping ? "Default" : Object.keys(this._themeMapping)[0];
      if (!this._themeMapping[themeName][themeVariant]) {
        themeVariant = "default" in this._themeMapping[themeName] ? "default" : void 0;
      }
    }
    return { themeName, themeVariant };
  }
  getDefaultTheme() {
    var _a, _b;
    switch (this.preferredColorScheme) {
      case ColorSchemePreference.Dark:
        return (_a = this._platform.config["defaultTheme"]) == null ? void 0 : _a.dark;
      case ColorSchemePreference.Light:
        return (_b = this._platform.config["defaultTheme"]) == null ? void 0 : _b.light;
    }
  }
  _findThemeDetailsFromId(themeId) {
    var _a, _b;
    for (const [themeName, themeData] of Object.entries(this._themeMapping)) {
      if ("id" in themeData && themeData.id === themeId) {
        return { themeName, themeData };
      } else if ("light" in themeData && ((_a = themeData.light) == null ? void 0 : _a.id) === themeId) {
        return { themeName, themeData: themeData.light };
      } else if ("dark" in themeData && ((_b = themeData.dark) == null ? void 0 : _b.id) === themeId) {
        return { themeName, themeData: themeData.dark };
      }
    }
  }
  _addDefaultThemeToMapping(log) {
    log.wrap("addDefaultThemeToMapping", (l) => {
      const defaultThemeId = this.getDefaultTheme();
      if (defaultThemeId) {
        const themeDetails = this._findThemeDetailsFromId(defaultThemeId);
        if (themeDetails) {
          this._themeMapping["Default"] = { id: "default", cssLocation: themeDetails.themeData.cssLocation };
          const variables = themeDetails.themeData.variables;
          if (variables) {
            this._themeMapping["Default"].variables = variables;
          }
        }
      }
      l.log({ l: "Default Theme", theme: defaultThemeId });
    });
  }
  get preferredColorScheme() {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return ColorSchemePreference.Dark;
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return ColorSchemePreference.Light;
    }
  }
}
function addScript(src2) {
  return new Promise(function(resolve, reject) {
    var s = document.createElement("script");
    s.setAttribute("src", src2);
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}
async function loadOlm(olmPaths) {
  if (window.msCrypto && !window.crypto) {
    window.crypto = window.msCrypto;
  }
  if (olmPaths) {
    if (window.WebAssembly) {
      await addScript(olmPaths.wasmBundle);
      await window.Olm.init({ locateFile: () => olmPaths.wasm });
    } else {
      await addScript(olmPaths.legacyBundle);
      await window.Olm.init();
    }
    return window.Olm;
  }
  return null;
}
function assetAbsPath(assetPath) {
  if (!assetPath.startsWith("/")) {
    return new URL(assetPath, document.location.href).pathname;
  }
  return assetPath;
}
async function loadOlmWorker(assetPaths2) {
  const workerPool = new WorkerPool(assetPaths2.worker, 4);
  await workerPool.init();
  await workerPool.sendAll({
    type: "load_olm",
    path: assetAbsPath(assetPaths2.olm.legacyBundle)
  });
  const olmWorker = new OlmWorker(workerPool);
  return olmWorker;
}
function adaptUIOnVisualViewportResize(container2) {
  if (!window.visualViewport) {
    return;
  }
  const handler = () => {
    const sessionView = container2.querySelector(".SessionView");
    if (!sessionView) {
      return;
    }
    const scrollable = container2.querySelector(".bottom-aligned-scroll");
    let scrollTopBefore, heightBefore, heightAfter;
    if (scrollable) {
      scrollTopBefore = scrollable.scrollTop;
      heightBefore = scrollable.offsetHeight;
    }
    const offsetTop = sessionView.offsetTop + sessionView.offsetHeight - window.visualViewport.height;
    container2.style.setProperty("--ios-viewport-height", window.visualViewport.height.toString() + "px");
    container2.style.setProperty("--ios-viewport-top", offsetTop.toString() + "px");
    if (scrollable) {
      heightAfter = scrollable.offsetHeight;
      scrollable.scrollTop = scrollTopBefore + heightBefore - heightAfter;
    }
  };
  window.visualViewport.addEventListener("resize", handler);
  return () => {
    window.visualViewport.removeEventListener("resize", handler);
  };
}
class Platform {
  constructor({ container: container2, assetPaths: assetPaths2, config, configURL: configURL2, options = null, cryptoExtras = null }) {
    this._container = container2;
    this._assetPaths = assetPaths2;
    this._config = config;
    this._configURL = configURL2;
    this.settingsStorage = new SettingsStorage("hydrogen_setting_v1_");
    this.clock = new Clock();
    this.encoding = new Encoding();
    this.random = Math.random;
    this._createLogger(options == null ? void 0 : options.development);
    this.history = new History();
    this.onlineStatus = new OnlineStatus();
    this._serviceWorkerHandler = null;
    if (assetPaths2.serviceWorker && "serviceWorker" in navigator) {
      this._serviceWorkerHandler = new ServiceWorkerHandler();
      this._serviceWorkerHandler.registerAndStart(assetPaths2.serviceWorker);
    }
    this.notificationService = void 0;
    if (this._assetPaths.olm) {
      this.crypto = new Crypto(cryptoExtras);
    }
    this.storageFactory = new StorageFactory(this._serviceWorkerHandler);
    this.sessionInfoStorage = new SessionInfoStorage("hydrogen_sessions_v1");
    this.estimateStorageUsage = estimateStorageUsage;
    if (typeof fetch === "function") {
      this.request = createFetchRequest(this.clock.createTimeout, this._serviceWorkerHandler);
    } else {
      this.request = xhrRequest;
    }
    const isIE11 = !!window.MSInputMethodContext && !!document.documentMode;
    this.isIE11 = isIE11;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && !window.MSStream;
    this.isIOS = isIOS;
    this._disposables = new Disposables();
    this._olmPromise = void 0;
    this._workerPromise = void 0;
    this._themeLoader = new ThemeLoader(this);
  }
  async init() {
    try {
      await this.logger.run("Platform init", async (log) => {
        var _a;
        if (!this._config) {
          if (!this._configURL) {
            throw new Error("Neither config nor configURL was provided!");
          }
          const { status, body } = await this.request(this._configURL, { method: "GET", format: "json", cache: true }).response();
          if (status === 404) {
            throw new Error(`Could not find ${this._configURL}. Did you copy over config.sample.json?`);
          } else if (status >= 400) {
            throw new Error(`Got status ${status} while trying to fetch ${this._configURL}`);
          }
          this._config = body;
        }
        this.notificationService = new NotificationService(this._serviceWorkerHandler, this._config.push);
        if (this._themeLoader) {
          const manifests = this.config["themeManifests"];
          await ((_a = this._themeLoader) == null ? void 0 : _a.init(manifests, log));
          const { themeName, themeVariant } = await this._themeLoader.getActiveTheme();
          log.log({ l: "Active theme", name: themeName, variant: themeVariant });
          await this._themeLoader.setTheme(themeName, themeVariant, log);
        }
      });
    } catch (err) {
      this._container.innerText = err.message;
      throw err;
    }
  }
  _createLogger(isDevelopment) {
    const transformer = (item) => {
      var _a;
      if ((_a = item.e) == null ? void 0 : _a.stack) {
        item.e.stack = item.e.stack.replace(/\/\?loginToken=(.+)/, "?loginToken=<snip>");
      }
      return item;
    };
    if (isDevelopment) {
      this.logger = new ConsoleLogger({ platform: this });
    } else {
      this.logger = new IDBLogger({ name: "hydrogen_logs", platform: this, serializedTransformer: transformer });
    }
  }
  get updateService() {
    return this._serviceWorkerHandler;
  }
  loadOlm() {
    if (!this._olmPromise) {
      this._olmPromise = loadOlm(this._assetPaths.olm);
    }
    return this._olmPromise;
  }
  get config() {
    return this._config;
  }
  async loadOlmWorker() {
    if (!window.WebAssembly) {
      if (!this._workerPromise) {
        this._workerPromise = loadOlmWorker(this._assetPaths);
      }
      return this._workerPromise;
    }
  }
  createAndMountRootView(vm) {
    if (this.isIE11) {
      this._container.className += " legacy";
    }
    if (this.isIOS) {
      this._container.className += " ios";
      const disposable = adaptUIOnVisualViewportResize(this._container);
      if (disposable) {
        this._disposables.track(disposable);
      }
    }
    this._container.addEventListener("error", handleAvatarError, true);
    this._disposables.track(() => this._container.removeEventListener("error", handleAvatarError, true));
    window.__hydrogenViewModel = vm;
    const view = new RootView(vm);
    this._container.appendChild(view.mount());
  }
  setNavigation(navigation) {
    var _a;
    (_a = this._serviceWorkerHandler) == null ? void 0 : _a.setNavigation(navigation);
  }
  createBlob(buffer, mimetype) {
    return BlobHandle.fromBuffer(buffer, mimetype);
  }
  saveFileAs(blobHandle, filename) {
    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blobHandle.nativeBlob, filename);
    } else {
      downloadInIframe(this._container, this._assetPaths.downloadSandbox, blobHandle, filename, this.isIOS);
    }
  }
  openFile(mimeType = null) {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.className = "hidden";
    if (mimeType) {
      input.setAttribute("accept", mimeType);
    }
    const promise = new Promise((resolve) => {
      const checkFile = () => {
        input.removeEventListener("change", checkFile, true);
        const file = input.files[0];
        this._container.removeChild(input);
        if (file) {
          resolve({ name: file.name, blob: BlobHandle.fromBlob(file) });
        } else {
          resolve();
        }
      };
      input.addEventListener("change", checkFile, true);
    });
    this._container.appendChild(input);
    input.click();
    return promise;
  }
  openUrl(url) {
    location.href = url;
  }
  parseHTML(html2) {
    return parseHTML(html2);
  }
  async loadImage(blob) {
    return ImageHandle.fromBlob(blob);
  }
  async loadVideo(blob) {
    return VideoHandle.fromBlob(blob);
  }
  hasReadPixelPermission() {
    return hasReadPixelPermission();
  }
  get devicePixelRatio() {
    return window.devicePixelRatio || 1;
  }
  get version() {
    return "0.3.3";
  }
  get themeLoader() {
    return this._themeLoader;
  }
  async replaceStylesheet(newPath, log) {
    const error = await this.logger.wrapOrRun(log, { l: "replaceStylesheet", location: newPath }, async (l) => {
      let error2;
      const head = document.querySelector("head");
      Array.from(document.querySelectorAll(".theme")).forEach((e) => e.remove());
      const styleTag = document.createElement("link");
      styleTag.href = newPath;
      styleTag.rel = "stylesheet";
      styleTag.type = "text/css";
      styleTag.className = "theme";
      const promise = new Promise((resolve) => {
        styleTag.onerror = () => {
          error2 = new Error(`Failed to load stylesheet from ${newPath}`);
          l.catch(error2);
          resolve();
        };
        styleTag.onload = () => {
          resolve();
        };
      });
      head.appendChild(styleTag);
      await promise;
      return error2;
    });
    if (error) {
      throw error;
    }
  }
  get description() {
    var _a;
    return (_a = navigator.userAgent) != null ? _a : "<unknown>";
  }
  dispose() {
    this._disposables.dispose();
  }
}
var configURL = "./assets/config.6eeb222f.json";
var _downloadSandboxPath = "./assets/download-sandbox.48a866e9.html";
var _workerPath = "./assets/main.bdb9a925.js";
var olmWasmPath = "./assets/olm.b3e0f9b4.wasm";
var olmJsPath = "./assets/olm.92f1ccd0.js";
var olmLegacyJsPath = "./assets/olm_legacy.9dc48f49.js";
var assetPaths = {
  downloadSandbox: _downloadSandboxPath,
  worker: _workerPath,
  olm: {
    wasm: olmWasmPath,
    legacyBundle: olmLegacyJsPath,
    wasmBundle: olmJsPath
  }
};
{
  assetPaths.serviceWorker = "sw.js";
}
const platform = new Platform({
  container: document.body,
  assetPaths,
  configURL,
  options: { development: false }
});
main(platform);
//# sourceMappingURL=index.3657c6d9.js.map
