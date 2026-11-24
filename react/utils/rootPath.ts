/**
 * The path prefix of the store binding, ready to put in front of an absolute
 * path. A binding without a prefix can report `/`, which would otherwise
 * produce links such as `//business-application`, which browsers read as
 * another website.
 */
export function normalizeRootPath(rootPath?: string) {
  return rootPath ? rootPath.replace(/\/+$/, '') : ''
}
