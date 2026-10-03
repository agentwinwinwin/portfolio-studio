import { useEffect, useRef } from 'react'
import { Renderer, Program, Mesh, Triangle } from 'ogl'
import './GradientWaves.css'

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [1, 1, 1]
  return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
}

const detailToSteps = detail => (detail === 'low' ? 40 : detail === 'high' ? 110 : 70)

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uTilt;
uniform float uZoom;
uniform float uHeight;
uniform float uFogDepth;
uniform float uSteps;
uniform float uBrightness;
uniform float uOpacity;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec2 uMouse;
uniform float uParallax;
uniform bool uEnableMouse;
uniform vec3 uHorizonColor;
uniform vec3 uWaveColor;
uniform vec3 uCrestColor;
out vec4 fragColor;
const float MAX_DIST = 20000.0;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);
  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);
  return r.z - (sin(mx * freq.x) * uAmplitude + sin(my * freq.y) * uAmplitude + uHeight);
}

float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float dscene = plasma(pos + dist * dir, freq, tc);
    if (abs(dscene) < 0.1) break;
    dist += 0.9 * dscene;
    if (!(abs(dist) < MAX_DIST)) return MAX_DIST;
  }
  return dist;
}

void main() {
  float T = iTime * uSpeed;
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(T / 0.130, T / 0.810, T / 0.200, T / 0.710);
  float c, s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, 30.0);
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;
  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot); s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  c = nuv.x; s = nuv.y;
  dir = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt); s = sin(uTilt);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
  if (uEnableMouse) {
    float yaw = (uMouse.x - 0.5) * uParallax * 0.4;
    float pitch = (uMouse.y - 0.5) * uParallax * 0.4;
    c = cos(yaw); s = sin(yaw);
    dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
    c = cos(pitch); s = sin(pitch);
    dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  }
  float dist = raymarch(cam, dir, freq, tc);
  vec3 pos = cam + dist * dir;
  float t = clamp(uFogDepth / max(dist, 0.001), 0.0, 1.0);
  vec3 body = mix(uWaveColor, uCrestColor, clamp(pos.z * 0.08 + 0.5, 0.0, 1.0));
  vec3 col = clamp(mix(uHorizonColor, body, t) * uBrightness, 0.0, 1.0);
  float alpha = clamp(t, 0.0, 1.0) * uOpacity;
  if (uGrain > 0.5) {
    float g = hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0);
    alpha += (g - 0.5) * uGrainIntensity;
  }
  alpha = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha);
}
`

const contexts = new WeakMap()

export default function GradientWaves({
  horizonColor = '#5227ff', waveColor = '#ff9ffc', crestColor = '#ffffff',
  speed = 0.4, amplitude = 2.5, waveScale = 0.6, waveRatio = 0.9,
  swell = 35, turbulence = 20, tilt = 1.11, zoom = 1, height = 5.5,
  fogDepth = 15, detail = 'medium', brightness = 1, opacity = 1,
  mouseInteraction = true, parallaxStrength = 0.5, grain = true,
  grainIntensity = 0.05, className = '',
  active = true,
}) {
  const containerRef = useRef(null)
  const enableMouseRef = useRef(mouseInteraction)
  const activeRef = useRef(active)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    let renderer
    try {
      renderer = new Renderer({ webgl: 2, alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance', dpr: Math.min(window.devicePixelRatio || 1, 1.5) })
    } catch {
      container.dataset.webglFallback = 'true'
      return undefined
    }
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    const canvas = gl.canvas
    Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block' })
    container.appendChild(canvas)
    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex, fragment,
      uniforms: {
        iTime: { value: 0 }, iResolution: { value: new Float32Array([1, 1]) },
        uSpeed: { value: 0.4 }, uAmplitude: { value: 2.5 }, uWaveScale: { value: 0.6 },
        uWaveRatio: { value: 0.9 }, uSwell: { value: 35 }, uTurbulence: { value: 20 },
        uTilt: { value: 1.11 }, uZoom: { value: 1 }, uHeight: { value: 5.5 },
        uFogDepth: { value: 15 }, uSteps: { value: 70 }, uBrightness: { value: 1 },
        uOpacity: { value: 1 }, uGrain: { value: 1 }, uGrainIntensity: { value: 0.05 },
        uMouse: { value: new Float32Array([0.5, 0.5]) }, uParallax: { value: 0.5 },
        uEnableMouse: { value: true }, uHorizonColor: { value: new Float32Array([1, 1, 1]) },
        uWaveColor: { value: new Float32Array([1, 1, 1]) }, uCrestColor: { value: new Float32Array([1, 1, 1]) },
      },
    })
    const mesh = new Mesh(gl, { geometry, program })
    const setSize = () => {
      const rect = container.getBoundingClientRect()
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)))
      program.uniforms.iResolution.value.set([gl.drawingBufferWidth, gl.drawingBufferHeight])
      renderer.render({ scene: mesh })
    }
    const resizeObserver = new ResizeObserver(setSize)
    resizeObserver.observe(container)
    setSize()
    const currentMouse = [0.5, 0.5]
    const targetMouse = [0.5, 0.5]
    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      targetMouse[0] = (event.clientX - rect.left) / rect.width
      targetMouse[1] = 1 - (event.clientY - rect.top) / rect.height
    }
    const onPointerLeave = () => { targetMouse[0] = 0.5; targetMouse[1] = 0.5 }
    if (enableMouseRef.current) {
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerleave', onPointerLeave)
    }
    let raf = 0
    let visible = true
    let pageVisible = !document.hidden
    const startedAt = performance.now()
    const loop = (time) => {
      program.uniforms.iTime.value = (time - startedAt) * 0.001
      const tx = enableMouseRef.current ? targetMouse[0] : 0.5
      const ty = enableMouseRef.current ? targetMouse[1] : 0.5
      currentMouse[0] += 0.05 * (tx - currentMouse[0])
      currentMouse[1] += 0.05 * (ty - currentMouse[1])
      program.uniforms.uMouse.value.set(currentMouse)
      renderer.render({ scene: mesh })
      raf = requestAnimationFrame(loop)
    }
    const start = () => { if (activeRef.current && visible && pageVisible && raf === 0) raf = requestAnimationFrame(loop) }
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0 } }
    contexts.set(container, { renderer, program, mesh, start, stop })
    const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop() })
    intersectionObserver.observe(container)
    const onVisibility = () => { pageVisible = !document.hidden; pageVisible ? start() : stop() }
    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => {
      stop(); resizeObserver.disconnect(); intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      if (enableMouseRef.current) {
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerleave', onPointerLeave)
      }
      contexts.delete(container)
      if (canvas.parentNode === container) container.removeChild(canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  useEffect(() => {
    const context = contexts.get(containerRef.current)
    if (!context) return
    const u = context.program.uniforms
    enableMouseRef.current = mouseInteraction
    u.uSpeed.value = speed; u.uAmplitude.value = amplitude; u.uWaveScale.value = waveScale
    u.uWaveRatio.value = waveRatio; u.uSwell.value = swell; u.uTurbulence.value = turbulence
    u.uTilt.value = tilt; u.uZoom.value = zoom; u.uHeight.value = height; u.uFogDepth.value = fogDepth
    u.uSteps.value = detailToSteps(detail); u.uBrightness.value = brightness; u.uOpacity.value = opacity
    u.uGrain.value = grain ? 1 : 0; u.uGrainIntensity.value = grainIntensity
    u.uParallax.value = parallaxStrength; u.uEnableMouse.value = mouseInteraction
    u.uHorizonColor.value.set(hexToRgb(horizonColor)); u.uWaveColor.value.set(hexToRgb(waveColor)); u.uCrestColor.value.set(hexToRgb(crestColor))
  }, [horizonColor, waveColor, crestColor, speed, amplitude, waveScale, waveRatio, swell, turbulence, tilt, zoom, height, fogDepth, detail, brightness, opacity, grain, grainIntensity, mouseInteraction, parallaxStrength])

  useEffect(() => {
    activeRef.current = active
    const context = contexts.get(containerRef.current)
    if (!context) return
    active ? context.start() : context.stop()
  }, [active])

  return <div ref={containerRef} className={`gradient-waves-container ${className}`.trim()} />
}
