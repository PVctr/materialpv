/*
 * Renderizador leve do dente 3D (WebGL, sem dependências).
 * - Lê arquivos .glb (glTF 2.0 binário) sem compressão Draco/Meshopt.
 * - Aplica um material próprio de esmalte, ignorando texturas do arquivo.
 * - Carregado sob demanda por main.js; expõe window.ToothRenderer.mount().
 */
(function () {
  'use strict';

  /* ---------- matemática mínima (matrizes 4x4, coluna maior) ---------- */
  var M = {
    ident: function () { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
    mul: function (a, b) {
      var o = new Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
        o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
      }
      return o;
    },
    trs: function (t, q, s) {
      t = t || [0,0,0]; q = q || [0,0,0,1]; s = s || [1,1,1];
      var x=q[0], y=q[1], z=q[2], w=q[3];
      return [
        (1-2*(y*y+z*z))*s[0], (2*(x*y+z*w))*s[0], (2*(x*z-y*w))*s[0], 0,
        (2*(x*y-z*w))*s[1], (1-2*(x*x+z*z))*s[1], (2*(y*z+x*w))*s[1], 0,
        (2*(x*z+y*w))*s[2], (2*(y*z-x*w))*s[2], (1-2*(x*x+y*y))*s[2], 0,
        t[0], t[1], t[2], 1
      ];
    },
    rotX: function (a) { var c=Math.cos(a), s=Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
    rotY: function (a) { var c=Math.cos(a), s=Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
    rotZ: function (a) { var c=Math.cos(a), s=Math.sin(a); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; },
    translate: function (x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; },
    perspective: function (fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
    },
    normal3: function (m) { // inversa transposta do bloco 3x3
      var a=m[0],b=m[1],c=m[2],d=m[4],e=m[5],f=m[6],g=m[8],h=m[9],i=m[10];
      var A=e*i-f*h, B=-(d*i-f*g), C=d*h-e*g;
      var det = a*A + b*B + c*C || 1;
      return [A/det, B/det, C/det,
              -(b*i-c*h)/det, (a*i-c*g)/det, -(a*h-b*g)/det,
              (b*f-c*e)/det, -(a*f-c*d)/det, (a*e-b*d)/det];
    }
  };

  /* ---------------------------- leitor GLB ---------------------------- */
  var COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  var NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  var NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

  function readAccessor(gltf, bin, index) {
    var acc = gltf.accessors[index];
    var view = gltf.bufferViews[acc.bufferView];
    var Type = COMP[acc.componentType];
    var n = NCOMP[acc.type];
    var bpe = Type.BYTES_PER_ELEMENT;
    var stride = view.byteStride || n * bpe;
    var base = (view.byteOffset || 0) + (acc.byteOffset || 0);
    var out = new Float32Array(acc.count * n);
    var dv = new DataView(bin.buffer, bin.byteOffset);
    var getter = {
      5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32'
    }[acc.componentType];
    var div = acc.normalized ? NORM[acc.componentType] : 1;
    for (var i = 0; i < acc.count; i++) {
      for (var k = 0; k < n; k++) {
        var v = dv[getter](base + i * stride + k * bpe, true);
        out[i * n + k] = acc.normalized ? Math.max(v / div, -1) : v;
      }
    }
    return { data: out, size: n };
  }

  function parseGLB(buffer, opts) {
    var dv = new DataView(buffer);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Arquivo não é GLB.');
    var offset = 12, gltf = null, bin = null;
    while (offset < buffer.byteLength) {
      var len = dv.getUint32(offset, true), type = dv.getUint32(offset + 4, true);
      var chunk = new Uint8Array(buffer, offset + 8, len);
      if (type === 0x4E4F534A) gltf = JSON.parse(new TextDecoder().decode(chunk));
      else if (type === 0x004E4942) bin = chunk;
      offset += 8 + len;
    }
    if (!gltf || !bin) throw new Error('GLB incompleto.');
    var unsupported = (gltf.extensionsRequired || []).filter(function (e) {
      return e !== 'KHR_materials_emissive_strength' && e !== 'KHR_texture_transform';
    });
    if (unsupported.length) throw new Error('Extensões não suportadas: ' + unsupported.join(', ') + '. Exporte o GLB sem compressão.');

    var include = (opts && opts.includeMeshes) || [];
    var pos = [], nor = [], col = [], idx = [], vcount = 0;

    function visit(nodeIndex, parent) {
      var node = gltf.nodes[nodeIndex];
      var local = node.matrix ? node.matrix.slice() : M.trs(node.translation, node.rotation, node.scale);
      var world = M.mul(parent, local);
      if (node.mesh !== undefined) {
        var mesh = gltf.meshes[node.mesh];
        var name = node.name || mesh.name || '';
        if (!include.length || include.indexOf(name) !== -1 || include.indexOf(mesh.name) !== -1) {
          addMesh(mesh, world);
        }
      }
      (node.children || []).forEach(function (c) { visit(c, world); });
    }

    function addMesh(mesh, world) {
      var nm = M.normal3(world);
      mesh.primitives.forEach(function (p) {
        if (p.mode !== undefined && p.mode !== 4) return; // apenas triângulos
        if (p.attributes.POSITION === undefined) return;
        var P = readAccessor(gltf, bin, p.attributes.POSITION).data;
        var count = P.length / 3;
        var N = p.attributes.NORMAL !== undefined ? readAccessor(gltf, bin, p.attributes.NORMAL).data : null;
        var C = p.attributes.COLOR_0 !== undefined ? readAccessor(gltf, bin, p.attributes.COLOR_0) : null;
        var I = p.indices !== undefined ? readAccessor(gltf, bin, p.indices).data : null;
        var localPos = new Float32Array(P.length);
        for (var i = 0; i < count; i++) {
          var x = P[i*3], y = P[i*3+1], z = P[i*3+2];
          localPos[i*3]   = world[0]*x + world[4]*y + world[8]*z + world[12];
          localPos[i*3+1] = world[1]*x + world[5]*y + world[9]*z + world[13];
          localPos[i*3+2] = world[2]*x + world[6]*y + world[10]*z + world[14];
        }
        var indices = [];
        if (I) for (i = 0; i < I.length; i++) indices.push(I[i]);
        else for (i = 0; i < count; i++) indices.push(i);
        var localNor = new Float32Array(P.length);
        if (N) {
          for (i = 0; i < count; i++) {
            var a = N[i*3], b = N[i*3+1], c = N[i*3+2];
            var nx = nm[0]*a + nm[3]*b + nm[6]*c, ny = nm[1]*a + nm[4]*b + nm[7]*c, nz = nm[2]*a + nm[5]*b + nm[8]*c;
            var l = Math.hypot(nx, ny, nz) || 1;
            localNor[i*3] = nx/l; localNor[i*3+1] = ny/l; localNor[i*3+2] = nz/l;
          }
        } else {
          computeNormals(localPos, indices, localNor);
        }
        for (i = 0; i < count; i++) {
          pos.push(localPos[i*3], localPos[i*3+1], localPos[i*3+2]);
          nor.push(localNor[i*3], localNor[i*3+1], localNor[i*3+2]);
          if (C) {
            var s = C.size;
            col.push(C.data[i*s], C.data[i*s+1], C.data[i*s+2], s === 4 ? C.data[i*s+3] : 1);
          } else col.push(1, 1, 1, 1);
        }
        for (i = 0; i < indices.length; i++) idx.push(indices[i] + vcount);
        vcount += count;
      });
    }

    var scene = gltf.scenes[gltf.scene || 0];
    scene.nodes.forEach(function (n) { visit(n, M.ident()); });
    if (!vcount) throw new Error('Nenhuma malha encontrada no modelo.');
    return normalize({ pos: new Float32Array(pos), nor: new Float32Array(nor), col: new Float32Array(col), idx: new Uint32Array(idx) });
  }

  function computeNormals(p, idx, out) {
    for (var i = 0; i < idx.length; i += 3) {
      var a = idx[i]*3, b = idx[i+1]*3, c = idx[i+2]*3;
      var ux = p[b]-p[a], uy = p[b+1]-p[a+1], uz = p[b+2]-p[a+2];
      var vx = p[c]-p[a], vy = p[c+1]-p[a+1], vz = p[c+2]-p[a+2];
      var nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
      [a, b, c].forEach(function (k) { out[k] += nx; out[k+1] += ny; out[k+2] += nz; });
    }
    for (i = 0; i < out.length; i += 3) {
      var l = Math.hypot(out[i], out[i+1], out[i+2]) || 1;
      out[i] /= l; out[i+1] /= l; out[i+2] /= l;
    }
  }

  // centraliza e ajusta a maior dimensão para 2 unidades
  function normalize(g) {
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (var i = 0; i < g.pos.length; i += 3) for (var k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], g.pos[i+k]); max[k] = Math.max(max[k], g.pos[i+k]);
    }
    var c = [(min[0]+max[0])/2, (min[1]+max[1])/2, (min[2]+max[2])/2];
    var s = 2 / Math.max(max[0]-min[0], max[1]-min[1], max[2]-min[2]);
    for (i = 0; i < g.pos.length; i += 3) for (k = 0; k < 3; k++) g.pos[i+k] = (g.pos[i+k] - c[k]) * s;
    return g;
  }

  /* ------------------------------ shaders ------------------------------ */
  var VERT = [
    'attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aCol;',
    'uniform mat4 uModel; uniform mat4 uViewProj; uniform mat3 uNormal;',
    'varying vec3 vN; varying vec3 vW; varying vec4 vC;',
    'void main(){',
    '  vec4 w = uModel * vec4(aPos, 1.0);',
    '  vW = w.xyz; vN = normalize(uNormal * aNor); vC = aCol;',
    '  gl_Position = uViewProj * w;',
    '}'
  ].join('\n');

  // Esmalte: difusa com "wrap" (aspecto levemente translúcido), especular
  // suave em duas camadas, Fresnel e ambiente neutro com preenchimento azul-claro.
  var FRAG = [
    'precision highp float;',
    'varying vec3 vN; varying vec3 vW; varying vec4 vC;',
    'uniform vec3 uCam;',
    'vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }',
    'float wrapD(vec3 n, vec3 l, float w){ return max((dot(n,l)+w)/(1.0+w), 0.0); }',
    'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }',
    'void main(){',
    '  vec3 n = normalize(vN); vec3 v = normalize(uCam - vW);',
    '  if (dot(n, v) < 0.0) n = -n;',
    '  vec3 base = toLin(vC.rgb) * 0.84; float ao = vC.a;',
    '  vec3 lKey = normalize(vec3(-0.85, 0.75, 0.35));',
    '  vec3 lFill = normalize(vec3(0.95, 0.05, 0.45));',
    '  vec3 lRim = normalize(vec3(0.25, 0.55, -0.95));',
    '  vec3 cKey = vec3(1.0, 0.985, 0.96) * 1.40;',
    '  vec3 cFill = toLin(vec3(0.725, 0.882, 0.961)) * 0.75;', // #B9E1F5
    '  vec3 cRim = vec3(1.0) * 0.55;',
    '  float up = n.y * 0.5 + 0.5;',
    '  vec3 amb = mix(vec3(0.80, 0.82, 0.84), vec3(1.0), up) * 0.26;',
    '  vec3 diff = base * (amb * ao + cKey * wrapD(n, lKey, 0.18) + cFill * wrapD(n, lFill, 0.5) * mix(0.6, 1.0, ao) + cRim * wrapD(n, lRim, 0.2) * 0.5 + vec3(0.10) * wrapD(n, v, 0.0));',
    '  vec3 h = normalize(lKey + v); float nh = max(dot(n, h), 0.0);',
    '  float spec = pow(nh, 70.0) * 0.32 + pow(nh, 14.0) * 0.06;',
    '  vec3 hf = normalize(lFill + v);',
    '  float specF = pow(max(dot(n, hf), 0.0), 40.0) * 0.12;',
    '  float ndv = max(dot(n, v), 0.0); float fres = pow(1.0 - ndv, 4.0) * smoothstep(0.0, 0.12, ndv);',
    '  vec3 col = diff + (cKey * spec + cFill * specF) * mix(0.4, 1.0, ao) + mix(vec3(0.9), cFill * 1.4, 0.6) * fres * 0.35 * ao;',
    '  col = aces(col * 0.9);',
    '  gl_FragColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);',
    '}'
  ].join('\n');

  // Órbita: linha fina com um trecho mais forte que percorre o círculo
  var RING_VERT = [
    'attribute vec3 aPos; attribute float aT;',
    'uniform mat4 uModel; uniform mat4 uViewProj;',
    'varying float vT;',
    'void main(){ vT = aT; gl_Position = uViewProj * uModel * vec4(aPos, 1.0); }'
  ].join('\n');
  var RING_FRAG = [
    'precision mediump float;',
    'varying float vT; uniform float uPhase; uniform vec3 uColor; uniform float uBase;',
    'void main(){',
    '  float d = fract(uPhase - vT);',               // distância atrás da "cabeça"
    '  float trail = pow(1.0 - d, 2.6);',
    '  float a = uBase + (1.0 - uBase) * trail;',
    '  gl_FragColor = vec4(uColor * a, a);',         // alfa pré-multiplicado
    '}'
  ].join('\n');

  function ringGeometry(radius, tube, seg, sides) {
    var pos = [], t = [], idx = [];
    for (var i = 0; i <= seg; i++) {
      var th = i / seg * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      for (var j = 0; j < sides; j++) {
        var ph = j / sides * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        pos.push(c * (radius + tube * cp), tube * sp, s * (radius + tube * cp));
        t.push(i / seg);
      }
    }
    for (i = 0; i < seg; i++) for (j = 0; j < sides; j++) {
      var a = i * sides + j, b = i * sides + (j + 1) % sides, c2 = a + sides, d2 = b + sides;
      idx.push(a, c2, b, b, c2, d2);
    }
    return { pos: new Float32Array(pos), t: new Float32Array(t), idx: new Uint16Array(idx) };
  }

  function hexToLin(hex) {
    var n = parseInt(String(hex || '#123047').replace('#', ''), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  /* ----------------------------- montagem ----------------------------- */
  function mount(container, options) {
    options = options || {};
    var canvas = document.createElement('canvas');
    canvas.className = 'tooth-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    canvas.tabIndex = -1;

    var ctxOpts = { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: !!options.preserveDrawingBuffer, powerPreference: 'low-power' };
    var gl = canvas.getContext('webgl', ctxOpts) || canvas.getContext('experimental-webgl', ctxOpts);
    if (!gl) return Promise.reject(new Error('WebGL indisponível.'));
    var uintExt = gl.getExtension('OES_element_index_uint');

    var source = options.buffer ? Promise.resolve(options.buffer)
      : fetch(options.src, { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('Modelo não encontrado (' + r.status + ').'); return r.arrayBuffer(); });
    return source
      .then(function (buf) {
        var geo = parseGLB(buf, options);
        if (!uintExt && geo.pos.length / 3 > 65535) throw new Error('Modelo grande demais para este dispositivo.');
        return start(geo);
      });

    function start(geo) {
      function program(vs, fs) {
        var pr = gl.createProgram();
        gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, vs));
        gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        return pr;
      }
      function buffer(data, target) {
        var b = gl.createBuffer();
        gl.bindBuffer(target || gl.ARRAY_BUFFER, b);
        gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return b;
      }
      function bindAttr(pr, name, buf, size) {
        var loc = gl.getAttribLocation(pr, name);
        if (loc < 0) return -1;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        return loc;
      }
      var enabled = [];
      function useAttrs(list) {
        // desliga apenas atributos que o novo programa não usa
        list = list.filter(function (l) { return l >= 0; });
        enabled.forEach(function (l) { if (list.indexOf(l) === -1) gl.disableVertexAttribArray(l); });
        enabled = list;
      }

      // dente
      var prog = program(VERT, FRAG);
      var bPos = buffer(geo.pos), bNor = buffer(geo.nor), bCol = buffer(geo.col);
      var useUint = geo.pos.length / 3 > 65535;
      var ib = buffer(useUint ? geo.idx : new Uint16Array(geo.idx), gl.ELEMENT_ARRAY_BUFFER);
      var idxType = useUint ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, idxCount = geo.idx.length;
      var uModel = gl.getUniformLocation(prog, 'uModel');
      var uViewProj = gl.getUniformLocation(prog, 'uViewProj');
      var uNormal = gl.getUniformLocation(prog, 'uNormal');
      var uCam = gl.getUniformLocation(prog, 'uCam');

      // órbita
      var orbit = options.orbit || {};
      var hasOrbit = orbit.enabled !== false;
      if (hasOrbit) {
        var ringProg = program(RING_VERT, RING_FRAG);
        var ring = ringGeometry(orbit.radius || 1.18, orbit.thickness || 0.0075, 320, 6);
        var rPos = buffer(ring.pos), rT = buffer(ring.t);
        var rIb = buffer(ring.idx, gl.ELEMENT_ARRAY_BUFFER);
        var rU = {
          model: gl.getUniformLocation(ringProg, 'uModel'), viewProj: gl.getUniformLocation(ringProg, 'uViewProj'),
          phase: gl.getUniformLocation(ringProg, 'uPhase'), color: gl.getUniformLocation(ringProg, 'uColor'),
          base: gl.getUniformLocation(ringProg, 'uBase')
        };
        var ringColor = hexToLin(orbit.color);
        var ringTilt = M.mul(M.rotZ((orbit.tilt != null ? orbit.tilt : -12) * Math.PI / 180), M.rotX((orbit.angle != null ? orbit.angle : 20) * Math.PI / 180));
      }

      gl.enable(gl.DEPTH_TEST);
      if (options.cullFaces !== false) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);

      var maxDpr = options.maxPixelRatio || 1.75;
      var camZ = 5.9, fov = 30 * Math.PI / 180;
      var orient = (options.rotation || [0, 0, 0]).map(function (d) { return d * Math.PI / 180; });
      var orientM = M.mul(M.rotZ(orient[2]), M.mul(M.rotY(orient[1]), M.rotX(orient[0])));
      var modelScale = options.scale || 1;
      var viewProj;

      function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
        var w = Math.max(1, Math.round(container.clientWidth * dpr));
        var h = Math.max(1, Math.round(container.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        viewProj = M.mul(M.perspective(fov, w / h, 0.1, 50), M.translate(0, 0, -camZ));
      }

      // estado da animação
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
      var target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
      var running = false, visible = true, raf = 0, t0 = performance.now(), tPaused = 0, pausedAt = 0;

      var amp = options.floatAmplitude != null ? options.floatAmplitude : 0.12;

      function draw(t) {
        cur.x += (target.x - cur.x) * 0.05; cur.y += (target.y - cur.y) * 0.05;
        var still = reduce.matches;
        var floatY = still ? 0 : Math.sin(t * 1.0) * amp;   // sobe e desce (ciclo de ~6 s)
        var ry = -0.62 + (still ? 0 : Math.sin(t * 0.38) * 0.26) + cur.x * 0.24;
        var rx = 0.30 + (still ? 0 : Math.sin(t * 0.29 + 1.2) * 0.05) + cur.y * 0.12;
        var rz = (still ? 0 : Math.sin(t * 0.47) * 0.035) - 0.06;
        var lift = M.translate(0, floatY, 0);
        var model = M.mul(lift,
          M.mul(M.rotZ(rz), M.mul(M.rotX(rx), M.mul(M.rotY(ry), M.mul(orientM, [modelScale,0,0,0, 0,modelScale,0,0, 0,0,modelScale,0, 0,0,0,1])))));
        var vp = new Float32Array(viewProj);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // dente (opaco)
        gl.useProgram(prog);
        useAttrs([bindAttr(prog, 'aPos', bPos, 3), bindAttr(prog, 'aNor', bNor, 3), bindAttr(prog, 'aCol', bCol, 4)]);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.uniformMatrix4fv(uModel, false, new Float32Array(model));
        gl.uniformMatrix4fv(uViewProj, false, vp);
        gl.uniformMatrix3fv(uNormal, false, new Float32Array(M.normal3(model)));
        gl.uniform3f(uCam, 0, 0, camZ);
        gl.disable(gl.BLEND); gl.depthMask(true);
        gl.drawElements(gl.TRIANGLES, idxCount, idxType, 0);

        // órbita (acompanha a flutuação; passa por trás do dente)
        if (hasOrbit) {
          gl.useProgram(ringProg);
          useAttrs([bindAttr(ringProg, 'aPos', rPos, 3), bindAttr(ringProg, 'aT', rT, 1)]);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, rIb);
          var wobble = still ? 0 : Math.sin(t * 0.6) * 0.04;
          gl.uniformMatrix4fv(rU.model, false, new Float32Array(M.mul(lift, M.mul(M.rotX(wobble), ringTilt))));
          gl.uniformMatrix4fv(rU.viewProj, false, vp);
          gl.uniform1f(rU.phase, still ? 0.62 : (t * (orbit.speed || 0.14)) % 1);
          gl.uniform3f(rU.color, ringColor[0], ringColor[1], ringColor[2]);
          gl.uniform1f(rU.base, orbit.baseOpacity != null ? orbit.baseOpacity : 0.18);
          gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.depthMask(false);
          gl.drawElements(gl.TRIANGLES, ring.idx.length, gl.UNSIGNED_SHORT, 0);
          gl.depthMask(true); gl.disable(gl.BLEND);
          if (options.cullFaces !== false) gl.enable(gl.CULL_FACE);
        }
      }

      function frame(now) {
        if (!running) return;
        draw((now - t0 - tPaused) / 1000);
        raf = requestAnimationFrame(frame);
      }
      function play() {
        if (running || reduce.matches || !visible || document.hidden) return;
        running = true;
        if (pausedAt) { tPaused += performance.now() - pausedAt; pausedAt = 0; }
        raf = requestAnimationFrame(frame);
      }
      function pause() {
        if (!running) return;
        running = false; cancelAnimationFrame(raf); pausedAt = performance.now();
      }
      function renderStill() { resize(); cur.x = target.x = 0; cur.y = target.y = 0; draw(0); }

      var ro = new ResizeObserver(function () { resize(); if (!running) draw(0); });
      ro.observe(container);
      var io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        visible ? play() : pause();
      }, { threshold: 0.01 });
      io.observe(container);
      document.addEventListener('visibilitychange', function () { document.hidden ? pause() : play(); });

      var onReduce = function () { if (reduce.matches) { pause(); renderStill(); } else play(); };
      reduce.addEventListener ? reduce.addEventListener('change', onReduce) : reduce.addListener(onReduce);

      window.addEventListener('pointermove', function (e) {
        if (!finePointer.matches || reduce.matches) return;
        var r = container.getBoundingClientRect();
        var nx = ((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2));
        var ny = ((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2));
        target.x = Math.max(-1, Math.min(1, nx));
        target.y = Math.max(-1, Math.min(1, ny));
      }, { passive: true });

      canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault(); pause();
        container.classList.remove('is-3d-ready');
        if (options.onError) options.onError(new Error('Contexto WebGL perdido.'));
      });

      container.appendChild(canvas);
      resize();
      draw(0);
      // revela o canvas só depois do primeiro quadro desenhado
      requestAnimationFrame(function () {
        container.classList.add('is-3d-ready');
        play();
      });
      return { play: play, pause: pause, renderStill: renderStill, canvas: canvas };
    }
  }

  window.ToothRenderer = { mount: mount, parseGLB: parseGLB };
})();
