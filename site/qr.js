'use strict';
/* Générateur de QR code (niveau de correction M, versions 1 à 10, modes numérique et octets). Sans dépendance, fonctionne hors connexion. */
(function (root) {
  var TOTAL = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  var DATA = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
  var ECB = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGen(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); }
      g = next;
    }
    return g;
  }
  function rsEncode(data, n) {
    var gen = rsGen(n), res = new Array(n).fill(0);
    data.forEach(function (d) {
      var f = d ^ res[0]; res.shift(); res.push(0);
      for (var i = 0; i < n; i++) res[i] ^= gmul(gen[i + 1], f);
    });
    return res;
  }

  function bitsFor(text) {
    var numeric = /^[0-9]+$/.test(text), bytes = null, out = [];
    function put(v, len) { for (var i = len - 1; i >= 0; i--) out.push((v >>> i) & 1); }
    if (!numeric) bytes = Array.prototype.slice.call(new TextEncoder().encode(text));
    for (var ver = 1; ver <= 10; ver++) {
      out = [];
      if (numeric) {
        put(1, 4); put(text.length, ver < 10 ? 10 : 12);
        for (var i = 0; i < text.length; i += 3) { var g = text.substr(i, 3); put(parseInt(g, 10), g.length === 3 ? 10 : g.length === 2 ? 7 : 4); }
      } else {
        put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
        bytes.forEach(function (b) { put(b, 8); });
      }
      if (out.length <= DATA[ver] * 8) return { ver: ver, bits: out };
    }
    throw new Error('Texte trop long pour le QR code');
  }

  function codewords(text) {
    var r = bitsFor(text), ver = r.ver, bits = r.bits, cap = DATA[ver] * 8, i;
    for (i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; cw.push(b); }
    for (i = 0; cw.length < DATA[ver]; i++) cw.push(i % 2 ? 0x11 : 0xec);
    // blocs
    var nb = ver === 1 || ver === 2 || ver === 3 ? 1 : ver === 4 || ver === 5 ? 2 : ver === 6 || ver === 7 ? 4 : ver === 8 ? 4 : ver === 9 ? 5 : 5;
    var shortLen = Math.floor(DATA[ver] / nb), longCount = DATA[ver] % nb, blocks = [], pos = 0;
    for (i = 0; i < nb; i++) { var len = shortLen + (i >= nb - longCount ? 1 : 0); blocks.push(cw.slice(pos, pos + len)); pos += len; }
    var ecs = blocks.map(function (bl) { return rsEncode(bl, ECB[ver]); }), out = [];
    var maxLen = shortLen + (longCount ? 1 : 0);
    for (i = 0; i < maxLen; i++) blocks.forEach(function (bl) { if (i < bl.length) out.push(bl[i]); });
    for (i = 0; i < ECB[ver]; i++) ecs.forEach(function (e) { out.push(e[i]); });
    return { ver: ver, data: out };
  }

  function formatBits(mask) { var data = mask, rem = data; for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); return ((data << 10) | rem) ^ 0x5412; }
  function versionBits(ver) { var rem = ver; for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); return (ver << 12) | rem; }

  function build(text) {
    var cwd = codewords(text), ver = cwd.ver, size = 17 + 4 * ver;
    var mod = [], fn = [], i, j;
    for (i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < size && y < size) { mod[y][x] = v; fn[y][x] = true; } }
    function finder(cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 4 && d !== 2); } }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    for (i = 8; i < size - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
    var al = ALIGN[ver];
    al.forEach(function (ay) { al.forEach(function (ax) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ax === al[al.length - 1] && ay === 6)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    // zones réservées
    for (i = 0; i < 9; i++) { if (i !== 6) { set(8, i, false); set(i, 8, false); } }
    for (i = 0; i < 8; i++) { set(size - 1 - i, 8, false); set(8, size - 1 - i, false); }
    set(8, size - 8, true);
    if (ver >= 7) { var vb = versionBits(ver); for (i = 0; i < 18; i++) { var bit = ((vb >> i) & 1) === 1, a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit); set(b, a, bit); } }
    // placement des données
    var bits = []; cwd.data.forEach(function (c) { for (var k = 7; k >= 0; k--) bits.push((c >> k) & 1); });
    var bi = 0, up = true;
    for (var x = size - 1; x > 0; x -= 2) {
      if (x === 6) x = 5;
      for (j = 0; j < size; j++) {
        var y = up ? size - 1 - j : j;
        for (var c = 0; c < 2; c++) { var xx = x - c; if (!fn[y][xx]) { mod[y][xx] = bi < bits.length ? bits[bi] === 1 : false; bi++; } }
      }
      up = !up;
    }
    var masks = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x, y) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; }, function (x, y) { return ((x * y) % 2) + ((x * y) % 3) === 0; },
      function (x, y) { return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; }, function (x, y) { return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; }];
    function withMask(m) {
      var g = mod.map(function (row, y) { return row.map(function (v, x) { return fn[y][x] ? v : v !== masks[m](x, y); }); });
      var f = formatBits(m);
      for (var k = 0; k < 15; k++) {
        var bit = ((f >> k) & 1) === 1;
        var p1 = k < 6 ? [8, k] : k === 6 ? [8, 7] : k === 7 ? [8, 8] : k === 8 ? [7, 8] : [14 - k, 8];
        g[p1[1]][p1[0]] = bit;
        var p2 = k < 8 ? [size - 1 - k, 8] : [8, size - 15 + k];
        g[p2[1]][p2[0]] = bit;
      }
      g[size - 8][8] = true;
      return g;
    }
    function penalty(g) {
      var p = 0, n, y, x, run, cnt = 0;
      for (var pass = 0; pass < 2; pass++) for (y = 0; y < size; y++) {
        run = 1;
        for (x = 1; x < size; x++) {
          var a = pass ? g[x][y] : g[y][x], b = pass ? g[x - 1][y] : g[y][x - 1];
          if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
      }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) if (g[y][x] === g[y][x + 1] && g[y][x] === g[y + 1][x] && g[y][x] === g[y + 1][x + 1]) p += 3;
      var pat = [true, false, true, true, true, false, true, false, false, false, false], pat2 = pat.slice().reverse();
      function line(get) { for (var s = 0; s + 11 <= size; s++) { var m1 = true, m2 = true; for (var t = 0; t < 11; t++) { var v = get(s + t); if (v !== pat[t]) m1 = false; if (v !== pat2[t]) m2 = false; } if (m1) p += 40; if (m2) p += 40; } }
      for (y = 0; y < size; y++) { line(function (i2) { return g[y][i2]; }); line(function (i2) { return g[i2][y]; }); }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (g[y][x]) cnt++;
      n = Math.floor(Math.abs(cnt * 20 - size * size * 10) / (size * size)); p += n * 10;
      return p;
    }
    var best = null, bestP = Infinity;
    for (var m = 0; m < 8; m++) { var g = withMask(m), pp = penalty(g); if (pp < bestP) { bestP = pp; best = g; } }
    return { size: size, grid: best };
  }

  function draw(canvas, text, px) {
    var q = build(text), quiet = 4, scale = px || 6, total = (q.size + quiet * 2) * scale;
    canvas.width = total; canvas.height = total;
    var ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, total, total); ctx.fillStyle = '#000';
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.grid[y][x]) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    return q;
  }
  root.NumixsQR = { build: build, draw: draw };
  if (typeof module !== 'undefined') module.exports = root.NumixsQR;
})(typeof window !== 'undefined' ? window : globalThis);
