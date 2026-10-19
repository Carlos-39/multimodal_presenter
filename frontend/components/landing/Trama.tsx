"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * La trama del hero: un semitono que respira, y que contesta cuando lo tocas.
 *
 * **Adaptado del PixelBlast de la galería, con el postprocesado fuera.** El original importa
 * `postprocessing` para dos efectos que aquí no se usan (el líquido y el grano) y ese import es de
 * primer nivel, así que entra en el bundle aunque las dos opciones estén apagadas. Quitándolo, la
 * pieza cuesta solo `three`.
 *
 * **Por qué un semitono y no los anillos.** Un dither de Bayer es, literalmente, cómo se imprime
 * un tono continuo con UNA sola tinta, que es exactamente lo que hace esta paleta desde el
 * segundo rediseño. Unos anillos concéntricos son bonitos y no significan nada aquí.
 *
 * **El color entra desde fuera**, leído del token en el momento de montar y re-leído al cambiar de
 * tema. Un lienzo no puede leer CSS por su cuenta: si no se hace esto, el hero se queda con el
 * azul del modo claro cuando el usuario pasa a oscuro.
 *
 * Se para solo cuando no se ve (`IntersectionObserver`) y cuando la pestaña se va, para no estar
 * gastando batería detrás de otra ventana.
 */
interface TramaProps {
  /** Tamaño del punto, en px de pantalla. */
  pixelSize?: number;
  /** Escala del patrón: más alto, grano más fino. */
  patternScale?: number;
  patternDensity?: number;
  speed?: number;
  /** Cuánto se apaga hacia los bordes, de 0 a 0.5. */
  edgeFade?: number;
  opacity?: number;
  variant?: "square" | "circle" | "diamond";
}

const FORMA = { square: 0, circle: 1, diamond: 3 } as const;
const MAX_CLICS = 10;

const VERT = `void main(){ gl_Position = vec4(position, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec3 uColor;
uniform vec2 uResolution;
uniform float uTime, uPixelSize, uScale, uDensity, uEdgeFade, uOpacity;
uniform float uRippleSpeed, uRippleThickness, uRippleIntensity;
uniform int uShapeType;
uniform vec2 uClickPos[${MAX_CLICS}];
uniform float uClickTimes[${MAX_CLICS}];
out vec4 fragColor;

float Bayer2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p), fp = fract(p);
  float n000=hash11(dot(ip+vec3(0,0,0),vec3(1,57,113)));
  float n100=hash11(dot(ip+vec3(1,0,0),vec3(1,57,113)));
  float n010=hash11(dot(ip+vec3(0,1,0),vec3(1,57,113)));
  float n110=hash11(dot(ip+vec3(1,1,0),vec3(1,57,113)));
  float n001=hash11(dot(ip+vec3(0,0,1),vec3(1,57,113)));
  float n101=hash11(dot(ip+vec3(1,0,1),vec3(1,57,113)));
  float n011=hash11(dot(ip+vec3(0,1,1),vec3(1,57,113)));
  float n111=hash11(dot(ip+vec3(1,1,1),vec3(1,57,113)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00=mix(n000,n100,w.x), x10=mix(n010,n110,w.x);
  float x01=mix(n001,n101,w.x), x11=mix(n011,n111,w.x);
  return mix(mix(x00,x10,w.y), mix(x01,x11,w.y), w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0, freq = 1.0, sum = 1.0;
  for (int i = 0; i < 5; ++i){ sum += amp * vnoise(p * freq); freq *= 1.25; }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}
float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspect = uResolution.x / uResolution.y;
  vec2 pixelUV = fract(fragCoord / uPixelSize);
  float cellPx = 8.0 * uPixelSize;
  vec2 uv = (floor(fragCoord / cellPx) * cellPx) / uResolution * vec2(aspect, 1.0);

  float base = fbm2(uv, uTime * 0.05) * 0.5 - 0.65;
  float feed = base + (uDensity - 0.5) * 0.3;

  for (int i = 0; i < ${MAX_CLICS}; ++i){
    vec2 pos = uClickPos[i];
    if (pos.x < 0.0) continue;
    vec2 cuv = ((pos - uResolution * .5 - cellPx * .5) / uResolution) * vec2(aspect, 1.0);
    float t = max(uTime - uClickTimes[i], 0.0);
    float r = distance(uv, cuv);
    float ring = exp(-pow((r - uRippleSpeed * t) / uRippleThickness, 2.0));
    feed = max(feed, ring * exp(-t) * exp(-10.0 * r) * uRippleIntensity);
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float cov = step(0.5, feed + bayer);
  float M = uShapeType == 1 ? maskCircle(pixelUV, cov)
          : uShapeType == 3 ? maskDiamond(pixelUV, cov)
          : cov;

  if (uEdgeFade > 0.0) {
    vec2 n = gl_FragCoord.xy / uResolution;
    float edge = min(min(n.x, n.y), min(1.0 - n.x, 1.0 - n.y));
    M *= smoothstep(0.0, uEdgeFade, edge);
  }

  vec3 srgb = mix(uColor * 12.92, 1.055 * pow(uColor, vec3(1.0/2.4)) - 0.055, step(0.0031308, uColor));
  fragColor = vec4(srgb, M * uOpacity);
}
`;

/** El acento, leído del token. Un lienzo no sabe de CSS. */
function leerAcento(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  return v || "#1e3c84";
}

export function Trama({
  pixelSize = 4,
  patternScale = 2.4,
  patternDensity = 1.05,
  speed = 0.45,
  edgeFade = 0.35,
  opacity = 0.55,
  variant = "square",
}: TramaProps) {
  const monte = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = monte.current;
    if (!nodo) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // sin WebGL no hay trama, y la portada funciona igual
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    nodo.appendChild(renderer.domElement);

    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(leerAcento()) },
      uPixelSize: { value: pixelSize * renderer.getPixelRatio() },
      uScale: { value: patternScale },
      uDensity: { value: patternDensity },
      uEdgeFade: { value: edgeFade },
      uOpacity: { value: opacity },
      uShapeType: { value: FORMA[variant] },
      uRippleSpeed: { value: 0.32 },
      uRippleThickness: { value: 0.11 },
      uRippleIntensity: { value: 1.4 },
      uClickPos: { value: Array.from({ length: MAX_CLICS }, () => new THREE.Vector2(-1, -1)) },
      uClickTimes: { value: new Float32Array(MAX_CLICS) },
    };

    const escena = new THREE.Scene();
    const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      glslVersion: THREE.GLSL3,
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    escena.add(new THREE.Mesh(geo, material));

    const medir = () => {
      const w = nodo.clientWidth || 1;
      const h = nodo.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
      uniforms.uPixelSize.value = pixelSize * renderer.getPixelRatio();
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(nodo);

    // El tema cambia el token: hay que volver a leerlo o el hero se queda con el azul del otro
    // modo. El atributo `data-theme` en la raíz es lo que mueve el conmutador de la aplicación.
    const mo = new MutationObserver(() => uniforms.uColor.value.set(leerAcento()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    let iClic = 0;
    const alPulsar = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      const ex = renderer.domElement.width / r.width;
      const ey = renderer.domElement.height / r.height;
      uniforms.uClickPos.value[iClic].set(
        (e.clientX - r.left) * ex,
        (r.height - (e.clientY - r.top)) * ey,
      );
      uniforms.uClickTimes.value[iClic] = uniforms.uTime.value;
      iClic = (iClic + 1) % MAX_CLICS;
    };
    // En la ventana y no en el lienzo: el lienzo está detrás del titular y no recibe punteros.
    window.addEventListener("pointerdown", alPulsar, { passive: true });

    const reloj = new THREE.Clock();
    let raf = 0;
    let aLaVista = false;
    let pestanaViva = !document.hidden;
    const pintar = () => {
      uniforms.uTime.value = reloj.getElapsedTime() * speed;
      renderer.render(escena, camara);
      raf = requestAnimationFrame(pintar);
    };
    const arrancar = () => {
      if (aLaVista && pestanaViva && !raf) raf = requestAnimationFrame(pintar);
    };
    const parar = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver(([e]) => {
      aLaVista = e.isIntersecting;
      if (aLaVista) arrancar();
      else parar();
    });
    io.observe(nodo);
    const visibilidad = () => {
      pestanaViva = !document.hidden;
      if (pestanaViva) arrancar();
      else parar();
    };
    document.addEventListener("visibilitychange", visibilidad);
    arrancar();

    return () => {
      parar();
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", visibilidad);
      window.removeEventListener("pointerdown", alPulsar);
      if (renderer.domElement.parentElement === nodo) nodo.removeChild(renderer.domElement);
      geo.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [pixelSize, patternScale, patternDensity, speed, edgeFade, opacity, variant]);

  return <div ref={monte} aria-hidden className="h-full w-full" />;
}
