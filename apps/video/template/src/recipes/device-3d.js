// Recipe (needs Three.js: pnpm add three): a laptop or phone in 3D showing a screenshot, turning
// slowly toward the viewer. For solution / feature when a flat screenshot feels static.
//
//   import device3d from '../../../src/recipes/device-3d.js'
//   export default device3d({ image: new URL('./capture.png', import.meta.url), kind: 'laptop' })
import * as THREE from 'three'
import { ease, progress, timeOf } from './util.js'

/**
 * @param {object} o
 * @param {URL|string} o.image          screenshot shown on the screen (load it relative to motion.js)
 * @param {'laptop'|'phone'} [o.kind='laptop']
 * @param {number|{cue:number}} [o.at=0]  when the turn starts
 * @param {number} [o.duration=2.4]      seconds of the turn; afterwards it keeps floating gently
 * @param {number} [o.from=-0.7]         start angle (radians, around the vertical axis)
 */
export default function device3d(o) {
  return async (ctx) => {
    const { width: w, height: h, theme } = ctx
    ctx.root.style.background = theme.background
    // preserveDrawingBuffer: the frame must still be there when the renderer takes the screenshot.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(w, h, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
    ctx.root.append(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100)
    camera.position.set(0, 0.6, 8.5)
    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const key = new THREE.DirectionalLight(0xffffff, 2)
    key.position.set(3, 4, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(new THREE.Color(theme.accent), 1.5)
    rim.position.set(-4, 2, -3)
    scene.add(rim)

    const texture = await new THREE.TextureLoader().loadAsync(String(o.image))
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const aspect = texture.image.width / texture.image.height
    const body = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35 })
    const screen = new THREE.MeshBasicMaterial({ map: texture })
    const device = new THREE.Group()

    if ((o.kind ?? 'laptop') === 'phone') {
      const sh = 3.4
      const sw = Math.min(sh * aspect, 1.9)
      device.add(new THREE.Mesh(new THREE.BoxGeometry(sw + 0.16, sh + 0.2, 0.16), body))
      const display = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screen)
      display.position.z = 0.081
      device.add(display)
    } else {
      const sw = 3.6
      const sh = Math.min(sw / aspect, 2.6)
      const lid = new THREE.Group()
      lid.add(new THREE.Mesh(new THREE.BoxGeometry(sw + 0.2, sh + 0.2, 0.08), body))
      const display = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screen)
      display.position.z = 0.041
      lid.add(display)
      lid.position.set(0, sh / 2 + 0.05, -0.1)
      lid.rotation.x = -0.12
      const base = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.4, 0.1, 2.3), body)
      base.position.set(0, 0, 1.05)
      device.add(lid, base)
      device.position.y = -0.9
    }
    scene.add(device)

    const start = timeOf(ctx, o.at, 0)
    const duration = o.duration ?? 2.4
    const from = o.from ?? -0.7
    return (t) => {
      const p = ease.inOut(progress(t, start, duration))
      device.rotation.y = from * (1 - p) + Math.sin(t * 0.6) * 0.04
      device.position.y = (o.kind === 'phone' ? 0 : -0.9) + Math.sin(t * 0.9) * 0.05
      camera.position.z = 8.5 - p // dolly in as it turns
      camera.lookAt(0, 0.2, 0)
      renderer.render(scene, camera)
    }
  }
}
