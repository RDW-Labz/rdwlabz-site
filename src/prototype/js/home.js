// Home: clay computer in a dark room, scroll dive into its CRT; the world inside the screen lives in js/world.
import * as THREE from 'three';
import { smoothJump } from './jump.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import * as TX from './tex.js';
import { buildComputer, ScreenOS, makeClay, woodMaps, boxUV, DIM, bakeComputerLight, RIM } from './computer.js';
import * as FX from './fx.js';
import { makeSound } from './sound.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { PROJECTS } from './data.js';
import { createWorld, S0 as W_S0, EXIT as W_EXIT } from './world/index.js';
import { privateArt } from './world/art.js';   // SCREEN WORLD

const V3 = THREE.Vector3;
const SRGB = THREE.SRGBColorSpace;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

class Spring {
  constructor(x = 0, k = 120, c = 14) { this.x = x; this.v = 0; this.t = x; this.k = k; this.c = c; }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = -this.k * (this.x - this.t) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    return this.x;
  }
}

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const GLSL_LIB = `
vec2 barrel(vec2 uv, float k){ vec2 c = uv - .5; float r2 = dot(c,c); c *= 1. + r2*(k + k*sqrt(r2)); c *= 1. - k*.3655; return c + .5; }
float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
float hash12(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
`;

// CSS matrix3d that maps the rect (0,0)-(w,h) onto quad q = [tl, tr, br, bl] (screen px)
function quadMatrix(w, h, q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const det = dx1 * dy2 - dx2 * dy1 || 1e-6;
  const g = (sx * dy2 - dx2 * sy) / det, k = (dx1 * sy - sx * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3, f = y0;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1];
  return 'matrix3d(' + m.map((v) => +v.toFixed(8)).join(',') + ')';
}

// --------------------------------------------------------------------------------------------
export async function startHome({ canvas, reduced, lenis }) {
  // quality: 2 = AO + DOF + SMAA at DPR<=2, 1 = SMAA at DPR<=1.5, 0 = none at DPR 1. ?quality=high|mid|low pins it.
  const QS = { high: 2, mid: 1, low: 0 }[new URLSearchParams(location.search).get('quality')];
  const isPhone = matchMedia('(hover: none)').matches || window.innerWidth < 800;
  const autoPhone = isPhone && QS === undefined;   // untouched query: the auto quality scaler is in charge
  const mobileTex = isPhone && QS !== 2;   // phones on the auto scaler use the 512 px pre-baked set
  const bakedTex = TX.preloadBaked(mobileTex ? 7000 : 12000, mobileTex);   /* [startup] pre-baked maps download + decode off the main thread, in parallel with fonts */
  try {
    await Promise.race([
      Promise.all(['italic 120px "Instrument Serif"', '120px "Instrument Serif"', '40px VT323', '500 20px "JetBrains Mono"', '30px "Instrument Sans"', '600 30px "Instrument Sans"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 1800)),
    ]);
  } catch (e) { /* fonts optional */ }
  await bakedTex;

  const site = document.getElementById('site');
  const heroUI = document.getElementById('heroUI'); heroUI.style.transition = 'none'; heroUI.style.willChange = 'opacity, transform';   // scroll drives it directly; a CSS transition here made it lag behind the camera
  const contactEl = document.getElementById('contact');
  const dlgWrap = document.getElementById('dlgWrap');

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  /* [startup] software GL (SwiftShader / llvmpipe, e.g. a GPU-blocklisted browser): start at the lightest preset */
  const softGL = (() => { try { const g = renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return /swiftshader|llvmpipe|software|basic render/i.test(String(g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER))); } catch (er) { return false; } })();
  const lite = softGL && QS === undefined;
  /* A software-rendered phone gets the approved static workbench instead of a 3 fps 3D page.
     Hardware WebGL (the real phone) keeps the prototype. ?quality=high still forces the 3D scene. */
  if (softGL && autoPhone) throw new Error('software WebGL on a phone: static page');
  let liteLast = 0, liteShadow = 0, liteSY = 0, liteRaster = false; if (lite) renderer.shadowMap.autoUpdate = false;
  TX.setLite(lite);
  const Q = { level: QS ?? (softGL ? 0 : isPhone ? 0 : 2), locked: QS !== undefined };
  const dprFor = (l) => (lite ? 0.45 : autoPhone && l === 0 ? Math.min(window.devicePixelRatio || 1, 0.85) : Math.min(window.devicePixelRatio || 1, [1, 1.5, 2][l]));   /* lite: software GL 45 %; auto phone 85 % */
  let DPR = dprFor(Q.level);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = SRGB;
  renderer.shadowMap.enabled = !autoPhone;   // auto-scaled phones: no shadow pass (the static desk props read fine without it)
  renderer.shadowMap.type = THREE.PCFShadowMap;   // crisp, small-source shadows
  let W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, false);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // ============================== ROOM ==============================
  const room = new THREE.Scene();
  room.background = new THREE.Color('#15121b');
  room.fog = new THREE.FogExp2(0x1d1925, 0.06);   // lavender-grey haze, not muddy brown
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 100);

  // Custom room environment for PMREM: dim walls, the lit screen as a big emissive panel, a warm lamp, a soft ceiling bounce.
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene(); env.background = new THREE.Color('#0a0708');
    const walls = new THREE.Mesh(new THREE.BoxGeometry(24, 10, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#252322').multiplyScalar(0.6), side: THREE.BackSide }));
    walls.position.y = 3; env.add(walls);
    const floorE = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#1c120c') })); floorE.rotation.x = -Math.PI / 2; floorE.position.y = -1.9; env.add(floorE);
    const panel = (geo, color, k, pos, look) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.copy(pos); m.lookAt(look || new V3()); env.add(m); return m;
    };
    panel(new THREE.PlaneGeometry(2.6, 2), '#ffd2a8', 2.2, new V3(3.4, 1.6, -3.2));        // the screen, up-and-behind the keys
    panel(new THREE.SphereGeometry(0.5, 16, 12), '#ffc888', 9, new V3(-5, 3.4, 1.5));       // warm lamp practical
    panel(new THREE.CircleGeometry(4, 32), '#f0e6dc', 0.45, new V3(-2, 7.8, 3), new V3(-2, 0, 3)); // soft ceiling bounce
    panel(new THREE.PlaneGeometry(1.2, 6), '#9fb0ff', 0.8, new V3(9, 2, -3));                // cool bounce strip (window light)
    panel(new THREE.PlaneGeometry(6, 3), '#6a3e22', 0.5, new V3(-6, 1, -8));                 // warm wall wash
    { // dim four-pane window softbox up-left behind the viewer: it shows in the screen glass and moves with parallax
      const wm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfd8ff').multiplyScalar(1.6), side: THREE.DoubleSide });
      [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]].forEach(([dx, dy]) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wm); q.position.set(-3.6 + dx, 4.2 + dy, 6.5); q.lookAt(0, 1, 0); env.add(q); }); }
    /* [computer-render] two-pass PMREM: re-filtering the first result smooths the lobe banding that streaked the rounded hood */
    /* [startup] the filtered environment is pre-baked (tex/env_rgb.png + env_m.png, RGBM); PMREM only runs as a fallback or in bake mode */
    const envA = TX.bakedImage('env_rgb'), envB = TX.bakedImage('env_m');
    if (envA && envB && !TX.bakeMode) room.environment = await TX.decodeEnv(envA, envB);
    else { const e1 = pmrem.fromScene(env, 0.04); const s2 = new THREE.Scene(); s2.background = e1.texture; s2.backgroundBlurriness = 0.12; const e2 = pmrem.fromScene(s2, 0.04); room.environment = e2.texture; if (TX.bakeMode) TX.exportEnv(renderer, e2, 'env'); }
    pmrem.dispose();
  }

  // Wall + floor with painted grunge (dirt x7 + grime) and a dark pool; the haze comes from smoke + bloom.
  const wallTex = new THREE.CanvasTexture(TX.grungeWall(1536, 768, 3, '#2b2632')); wallTex.colorSpace = SRGB; wallTex.anisotropy = maxAniso;
  const WD = woodMaps(maxAniso);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.96, metalness: 0, envMapIntensity: 0.25 }));
  wall.position.set(0, -1, -6); wall.receiveShadow = true; room.add(wall);
  const wallBase = (() => { const c = TX.makeCanvas(4, 128), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(42,36,48,0)'); g.addColorStop(1, 'rgba(42,36,48,1)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; return new THREE.Mesh(new THREE.PlaneGeometry(34, 1.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false })); })();
  wallBase.position.set(0, 0, -5.97); room.add(wallBase);
  const floorAlpha = (() => { const c = TX.makeCanvas(4, 256), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#000'); g.addColorStop(2.0 / 22, '#000'); g.addColorStop(6.0 / 22, '#fff'); g.addColorStop(1, '#fff'); x.fillStyle = g; x.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c); })();
  const DESK_FRONT = 2.8;   // local z of the desk's front edge, a hand-width in front of the keyboard
  // a real desk: 1.6 x 0.8 m slab (1 unit ~ 13 cm) with a rounded 3 cm front edge; the floor sits 0.75 m below in the fog
  const deskGeo = boxUV(new RoundedBoxGeometry(12.5, 0.46, 6.25, 8, 0.2).translate(0, -0.23, 0), 1 / 3.2);
  const floor = new THREE.Mesh(deskGeo, new THREE.MeshPhysicalMaterial({ map: WD.map, roughnessMap: WD.rough, normalMap: WD.normal, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 1, metalness: 0, envMapIntensity: 0.12, clearcoat: 0.5, clearcoatRoughness: 0.28 }));   // varnished: the rounded front edge catches a highlight line
  floor.receiveShadow = true;   // parented to the computer below, aligned with it
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: '#0d0a0b', roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; room.add(ground);

  // ---------- clay + the computer (built in computer.js) ----------
  const clay = makeClay(maxAniso);
  const clayMat = clay.make('#D9A574');
  const images = await Promise.all(PROJECTS.map((p) => (p.img ? TX.loadImage(p.img) : Promise.resolve(privateArt(p)))));   // private builds now show their real sign-in page; the placeholder is only for a build with no image yet
  const C = buildComputer({ maxAniso, clay });
  /* [computer-render] one-time GPU AO + desk-bounce bake into vertex colours (behind the boot screen) */
  try { C.bake = isPhone && QS === undefined ? { how: 'skipped-phone' } : bakeComputerLight(renderer, C, { dirs: Q.level === 0 ? 24 : 64 }); } catch (e) { C.bake = { error: String(e) }; }
  const pc = C.pc; room.add(pc);
  floor.position.set(-1.0, 0, DESK_FRONT - 3.125); pc.add(floor);
  { const c = TX.makeCanvas(4, 64), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,226,192,0)'); g.addColorStop(0.6, 'rgba(255,226,192,1)'); g.addColorStop(1, 'rgba(255,226,192,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 64);
    const lc = TX.makeCanvas(256, 4), lx = lc.getContext('2d'); const lg = lx.createLinearGradient(0, 0, 256, 0); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.3, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, '#fff'); lg.addColorStop(1, '#fff'); lx.fillStyle = lg; lx.fillRect(0, 0, 256, 4);
    const hm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { tC: { value: new THREE.CanvasTexture(c) }, tL: { value: new THREE.CanvasTexture(lc) } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D tC, tL; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - clamp(dot(vN, vV), 0., 1.), 2.);   // grazing sheen on the bevel
        float a = texture2D(tC, vec2(.5, vUv.y)).a * texture2D(tL, vec2(vUv.x, .5)).a * (.35 + .65 * f) * .056; gl_FragColor = vec4(vec3(1., .89, .76) * a, 1.); }` });
    const hi = new THREE.Mesh(new THREE.PlaneGeometry(12.1, 0.12), hm); hi.rotation.x = -Math.PI / 4; hi.position.set(-1.0, -0.06, DESK_FRONT - 0.06); pc.add(hi); }   // varnish highlight running along the rounded front edge
  let figRef = null;
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const { MY, OPEN_W, OPEN_H, PLANE_W, PLANE_H, BEZ_W, BEZ_H } = DIM;
  // hero screen: bright project slideshow + status line + typed terminal
  const os = new ScreenOS(images, PROJECTS, reduced);
  // contact screen: NEW_PROJECT.TXT dialog drawn into the glass
  const deskCanvas = TX.makeCanvas(2048, 1504); const deskTex = new THREE.CanvasTexture(deskCanvas); deskTex.colorSpace = SRGB; deskTex.anisotropy = maxAniso;
  const screenMat = new THREE.ShaderMaterial({
    uniforms: {
      tInside: { value: null }, tBoot: { value: os.tex }, uMix: { value: 0 }, uTime: { value: 0 }, uK: { value: 0 }, uScanP: { value: 2 }, uConv: { value: 0.002 }, uGrille: { value: 0 },
      uCrop: { value: new THREE.Vector2(1, 1) }, uBright: { value: 1.9 }, uScan: { value: 1 }, uLines: { value: 300 },
      uHover: { value: 0 }, uFlick: { value: 0 }, uSpec: { value: 1 },
      uPow: { value: 0 }, uRoll: { value: 0 }, uPar: { value: new THREE.Vector2() }, uLampK: { value: 1 }, tPrev: { value: os.prevTex }, uPrevK: { value: 0 }, uBase: { value: new THREE.Color() },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: GLSL_LIB + `
      varying vec3 vN; varying vec3 vV; uniform vec2 uPar; uniform float uLampK;
      uniform sampler2D tInside, tBoot, tPrev; uniform float uScanP, uConv, uGrille; uniform float uMix, uTime, uK, uBright, uScan, uLines, uHover, uFlick, uSpec, uPow, uRoll, uPrevK; uniform vec3 uBase; uniform vec2 uCrop; varying vec2 vUv;
      void main(){
        vec2 uv = barrel(vUv, uK);
        // slide change: 2-frame vertical roll + tear
        float blank = 1.; if (uRoll > 0.) { float yr = uv.y + uRoll * .38; blank = smoothstep(.0, .05, abs(fract(yr) - .0)) * smoothstep(.0, .05, abs(1. - fract(yr))); uv.y = fract(yr); uv.x += (step(.5, fract(uv.y * 9. + uTime * 37.)) - .5) * uRoll * .05; }   // vertical-blanking bar at the wrap
        // degauss wobble right after power-on
        if (uPow > .45 && uPow < .55) uv.x += sin(uv.y * 34. + uTime * 70.) * .014 * (1. - (uPow - .45) / .1);
        float d = sdRR(uv - .5, vec2(.5), .07);
        float mask = 1. - smoothstep(-.006, .004, d);
        vec2 iuv = .5 + (uv - .5) * uCrop;
        float ca = uConv * length(uv - .5) * 2.;   // ~0.5 px convergence error at the edges
        vec3 inside = vec3(texture2D(tInside, iuv + vec2(ca, 0.)).r, texture2D(tInside, iuv).g, texture2D(tInside, iuv - vec2(ca, 0.)).b);
        vec3 boot = vec3(texture2D(tBoot, uv + vec2(ca,0.), -.5).r, texture2D(tBoot, uv, -.5).g, texture2D(tBoot, uv - vec2(ca,0.), -.5).b);
        { vec2 o = vec2(1. / 1024., 1. / 768.); vec3 bl = (texture2D(tBoot, uv + vec2(o.x, 0.), -.5).rgb + texture2D(tBoot, uv - vec2(o.x, 0.), -.5).rgb + texture2D(tBoot, uv + vec2(0., o.y), -.5).rgb + texture2D(tBoot, uv - vec2(0., o.y), -.5).rgb) * .25;
          boot = max(boot + .3 * (boot - bl), 0.); }   // unsharp 0.3
        vec3 col = mix(boot, inside, uMix);
        col += texture2D(tPrev, uv).rgb * uPrevK * (1. - uMix);   // phosphor afterglow
        float lumF = dot(col, vec3(.3, .55, .15));
        col = mix(col, max(col, uBase), smoothstep(.25, .0, lumF) * (1. - uMix));   // phosphor floor only in the deep shadows
        float lum0 = dot(mix(boot, inside, uMix), vec3(.3, .55, .15));
        float scan = mix(1., 1. - .13 * (.5 + .5 * sin(gl_FragCoord.y * 6.2832 / uScanP)) * (1. - smoothstep(.5, 1., lum0)), uScan);   // 2 px @1440, fades on bright
        float tri = mod(floor(gl_FragCoord.x), 3.); vec3 grille = tri < 1. ? vec3(1.04, .98, .98) : (tri < 2. ? vec3(.98, 1.04, .98) : vec3(.98, .98, 1.04));
        float roll = mix(1., .97 + .03 * sin(uv.y * 6. - uTime * 2.4), uScan);
        col *= scan * roll;
        float vig = smoothstep(1.0, .3, length((uv - .5) * vec2(1., 1.15)));
        col *= mix(vec3(1.), grille, uScan * uGrille); col *= mix(1., .7 + .3 * vig, uScan);   // aperture grille 4%, corner vignette 30%
        col *= uBright * (1. + .08 * uHover) * (1. + uFlick * (hash12(vec2(floor(uTime * 60.), 3.)) - .35) * .9);
        col *= .92; { vec3 o = max(col - .8, 0.); col = min(col, vec3(.8)) + o / (1. + o * 2.5); }   // soft shoulder above .8 only; midtones untouched
        // CRT power-on: black -> bright horizontal line -> collapse to a dot -> expand
        if (uPow < .6) {
          vec2 c = vUv - .5; float bx = 0., by = 0., wht = 0., br = 1.;
          if (uPow < .08) { bx = 0.; by = 0.; }
          else if (uPow < .17) { float k = (uPow - .08) / .09; bx = .5 * k; by = .005; wht = 1.; }
          else if (uPow < .24) { float k = (uPow - .17) / .07; bx = mix(.5, .012, k); by = mix(.005, .012, k); wht = 1.; }
          else if (uPow < .45) { float k = smoothstep(.24, .45, uPow); bx = mix(.012, .5, k); by = mix(.012, .5, k); br = mix(2.4, 1., k); }
          else { bx = .5; by = .5; }
          float box = (1. - smoothstep(bx - .003, bx + .003, abs(c.x))) * (1. - smoothstep(by - .003, by + .003, abs(c.y)));
          col = mix(col * br, vec3(1., .97, .92) * 2.4, wht) * box;
        }
        col *= mask * blank;
        col += vec3(.012, .008, .006) * (1. - mask);
        // curved glass: soft diagonal specular streak + top-left sheen
        float streak = smoothstep(.06, .0, abs(vUv.x * .62 + vUv.y * .78 - 1.08)) * .10 + smoothstep(.5, .0, length(vUv - vec2(.18, .86))) * .06;
        // glass reflection (visible only as reflection): Fresnel, soft room, lamp hotspot, fingerprint smudge
        float ndv = clamp(dot(normalize(vN), normalize(vV)), 0., 1.);
        float fres = mix(.04, .15, pow(1. - ndv, 2.)) * uSpec;
        vec3 env = mix(vec3(.10, .09, .13), vec3(.32, .29, .36), vUv.y);
        vec2 lp = vec2(.035, .62) + uPar * vec2(.05, .035);
        float hot = exp(-dot((vUv - lp) * vec2(9., 6.), (vUv - lp) * vec2(9., 6.))) * 6. * uLampK;
        float fr = length((vUv - vec2(.2, .2)) * vec2(1., 1.3));
        float smudge = smoothstep(.13, .02, fr) * (.55 + .45 * sin(fr * 190.));
        col += env * smudge * 1.4 * fres;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const screen = new THREE.Mesh(C.glassGeo, screenMat);
  screen.position.set(0, DIM.SCREEN_Y, DIM.SCREEN_Z); pc.add(screen);
  // physical glass over the emissive face: clearcoat 1, rough .05, ior 1.5, additive so only its reflections show
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.05, metalness: 0, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.75, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const glassOver = new THREE.Mesh(C.glassGeo, glassMat); glassOver.position.set(0, DIM.SCREEN_Y, DIM.SCREEN_Z + 0.003); glassOver.renderOrder = 3; pc.add(glassOver);
  screen.layers.enable(1); C.led.layers.enable(1); C.fled.layers.enable(1);
  const deskRefl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2,
    uniforms: { uCol: { value: new THREE.Color() }, tRough: { value: WD.rough } },
    vertexShader: `varying vec2 vL; varying vec3 vW; void main(){ vL = position.xz; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uCol; uniform sampler2D tRough; varying vec2 vL; varying vec3 vW;
      void main(){ float zf = vL.y + 1.1; float a = exp(-zf * zf * 1.1) * exp(-pow(abs(vL.x) / 1.05, 4.));
        float r = texture2D(tRough, vec2(vW.x, -vW.z) / 3.2).r; a *= clamp(1.35 - r * 1.3, 0., 1.);   // smears less where the varnish is rough
        gl_FragColor = vec4(uCol * a * .44, 1.); }` }));
  deskRefl.position.set(0, 0.004, 0.47 + 1.1); deskRefl.renderOrder = 1; pc.add(deskRefl);
  const halo = FX.makeHalo(DIM); pc.add(halo);
  const lightFog = FX.makeLightFog(DIM); pc.add(lightFog.cone); pc.add(lightFog.pool);
  const dust = FX.makeDust(DIM, 100); pc.add(dust);
  const sound = makeSound({ reduced, mobile: matchMedia('(hover: none)').matches || window.innerWidth < 800 });
  let camOv = null, sndCut = -10, sndHover = false, prevMode = 'room', landT = -9, rackT = -1e9, flashT = -1e9, frameNo = 0, prevH = 0, ledBlinkT = -9, floppyUntil = -9, hoverKey = null, capsOn = false; let powerStart = performance.now() / 1000 + 0.35, powerFreeze = null, rollFreeze = null, blurForce = null, lastKeyT = -9;

  // little clay Lumpy figurine: orange teardrop, smile, eyes, blush
  {
    const lm = clay.make('#EF8A5C', { emissive: new THREE.Color('#EF8A5C'), emissiveIntensity: 0.12, clearcoat: 0.3 });
    const prof = [[0, 0], [0.15, 0], [0.175, 0.02], [0.185, 0.07], [0.18, 0.13], [0.16, 0.2], [0.13, 0.27], [0.095, 0.33], [0.06, 0.38], [0.028, 0.42], [0, 0.44]];
    const g = new THREE.LatheGeometry(prof.map((q) => new THREE.Vector2(q[0], q[1])), 40);
    { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) - 0.07 * Math.pow(y / 0.44, 3)); } g.computeVertexNormals(); }
    const fig = new THREE.Group();
    fig.add(shadowy(new THREE.Mesh(g, lm)));
    const ink = new THREE.MeshStandardMaterial({ color: '#241c18', roughness: 0.35 });
    [-0.055, 0.055].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), ink); e.position.set(x, 0.205, 0.158); e.scale.set(1, 1.15, 0.6); fig.add(e); });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 8, 20, Math.PI), ink); smile.position.set(0, 0.168, 0.168); smile.rotation.set(0.2, 0, Math.PI); fig.add(smile);
    const blush = new THREE.MeshBasicMaterial({ color: '#E2533B', transparent: true, opacity: 0.45, depthWrite: false });
    [-0.105, 0.105].forEach((x) => { const b = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), blush); b.position.set(x, 0.17, 0.152); b.rotation.y = x * 4.5; fig.add(b); });
    fig.position.set(-1.15, 0, 1.98); fig.rotation.y = 0.1; fig.scale.setScalar(0.8); pc.add(fig); figRef = fig;
    const sc = TX.makeCanvas(64, 64), sx = sc.getContext('2d'); const sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32); sg.addColorStop(0, 'rgba(0,0,0,.6)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
    const fsh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    fsh.rotation.x = -Math.PI / 2; fsh.position.y = 0.004; fig.add(fsh);
  }

  // ---------- clay desk props in the fog: mug of pencils, floppy stack, desk lamp ----------
  let poolRef = null, coneRef = null, calRef = null, headRef = null, calSpot = null;
  let lampRef = null, mugRef = null, disksRef = null, lampGlint = null, steam = null;
  const lampLight = new THREE.SpotLight('#ffa757', 4.2, 7, 0.5, 0.4, 2);   // ~2700 K
  {
    const tint = (c, b = 0.8) => { const m = clayMat.clone(); m.color.set(c); m.bumpScale = b; return m; };
    // mug with pencils
    const mug = new THREE.Group();
    const mprof = [[0, 0], [0.12, 0], [0.13, 0.02], [0.13, 0.24], [0.115, 0.25], [0.11, 0.03], [0, 0.03]];
    mug.add(shadowy(new THREE.Mesh(new THREE.LatheGeometry(mprof.map((q) => new THREE.Vector2(q[0], q[1])), 28), tint('#7FA88E'))));
    const handle = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 18, Math.PI * 1.3), tint('#7FA88E')));
    handle.position.set(0.14, 0.13, 0); handle.rotation.z = -Math.PI * 0.65; mug.add(handle);
    [['#F2C94C', -0.03, 0.02, 0.12], ['#C2412E', 0.04, -0.02, -0.1], ['#5B7FD6', 0.0, 0.04, 0.05]].forEach(([c, x, z, tilt]) => {
      const pg = new THREE.Group();
      const body = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), tint(c, 0.4))); body.position.y = 0.17; pg.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 8), tint('#E9C89E', 0.3)); tip.position.y = 0.36; pg.add(tip);
      pg.position.set(x, 0.03, z); pg.rotation.set(tilt * 0.6, 0, tilt); mug.add(pg);
    });
    mug.position.set(1.62, 0, 0.42); pc.add(mug);
    { const mf = new THREE.PointLight('#ffd6b0', 0.3, 0.9, 1.5); mf.position.set(-0.25, 0.45, 0.35); mug.add(mf); }   // small fill so the mug reads on dark slides
    // stack of clay floppy disks
    const disks = new THREE.Group();
    ['#3B37C8', '#C2412E', '#2b2a33'].forEach((c, i) => {
      const d = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.035, 0.36, 2, 0.012), tint(c, 0.5)));
      d.position.set((i - 1) * 0.015, 0.018 + i * 0.037, (i % 2) * 0.012); d.rotation.y = (i - 1) * 0.12; disks.add(d);
      const lab = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.004, 0.13, 1, 0.002), tint('#F3E9D8', 0.2));
      lab.position.set(d.position.x, d.position.y + 0.019, d.position.z + 0.07); lab.rotation.y = d.rotation.y; disks.add(lab);
    });
    disks.position.set(-1.38, 0, 0.12); disks.rotation.y = 0.3; pc.add(disks);
    // desk lamp throwing a warm cone across the keyboard
    const lamp = new THREE.Group(); const lm = tint('#C9935F', 0.6);
    lamp.add(shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.06, 28), lm)));
    const arm1 = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.8, 10), lm)); arm1.position.set(0.12, 0.42, 0); arm1.rotation.z = -0.3; lamp.add(arm1);
    const arm2 = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 10), lm)); arm2.position.set(0.45, 0.88, 0); arm2.rotation.z = -1.25; lamp.add(arm2);
    { const jm = new THREE.MeshStandardMaterial({ color: '#3a302a', roughness: 0.35, metalness: 0.6 });
      [[0.0, 0.06], [0.2, 0.79], [0.74, 0.96]].forEach(([x, y]) => { const j = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.06, 18), jm)); j.rotation.x = Math.PI / 2; j.position.set(x, y, 0); lamp.add(j); });
      const pts = []; const A = new V3(0.03, 0.14, 0.04), B = new V3(0.21, 0.72, 0.04), ax = B.clone().sub(A), n1 = new V3(0, 0, 1), n2 = ax.clone().normalize().cross(n1);
      for (let i = 0; i <= 260; i++) { const t = i / 260, th = t * Math.PI * 2 * 15; pts.push(A.clone().addScaledVector(ax, t).addScaledVector(n1, Math.cos(th) * 0.014).addScaledVector(n2, Math.sin(th) * 0.014)); }
      lamp.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 520, 0.0028, 5, false), new THREE.MeshStandardMaterial({ color: '#8d8a84', metalness: 1, roughness: 0.35 })))); }
    const head = new THREE.Group(); head.position.set(0.74, 0.92, 0); head.rotation.z = 0.64; lamp.add(head); headRef = head;
    head.add(shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 24, 1, true), Object.assign(lm.clone(), { side: THREE.DoubleSide }))));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a8').multiplyScalar(4) })); bulb.position.y = -0.06; head.add(bulb); bulb.layers.enable(1);
    // visible light cone (additive, soft)
    const coneMat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uK; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(abs(dot(vN, vV)), 1.5); float a = smoothstep(0., .9, vY) * (.03 + .05 * rim) * uK; gl_FragColor = vec4(vec3(1., .78, .5) * a, a); }` });
    coneRef = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.9, 32, 1, true), coneMat); coneRef.position.y = -1.05; head.add(coneRef);
    lampLight.castShadow = true; lampLight.shadow.mapSize.set(1024, 1024); lampLight.shadow.bias = -0.0006; lampLight.shadow.normalBias = 0.02; lampLight.shadow.camera.near = 0.05; lampLight.shadow.camera.far = 5;
    lampLight.position.set(0, -0.05, 0); head.add(lampLight); head.add(lampLight.target); lampLight.target.position.set(0, -2, 0);
    { const pc2 = TX.makeCanvas(128, 128), px = pc2.getContext('2d'); const pg = px.createRadialGradient(64, 64, 0, 64, 64, 64); pg.addColorStop(0, 'rgba(255,200,140,1)'); pg.addColorStop(1, 'rgba(255,200,140,0)'); px.fillStyle = pg; px.fillRect(0, 0, 128, 128);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc2), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(1.42, 0.006, 0); lamp.add(pool); poolRef = pool; }
    lampRef = lamp; mugRef = mug; disksRef = disks;
    steam = FX.makeSteam(new THREE.CanvasTexture(TX.smokeTexture(128, 21))); mug.add(steam);
    // clay desk calendar (tent card) for the contact close-up
    const cal = new THREE.Group();
    const cc = TX.makeCanvas(512, 400), cx = cc.getContext('2d');
    cx.fillStyle = '#F3E9D8'; cx.fillRect(0, 0, 512, 400); cx.fillStyle = '#C2412E'; cx.fillRect(0, 0, 512, 104);
    cx.fillStyle = '#FFF6E8'; cx.font = '700 76px "JetBrains Mono"'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('OCT', 256, 56);
    cx.fillStyle = '#2b2420'; cx.font = 'italic 250px "Instrument Serif"'; cx.fillText('30', 256, 262);
    cx.font = '500 26px "JetBrains Mono"'; cx.fillStyle = '#8a6a50'; cx.fillText('RDW LABZ · 2026', 256, 372);
    const ct2 = new THREE.CanvasTexture(cc); ct2.colorSpace = SRGB; ct2.anisotropy = maxAniso; ct2.minFilter = THREE.LinearMipmapLinearFilter;
    const calMat = clayMat.clone(); calMat.color.set('#E9D8BC'); calMat.bumpScale = 0.4;
    [-1, 1].forEach((sg) => { const pnl = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.34, 0.03, 2, 0.012), calMat)); pnl.position.set(0, 0.16, sg * 0.055); pnl.rotation.x = sg * 0.32; cal.add(pnl); });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), new THREE.MeshStandardMaterial({ map: ct2, roughness: 0.9 })); face.position.set(0, 0.16, 0.078); face.rotation.x = 0.32; cal.add(face);
    cal.position.set(-1.78, 0, 1.02); cal.rotation.y = 0.7; cal.visible = false; pc.add(cal); calRef = cal;
    // soft warm pool on the contact desk, aimed at the calendar
    calSpot = new THREE.SpotLight('#ffb070', 1.2, 0, 0.5, 0.8, 0);
    calSpot.position.set(-2.3, 1.9, 1.3); calSpot.target.position.set(-1.72, 0, 0.9); calSpot.visible = false;
    pc.add(calSpot); pc.add(calSpot.target);
    lamp.position.set(-1.9, 0, -0.55); lamp.rotation.y = -0.75; pc.add(lamp);
  }

  const props = FX.makeProps({ clay, pc, C, maxAniso, disks: disksRef });
  {
    const c = TX.makeCanvas(128, 128), x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(0.45, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const bt = new THREE.CanvasTexture(c);
    const blob = (parent, w, d, op, px = 0, pz = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: bt, transparent: true, opacity: op, depthWrite: false, color: '#000' })); m.rotation.x = -Math.PI / 2; m.position.set(px, 0.003, pz); m.renderOrder = -1; parent.add(m); return m; };
    blob(mugRef, 0.42, 0.42, 0.6); blob(disksRef, 0.62, 0.62, 0.55); blob(lampRef, 0.52, 0.52, 0.65); blob(calRef, 0.62, 0.4, 0.55); blob(props.viking, 0.24, 0.24, 0.6);
  }
  // verlet cables: monitor -> keyboard, monitor -> lamp
  const ropeTex = (() => { const c = TX.makeCanvas(64, 64), x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const ropeMat = new THREE.MeshPhysicalMaterial({ color: '#1d1918', roughness: 0.7, metalness: 0, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color('#5a524e'), envMapIntensity: 0.4 });   // 6 mm matte rubber
  const ropeKb = new FX.Rope(pc, ropeMat, 22, 0.015, ropeTex), ropeLamp = new FX.Rope(pc, ropeMat, 22, 0.015, ropeTex);
  // routes: drop behind the plinth, lie along the desk, enter the keyboard's back edge / the lamp base
  // rear drops: real tube geometry out of each strain relief with a 15 mm (0.12 u) minimum bend radius,
  // a soft S on the way down and a second 15 mm bend onto the desk; the verlet cable takes over where it lies flat
  function cableDrop(a, sd) {
    const R = 0.12, pts = [], x0 = a.x, y0 = a.y, z0 = a.z, zA = z0 - 0.04;
    for (let k = 0; k <= 4; k++) pts.push(new V3(x0, y0, z0 - 0.04 * k / 4));
    for (let k = 1; k <= 16; k++) { const t = (k / 16) * Math.PI / 2; pts.push(new V3(x0, y0 - R + R * Math.cos(t), zA - R * Math.sin(t))); }
    const R2 = 0.2, yS = y0 - R, zS = zA - R, yB = 0.015 + R2, zB = zS - 0.07;   // second bend opens wider than the 15 mm minimum
    for (let k = 1; k <= 20; k++) { const u = k / 20, e = u * u * (3 - 2 * u); pts.push(new V3(x0 + sd * 0.04 * e + sd * 0.02 * Math.sin(u * Math.PI * 2) * 0.5, yS + (yB - yS) * u, zS + (zB - zS) * e)); }
    const xB = x0 + sd * 0.04;
    for (let k = 1; k <= 16; k++) { const t = (k / 16) * Math.PI / 2; pts.push(new V3(xB + sd * (R2 - R2 * Math.cos(t)), yB - R2 * Math.sin(t), zB)); }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.015, 10, false), ropeMat); tube.castShadow = true; tube.receiveShadow = true; pc.add(tube);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ map: ropeTex, transparent: true, opacity: 0.5, depthWrite: false, color: '#000' }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(xB + sd * 0.17, 0.004, zB); pc.add(sh);
    return { end: pts[pts.length - 1].clone(), dir: new V3(sd, 0, 0), tube, sh };
  }
  const dropKb = cableDrop(C.ropeAnchors.monitorKb, 1), dropLamp = cableDrop(C.ropeAnchors.monitorLamp, -1);
  ropeKb.exit = dropKb.end.clone().addScaledVector(dropKb.dir, 0.07); ropeLamp.exit = dropLamp.end.clone().addScaledVector(dropLamp.dir, 0.07);
  ropeKb.setRoute([[0, dropKb.end], [6, new V3(1.22, 0.015, -2.38)], [19, new V3(1.25, 0.015, 0.62)], [22, new V3(1.02, 0.06, 0.82)]], 1.02);
  const lampMid = new V3(-1.05, 0.015, -2.86), lampEnd = new V3();   // continues the drop's -x heading: no kink
  const PLX = 1.06, PLZ0 = -2.12, PLZ1 = 0.47, PLY = 0.1;
  const ropeCollide = (p, r) => {
    if (Math.abs(p.x) < PLX && p.z > PLZ0 && p.z < PLZ1 && p.y < PLY + r) {
      const dx = PLX - Math.abs(p.x), dz = Math.min(p.z - PLZ0, PLZ1 - p.z), dy = PLY + r - p.y;
      if (dy < dx && dy < dz) p.y = PLY + r; else if (dx < dz) p.x = Math.sign(p.x) * (PLX + 0.001); else p.z = p.z - PLZ0 < PLZ1 - p.z ? PLZ0 : PLZ1;
    }
    if (p.y < r) p.y = r;
  };
  ropeCollide.floorAt = (p) => (Math.abs(p.x) < PLX && p.z > PLZ0 && p.z < PLZ1 ? PLY : 0);
  const ropePush = new V3();
  const ropeHide = (p) => Math.abs(p.x) < PLX && p.z > PLZ1 && p.z < PLZ1 + 0.3 && p.y < 0.16;   // never in front of the plinth

  // ---------- lights ----------
  RectAreaLightUniformsLib.init();
  const screenLight = new THREE.RectAreaLight('#ffffff', 8, DIM.PLANE_W, DIM.PLANE_H);
  screenLight.position.set(0, DIM.SCREEN_Y, 0.335); /* just proud of the bezel face: the hole walls sit behind the one-sided light, so the lip doesn't flare */
  screenLight.rotation.y = Math.PI; pc.add(screenLight);
  const scrCol = new THREE.Color('#ffb070');
  const ambient = new THREE.AmbientLight('#33312f', 0.3); room.add(ambient);
  const hemi = new THREE.HemisphereLight('#bdb8b2', '#26221f', 0.08); room.add(hemi);
  // cool lavender rim/fill on the back housing (keeps the case readable on dark slides)
  const backFill = new THREE.DirectionalLight('#b8a0ac', 3.5); room.add(backFill); room.add(backFill.target);
  // second screen light at the bottom edge of the glass, angled ~35 deg down onto the keyboard (below the lip)
  const keySpill = new THREE.SpotLight('#ffffff', 6, 3.2, 0.75, 0.8, 1.4);
  keySpill.position.set(0, DIM.SCREEN_Y - 0.56, 0.42); keySpill.target.position.set(0, 0.15, 0.95); keySpill.angle = 0.55; keySpill.penumbra = 1; keySpill.decay = 2; keySpill.distance = 2.8; pc.add(keySpill); pc.add(keySpill.target);   // aimed at the back rows: falls off toward the space bar
  const key = new THREE.SpotLight('#f4eee6', 34, 22, 0.34, 0.15, 1.3);   // small hard source: a pool on the computer, falloff on the desk
  key.position.set(-3.2, 4.2, 4.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0008; key.shadow.normalBias = 0.035; key.shadow.radius = 1; key.shadow.camera.near = 3;
  key.shadow.camera.near = 2; key.shadow.camera.far = 14;
  room.add(key); room.add(key.target);
  const rim = new THREE.DirectionalLight('#a8b8ff', 2.6); rim.position.set(6, 3, -4); room.add(rim); room.add(rim.target);
  const backRim = new THREE.PointLight('#9c88c8', 1.5, 9, 0.6); room.add(backRim);
  const glow = new THREE.PointLight('#ffb070', 1.4, 4.5, 2);   // kept as a colour carrier only: a point light in front of the physical glass paints a hot dot on it
  const pool = new THREE.SpotLight('#ff9d5c', 2.5, 12, 0.9, 0.9, 1.5); room.add(pool); room.add(pool.target); // warm wash on wall

  // ---------- volumetric fog: camera-facing fbm planes ----------
  const fogPlanes = [];
  {
    const defs = [
      // [x, y, z (computer-local, clear of all clay), w, h, opacity]
      // 'w' = world-aligned (parallel to the wall, offset from the computer), else computer-local
      [0.0, 1.5, -4.8, 26, 3.4, 0.42, 'w'],   // far bank: swallows the wall/floor horizon
      [0.0, 0.75, -3.5, 20, 1.5, 0.35, 'w'],   // near-floor band
      [0.5, 1.45, -3.1, 9, 3.2, 0.3, 'w'],   // billows behind the monitor
      [-2.55, 0.86, -1.1, 2.9, 1.7, 0.6], // masses either side of the base
      [2.55, 0.86, -0.7, 2.9, 1.7, 0.6],
      [0.3, 1.7, -3.3, 6.5, 3.6, 0.5],
      [0.8, 2.0, -2.6, 7, 3.2, 0.42, 'w'],   // lighter haze behind the hood's right shoulder     // soft lavender bank right behind the hood: the silhouette reads against light fog
      [0.0, 0.32, -2.7, 8.5, 1.1, 0.55],   // low pool hugging the desk behind the plinth
    ];
    defs.forEach(([x, y, z, w, h, op, world], i) => {
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uTime: { value: 0 }, uOp: { value: op }, uSeed: { value: i * 3.7 }, cLit: { value: new THREE.Color('#8b8199') }, cDark: { value: new THREE.Color('#2c2734') }, uKeyX: { value: -2 }, uSize: { value: new THREE.Vector2(w, h) }, uTint: { value: scrCol }, uScr: { value: new V3() } },
        vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform float uTime, uOp, uSeed, uKeyX; uniform vec2 uSize; uniform vec3 cLit, cDark, uTint, uScr; varying vec2 vUv; varying vec3 vW;
          float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
            return mix(mix(h1(i), h1(i+vec2(1.,0.)), f.x), mix(h1(i+vec2(0.,1.)), h1(i+vec2(1.,1.)), f.x), f.y); }
          float fbm2(vec2 p){ return .64*vn(p) + .36*vn(p*2.07 + 5.3); }
          void main(){
            // billows: fbm at ~1.5 cycles per plane with a domain warp
            vec2 p = vUv * uSize * .45 + uSeed + vec2(uTime * .02, uTime * .006);
            vec2 q = vec2(fbm2(p + vec2(0., uTime * .015)), fbm2(p + vec2(5.2, 1.3) - uTime * .01));
            float f = fbm2(p + 1.7 * q);
            float d = smoothstep(.36, .7, f);
            d *= .6 + .4 * fbm2(p * 2.1 + q);
            // top-lit billows: brighter where density rises upward
            float fu = fbm2(p + 1.7 * q + vec2(0., .22));
            float shade = clamp(.5 + (f - fu) * 3.2, 0., 1.);
            vec2 e = vUv - .5;
            float edge = smoothstep(.5, .3, abs(e.x)) * (e.y > 0. ? smoothstep(.5, .15, e.y) : smoothstep(.5, .4, -e.y));
            float near = smoothstep(.8, 2.4, distance(vW, cameraPosition));   // thin out within 2 units of the lens
            float lit = clamp(.45 + shade * .55 - (vW.x - uKeyX) * .03, 0., 1.);
            float sd = distance(vW, uScr);
            vec3 col = mix(cDark, cLit, lit) * .7 + uTint * (.35 * exp(-sd * sd * .12)) * (.4 + .6 * shade);
            gl_FragColor = vec4(col, clamp(d * edge * near * uOp * 1.3, 0., .7));
          }`,
      });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      pl.position.set(x, y, z); pl.renderOrder = 5; pl.userData.rel = world ? new V3(x, y, z) : null;
      if (world) room.add(pl); else pc.add(pl);
      fogPlanes.push(pl);
    });
  }
  // low drifting desk fog: wraps the plinth and crosses the keyboard's back edge (hero only)
  const lowFog = FX.makeLowFog(); pc.add(lowFog);

  // ---------- smoke: 30 soft sprites ----------
  const smokeTex = new THREE.CanvasTexture(TX.smokeTexture(256, 11)); smokeTex.colorSpace = SRGB;
  const smokes = [];
  {
    const r = TX.rng(5);
    for (let i = 0; i < 30; i++) {
      const low = i < 14;
      const m = new THREE.SpriteMaterial({ map: smokeTex, color: low ? '#cbbcd8' : '#bfb3c8', transparent: true, opacity: low ? 0.09 : 0.055, depthWrite: false, rotation: r() * TAU });
      const sp = new THREE.Sprite(m);
      const sz = low ? 3.4 + r() * 3.4 : 2 + r() * 2.2;
      sp.scale.set(sz * 1.5, sz, 1);
      sp.userData = { bx: (r() - 0.5) * 11, by: low ? r() * 0.55 : 0.4 + r() * 2.2, bz: -4.6 + r() * 2.4, spin: (r() - 0.5) * 0.4, drift: 0.04 + r() * 0.08, ph: r() * TAU };
      room.add(sp); smokes.push(sp);
    }
  }

  // ============================== SCREEN WORLD (js/world) ==============================
  // The long journey inside the CRT (project ring, beats, project pages). The bench grid is the no-WebGL fallback only.
  const world = createWorld({ renderer, reduced, lenis, images, projects: PROJECTS, home: document.getElementById('home'), getDPR: () => DPR, mobile: window.innerWidth / window.innerHeight < 0.8 });
  const trackEl = document.getElementById('track');
  site.classList.add('world');
  // ============================== /SCREEN WORLD ==============================

  // ============================== POST ==============================
  const insideRT = new THREE.WebGLRenderTarget(Math.round(W * DPR), Math.round(H * DPR), { type: THREE.HalfFloatType });
  screenMat.uniforms.tInside.value = insideRT.texture;
  // native-fov copy of the world for the full-screen hand-off: insideRT is rendered wide (L.zoom) for the glass, so cropping
  // its centre for the take-over upscaled it ~1/L.zoom (soft landing). Only rendered while the hand-off is mixing.
  const handRT = new THREE.WebGLRenderTarget(Math.round(W * DPR), Math.round(H * DPR), { type: THREE.HalfFloatType });
  /* [computer-render] MSAA x4 on the HDR chain (fine vents/legends stop crawling under parallax) */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.round(W * DPR), Math.round(H * DPR), { type: THREE.HalfFloatType, samples: Q.level >= 1 ? 4 : 0 }));
  composer.setPixelRatio(DPR); composer.setSize(W, H);
  const renderPass = new RenderPass(room, cam);
  const handoff = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tInside: { value: null }, uMix: { value: 0 }, uZoom: { value: 1 }, uC: { value: new THREE.Vector2(0.5, 0.5) } },
    vertexShader: VS,
    // the native frame is registered onto the glass: scaled by uZoom (camera distance / hand-off distance) about the
    // screen centre's projection uC, so the crossfade never ghosts while the camera is still closing in
    fragmentShader: `uniform sampler2D tInside, tDiffuse; uniform float uMix, uZoom; uniform vec2 uC; varying vec2 vUv;
      void main(){ vec4 a = texture2D(tDiffuse, vUv); if (uMix <= 0.) { gl_FragColor = a; return; }
        vec2 st = .5 + (vUv - uC) * uZoom;
        vec2 e = smoothstep(vec2(0.), vec2(.015), st) * smoothstep(vec2(1.), vec2(.985), st);
        vec4 b = texture2D(tInside, clamp(st, 0., 1.)); gl_FragColor = mix(a, b, uMix * e.x * e.y); }`,
  });
  handoff.uniforms.tInside.value = handRT.texture;
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.55, 0.6);   // inside world only
  // room bloom is selective: a black-silhouette render of the room plus only the bloom layer (screen, LEDs, bulb)
  const selRT = new THREE.WebGLRenderTarget(Math.round(W * DPR / 2), Math.round(H * DPR / 2), { type: THREE.HalfFloatType });
  const bloomSel = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.6, 0.5, 0.35);
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 }), selHidden = [];
  function renderSelective(k) {
    const bg = room.background, fg = room.fog; room.background = null; room.fog = null;
    selHidden.length = 0;
    room.traverse((o) => { if (!o.visible) return; if (o.isPoints || o.isSprite || o.isLine || (o.material && o.material.transparent && !o.layers.isEnabled(1))) { selHidden.push(o); o.visible = false; } });
    const su = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(selRT); renderer.setClearColor(0x000000, 1); renderer.clear();
    room.overrideMaterial = blackMat; renderer.render(room, cam); room.overrideMaterial = null;
    const ac = renderer.autoClear; renderer.autoClear = false; cam.layers.set(1); renderer.render(room, cam); cam.layers.set(0); renderer.autoClear = ac;
    renderer.shadowMap.autoUpdate = su;
    selHidden.forEach((o) => { o.visible = true; });
    room.background = bg; room.fog = fg;
    bloomSel.strength = k; bloomSel.render(renderer, null, selRT, 0, false); renderer.setRenderTarget(null);
  }
  const bloomMix = new ShaderPass({ uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uK: { value: 1 } }, vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse, tBloom; uniform float uK; varying vec2 vUv; void main(){ vec4 a = texture2D(tDiffuse, vUv); gl_FragColor = vec4(a.rgb + texture2D(tBloom, vUv).rgb * uK, a.a); }` });
  const output = new OutputPass();
  const finalPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.037 }, uVig: { value: 0.5 }, uCA: { value: 1 }, uSepia: { value: 0.2 },
      uPow: { value: 1.1 }, uCon: { value: 1.08 }, uS: { value: 0 }, uFlash: { value: 0 }, uFade: { value: 0 }, uLens: { value: 0 }, uBorder: { value: 0 }, uAspect: { value: W / H }, uHouse: { value: 0 },
    },
    vertexShader: VS,
    fragmentShader: GLSL_LIB + `
      uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig, uCA, uSepia, uPow, uCon, uFade, uLens, uBorder, uAspect, uS, uFlash, uHouse; varying vec2 vUv;
      void main(){
        vec2 uv = barrel(vUv, uLens);
        vec2 cc = (uv - .5) * vec2(uAspect, 1.);
        float r = length(cc);
        float edge = smoothstep(0., .005, min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y)));
        float a = .001 * 2. * r * uCA * edge;
        vec3 col = vec3(texture2D(tDiffuse, uv - vec2(0., a)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + vec2(0., a)).b);
        col = pow(max(col, 0.), vec3(uPow));
        vec3 sep = vec3(dot(col, vec3(.393,.769,.189)), dot(col, vec3(.349,.686,.168)), dot(col, vec3(.272,.534,.131)));
        col = mix(col, sep, uSepia);
        col = clamp((col - .45) * uCon + .45, 0., 8.);
        { float L = dot(clamp(col, 0., 1.), vec3(.3,.55,.15));   // house look: one split-tone across every beat inside the screen (cool lifted shadows, warm paper highlights)
          vec3 tone = vec3(L) * mix(vec3(.82,.78,1.02), vec3(1.1,1.0,.86), smoothstep(.08,.85,L)) + vec3(.03,.02,.04) * (1. - L);
          col = mix(col, tone, uHouse); }
        { vec3 c1 = clamp(col, 0., 1.); col = mix(col, c1 * c1 * (3. - 2. * c1) + max(col - 1., 0.), uS); }   // S-curve
        float vig = smoothstep(-.45, .45, .62 - length((vUv - .5) * vec2(1., 1.1)));
        col = mix(col, col * vig, uVig);
        float d = sdRR((uv - .5) * vec2(uAspect, 1.), vec2(.5 * uAspect, .5), .045);
        float m = 1. - smoothstep(-.002, .002, d);
        float inner = 1. - smoothstep(-.05, -.0, d) * .35;
        col = mix(col, col * inner * m + vec3(.03, .02, .016) * (1. - m), uBorder);
        float n = hash12(vUv * vec2(1731., 977.) + fract(uTime * 7.13)) - .5;
        col += n * uGrain * 3.2 * (1.1 - col * .7);
        col += .06 * uFlash;   // glass pass
        col = mix(col, vec3(0.), uFade);
        col = vec3(.043, .035, .051) * (1. - uFade) + col * (1. - vec3(.043, .035, .051));   // film black, not pure black
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const rblur = new ShaderPass(FX.makeRadialBlur()); rblur.enabled = false;
  // ground-truth AO (room only); transparent sheets, sprites, points never write AO depth
  const gtao = new GTAOPass(room, cam, W, H);
  gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({ radius: 0.16, distanceExponent: 1.4, thickness: 1, scale: 1.5, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
  gtao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.isSprite || (o.material && o.material.transparent && o !== floor)) o.visible = false; });
  };
  // depth of field from the AO depth buffer, focused on the screen glass (gather with CoC-weighted taps, no sharp-edge bleed)
  const dof = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: gtao.depthTexture }, uNear: { value: cam.near }, uFar: { value: cam.far }, uFocus: { value: 5 }, uAmt: { value: 1 }, uMaxR: { value: 4 }, uRange: { value: 1 }, uRes: { value: new THREE.Vector2(W, H) } },
    vertexShader: VS,
    fragmentShader: `#include <packing>
      uniform sampler2D tDiffuse, tDepth; uniform float uNear, uFar, uFocus, uAmt, uMaxR, uRange; uniform vec2 uRes; varying vec2 vUv;
      float vz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
      float coc(float z){ return clamp(max(abs(z - uFocus) - uRange, 0.) / z * 2.2, 0., 1.) * uAmt * uMaxR; }
      void main(){
        vec4 base = texture2D(tDiffuse, vUv); float c = coc(vz(vUv));
        if (c < .35) { gl_FragColor = base; return; }
        vec3 acc = base.rgb; float wsum = 1.;
        for (int i = 0; i < 20; i++) {
          float fi = float(i) + .5; float a = fi * 2.39996; float rr = sqrt(fi / 20.) * c;
          vec2 uv = vUv + vec2(cos(a), sin(a)) * rr / uRes;
          float w = clamp(coc(vz(uv)) - rr + 1., 0., 1.);
          acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
        }
        gl_FragColor = vec4(acc / wsum, base.a);
      }`,
  });
  const smaa = new SMAAPass(Math.round(W * DPR), Math.round(H * DPR));
  composer.addPass(renderPass); composer.addPass(gtao); composer.addPass(handoff); composer.addPass(rblur); bloomMix.uniforms.tBloom.value = bloomSel.renderTargetsHorizontal[0].texture;
  composer.addPass(dof); composer.addPass(bloomMix); composer.addPass(bloom); composer.addPass(output); composer.addPass(smaa); composer.addPass(finalPass);
  function applyQuality() {
    DPR = dprFor(Q.level); renderer.setPixelRatio(DPR); composer.setPixelRatio(DPR);
    smaa.enabled = Q.level >= 1; lampLight.shadow.mapSize.set(Q.level === 2 ? 1024 : 512, Q.level === 2 ? 1024 : 512);
    if (lampLight.shadow.map) { lampLight.shadow.map.dispose(); lampLight.shadow.map = null; }
    layout();
  }
  // auto quality: below 45 fps for 2 s drops one level (AO + DOF first, then SMAA + DPR). Never climbs back (no oscillation).
  const qm = { t0: performance.now(), last: performance.now(), acc: 0, n: 0, low: 0 };
  function qualityTick() {
    const now = performance.now(), rdt = (now - qm.last) / 1000; qm.last = now;
    if (!postWarm || Q.locked || Q.level === 0 || now - qm.t0 < 4000 || rdt > 0.5 || document.hidden) return;
    qm.acc += rdt; qm.n++;
    if (qm.acc >= 0.5) { const fps = qm.n / qm.acc; qm.acc = 0; qm.n = 0; qm.low = fps < 45 ? qm.low + 0.5 : 0; if (qm.low >= 2) { qm.low = 0; Q.level--; applyQuality(); } }
  }

  // ============================== LAYOUT ==============================
  const L = {
    camStart: new V3(), lookStart: new V3(), sc: new V3(), n: new V3(), scale: 1,
    dEnd: 4, dHand: 3, zoom: 1, mobile: false,
  };
  const tanH = Math.tan(THREE.MathUtils.degToRad(25));
  const dHf = (h) => h / 2 / tanH;
  const dWf = (w, a) => w / 2 / (tanH * a);
  function layout() {
    W = window.innerWidth; H = window.innerHeight; const a = W / H;
    renderer.setSize(W, H, false); composer.setSize(W, H); dof.uniforms.uRes.value.set(W * DPR, H * DPR); L.dofPx = H * DPR / 800;
    insideRT.setSize(Math.round(W * DPR), Math.round(H * DPR)); handRT.setSize(Math.round(W * DPR), Math.round(H * DPR)); selRT.setSize(Math.round(W * DPR / 2), Math.round(H * DPR / 2)); bloomSel.setSize(Math.round(W * DPR / 2), Math.round(H * DPR / 2));
    cam.aspect = a; cam.updateProjectionMatrix();
    finalPass.uniforms.uAspect.value = a;
    L.mobile = a < 0.8;
    if (a < 0.8) {
      pc.position.set(0.5, -1.55, 0.2); pc.rotation.y = -0.42; L.scale = 1;
      L.camStart.set(0, 1.0, clamp(1.98 / (tanH * a), 5.6, 9)); L.lookStart.set(0, 0.5, 0);
    } else if (a < 1.3) {
      pc.position.set(0.85, -1.4, -0.2); pc.rotation.y = -0.72; L.scale = 1;
      L.camStart.set(0, 1.0, 5.5); L.lookStart.set(0.35, 0.3, 0);
    } else {
      pc.position.set(1.55, -1.25, -0.5); pc.rotation.y = -0.8; L.scale = 1;
      L.camStart.set(0, 0.88, 4.95); L.lookStart.set(0.25, -0.03, 0);
    }
    pc.scale.setScalar(L.scale);
    lampRef.visible = !L.mobile; disksRef.visible = !L.mobile; figRef.visible = !L.mobile; mugRef.position.x = L.mobile ? 1.42 : 1.62; disksRef.position.x = L.mobile ? -1.18 : -1.38;
    ground.position.y = pc.position.y - 5.9;
    wallBase.position.y = pc.position.y - 5.15;
    key.target.position.set(pc.position.x, pc.position.y + 1, 0);
    backRim.position.set(pc.position.x + 0.4, pc.position.y + 2.9, pc.position.z - 2.2);
    rim.target.position.copy(key.target.position);
    backFill.position.set(pc.position.x + 3, pc.position.y + 2.5, pc.position.z - 2); backFill.target.position.set(pc.position.x, pc.position.y + 1.1, pc.position.z - 1);
    pool.position.set(pc.position.x + 0.2, pc.position.y + 0.3, -1.6); pool.target.position.set(pc.position.x - 1.5, pc.position.y + 2.2, -6);
    pc.updateMatrixWorld(true);
    screen.getWorldPosition(L.sc);
    L.n.set(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(new THREE.Quaternion()));
    glow.position.copy(L.sc).addScaledVector(L.n, 1.0); glow.position.y -= 0.55;
    const ow = OPEN_W * L.scale, oh = OPEN_H * L.scale;
    const contain = Math.max(dHf(oh), dWf(ow, a)), cover = Math.min(dHf(oh), dWf(ow, a));
    L.dEnd = contain * 0.9;
    L.dHand = Math.min(L.dEnd, cover * 0.96);
    // the world renders with a wider fov (L.zoom) so the part of the screen visible at hand-off equals the full-screen inside view
    const Ap = PLANE_W / PLANE_H;
    const sU = a > Ap ? Ap / a : 1, sV = a > Ap ? 1 : a / Ap;
    screenMat.uniforms.uCrop.value.set(sU, sV);
    const fH = (2 * L.dHand * tanH) / (PLANE_H * L.scale);
    const f = clamp(fH * sV, 0.2, 1);
    L.zoom = f;
    handoff.uniforms.uZoom.value = 1;   // handRT is rendered at the native world fov: sample it 1:1
    // bezel fits for the contact close-up
    L.dFar = Math.max(dHf(BEZ_H * 1.45), dWf(BEZ_W * 1.3, a));
    // distance where the screen opening is about 46% of the width (desktop three-quarter close-up)
    L.dQ = (H / (2 * tanH)) / (clamp(W * 0.42, 420, 620) / (OPEN_W * 0.88));
    L.dPh = dWf(OPEN_W * L.scale / 0.96, a); // phone: the screen fills the width so the mapped dialog stays readable
    L.dNear = L.mobile ? dWf(OPEN_W * 1.04, a) : Math.max(dHf(OPEN_H * 1.5), dWf(OPEN_W * 1.3, a));
    // SCREEN WORLD: track length = dive + world + pull-back; the bench grid is the no-WebGL fallback only
    if (typeof world !== 'undefined') { trackEl.style.height = ((W_S0 + world.total + W_EXIT) * 100).toFixed(2) + 'vh'; world.resize(W, H, DPR, L.mobile); }
    // smoke cluster follows the computer
    smokes.forEach((sp) => { sp.userData.cx = pc.position.x; sp.userData.cy = pc.position.y; });
  }
  layout();

  // ============================== INPUT ==============================
  const mouse = { x: new Spring(0, 60, 30), y: new Spring(0, 60, 30), x1: new Spring(0, 100, 20), y1: new Spring(0, 100, 20) };
  const isTouch = matchMedia('(hover: none)').matches;
  let lastInput = performance.now();
  let mode = 'room';
  const onMove = (e) => {
    lastInput = performance.now();
    if (!isTouch && (e.pointerType === 'mouse' || !e.pointerType)) { mouse.x1.t = (e.clientX / W) * 2 - 1; mouse.y1.t = -((e.clientY / H) * 2 - 1); }
    hoverPick(e);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hoverScreen = 0, hoverTarget = 0, downPick = null;
  const heroActive = () => mode === 'room' && window.scrollY < window.innerHeight * 0.3;
  function pickAt(e) {
    ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1); ray.setFromCamera(ndc, cam);
    const objs = mode === 'close' ? [screen] : [screen, C.powerBtn, ...C.keyMeshes];
    const hit = ray.intersectObjects(objs, false)[0];
    if (!hit) return null;
    if (hit.object === screen) return { type: 'screen', uv: hit.uv };
    if (hit.object === C.powerBtn) return { type: 'power' };
    return { type: 'key', key: hit.object.userData.key };
  }
  const pwrTip = document.createElement('div'); pwrTip.textContent = 'reboot'; pwrTip.setAttribute('aria-hidden', 'true');
  pwrTip.style.cssText = 'position:fixed;left:0;top:0;z-index:40;pointer-events:none;opacity:0;transition:opacity .15s;padding:5px 9px;border-radius:7px;background:rgba(20,15,13,.9);border:1px solid rgba(255,240,235,.2);color:#F3E9D8;font:500 12px "JetBrains Mono",monospace;letter-spacing:.04em';
  document.body.appendChild(pwrTip);
  function setHoverKey(k) {
    if (k === hoverKey) return;
    if (hoverKey) { hoverKey.hoverT = false; if (hoverKey.decal) hoverKey.decal.material = C.decalMat; }
    hoverKey = k; if (k) { k.hoverT = true; if (k.decal) k.decal.material = C.hoverDecalMat; }
  }
  function reboot() { powerStart = performance.now() / 1000 + 0.15; ledBlinkT = elapsed; sound.powerOn(); }
  const onCaps = (e) => { if (e.getModifierState) capsOn = e.getModifierState('CapsLock'); };
  window.addEventListener('keydown', onCaps); window.addEventListener('keyup', onCaps);
  function hoverPick(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (e.target && e.target.closest && e.target.closest('a,button,#nav')) { document.body.style.cursor = ''; hoverTarget = 0; return; }
    let cur = '', hv = 0;
    let hk = null, tip = false;
    if (heroActive()) { const p = pickAt(e); if (p) { cur = 'pointer'; if (p.type === 'screen') hv = 1; if (p.type === 'key') hk = p.key; if (p.type === 'power') tip = true; } }
    setHoverKey(hk); pwrTip.style.opacity = tip ? '1' : '0'; if (tip) pwrTip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY - 34}px)`;
    else if (mode === 'close' && !L.mobile || mode === 'close') {
      const p = pickAt(e); const bi = p && p.type === 'screen' ? deskButtonAt(p.uv) : -1;
      if (bi !== deskHover) { deskHover = bi; drawDesk(); }
      if (bi >= 0) cur = 'pointer';
    }
    hoverTarget = hv; document.body.style.cursor = cur;
  }
  const keyPan = (k) => { if (!k || !k.grp) return 0; const v = k.grp.getWorldPosition(new V3()).project(cam); return clamp(v.x, -1, 1) * 0.55; };
  const typeKey = (k) => { if (k) { C.pressKey(k.code, elapsed); sound.key(k.code, keyPan(k)); } lastKeyT = elapsed; };
  let KS = 45, SL = 6, BF = 0.25, KEYK = 1;   // SL: screen RectAreaLight = the key on the deck   // key tops stay under ~0.85 after tone mapping
  let hopT = -9, blinkAt = 3, blinkEnd = 0, lampDipAt = 6, lampDip = 0;
  const termLive = document.getElementById('termLive');
  const startTyping = () => { if (!os.typing) os.startTyping(); };
  const stopTyping = () => { if (os.typing) os.stopTyping(); };
  function runCommand() {
    const typed = (os.buf || '').trim();
    const act = os.enter();
    if (typed) { const bad = os.lastOut[0] === 'Bad command or file name'; if (!bad && act !== 'boot') { sound.seek(); floppyUntil = elapsed + 0.8; } if (act !== 'boot') sound.result(!bad); }
    if (termLive) termLive.textContent = os.lastOut.join('. ');
    if (act && act !== 'boot' && act !== 'lumpy') stopTyping();
    if (act === 'work') setTimeout(() => snapTo(DIVE_Y()), 380);
    else if (act === 'about') setTimeout(() => { location.href = '/about'; }, 380);
    else if (act === 'contact') setTimeout(() => anchor('#contact'), 380);
    else if (act === 'boot') { startTyping(); powerStart = performance.now() / 1000 + 0.6; sound.boot(); ledBlinkT = elapsed + 0.4; floppyUntil = elapsed + 2; }
    else if (act === 'lumpy') { startTyping(); hopT = elapsed; }
  }
  function keyFromMesh(k) {
    if (!k) return;
    typeKey(k);
    if (k.code === 'Escape') { stopTyping(); return; }
    if (k.code === 'ArrowDown') { stopTyping(); snapTo(DIVE_Y()); return; }
    startTyping();
    if (k.code === 'Enter') runCommand();
    else if (k.code === 'Backspace') os.back();
    else if (k.code === 'Space') os.type(' ');
    else if (k.label && k.label.length === 1 && !/[↑↓←→]/.test(k.label)) os.type(k.label.toLowerCase());
  }
  const onPickDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('a,button,#nav,input')) return;
    if (!(heroActive() || mode === 'close')) return;
    const p = pickAt(e); downPick = p ? { p, x: e.clientX, y: e.clientY } : null;
    if (p && p.type === 'key') keyFromMesh(p.key);
    if (p && p.type === 'power') reboot();
  };
  const onPickUp = (e) => {
    const d = downPick; downPick = null; if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    if (d.p.type === 'screen') {
      if (mode === 'close') { const bi = deskButtonAt(d.p.uv); if (bi >= 0 && dlgLinks[bi]) dlgLinks[bi].click(); }
      else if (heroActive()) startTyping();
      sound.tap(clamp(((d.x / W) * 2 - 1) * 0.5, -0.6, 0.6));
    }
  };
  window.addEventListener('pointerdown', onPickDown);
  window.addEventListener('pointerup', onPickUp);
  const onType = (e) => {
    lastInput = performance.now();
    if (!heroActive() || snapping) { if (os.typing && !heroActive()) stopTyping(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae !== document.documentElement) return;   // links, buttons, inputs keep their keys
    const k = C.keys[e.code] || (e.key === ' ' ? C.keys.Space : null);
    if (e.key === 'Escape') { if (os.typing) { typeKey(k); stopTyping(); e.preventDefault(); } return; }
    const printable = e.key.length === 1 && e.key !== ' ';
    if (!os.typing) { if (!printable) return; startTyping(); }
    if (e.key === 'Tab') { os.complete(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { os.histStep(e.key === 'ArrowUp' ? -1 : 1); if (k) C.pressKey(k.code, elapsed); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (['PageDown', 'PageUp'].includes(e.key)) { stopTyping(); return; }   // scroll gesture leaves typing
    if (e.key === 'Enter') { typeKey(k); runCommand(); }
    else if (e.key === 'Backspace') { typeKey(k); os.back(); }
    else if (e.key.length === 1) { typeKey(k); os.type(e.key.toLowerCase()); }
    else if (k) C.pressKey(k.code, elapsed);
    e.preventDefault(); e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', onType, { capture: true });
  // Snap dive: one gesture from the hero tweens 0 -> 1 over 1.8s (easeInOutCubic), input locked until it lands; up from the ring reverses.
  const DIVE_Y = () => window.innerHeight * 1.2;
  let snapping = false, touchY = null;
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function snapTo(y) {
    snapping = true;
    if (Math.abs(y - window.scrollY) > window.innerHeight * 0.4) sound.dive(y > window.scrollY ? 1 : -1);
    if (reduced || !lenis) { window.scrollTo(0, y); setTimeout(() => { snapping = false; }, 120); return; }
    lenis.scrollTo(y, { duration: 1.8, easing: easeIO, lock: true, force: true, onComplete: () => { setTimeout(() => { snapping = false; }, 60); } });
    setTimeout(() => { snapping = false; }, 2300);
  }
  function snapIntent(dir, e) {
    const sy = window.scrollY, vh = window.innerHeight;
    if (world.modal || world.locked) return;   // SCREEN WORLD: a project page is open or a beat is being played
    if (snapping) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (dir > 0 && sy < vh * 0.6) { e.preventDefault(); e.stopImmediatePropagation(); snapTo(DIVE_Y()); }
    else if (dir < 0 && sy > vh * 0.3 && sy <= vh * 1.25) { e.preventDefault(); e.stopImmediatePropagation(); snapTo(0); }
  }
  const onSnapWheel = (e) => { lastInput = performance.now(); if (Math.abs(e.deltaY) < 2) return; stopTyping(); snapIntent(Math.sign(e.deltaY), e); };
  const onSnapKey = (e) => {
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    const ae = document.activeElement; if (e.key === ' ' && ae && ae !== document.body && ae.closest && ae.closest('a,button')) return;
    const down = e.key === 'PageDown' || e.key === 'ArrowDown' || (e.key === ' ' && !e.shiftKey);
    const up = e.key === 'PageUp' || e.key === 'ArrowUp' || (e.key === ' ' && e.shiftKey);
    if (down || up) snapIntent(down ? 1 : -1, e);
  };
  const onTS = (e) => { touchY = e.touches[0].clientY; };
  const onTM = (e) => { if (touchY === null) return; const dy = touchY - e.touches[0].clientY; if (Math.abs(dy) > 12) { stopTyping(); snapIntent(Math.sign(dy), e); if (snapping) touchY = null; } };
  window.addEventListener('wheel', onSnapWheel, { capture: true, passive: false });
  window.addEventListener('keydown', onSnapKey, { capture: true });
  window.addEventListener('touchstart', onTS, { capture: true, passive: true });
  window.addEventListener('touchmove', onTM, { capture: true, passive: false });
  let rzT = 0;
  const onResize = () => { clearTimeout(rzT); rzT = setTimeout(() => { layout(); drawDesk(); }, 100); };
  window.addEventListener('resize', onResize);

  // ============================== CANVAS SCREENS ==============================
  // NEW_PROJECT.TXT drawn inside the screen glass (crisp canvas, clicks raycast to UV). The HTML dialog stays as the
  // accessible, focusable copy; focusing its links draws a focus ring here.
  let deskBtns = [], deskFocus = -1, deskHover = -1;
  const dlgLinks = [...dlgWrap.querySelectorAll('a')];
  function wrapText(x, text, maxW) { const words = text.split(' '), lines = []; let ln = ''; words.forEach((w) => { const t = ln ? ln + ' ' + w : w; if (x.measureText(t).width > maxW && ln) { lines.push(ln); ln = w; } else ln = t; }); if (ln) lines.push(ln); return lines; }
  function drawDesk() {
    const x = deskCanvas.getContext('2d'), w = 1024, h = 752, m = L.mobile; x.setTransform(2, 0, 0, 2, 0, 0); x.imageSmoothingQuality = 'high';
    const g = x.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h / 2, w * 0.75); g.addColorStop(0, '#1d1950'); g.addColorStop(1, '#05041c');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(140,150,255,.07)'; x.lineWidth = 1;
    for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (let i = 0; i < h; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
    x.font = '32px VT323'; x.fillStyle = 'rgba(255,200,130,.9)'; x.textBaseline = 'alphabetic';
    x.fillText('C:\\BENCH> type NEW_PROJECT.TXT', 64, 60);
    // dialog box, kept well inside the rounded glass
    const bx = m ? 84 : 92, by = m ? 84 : 92, bw = w - bx * 2, bh = (m ? 640 : 600) - by;
    x.fillStyle = '#0B0908'; x.fillRect(bx + 10, by + 10, bw, bh);
    x.fillStyle = '#EADFCC'; x.fillRect(bx, by, bw, bh);
    x.lineWidth = 4; x.strokeStyle = '#0B0908'; x.strokeRect(bx, by, bw, bh);
    x.fillStyle = '#3B2BB0'; x.fillRect(bx + 2, by + 2, bw - 4, 54);
    x.fillStyle = '#FFF6E8'; x.font = '38px VT323'; x.fillText('NEW_PROJECT.TXT', bx + 22, by + 41);
    x.textAlign = 'right'; x.fillText('_  ▢  ×', bx + bw - 22, by + 41); x.textAlign = 'left';
    const px = bx + (m ? 28 : 46); let y = by + 56 + (m ? 92 : 96);
    const tSize = m ? 92 : 84;
    x.fillStyle = '#1B1208'; x.font = `${tSize}px "Instrument Serif"`; x.fillText('Bring us a ', px, y);
    const tw = x.measureText('Bring us a ').width; x.font = `italic ${tSize}px "Instrument Serif"`; x.fillText('build.', px + tw, y);
    const bSize = m ? 40 : 31; x.font = `${bSize}px "Instrument Sans"`; x.fillStyle = '#3A2E22';
    y += m ? 62 : 54;
    wrapText(x, 'Software, a website, a game or an asset pack. One email: what it is, links that show the vibe, rough timing.', bw - (px - bx) * 2).forEach((l) => { x.fillText(l, px, y); y += bSize * 1.32; });
    y += m ? 14 : 18;
    const btnH = m ? 74 : 62, f = m ? '500 32px "JetBrains Mono"' : '500 27px "JetBrains Mono"';
    x.font = f;
    const labels = ['[ OK ] Email the lab', 'About us'];
    deskBtns = []; let bxx = px;
    labels.forEach((lab, i) => {
      const bw2 = x.measureText(lab).width + (m ? 52 : 48);
      const r = [bxx, y, bw2, btnH];
      x.fillStyle = '#0B0908'; x.fillRect(r[0] + 7, r[1] + 7, r[2], r[3]);
      x.fillStyle = i === 0 ? (deskHover === 0 ? '#4A3AD0' : '#3B2BB0') : (deskHover === 1 ? '#FFF6E8' : '#F6E9D6'); x.fillRect(r[0], r[1], r[2], r[3]);
      x.lineWidth = 4; x.strokeStyle = '#0B0908'; x.strokeRect(r[0], r[1], r[2], r[3]);
      x.fillStyle = i === 0 ? '#FFF6E8' : '#1B1208'; x.textBaseline = 'middle'; x.fillText(lab, r[0] + (m ? 26 : 24), r[1] + r[3] / 2 + 1); x.textBaseline = 'alphabetic';
      if (deskFocus === i) { x.lineWidth = 4; x.strokeStyle = '#FFB45E'; x.strokeRect(r[0] - 8, r[1] - 8, r[2] + 16, r[3] + 16); }
      deskBtns.push(r); bxx += bw2 + 28;
    });
    y += btnH + (m ? 60 : 58);
    x.font = m ? '500 34px "JetBrains Mono"' : '500 27px "JetBrains Mono"'; x.fillStyle = '#3B2BB0'; x.fillText('devops@therdw.com', px, y);
    deskTex.needsUpdate = true;
  }
  drawDesk();
  dlgLinks.forEach((a, i) => { a.addEventListener('focus', () => { deskFocus = i; drawDesk(); }); a.addEventListener('blur', () => { deskFocus = -1; drawDesk(); }); });
  // screen UV (mesh) -> content UV, matching the shader's barrel()
  function contentUV(uv, k) { let cx = uv.x - 0.5, cy = uv.y - 0.5; const r2 = cx * cx + cy * cy, f = 1 + r2 * (k + k * Math.sqrt(r2)); cx *= f * (1 - k * 0.3655); cy *= f * (1 - k * 0.3655); return [cx + 0.5, cy + 0.5]; }
  function deskButtonAt(uv) { const [u, v] = contentUV(uv, 0); const X = u * 1024, Y = (1 - v) * 752; return deskBtns.findIndex(([bx, by, bw, bh]) => X >= bx && X <= bx + bw && Y >= by && Y <= by + bh); }

  // ---- optional key-click synth (off by default; toggled in the nav)
  const sndBtn = document.getElementById('sndBtn');
  const sndWrap = document.getElementById('sndWrap'), sndVol = document.getElementById('sndVol'), sndWhine = document.getElementById('sndWhine');
  let peekT = 0;
  const showSnd = (on) => { sndBtn.setAttribute('aria-pressed', String(on)); sndBtn.title = on ? 'Sound: on' : 'Sound: off'; if (sndWrap) sndWrap.classList.toggle('on', on); };
  const onSnd = async () => {
    const want = !sound.on; showSnd(want);   // state shows at once; samples load behind it
    if (want && sndWrap) { sndWrap.classList.add('peek'); clearTimeout(peekT); peekT = setTimeout(() => sndWrap.classList.remove('peek'), 2600); }
    const on = await sound.toggle(); showSnd(on); if (on && want) ledBlinkT = elapsed;
  };
  const onVol = () => sound.setVolume(sndVol.value / 100);
  const onWhine = () => sound.setWhine(sndWhine.checked);
  if (sndBtn) { showSnd(sound.on); sndBtn.addEventListener('click', onSnd); }
  if (sndVol) { sndVol.value = Math.round(sound.volume * 100); sndVol.addEventListener('input', onVol); }
  if (sndWhine) { sndWhine.checked = sound.whine; sndWhine.addEventListener('change', onWhine); }

  // ============================== LOOP ==============================
  const clock = new THREE.Clock();
  let raf = 0, alive = true, bootT = 0, lastBootDraw = -1, elapsed = 0, idleDraw = 0;
  const tmpPos = new V3(), tmpLook = new V3(), endPos = new V3(), handPos = new V3();
  const deskLightCol = new THREE.Color('#c9c3ff'), skyLightCol = new THREE.Color('#a896d8');
  const showClass = (el, cls, on) => { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); };

  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (window.__pause) { if (!(window.__stepN > 0)) return; window.__stepN--; }
    if (lite && liteRaster) { liteRaster = false; liteLast = performance.now(); return; }   /* software GL rasterises after the JS returns: count the gap from when that is done */
    if (lite) { const nowL = performance.now(), act = nowL - lastInput < 1500 || Math.abs(window.scrollY - liteSY) > 0.5;
      liteSY = window.scrollY; if (nowL - liteLast < (act ? 160 : 700)) return; if (nowL - liteShadow > 1500) { renderer.shadowMap.needsUpdate = true; liteShadow = nowL; } }   /* software GL: ~6 fps while you scroll/move, ~1.5 fps at rest, shadows every 1.5 s: the page stays responsive */   // frame-by-frame capture hook (inert by default)
    // Phones idle at rest: keep the workbench responsive without burning the battery (or TBT) on 60 fps.
    if (L.mobile && !lite && window.__firstFrame && mode === 'room' && window.scrollY < 4 && performance.now() - lastInput > 1200) {
      const nowI = performance.now(); if (nowI - idleDraw < 500) return; idleDraw = nowI;
    }
    const dt0 = Math.min(clock.getDelta(), 1 / 20), dt = window.__fixedDt || dt0; elapsed += dt; frameNo++; bootT += dt; qualityTick();
    const vh = H, sy = window.scrollY, s = sy / vh;
    const cr = contactEl.getBoundingClientRect();
    const ct = cr.top / vh;
    const pinP = clamp(-cr.top / Math.max(1, cr.height - vh));
    /* dive: the camera reaches the glass by s .66 and the screen fills + flattens into the page by s .8 (~70 % of the 0 -> 1.2 vh snap) */
    const u = clamp(s / 0.66), ue = 1 - Math.pow(1 - u, 1.4);
    const h = sstep(0.6, 0.8, s);
    const direct = s >= 0.8 && s < 0.97 && !(ct <= W_EXIT);   // page fully taken over: draw the world straight to the composer, exactly like 'inside'
    // SCREEN WORLD: the last W_EXIT vh before the contact pin is the pull-back out through the glass (close mode, camera from the hand-off spot)
    const exitK = ct > 0 && ct <= W_EXIT ? 1 - ct / W_EXIT : (ct <= 0 ? 1 : 0);
    mode = ct <= W_EXIT ? 'close' : (s >= 0.97 ? 'inside' : 'room');
    if (mode !== prevMode) { if (mode === 'inside' && prevMode === 'room') landT = elapsed; if (mode === 'room' && prevMode === 'inside') rackT = elapsed; prevMode = mode; }
    const fade = 0;   // SCREEN WORLD: no black cut before contact, the pull-back carries it

    mouse.x1.step(dt); mouse.y1.step(dt); mouse.x.t = mouse.x1.x; mouse.y.t = mouse.y1.x; mouse.x.step(dt); mouse.y.step(dt);
    const mx = reduced ? 0 : mouse.x.x, my = reduced ? 0 : mouse.y.x;

    // ----- room camera -----
    if (mode !== 'close') {
      endPos.copy(L.sc).addScaledVector(L.n, L.dEnd);
      handPos.copy(L.sc).addScaledVector(L.n, L.dHand);
      tmpPos.lerpVectors(L.camStart, endPos, ue);
      if (h > 0) tmpPos.lerpVectors(endPos, handPos, h);
      tmpLook.lerpVectors(L.lookStart, L.sc, ue);
      const par = 0.15 * (1 - ue);
      tmpPos.x -= mx * par; tmpPos.y -= my * par;
    } else {
      const e = 1 - Math.pow(1 - clamp(pinP / 0.45), 2.2);
      if (L.mobile) {
        const d = lerp(L.dPh * 1.15, L.dPh, e);
        tmpPos.copy(L.sc).addScaledVector(L.n, d); tmpPos.y += 0.05 * d;
        tmpLook.copy(L.sc); tmpLook.y -= 0.12;
      } else {
        // three-quarter view from the right, the whole clay computer standing in fog
        const d = lerp(L.dQ * 1.3, L.dQ, e) * 1.32, ang = 0.5;
        const nx = L.n.x * Math.cos(ang) + L.n.z * Math.sin(ang), nz = -L.n.x * Math.sin(ang) + L.n.z * Math.cos(ang);
        tmpPos.set(L.sc.x + nx * d, L.sc.y + d * 0.1, L.sc.z + nz * d);
        tmpLook.set(L.sc.x - 0.5, L.sc.y - 0.3, L.sc.z + 0.1);
      }
      tmpPos.x += mx * 0.08; tmpPos.y += my * 0.05;
    }
    if (mode === 'close' && exitK < 1) {   // SCREEN WORLD pull-back: from the hand-off spot in front of the glass to the contact framing
      const ek = reduced ? 1 : 1 - Math.pow(1 - sstep(0.04, 0.95, exitK), 2.2);
      handPos.copy(L.sc).addScaledVector(L.n, L.dHand);
      tmpPos.lerpVectors(handPos, tmpPos, ek); tmpLook.lerpVectors(L.sc, tmpLook, ek);
    }
    cam.position.copy(tmpPos); cam.lookAt(tmpLook);
    if (mode === 'room' && !reduced) {   // handheld: +-0.6 mm, ~0.07 Hz smooth noise, on top of the parallax
      const n1 = Math.sin(elapsed * 0.44) * 0.6 + Math.sin(elapsed * 0.71 + 1.3) * 0.4, n2 = Math.sin(elapsed * 0.37 + 2.1) * 0.6 + Math.sin(elapsed * 0.83 + 0.4) * 0.4;
      cam.position.x += n1 * 0.019; cam.position.y += n2 * 0.019; cam.rotateZ(n1 * 0.0012);   // ~2 px at 1280
    }
    if (mode === 'room' && !reduced) cam.rotateY(-mx * 0.012 * (1 - ue));

    // ----- screen content -----
    screenMat.uniforms.uTime.value = elapsed;
    screenMat.uniforms.uScanP.value = Math.max(2, 2 * H * DPR / 1440);
    { const dist = cam.position.distanceTo(L.sc), pxW = OPEN_W * L.scale / (2 * dist * tanH * (W / H)) * W * DPR; screenMat.uniforms.uConv.value = clamp(0.5 / Math.max(pxW, 50), 0.0004, 0.004); screenMat.uniforms.uGrille.value = clamp((pxW - 520) / 300); }
    if (mode === 'close') {
      screenMat.uniforms.tBoot.value = deskTex; screenMat.uniforms.uMix.value = 0; screenMat.uniforms.uBright.value = 1.18; screenMat.uniforms.uScan.value = 0.6; screenMat.uniforms.uFlick.value = 0; screenMat.uniforms.uHover.value = 0; screenMat.uniforms.uRoll.value = 0; screenMat.uniforms.uPrevK.value = 0; screenMat.uniforms.uBase.value.setRGB(0, 0, 0);
      if (exitK < 1) {   // SCREEN WORLD: the glass keeps showing the world, then a channel roll flips it to NEW_PROJECT.TXT
        const sw = reduced ? (exitK < 0.8 ? 0 : 1) : sstep(0.7, 0.9, exitK);   /* [smooth] soft crossfade to the dialog */
        screenMat.uniforms.uMix.value = 1 - sw; screenMat.uniforms.uScan.value = lerp(0.15, 0.6, sstep(0.1, 0.6, exitK)); screenMat.uniforms.uBright.value = lerp(1.05, 1.18, sw);
        screenMat.uniforms.uRoll.value = reduced ? 0 : Math.max(0, 1 - Math.abs(exitK - 0.8) / 0.07) * 0.9;
      }
      screenMat.uniforms.uScan.value = 0; screenMat.uniforms.uGrille.value = 0; screenMat.uniforms.uConv.value = 0; screenMat.uniforms.uRoll.value = 0; screenMat.uniforms.uFlick.value = 0;   /* [clean-screen] */
    } else {
      screenMat.uniforms.tBoot.value = os.tex;
      screenMat.uniforms.uMix.value = sstep(0.05, 0.55, u);
      screenMat.uniforms.uBright.value = lerp(1.02, 1.05, screenMat.uniforms.uMix.value) * lerp(0.78, 1, sstep(0.0, 0.14, s));   // idle hero ~78 %, full brightness as the dive begins (a reveal)
      screenMat.uniforms.uScan.value = 1 - h * 0.85;
      if (s < 0.7) os.update(elapsed);
      screenMat.uniforms.uFlick.value = 0;
      screenMat.uniforms.uRoll.value = rollFreeze !== null ? rollFreeze : os.flicker * (1 - u);
      screenMat.uniforms.uPrevK.value = os.prevK; screenMat.uniforms.uBase.value.copy(os.base);
      /* [clean-screen] crisp, modern panel: no scanlines, grille, convergence error, roll, flicker or afterglow */
      screenMat.uniforms.uScan.value = 0; screenMat.uniforms.uGrille.value = 0; screenMat.uniforms.uConv.value = 0; screenMat.uniforms.uRoll.value = 0; screenMat.uniforms.uFlick.value = 0; screenMat.uniforms.uPrevK.value = 0;
      os.setHover(hoverScreen > 0.5 && heroActive() && !os.typing);
      hoverScreen += (hoverTarget - hoverScreen) * (1 - Math.exp(-dt * 10));
      screenMat.uniforms.uHover.value = hoverScreen * (1 - u);
    }
    const pT = powerFreeze !== null ? powerFreeze : (reduced ? 9 : Math.max(0, performance.now() / 1000 - powerStart));
    screenMat.uniforms.uSpec.value = mode === 'close' ? 1 : 1 - sstep(0.3, 0.62, s);   // glass smudge/Fresnel gone before the magnified hand-off
    screenMat.uniforms.uPow.value = mode === 'close' ? 9 : pT;
    screenMat.uniforms.uPar.value.set(-mx, -my);
    const powerK = mode === 'close' ? 1 : (pT < 0.08 ? 0 : pT < 0.24 ? 0.5 : pT < 0.45 ? 0.3 + 0.7 * sstep(0.24, 0.45, pT) : 1);
    const scrMix = screenMat.uniforms.uMix.value;
    // the screen is the key light: its colour follows the current image's average colour
    const tgtCol = mode === 'close' ? deskLightCol : (scrMix > 0.5 ? skyLightCol : os.avg);
    scrCol.lerp(tgtCol, 1 - Math.exp(-dt * 7));
    const flickK = 1 + 0.05 * Math.sin(elapsed * 10) + 0.03 * Math.sin(elapsed * 23) + 0.02 * Math.sin(elapsed * 47) - os.flicker * 0.25 * (mode === 'room' ? 1 : 0);
    screenLight.color.copy(scrCol); screenLight.intensity = SL * (mode === 'close' ? 0.8 : 1) * flickK * (1 + 0.15 * hoverScreen) * powerK;   /* dk boost applied below once dk is known */
    // fake selective bloom + lit fog + dust, all driven by the live screen colour
    const scrLum = powerK * flickK * (mode === 'close' ? 0.6 : 1 - 0.7 * u);
    const dk = mode === 'room' ? sstep(0.08, 0.62, s) * (1 - h) : 0;   // screen glow swells as the camera closes in, then hands off to the page
    halo.material.uniforms.uCol.value.copy(scrCol); halo.material.uniforms.uK.value = powerK * flickK * (mode === 'close' ? 0.6 : 1) * os.rawLum * 0.9 * (mode === 'close' ? 0.6 : 1) * (1 + 0.15 * hoverScreen) * (1 + 1.2 * dk) * (mode === 'room' ? Math.max(1 - 0.7 * u, dk) : 1);
    deskRefl.material.uniforms.uCol.value.copy(scrCol).multiplyScalar(scrLum * os.rawLum);
    lightFog.update(scrCol, scrLum, elapsed); lightFog.cone.material.uniforms.uK.value = 0.07; lightFog.pool.material.uniforms.uK.value = 0.0; lightFog.pool.visible = false;
    dust.visible = !reduced && !L.mobile && mode !== 'inside'; dust.material.uniforms.uT.value = elapsed; dust.material.uniforms.uCol.value.copy(scrCol).multiplyScalar(0.55 * scrLum); dust.material.uniforms.uScale.value = H * 0.9; dust.material.uniforms.uRes.value.set(W * DPR, H * DPR); dust.material.uniforms.uMaxPx.value = 18 * DPR;
    C.lipGlowMat.uniforms.uCol.value.copy(scrCol); C.lipGlowMat.uniforms.uK.value = (mode === 'close' ? 0.6 : 1 + 0.6 * dk) * flickK * (1 + 0.3 * hoverScreen) * powerK;
    glow.color.copy(scrCol); screenLight.intensity *= 1 + 0.6 * dk;
    RIM.k.value = mode === 'close' ? 0.6 : 1 - 0.6 * u;   // cool back-left rim on the case, eases off as the bezel fills the frame
    { const k = 1 - 0.3 * clamp((u - 0.5) / 0.5) * (mode === 'room' ? 1 : 0); rim.intensity = 2.6 * k * BF; backFill.intensity = 3.5 * k * BF; }
    keySpill.color.copy(scrCol); keySpill.intensity = (mode === 'close' ? 2.2 : KS) * flickK * powerK;
    glow.intensity = (mode === 'close' ? 1.2 : 2.6) * flickK;
    key.intensity = KEYK * (mode === 'close' ? 15 : 8.6) * (1 + (reduced ? 0 : 0.02 * Math.sin(elapsed * 10)));
    ambient.intensity = mode === 'close' ? 0.3 : 0.08;
    C.update(elapsed, dt, reduced);
    if (pT < 0.7 && mode !== 'close') C.led.material.color.setRGB(3.2, 1.6, 0.3);
    else C.led.material.color.setRGB(0.5, 3.2, 1.6).multiplyScalar(reduced ? 1 : (hoverScreen > 0.3 ? 0.6 + 0.4 * Math.abs(Math.sin(elapsed * 6)) : 0.85 + 0.15 * Math.sin(elapsed * 3)));
    if (elapsed - ledBlinkT < 0.7) C.led.material.color.multiplyScalar(Math.floor((elapsed - ledBlinkT) * 12) % 2 ? 0.08 : 1.4);   // power -> LED blink
    C.capsLed.material.color.set('#ffb24a').multiplyScalar(capsOn ? 3 : 0.12);
    { const busy = os.flicker > 0 || elapsed - lastKeyT < 0.25 || elapsed < floppyUntil || (os.anim && mode === 'room'); C.fled.material.color.setRGB(1, 0.6, 0.2).multiplyScalar(busy && (Math.floor(elapsed * 30) % 3) ? 2.6 : 0.2); }
    // rare lamp flicker (+-3%)
    if (!reduced && elapsed > lampDipAt) { lampDip = 0.15; lampDipAt = elapsed + 5 + Math.random() * 6; }
    lampDip = Math.max(0, lampDip - dt);
    const lampK = lampDip > 0 ? 0.97 + 0.03 * Math.sin(elapsed * 90) : 1;
    lampLight.intensity = (mode === 'close' ? 2.2 : 2.6) * lampK; screenMat.uniforms.uLampK.value = lampK;
    poolRef.visible = coneRef.visible = !(mode === 'close' && L.mobile);
    poolRef.material.opacity = mode === 'close' ? 0.22 : 0.14;
    glow.distance = mode === 'close' ? 1.6 : 3.5;
    lampRef.visible = !L.mobile && (mode === 'close' || u < 0.3);
    fogPlanes.forEach((pl) => { const b = pl.userData.op0 ?? (pl.userData.op0 = pl.material.uniforms.uOp.value); pl.material.uniforms.uOp.value = mode === 'close' && pl.position.x < 0 && !pl.userData.rel ? Math.min(b, 0.18) : b; });
    figRef.children[0].material.emissiveIntensity = mode === 'close' ? 0.28 : 0.14;
    const closeDesk = mode === 'close' && !L.mobile;
    if (closeDesk) {
      figRef.position.set(-0.95, 0, 0.5); figRef.rotation.y = 0.55;
      lampRef.position.set(-2.9, 0, 0.92); lampRef.rotation.y = -0.09; lampRef.scale.setScalar(0.84);
      headRef.rotation.z = 0.89; poolRef.position.set(1.87, 0.01, 0); poolRef.scale.setScalar(2.3);
      coneRef.material.uniforms.uK.value = 2.2;
      mugRef.position.set(-1.62, 0, 0.62); calRef.visible = true; calSpot.visible = true;
    } else {
      figRef.position.set(-1.85, 0, 1.6); figRef.rotation.y = 0.25;
      lampRef.position.set(-2.04, 0, -0.92); lampRef.rotation.y = -1.3; lampRef.scale.setScalar(1.4);   // pool on the desk left of the keys, overlapping the screen wash
      headRef.rotation.z = 0.64; poolRef.position.set(1.42, 0.006, 0); poolRef.scale.setScalar(1); coneRef.material.uniforms.uK.value = 1;
      mugRef.position.x = L.mobile ? 1.42 : 1.62; mugRef.position.z = 0.42; calRef.visible = false; calSpot.visible = false;
    }

    props.viking.position.set(mugRef.position.x - (closeDesk ? -0.28 : 0.27), 0, mugRef.position.z + 0.22); props.viking.rotation.y = closeDesk ? 0.9 : -0.3;
    /* hero silhouette: only the lamp + Lumpy beside the computer; the mug and the little figure only dress the contact desk */
    mugRef.visible = closeDesk; props.viking.visible = closeDesk; props.ring.visible = closeDesk;
    props.ring.position.set(mugRef.position.x - 0.3, 0.004, mugRef.position.z - 0.32);
    { const nk = mode === 'room' ? 1 - sstep(0.03, 0.16, s) : 1; props.note.material.opacity = nk; props.note.visible = nk > 0.01; }   // sticky note gone before the bezel reaches the nav
    steam.visible = !reduced && closeDesk; if (steam.visible) steam.userData.update(elapsed);
    // Lumpy: blink every 4-6s, turn up to 10deg toward the cursor, hop on command
    if (elapsed > blinkAt) { blinkEnd = elapsed + 0.12; blinkAt = elapsed + 4 + Math.random() * 2; }
    { const closed = !reduced && elapsed < blinkEnd; [1, 2].forEach((ci) => { const e = figRef.children[ci]; if (e) e.scale.y = closed ? 0.12 : 1.15; }); }
    figRef.rotation.y += reduced ? 0 : clamp(mx, -1, 1) * 0.17;
    { const hp = elapsed - hopT; figRef.position.y = hp < 0.9 && !reduced ? Math.abs(Math.sin(hp / 0.9 * Math.PI * 2)) * 0.16 : 0; }
    // cables
    { const sway = reduced || L.mobile ? 0 : 1;
      ropePush.set(Math.sin(elapsed * 0.7) * 0.15 * sway + (mouse.x1.x - mouse.x.x) * 12 * sway, 0, (mouse.y1.x - mouse.y.x) * 6 * sway);
      ropeKb.update(dt, ropePush, ropeCollide, ropeHide);
      lampEnd.set(lampRef.position.x + 0.1 * lampRef.scale.x, 0.03, lampRef.position.z + 0.1 * lampRef.scale.x);
      if (!ropeLamp.route || !ropeLamp.route[ropeLamp.route.length - 1][1].equals(lampEnd)) ropeLamp.setRoute([[0, dropLamp.end], [6, lampMid], [22, lampEnd.clone()]], 1.02);
      ropeLamp.update(dt, ropePush, ropeCollide, ropeHide);
      [ropeLamp.seg, ropeLamp.joint, ropeLamp.sh, dropLamp.tube, dropLamp.sh].forEach((m) => { m.visible = lampRef.visible && mode !== 'close'; }); }
    lowFog.userData.update(reduced ? 0 : elapsed, mode === 'room' ? 1 - sstep(0.06, 0.35, s) : 0, scrCol);
    // fog planes face the camera and drift
    fogPlanes.forEach((pl) => { if (pl.userData.rel) pl.position.copy(pc.position).add(pl.userData.rel); pl.material.uniforms.uTime.value = reduced ? 0 : elapsed; pl.material.uniforms.uKeyX.value = key.position.x; pl.material.uniforms.uScr.value.copy(L.sc); });
    // smoke
    smokes.forEach((sp, i) => {
      const ud = sp.userData;
      if (!reduced) { sp.material.rotation += ud.spin * dt; ud.bx += ud.drift * dt; if (ud.bx > 4.5) ud.bx = -4.5; }
      sp.position.set(ud.cx + ud.bx, ud.cy + ud.by + (reduced ? 0 : Math.sin(elapsed * 0.3 + ud.ph) * 0.08), ud.bz);
      if (ud.op0 === undefined) ud.op0 = sp.material.opacity;
      sp.material.opacity = ud.op0 * 0.7 * clamp((sp.position.distanceTo(cam.position) - 0.8) / 1.6);
    });

    // ----- sound: slide ticks, hover brush, hum/room levels follow the dive
    if (sound.on) {
      if (os.cutT !== sndCut) { sndCut = os.cutT; if (mode === 'room' && u < 0.5) { sound.slide(); if (Math.random() < 0.45) { sound.seek(); floppyUntil = elapsed + 0.8; } } }
      if (hoverTarget > 0.5 && !sndHover) sound.hover(); sndHover = hoverTarget > 0.5;
      sound.update({ room: mode === 'room' ? 1 - clamp(s / 1.1) * 0.7 : (mode === 'close' ? 0.7 : 0.15), inside: mode === 'inside' ? 1 : (mode === 'room' ? h : 0), lum: os.rawLum * powerK });
    }
    if (camOv) { cam.position.copy(camOv.p).applyMatrix4(pc.matrixWorld); cam.lookAt(camOv.l.clone().applyMatrix4(pc.matrixWorld)); cam.fov = camOv.f; cam.updateProjectionMatrix(); }
    // ----- post settings per phase -----
    const exitIns = mode === 'close' && exitK < 1 ? 1 - sstep(0.02, 0.2, exitK) : 0;   // SCREEN WORLD hand-back
    const ins = mode === 'inside' ? 1 : (mode === 'room' ? h : exitIns);
    // the 5 cm glass bulge magnifies the centre ~6 % at hand-off distance: flatten it before the native frame crossfades in, so the two register
    screen.scale.z = mode === 'room' ? 1 - sstep(0, 0.3, h) : (mode === 'close' ? 1 - exitIns : 1);
    const wp = world.post();   // SCREEN WORLD per-beat look
    const frameAmt = ins * (mode === 'inside' ? wp.border : 1);
    const insB = mode === 'room' ? Math.sqrt(ins) : ins;
    { const vel = Math.abs(ue - (frame.pu ?? ue)) / Math.max(dt, 1e-3); frame.pu = ue;
      const tgt = mode === 'room' && !reduced && !L.mobile ? clamp((vel - 0.3) * 0.06, 0, 0.035) : 0;   // subtle: the bezel stays readable mid-dive
      frame.bl = lerp(frame.bl || 0, tgt, 1 - Math.exp(-dt * 12)); const amt = blurForce !== null ? blurForce : frame.bl;
      const amtH = amt * (1 - h); rblur.enabled = amtH > 0.004; rblur.uniforms.uAmt.value = amtH;   // gone before the page takes over: the landing is never smeared
      cam.updateMatrixWorld(); const sp = L.sc.clone().project(cam);   // this frame's camera, not last frame's (a scroll jump would misregister the hand-off) rblur.uniforms.uC.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
      handoff.uniforms.uC.value.copy(rblur.uniforms.uC.value); handoff.uniforms.uZoom.value = Math.max(1, cam.position.distanceTo(L.sc) / L.dHand);  }
    bloom.strength = lerp(mode === 'close' ? 0.35 : 0.55, 0.38, insB) * (1 + 0.03 * Math.sin(elapsed * 2.65) + 0.03 * Math.sin(elapsed * 5.85));
    bloom.threshold = 0.88; bloom.enabled = insB > 0.01 || mode === 'inside'; bloom.strength *= mode === 'inside' ? wp.bloom / 0.38 : insB;   // SCREEN WORLD per-beat bloom
    { const k = mode === 'inside' ? 0 : (1 - insB) * (mode === 'close' ? 0.25 : 0.38) * (1 + 0.9 * dk); bloomMix.enabled = k > 0.01; bloomSel.threshold = 0.8; bloomSel.radius = 0.3; if (bloomMix.enabled && postWarm && !lite) renderSelective(k); }
    bloom.radius = lerp(0.6, 0.6, ins);
    const fu = finalPass.uniforms;
    fu.uTime.value = elapsed;
    fu.uPow.value = lerp(1.06, 1.02, ins);
    fu.uSepia.value = lerp(0, 0.07, ins); fu.uHouse.value = 0.38 * ins;   // one look for the whole screen world
    fu.uCon.value = lerp(1.04, wp.con, ins); fu.uS.value = lerp(0.45, wp.s, ins);   // SCREEN WORLD grade
    fu.uCA.value = 0;   // [clean-screen] fringe only a hint in the room, none inside
    fu.uVig.value = lerp(mode === 'close' ? 0.6 : 0.55, wp.vig, ins);   // SCREEN WORLD
    fu.uLens.value = 0;   // [clean-screen] no CRT barrel on the full-screen world
    fu.uBorder.value = frameAmt;
    fu.uFade.value = fade;
    if (mode === 'room' && (prevH < 0.5) !== (h < 0.5) && !reduced) flashT = elapsed; prevH = mode === 'room' ? h : prevH;
    fu.uFlash.value = Math.max(0, 1 - (elapsed - flashT) / 0.06);
    fu.uGrain.value = 0;   // [clean-screen] no grain anywhere
    { const aoOn = Q.level === 2 && mode !== 'inside' && !direct; gtao.enabled = aoOn; dof.enabled = aoOn && !L.mobile;
      { const du = dof.uniforms;
        if (camOv) { du.uFocus.value = cam.position.distanceTo(camOv.l.clone().applyMatrix4(pc.matrixWorld)); du.uRange.value = camOv.range ?? 0.1; du.uMaxR.value = (camOv.bokeh ?? 4) * L.dofPx; }
        else if (mode === 'close') { du.uFocus.value = cam.position.distanceTo(L.sc); du.uRange.value = 0.5; du.uMaxR.value = 2.5 * L.dofPx; }   // screen + bezel plane sharp
        else { const rk = sstep(0, 1, clamp((elapsed - rackT) / 0.4)); du.uFocus.value = cam.position.distanceTo(L.sc) - 0.3 * rk; du.uRange.value = lerp(0.35, 2.4, rk); du.uMaxR.value = lerp(3, 1.5, rk) * L.dofPx; } }   // 400 ms rack focus back to the whole computer   // whole computer sharp, background falls off dof.uniforms.uAmt.value = mode === 'room' ? 1 - h : 1;
      dof.uniforms.uAmt.value = mode === 'room' && !camOv ? 1 - sstep(0.02, 0.2, s) : 1; if (dof.uniforms.uAmt.value < 0.02) dof.enabled = false;   // no bokeh on the bezel while diving
      glassMat.opacity = mode === 'close' ? 0.6 : 1 - clamp(s / 0.5);   // reflections fade as we dive through the glass
      dof.uniforms.uNear.value = cam.near; dof.uniforms.uFar.value = cam.far; }

    // ----- render -----
    if (mode === 'room' && direct) {
      world.update(s, dt, { mx, my }); world.prepare();   // SCREEN WORLD: native resolution + fov, same path as 'inside'
      renderPass.scene = world.display.scene; renderPass.camera = world.display.cam; handoff.enabled = false;
    } else if (mode === 'room') {
      if (s > 0.012) {
        world.update(s, dt, { mx, my }); world.renderInto(insideRT, L.zoom);   // SCREEN WORLD
      }
      renderPass.scene = room; renderPass.camera = cam; handoff.uniforms.uMix.value = sstep(0.3, 0.9, h); handoff.enabled = h > 0.3 && s > 0.012;   /* registered onto the glass (uC/uZoom), so it can take over early */   // camera settles on the glass first, then the page takes over (no double image)
      if (handoff.enabled) world.renderInto(handRT);   // crisp native-fov frame for the take-over
    } else if (mode === 'inside') {
      world.update(s, dt, { mx, my }); world.prepare();   // SCREEN WORLD
      renderPass.scene = world.display.scene; renderPass.camera = world.display.cam; handoff.enabled = false;
    } else {
      renderPass.scene = room; renderPass.camera = cam; handoff.enabled = false;
      if (exitK < 0.88) { world.update(s, dt, { mx, my }); world.renderInto(insideRT, L.zoom); handoff.uniforms.uMix.value = exitIns; handoff.enabled = exitIns > 0; if (handoff.enabled) world.renderInto(handRT); }   // SCREEN WORLD pull-back
    }
    if (world.active !== (mode === 'inside')) world.setActive(mode === 'inside');   // SCREEN WORLD: overlay + input only while inside
    if (!postWarm) rblur.enabled = false;
    if (!postWarm || lite) { gtao.enabled = dof.enabled = bloom.enabled = bloomMix.enabled = smaa.enabled = false; }   /* lite = software GL: heavy passes stay off */   /* [startup] heavy passes join once their shaders are linked */
    if (Q.level === 0 && !lite) { renderer.setRenderTarget(null); renderer.render(renderPass.scene, renderPass.camera); }   /* lowest preset: scene straight to the canvas, no post chain */
    else composer.render(dt);
    liteRaster = true;
    if (!window.__firstFrame) { window.__firstFrame = Math.round(performance.now()); document.documentElement.dataset.scene = 'on'; }

    // ----- HTML overlays -----
    { const k0 = clamp(s / 0.1), k = k0 * k0 * (3 - 2 * k0); heroUI.style.opacity = (1 - k).toFixed(3); heroUI.style.transform = k > 0.001 ? `translate3d(${(-60 * k).toFixed(1)}px,0,0)` : ''; heroUI.style.filter = ''; showClass(heroUI, 'hide', k >= 1); }   // GPU-only fade+slide (no filter blur: it re-rasterises the big type every frame)
    const idle = heroActive() && !os.typing && !reduced && performance.now() - lastInput > 3000 && !snapping;
    showClass(heroUI, 'idle', false); void idle;   // one hint line only: the idle '▼ scroll, click the screen…' line stays hidden
  }
  /* [startup] link shader programs a few per task instead of one multi-second freeze on the first frame:
     room materials before the first frame, post passes + the screen world in the background */
  const yieldTask = () => new Promise((r) => setTimeout(r, 0));
  async function warm(list, target, camera, rt) {
    let t = performance.now();
    for (const o of list) {
      const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt);
      try { renderer.compile(o, camera, target); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { const pr = m && renderer.properties.get(m).currentProgram; if (pr) pr.getUniforms(); }); } catch (e) { /* compiles on first use instead */ }
      renderer.setRenderTarget(prev);
      if (performance.now() - t > 30) { await yieldTask(); t = performance.now(); }
    }
  }
  const drawables = (root) => { const out = [], seen = new Set(); root.traverse((o) => { if (!(o.isMesh || o.isPoints || o.isSprite || o.isLine)) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; if (ms.some((m) => m && !seen.has(m))) { ms.forEach((m) => seen.add(m)); out.push(o); } }); return out; };
  let postWarm = false;
  const glc = renderer.getContext();
  const gpuIdle = () => new Promise((res) => { if (!glc.fenceSync) { res(); return; } const f = glc.fenceSync(glc.SYNC_GPU_COMMANDS_COMPLETE, 0); glc.flush();
    const poll = () => { if (glc.getSyncParameter(f, glc.SYNC_STATUS) === glc.SIGNALED) { glc.deleteSync(f); res(); } else setTimeout(poll, 25); }; setTimeout(poll, 25); });
  const compileAsyncish = async (scene, camera, rt) => { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); try { renderer.compile(scene, camera); } catch (e) { /* on first use */ } renderer.setRenderTarget(prev); await gpuIdle(); };
  { // queue every room program + texture upload at once (async on the GPU side), then wait on a fence without blocking the page
    const prev = renderer.getRenderTarget(); renderer.setRenderTarget(composer.renderTarget1);
    try { if (isPhone && renderer.compileAsync) await renderer.compileAsync(room, cam); else renderer.compile(room, cam); } catch (e) { /* first use compiles instead */ }
    renderer.setRenderTarget(prev);
    await gpuIdle();
    const texs = new Set(); room.traverse((o) => { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m) Object.values(m).forEach((v) => { if (v && v.isTexture && !v.isRenderTargetTexture) texs.add(v); }); if (m && m.uniforms) Object.values(m.uniforms).forEach((u) => { if (u && u.value && u.value.isTexture && !u.value.isRenderTargetTexture) texs.add(u.value); }); }); });
    let tt = performance.now(); for (const t of texs) { try { renderer.initTexture(t); } catch (e) { /* uploads on first use */ } if (performance.now() - tt > 30) { await yieldTask(); tt = performance.now(); } }
    await gpuIdle();
  }
  if (!(isPhone && renderer.compileAsync)) await warm(drawables(room), room, cam, composer.renderTarget1);
  if (lite) { key.shadow.mapSize.set(512, 512); lampLight.shadow.mapSize.set(256, 256); }   /* software GL: small shadow maps */
  frame();
  (async () => {
    if (lite) { postWarm = true; return; }   /* software GL: nothing heavy to warm; the screen world builds + compiles on the dive */
    if (Q.level === 0) return;   /* lowest preset: no post chain to link or run */
    const quad = new THREE.PlaneGeometry(2, 2), oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), empty = new THREE.Scene(), mats = new Set();
    const grab = (v) => { if (v && v.isMaterial && !v.isMeshNormalMaterial) mats.add(v); else if (Array.isArray(v)) v.forEach(grab); };
    const skip = new Set([lite || Q.level < 2 ? gtao : null, lite || Q.level < 2 ? dof : null, lite || Q.level < 1 ? smaa : null, lite ? bloom : null, lite ? bloomSel : null, lite ? bloomMix : null]);
    [...composer.passes, bloomSel].forEach((p) => { if (skip.has(p)) return; Object.values(p).forEach(grab); if (p.fsQuad) grab(p.fsQuad.material); });
    const last = composer.passes[composer.passes.length - 1], lastMats = new Set(); if (last) { Object.values(last).forEach((v) => v && v.isMaterial && lastMats.add(v)); if (last.fsQuad) lastMats.add(last.fsQuad.material); }
    // queue all links at once (GPU side, async), wait on a fence, then the per-program check is instant
    const qs = [...mats].map((m) => new THREE.Mesh(quad, m));
    for (const q of qs) { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(lastMats.has(q.material) ? null : composer.renderTarget1); try { renderer.compile(q, oc, empty); } catch (e) { /* first use */ } renderer.setRenderTarget(prev); }
    await gpuIdle();
    for (const q of qs) await warm([q], empty, oc, lastMats.has(q.material) ? null : composer.renderTarget1);
    postWarm = true; smaa.enabled = Q.level >= 1; qm.t0 = performance.now();
    await new Promise((r) => setTimeout(r, 400));
    try { if (world.preload && !L.mobile) { world.preload(); await gpuIdle();
      const b0 = world.beats && world.beats[0] && world.beats[0].inst; if (b0) await compileAsyncish(b0.scene, b0.cam, insideRT);
      await compileAsyncish(world.display.scene, world.display.cam, insideRT); } } catch (e) { /* built + compiled on the dive instead */ }   /* phones: the screen world builds on the dive, not during load */
  })();

  function anchor(hsh) {
    const vh = window.innerHeight, sy = window.scrollY;
    let y = null;
    if (hsh === '' || hsh === '#top') y = 0;
    else if (hsh === '#work') y = vh * 1.15;
    else if (hsh === '#bench') y = world.heroY(world.idOf('library')) * vh;   // SCREEN WORLD: the clay library beat
    else if (hsh === '#contact') { const r = contactEl.getBoundingClientRect(); y = r.top + sy + (r.height - vh) * 0.75; }
    if (y === null) return;
    smoothJump(lenis, y, { reduced });   /* [smooth] */
  }

  return {
    anchor,
    bootDone() { bootT = Math.max(bootT, 0.2); powerStart = performance.now() / 1000 + 0.15; if (sound.on) sound.powerOn(); },
    stop() {
      alive = false; cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onCaps); window.removeEventListener('keyup', onCaps); pwrTip.remove(); window.removeEventListener('keydown', onType, { capture: true }); window.removeEventListener('pointerdown', onPickDown); window.removeEventListener('pointerup', onPickUp); if (sndBtn) sndBtn.removeEventListener('click', onSnd); if (sndVol) sndVol.removeEventListener('input', onVol); if (sndWhine) sndWhine.removeEventListener('change', onWhine); showSnd(false); sound.stop(); document.body.style.cursor = ''; window.removeEventListener('wheel', onSnapWheel, { capture: true }); window.removeEventListener('keydown', onSnapKey, { capture: true }); window.removeEventListener('touchstart', onTS, { capture: true }); window.removeEventListener('touchmove', onTM, { capture: true }); window.removeEventListener('resize', onResize);
      heroUI.classList.remove('hide');
      world.dispose(); site.classList.remove('world');   // SCREEN WORLD
      composer.dispose?.(); insideRT.dispose(); handRT.dispose(); renderer.dispose();
    },
    _debug: { renderer, get bake() { return C.bake; }, get frame() { return frameNo; }, key, room, sound, world, L, os, Q, setSL(v) { SL = v; }, setBF(v) { BF = v; }, setKey(v) { KEYK = v; }, setKS(v) { KS = v; }, cam(p, l, f, range, bokeh) { camOv = p ? { p: new V3(...p), l: new V3(...l), f, range, bokeh } : null; }, setQ(l) { Q.level = l; Q.locked = true; applyQuality(); }, power(v) { powerFreeze = v; }, roll(v) { rollFreeze = v; }, blur(v) { blurForce = v; }, get mode() { return mode; }, get post() { return { rblur: rblur.enabled, rAmt: rblur.uniforms.uAmt.value, dof: dof.enabled }; },
      // screen px -> point on the desk plane (pc local) or on the back wall (world)
      probe(px, py, what) {
        const v = new THREE.Vector2((px / W) * 2 - 1, -(py / H) * 2 + 1); const rc = new THREE.Raycaster(); rc.setFromCamera(v, cam);
        const o = rc.ray.origin, d = rc.ray.direction;
        if (what === 'wall') { const t = (-6 - o.z) / d.z; return [o.x + d.x * t, o.y + d.y * t, -6].map((n) => +n.toFixed(2)); }
        const t = (pc.position.y - o.y) / d.y; const w = new V3(o.x + d.x * t, pc.position.y, o.z + d.z * t); pc.worldToLocal(w); return [w.x, w.y, w.z].map((n) => +n.toFixed(2));
      },
      proj(x, y, z) { const w = new V3(x, y, z); pc.localToWorld(w); w.project(cam); return [Math.round((w.x * .5 + .5) * W), Math.round((-w.y * .5 + .5) * H)]; } },
  };
}
