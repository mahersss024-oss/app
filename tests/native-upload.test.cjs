const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { Blob } = require("node:buffer");
const ts = require("typescript");

const runtime = {
  Blob,
  Uint8Array: globalThis.Uint8Array,
  TextEncoder: globalThis.TextEncoder,
  TextDecoder: globalThis.TextDecoder,
};

function loadActualModule(relativePath, imports = {}, globals = {}) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const javascript = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(javascript, {
    module,
    exports: module.exports,
    require: (id) => {
      assert.ok(Object.hasOwn(imports, id), `Unexpected module import: ${id}`);
      return imports[id];
    },
    ...runtime,
    ...globals,
  }, { filename });
  return module.exports;
}

function uploadHarness(platform) {
  // Expo patches RN's simple _parts store. Use the installed patch and serializer
  // themselves so this test follows changes in the pinned SDK's wire format.
  class ReactNativeFormData {
    constructor() { this._parts = []; }
  }
  const { installFormDataPatch } = loadActualModule("node_modules/expo/src/winter/FormData.ts");
  const ExpoFormData = installFormDataPatch(ReactNativeFormData);
  const { convertFormDataAsync } = loadActualModule(
    "node_modules/expo/src/winter/fetch/convertFormData.ts",
    { "../../utils/blobUtils": { blobToArrayBufferAsync: (blob) => blob.arrayBuffer() } },
  );

  const uri = "file:///sandbox/cache/camera-original.jpg";
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x12, 0x80, 0xff, 0xd9]);
  let fileReads = 0;
  let webReads = 0;
  const requests = [];
  const nativeFileStore = new Map([[uri, bytes]]);
  class NativeFile {
    constructor(fileUri) {
      this.uri = fileUri;
      this.name = fileUri.split("/").at(-1);
      this.type = this.name.endsWith(".jpg") ? "image/jpeg" : "";
    }
    async bytes() {
      fileReads++;
      assert.ok(nativeFileStore.has(this.uri), "Only the selected local asset may be read");
      return new Uint8Array(nativeFileStore.get(this.uri));
    }
  }
  const boundary = "----local-test-jpeg-boundary";
  const fetch = async (url, init) => {
    assert.equal(url, "https://native-upload.invalid/api/marketplace/listings/owned-listing/images");
    const multipart = await convertFormDataAsync(init.body, boundary);
    requests.push({ url, init, multipart });
    return { ok: true, status: 201, text: async () => JSON.stringify({ image: { id: "saved-image" } }) };
  };
  const client = loadActualModule("src/core/api.ts", {
    "expo/fetch": { fetch },
    "expo-file-system": { File: NativeFile },
    "react-native": { Platform: { OS: platform } },
  }, {
    FormData: ExpoFormData,
    Headers: globalThis.Headers,
    AbortController: globalThis.AbortController,
    URL: globalThis.URL,
    setTimeout,
    clearTimeout,
    __DEV__: false,
    process: { env: { EXPO_PUBLIC_API_URL: "https://native-upload.invalid" } },
    fetch: async (source) => {
      webReads++;
      assert.equal(platform, "web", "Native upload must not fetch a file URI");
      assert.equal(source, uri);
      return { blob: async () => new Blob([bytes], { type: "image/jpeg" }) };
    },
  });
  return { client, requests, uri, bytes, boundary, convertFormDataAsync, ExpoFormData,
    getFileReads: () => fileReads, getWebReads: () => webReads };
}

function verifyMultipart(request, expectedBytes, filename, boundary) {
  const body = Buffer.from(request.multipart.body);
  const headerEnd = body.indexOf("\r\n\r\n");
  assert.ok(headerEnd > 0, "Multipart headers must be present");
  assert.equal(body.subarray(0, headerEnd).toString("utf8"),
    `--${boundary}\r\ncontent-disposition: form-data; name="image"; filename="${filename}"\r\ncontent-type: image/jpeg`);
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  assert.deepEqual(body.subarray(headerEnd + 4, body.length - suffix.length), expectedBytes,
    "The exact selected JPEG bytes must reach the multipart body");
  assert.deepEqual(body.subarray(-suffix.length), suffix);
  assert.equal(request.multipart.boundary, boundary);
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.credentials, "omit");
  assert.equal(request.init.headers.get("content-type"), null,
    "The transport must generate its boundary instead of receiving JSON or a boundary-less content type");
}

for (const platform of ["android", "ios"]) {
  test(`${platform}: actual API upload survives Expo SDK multipart conversion with JPEG bytes`, async () => {
    const harness = uploadHarness(platform);
    harness.client.setApiIdentity("test-session", "test-agreement");
    const result = await harness.client.api.upload("/api/marketplace/listings/owned-listing/images", {
      uri: harness.uri, name: "product.jpg", type: "image/jpeg",
    }, { idempotencyKey: "one-selected-photo" });
    assert.equal(result.image.id, "saved-image");
    assert.equal(harness.requests.length, 1);
    verifyMultipart(harness.requests[0], harness.bytes, "camera-original.jpg", harness.boundary);
    assert.equal(harness.requests[0].init.headers.get("authorization"), "Bearer test-session");
    assert.equal(harness.requests[0].init.headers.get("idempotency-key"), "one-selected-photo");
    assert.equal(harness.requests[0].init.headers.get("x-souq-hamad-commission-agreement"), "test-agreement");
    assert.equal(harness.getFileReads(), 1);
    assert.equal(harness.getWebReads(), 0);
  });
}

test("web: actual API uploads a fetched Blob with its chosen filename and unchanged bytes", async () => {
  const harness = uploadHarness("web");
  const result = await harness.client.api.upload("/api/marketplace/listings/owned-listing/images", {
    uri: harness.uri, name: "selected-product.jpg", type: "image/jpeg",
  });
  assert.equal(result.image.id, "saved-image");
  verifyMultipart(harness.requests[0], harness.bytes, "selected-product.jpg", harness.boundary);
  assert.equal(harness.getFileReads(), 0);
  assert.equal(harness.getWebReads(), 1);
});

test("regression guard: Expo's actual converter rejects the old RN URI object", async () => {
  const harness = uploadHarness("android");
  const oldBody = new harness.ExpoFormData();
  oldBody.append("image", { uri: harness.uri, name: "product.jpg", type: "image/jpeg" });
  await assert.rejects(() => harness.convertFormDataAsync(oldBody, harness.boundary), /Unsupported FormDataPart implementation/);
});
