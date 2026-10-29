/**
 * pdf.js v6 uses the stage-3 Uint8Array hex/base64 helpers. They exist in
 * recent V8 versions but not in every browser build we have to support, so we
 * fill the gaps once, before the PDF viewer is imported.
 */

type HexArray = Uint8Array & { toHex?: () => string; toBase64?: () => string }
type HexConstructor = Uint8ArrayConstructor & {
  fromHex?: (value: string) => Uint8Array
  fromBase64?: (value: string) => Uint8Array
}

const proto = Uint8Array.prototype as HexArray
const ctor = Uint8Array as HexConstructor

if (typeof proto.toHex !== 'function') {
  Object.defineProperty(proto, 'toHex', {
    configurable: true,
    writable: true,
    value(this: Uint8Array) {
      let out = ''
      for (let i = 0; i < this.length; i += 1) out += this[i].toString(16).padStart(2, '0')
      return out
    },
  })
}

if (typeof ctor.fromHex !== 'function') {
  Object.defineProperty(ctor, 'fromHex', {
    configurable: true,
    writable: true,
    value(value: string) {
      const clean = value.length % 2 === 0 ? value : `0${value}`
      const out = new Uint8Array(clean.length / 2)
      for (let i = 0; i < out.length; i += 1) {
        out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
      }
      return out
    },
  })
}

if (typeof proto.toBase64 !== 'function') {
  Object.defineProperty(proto, 'toBase64', {
    configurable: true,
    writable: true,
    value(this: Uint8Array) {
      let binary = ''
      const chunk = 8192
      for (let i = 0; i < this.length; i += chunk) {
        binary += String.fromCharCode(...this.subarray(i, i + chunk))
      }
      return btoa(binary)
    },
  })
}

if (typeof ctor.fromBase64 !== 'function') {
  Object.defineProperty(ctor, 'fromBase64', {
    configurable: true,
    writable: true,
    value(value: string) {
      const binary = atob(value)
      const out = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
      return out
    },
  })
}
