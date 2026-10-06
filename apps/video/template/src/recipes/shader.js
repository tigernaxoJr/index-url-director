// Recipe: a flowing light-and-color background drawn by a GLSL fragment shader (plain WebGL, no
// library). Put `elements` text on top. For hook / cta / section openers that need texture.
//
//   import shader from '../../../src/recipes/shader.js'
//   export default shader({ colors: ['#0f172a', '#0c4a6e', '#38bdf8'], speed: 0.6 })
//
// Custom look: pass `fragment`, a GLSL ES 1.0 body that sets gl_FragColor from
// uv (0–1), uTime (seconds) and uColor0..2 (vec3).

const VERTEX = `attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const FLOW = `
  float n = sin(uv.x * 3.0 + uTime * 0.7) + sin(uv.y * 4.0 - uTime * 0.5) + sin((uv.x + uv.y) * 5.0 + uTime * 0.9);
  float band = smoothstep(0.0, 1.0, 0.5 + 0.25 * n);
  vec3 col = mix(uColor0, uColor1, band);
  float glow = pow(max(0.0, 1.0 - abs(uv.y - 0.5 - 0.18 * sin(uv.x * 4.0 + uTime))) , 12.0);
  col += uColor2 * glow * 0.8;
  gl_FragColor = vec4(col, 1.0);
`

/**
 * @param {object} [o]
 * @param {string[]} [o.colors]   three hex colors: base, secondary, highlight (default: theme)
 * @param {number} [o.speed=1]    time multiplier
 * @param {string} [o.fragment]   custom GLSL body (see above)
 */
export default function shader(o = {}) {
  return (ctx) => {
    const c = document.createElement('canvas')
    c.width = ctx.width
    c.height = ctx.height
    Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
    ctx.root.append(c)
    // preserveDrawingBuffer: the frame must still be there when the renderer takes the screenshot.
    const gl = c.getContext('webgl', { preserveDrawingBuffer: true, antialias: true })
    if (!gl) throw new Error('WebGL is not available in this browser')
    const fragment = `precision highp float; varying vec2 uv; uniform float uTime; uniform vec3 uColor0, uColor1, uColor2;
      void main() { ${o.fragment ?? FLOW} }`
    const program = gl.createProgram()
    for (const [type, src] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]]) {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s)}`)
      gl.attachShader(program, s)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`shader: ${gl.getProgramInfoLog(program)}`)
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const colors = o.colors ?? ['#0f172a', '#0c4a6e', ctx.theme.accent]
    colors.forEach((hex, i) => gl.uniform3fv(gl.getUniformLocation(program, `uColor${i}`), rgb(hex)))
    const uTime = gl.getUniformLocation(program, 'uTime')
    gl.viewport(0, 0, c.width, c.height)

    return (t) => {
      gl.uniform1f(uTime, t * (o.speed ?? 1))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }
}

const rgb = (hex) => {
  const v = parseInt(hex.replace('#', ''), 16)
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}
