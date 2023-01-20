import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

/**
 * Recursively retrieves file names for each file under <code>dir</code>.
 *
 * <h2>Parameters</h2>
 * - dir: (req) The path to the starting point for the search.
 * - reName: (opt) If set, then the base file name must match <code>reName</code> to be included.
 */
const getFiles = async({
  dir,
  depth,
  ignoreDotFiles = false,
  noRecurse = false,
  onlyDirs = false,
  reName
}) => {
  if (noRecurse === true) depth = 1

  const dirents = await fs.readdir(dir, { withFileTypes : true })

  const files = await Promise.all(dirents.map((dirent) => {
    const res = fsPath.resolve(dir, dirent.name)
    if (dirent.isDirectory()) {
      const newDepth = depth === undefined ? undefined : depth - 1

      const dirResults = onlyDirs === true
          && (ignoreDotFiles === false || !fsPath.basename(res).startsWith('.'))
        ? [res]
        : []
      if (newDepth === 0) /* then it was 1 */ return dirResults

      return (async() => {
        return dirResults.concat(await getFiles({ dir : res, depth : newDepth, onlyDirs, reName }))
      })()
    }
    // else
    if ((reName === undefined || res.match(new RegExp(reName)))
        && (ignoreDotFiles === false || !fsPath.basename(res).startsWith('.'))
        && onlyDirs === false) {
      return res
    }
    return null
  }))
  return files.flat().filter((n) => n !== null)
}

export { getFiles }
