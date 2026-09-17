/** Byte-signature helpers used by the extractor strategies for content sniffing. */

const startsWith = (bytes: Uint8Array, sig: readonly number[]): boolean => sig.every((b, i) => bytes[i] === b)

export const isPdf = (data: ArrayBuffer): boolean =>
  startsWith(new Uint8Array(data, 0, 5), [0x25, 0x50, 0x44, 0x46, 0x2d]) // %PDF-

/** ZIP local-file header — every OOXML package (.docx) starts with it. */
export const isZip = (data: ArrayBuffer): boolean =>
  startsWith(new Uint8Array(data, 0, 4), [0x50, 0x4b, 0x03, 0x04])

/** OLE2 compound document — the container of legacy Word 97–2003 `.doc` files. */
export const isOle = (data: ArrayBuffer): boolean =>
  startsWith(new Uint8Array(data, 0, 8), [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

export const hasExtension = (name: string, ext: string): boolean => name.toLowerCase().endsWith(ext)
