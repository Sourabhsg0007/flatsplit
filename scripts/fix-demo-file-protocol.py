# Post-process the singlefile demo build so it runs from file:// too:
# 1. convert the inline ES-module bundle to a classic strict-mode IIFE
#    placed at the end of <body> (crossorigin module scripts are blocked
#    on file:// pages, which have an opaque origin)
# 2. add a visible error overlay instead of a silent white screen
import re, sys

path = 'dist-demo/index.demo.html'
s = open(path).read()

m = re.search(r'<script type="module" crossorigin>(.*?)</script>', s, re.DOTALL)
if not m:
    sys.exit('module script not found - already converted?')
bundle = m.group(1)
s = s.replace(m.group(0), '', 1)

overlay = """<script>
window.addEventListener('error', function (e) {
  var el = document.createElement('pre');
  el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;background:#7e2418;color:#fff;padding:12px;font:12px monospace;z-index:99999;white-space:pre-wrap;margin:0';
  el.textContent = 'Preview error: ' + (e.message || e.type) + (e.filename ? '\\n' + e.filename + ':' + e.lineno : '');
  if (document.body) { document.body.appendChild(el); }
  else { document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(el); }); }
});
</script>"""
s = s.replace('</head>', overlay + '\n</head>', 1)

# import.meta is illegal in classic scripts; the only uses in this bundle
# are vite's inline-worker helper reading import.meta.url for diagnostics.
# A plain string keeps it happy.
bundle = bundle.replace('import.meta.url', '"file:///flatsplit-demo.html"')

classic = '<script>\n(function () {\n"use strict";\n' + bundle + '\n})();\n</script>'
s = s.replace('</body>', classic + '\n</body>', 1)

open(path, 'w').write(s)
print('converted: classic IIFE at end of body, error overlay added')
