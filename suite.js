
const sources = new WeakMap();
window.addEventListener('message', (ev) => {
  const resolve = sources.get(ev.source);
  if (!resolve) {
    throw new TypeError('unexpected source');
  }
  resolve(ev.data);
});

function testManifest(manifest, head='') {
  const rigsource = `
<!DOCTYPE html>
<html>
<head>
  <link rel="manifest" href="data:application/json;base64,${btoa(JSON.stringify(manifest))}" />
  ${head}
</head>
<body>
  <script src="${window.location.origin}/pwacompat.js"></script>
  <script>
const ready = new Promise((resolve) => {
  window.addEventListener('load', () => {
    // let pwacompat do its work
    window.setTimeout(resolve, 0);
  });
});
ready.then(() => {
  const all = Array.from(document.head.children).map((el) => {
    const attr = {};
    for (let i = 0; i < el.attributes.length; ++i) {
      const raw = el.attributes[i];
      attr[raw.name] = raw.value;
    }
    return {name: el.localName, attr};
  });
  window.parent.postMessage(all, '*');
});
  </script>
</body>
</html>
  `;

  const iframe = document.createElement('iframe');
  iframe.hidden = true;
  iframe.src = `data:text/html;base64,${btoa(rigsource)}`;
  iframe.sandbox = 'allow-scripts';
  document.body.appendChild(iframe);

  const p = new Promise((resolve, reject) => {
    sources.set(iframe.contentWindow, resolve);
    window.setTimeout(reject, 200);
  });

  const cleanup = () => iframe.remove();
  p.then(cleanup, cleanup);

  return p.then((all) => {
    // rehydrate DOM
    const frag = document.createDocumentFragment();
    all.forEach(({name, attr}) => {
      const node = document.createElement(name);
      for (const n in attr) {
        node.setAttribute(n, attr[n]);
      }
      frag.appendChild(node);
    });
    return frag;
  });
}

suite('pwacompat', () => {
  test('theme_color', async () => {
    const manifest = {
      'theme_color': 'red',
    };
    let r = await testManifest(manifest);
    assert.isNotNull(r.querySelector('meta[name="theme-color"][content="red"]'));

    r = await testManifest(manifest, '<meta name="theme-color" content="blue" />');
    assert.isNotNull(r.querySelector('meta[name="theme-color"][content="blue"]'));
    assert.isNull(r.querySelector('meta[name="theme-color"][content="red"]'),
        'red should not be created');
  });

  test('icons', async () => {
    const manifest = {
      'icons': [
        {'src': 'logo-192.png', 'sizes': '192x192'},
        {'src': 'logo-128.png', 'sizes': '128x128'},
      ],
    };
    const r = await testManifest(manifest);
    assert.isNotNull(r.querySelector('link[rel="icon"][href="logo-128.png"][sizes="128x128"]'));
  });

  // TODO(samthor): Emulate/force userAgent and other environments to test Edge/iOS.
});
