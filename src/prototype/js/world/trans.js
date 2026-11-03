// Screen world: full-frame transitions between two beat renders (A -> B), all original:
// 1 channel  CRT channel change: vertical roll, sync tear, static burst, settle
// 2 squash   clay-press wipe: a wobbly clay blob squashes open from a point, rim shaded like clay
// 3 scan     scanline dissolve: interlaced rows switch over behind a bright scan bar
// 4 vhs      VHS tracking tear: a tracking band crawls up, smearing and chroma-splitting the cut
// 5 floppy   floppy insert swap: A ejects downward, a metal shutter slides across, B clicks in from above
import * as THREE from 'three';

export const MODES = { none: 0, channel: 1, squash: 2, scan: 3, vhs: 4, floppy: 5, glide: 6 };

export function makeTransMat() {
  return new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tA: { value: null }, tB: { value: null }, uP: { value: 0 }, uMode: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      uniform sampler2D tA, tB; uniform float uP, uMode, uTime, uAspect; uniform vec2 uC, uRes; varying vec2 vUv;
      float h1(float n){ return fract(sin(n) * 43758.5453); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float vn(float x){ float i = floor(x), f = fract(x); f = f*f*(3.-2.*f); return mix(h1(i), h1(i+1.), f); }
      vec3 A(vec2 uv){ return texture2D(tA, clamp(uv, 0., 1.)).rgb; }
      vec3 B(vec2 uv){ return texture2D(tB, clamp(uv, 0., 1.)).rgb; }
      float lum(vec3 c){ return dot(c, vec3(.3,.55,.15)); }
      float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
      void main(){
        vec2 uv = vUv; float p = clamp(uP, 0., 1.); vec3 col;
        int m = int(uMode + .5);
        if (m == 0) { col = A(uv); }
        else if (m == 1) {
          // ---- CRT channel change
          float a = smoothstep(0., .48, p), b = 1. - smoothstep(.52, 1., p);
          float k = p < .5 ? a : b;                         // disturbance envelope
          float roll = (p < .5 ? a * a * 1.6 : -(b * b) * .9);
          vec2 q = uv; q.y = fract(q.y + roll);
          float line = floor(q.y * uRes.y / 3.);
          q.x += (vn(line * .2 + uTime * 40.) - .5) * .08 * k + sin(q.y * 60. + uTime * 30.) * .004 * k;
          vec3 src = p < .5 ? A(q) : B(q);
          float bar = smoothstep(.0, .06, abs(fract(uv.y + roll) - .0)) * smoothstep(.0, .06, abs(1. - fract(uv.y + roll)));
          src *= mix(1., bar, k);
          float st = h2(floor(uv * uRes / 2.) + floor(uTime * 60.));
          vec3 stat = vec3(st) * vec3(.95, .9, 1.05) * .9;
          float sk = smoothstep(.25, .5, p) * (1. - smoothstep(.5, .72, p));
          col = mix(src * (1. - .4 * k), stat, sk);
          // horizontal hold line flash at the cut
          col += vec3(1., .9, .8) * exp(-pow((uv.y - .5) * 40., 2.)) * smoothstep(.4, .5, p) * (1. - smoothstep(.5, .6, p)) * 2.;
          col.r = mix(col.r, (p < .5 ? A(q + vec2(.006 * k, 0.)) : B(q + vec2(.006 * k, 0.))).r * (1. - .4 * k), k * (1. - sk));
        }
        else if (m == 2) {
          // ---- clay press: wobbly blob with squash and stretch and a lit clay rim
          vec2 d = (uv - uC) * vec2(uAspect, 1.);
          float e = smoothstep(0., 1., p);
          float sq = 1. + .22 * sin(e * 9.) * (1. - e);       // squash / stretch wobble while it opens
          d *= vec2(1. / sq, sq);
          float ang = atan(d.y, d.x);
          float wob = .05 * sin(ang * 5. + p * 6.) + .03 * sin(ang * 9. - p * 9.) + .02 * sin(ang * 3. + 1.7);
          float R = pow(e, 1.7) * (length(vec2(uAspect, 1.)) * .62 + .14);
          float sd = length(d) - R * (1. + wob * (1. - e * .7));
          float rim = .11 * (1. - e * .5);
          vec2 bulge = -d * .08 * smoothstep(-.25, 0., sd) * (1. - e);
          vec3 cb = B(uv + bulge / vec2(uAspect, 1.));
          vec3 ca = A(uv - d * .03 * e);
          float t = clamp(-sd / rim, 0., 1.);
          // rim shading: a rounded clay lip lit from top-left
          vec2 nrm = normalize(d + 1e-5);
          float lit = .55 + .45 * dot(nrm, normalize(vec2(-.6, .8))) * (1. - t);
          vec3 clay = mix(vec3(.85, .52, .36), vec3(.98, .78, .6), lit) * (.75 + .25 * t);
          float shadow = smoothstep(.12, 0., sd) * .55 * (1. - e * .5);
          col = sd > 0. ? ca * (1. - shadow) : mix(clay, cb, smoothstep(.35, 1., t));
          col += vec3(1., .9, .8) * smoothstep(.02, 0., abs(sd + rim * .3)) * .25 * (1. - e);
          if (sd > -.002 && sd < 0.) col = clay * .7;
          if (p >= .999) col = B(uv);
        }
        else if (m == 3) {
          // ---- scanline dissolve
          float row = floor(uv.y * uRes.y / 4.);
          float th = mix(h1(row * 1.7) * .35 + (1. - uv.y) * .65, h1(row * .3), .15);
          float s = smoothstep(th - .06, th + .06, p * 1.12 - .06);
          float front = exp(-pow((p * 1.12 - .06 - th) * 22., 2.));
          vec2 qa = uv + vec2((h1(row) - .5) * .05 * front, 0.);
          col = mix(A(qa), B(uv), s);
          col += vec3(1., .86, .7) * front * .35;
          col *= 1. - .18 * step(.5, fract(uv.y * uRes.y / 4.)) * (1. - abs(p * 2. - 1.));
        }
        else if (m == 4) {
          // ---- VHS tracking tear
          float y0 = 1.15 - p * 1.3;                         // tear front moving up the frame
          float band = exp(-pow((uv.y - y0) * 7., 2.));
          float jitter = (vn(uv.y * 80. + uTime * 25.) - .5) * .12 * band + (vn(uv.y * 9. - uTime * 3.) - .5) * .02 * (1. - abs(p * 2. - 1.));
          vec2 q = uv + vec2(jitter, 0.);
          float useB = step(y0, uv.y);
          float ca = .012 * band + .003;
          vec3 c1 = mix(A(q), B(q), useB);
          vec3 cr = mix(A(q + vec2(ca, 0.)), B(q + vec2(ca, 0.)), useB), cbl = mix(A(q - vec2(ca, 0.)), B(q - vec2(ca, 0.)), useB);
          col = vec3(cr.r, c1.g, cbl.b);
          float noise = h2(vec2(floor(uv.x * uRes.x / 3.), floor(uv.y * uRes.y / 2.)) + floor(uTime * 50.));
          col = mix(col, vec3(noise), band * .55 * step(.6, h1(floor(uv.y * 90.) + floor(uTime * 20.))));
          col = mix(col, vec3(lum(col)) * vec3(1.05, .95, 1.1), band * .4);
          col += vec3(.9, .85, 1.) * smoothstep(.006, 0., abs(uv.y - y0)) * .6;
        }
        else if (m == 6) {
          // ---- glide: soft dolly-through cross-dissolve (smooth, no glitch)
          float e = p * p * p * (p * (p * 6. - 15.) + 10.);
          float bl = sin(3.14159 * p) * .0035;
          vec2 ca = .5 + (uv - .5) * (1. - .07 * e), cb = .5 + (uv - .5) * (1. - .05 * (1. - e));
          vec3 a = (A(ca) * 2. + A(ca + vec2(bl, 0.)) + A(ca - vec2(bl, 0.)) + A(ca + vec2(0., bl)) + A(ca - vec2(0., bl))) / 6.;
          vec3 b = (B(cb) * 2. + B(cb + vec2(bl, 0.)) + B(cb - vec2(bl, 0.)) + B(cb + vec2(0., bl)) + B(cb - vec2(0., bl))) / 6.;
          col = mix(a, b, e);
        }
        else if (m == 5) {
          // ---- floppy swap: the frame shrinks into a floppy (metal shutter + label) and ejects down while the next one
          // drops in from above and opens up; the two disks cross mid-way
          col = vec3(.03, .03, .1) + .03 * step(.97, fract(uv.x * 24.)) + .03 * step(.97, fract(uv.y * 16.));
          for (int k = 0; k < 2; k++) {
            bool isB = k == 0;                                   // B drawn first (behind), A on top
            float q = isB ? clamp((1. - p) / .78, 0., 1.) : clamp(p / .78, 0., 1.);
            float shrink = smoothstep(0., .4, q), drop = smoothstep(.35, 1., q);
            if (q >= 1.) continue;
            float sc = mix(1., .48, shrink);
            vec2 cc = vec2(.5 + (isB ? .05 : -.05) * drop, .5 + (isB ? 1. : -1.) * drop * .95);
            vec2 lp = (uv - cc) / sc + .5;
            vec2 ap = (lp - .5) * vec2(uAspect, 1.);
            float sdc = sdRR(ap, vec2(.5 * uAspect, .5), .06 * shrink + .001);
            float dk = shrink;
            col *= 1. - .45 * smoothstep(.09, .0, sdc - .02) * dk * step(0., sdc);   // drop shadow
            if (sdc > .003) continue;
            vec3 img = isB ? B(lp) : A(lp);
            float shut = step(abs(lp.x - .5), .19) * step(.8, lp.y);
            float shutWin = step(abs(lp.x - .55), .05) * step(.84, lp.y) * step(lp.y, .96);
            vec3 metal = vec3(.66, .68, .74) + (h2(vec2(floor(lp.y * 300.), 2.)) - .5) * .08 - .12 * smoothstep(.8, 1., lp.y);
            metal = mix(metal, vec3(.08, .07, .1), shutWin);
            float lab = step(abs(lp.x - .5), .36) * step(lp.y, .2) * step(.03, lp.y);
            vec3 labc = vec3(.96, .91, .83) - .25 * step(.6, fract(lp.y * 22.)) * step(lp.y, .15) * step(.08, lp.y) * step(abs(lp.x - .5), .3);
            labc = mix(labc, vec3(.76, .25, .18), step(.16, lp.y) * step(lp.y, .2));
            vec3 card = img * mix(1., .6, dk);
            card = mix(card, metal, shut * dk); card = mix(card, labc, lab * dk);
            card += vec3(1., .95, .9) * smoothstep(.004, 0., abs(sdc)) * .3 * dk;
            col = mix(col, card, 1. - smoothstep(-.003, .003, sdc));
          }
        }
        gl_FragColor = vec4(max(col, 0.), 1.);
      }`,
  });
}
