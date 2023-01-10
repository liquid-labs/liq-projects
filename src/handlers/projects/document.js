import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import walk from 'walkdir'

import { getFiles } from './_lib/get-files'
import { getPackageData } from './_lib/get-package-data'

const help = {
  name: 'Local project document',
  summary: 'Generates developer documents for local projects.',
  description: 'Generates developer documentation for <em>local<rst> projects which have been imported to the liq playground.'
}

const method = 'put'
const path = [ 'orgs', ':localOrgKey', 'projects', ':projectName']
const parameters = [
  {
    name: 'ignoreDocumentationImplementation',
    isBoolean: true,
    description: 'If set to true, then a missing <code>implementation:documentation<rst> label will not cause the process to exit.'
  }
]

const func = ({ app, model }) => {
  app.commonPathResolvers['localOrgKey'] = {
    optionsFetcher: async () => {
      // TODO: we really want to see the endpoint parameters so we can properly handle when 'currentOrgKey' is set
      // TODO: this is a good case for using the cache
      const liqPlayground = process.env.LIQ_HOME || fsPath.join(process.env.HOME, '.liq', 'playground')
      const absDirs = await getFiles({ dir: liqPlayground, ignoreDotFiles: true, onlyDirs: true, depth: 1 })
      return absDirs?.map((d) => fsPath.basename(d))
    },
    bitReString: '(?:[a-z][a-z0-9-]*)?'
  }

  app.commonPathResolvers['projectName'] = {
    optionsFetcher: async ({ localOrgKey }) => {
      // TODO: we really want to see the endpoint parameters so we can properly handle when 'currentOrgKey' is set
      // TODO: this is a good case for using the cache
      const liqPlayground = process.env.LIQ_HOME || fsPath.join(process.env.HOME, '.liq', 'playground')
      const orgDir = fsPath.join(liqPlayground, localOrgKey)
      const absDirs = await getFiles({ dir: liqPlayground, ignoreDotFiles: true, onlyDirs: true, depth: 1 })
      return absDirs?.map((d) => fsPath.basename(e))
    },
    bitReString: '(?:[a-z][a-z0-9-]*)?'
  }
  
  return async (req, res) => {
    const { localOrgKey, ignoreDocumentationImplementation, projectName } = req.vars

    const requireImplements = ignoreDocumentationImplementation === true
      ? []
      : [ 'implementation:documentation' ]

    const pkgData = await getPackageData({ localOrgKey, projectName, requireImplements })
    if (pkgData === false) return // error results already sent
    // else, we are good to start generating documentation!

    const { projectPath } = pkgData

    const pkgSrc = fsPath.join(projectPath, 'src')
    const docPath = fsPath.join(projectPath, 'docs')
    const sourceFiles = getFiles({ dir: pkgSrc, reName: '.(?:js|mjs)' })
    const dirs = {}

    await Promise.all(files.map(async (file) => {
      const fileContents = await fs.readFile(file, { encoding: 'utf8' })
      const baseName = fsPath.basename(file)
      const docFilePath = fsPath.join(docPath, docFilePath)
      const docDirPath = fsPath.dirname(docFilePath)
      if (dirs[docDirPath] === undefined) {
        await fs.mkdir(docDirPath, { recursive: true })
        dirs[docDirPath] = true
      }

      return fs.writeFile(docFilePath)
    }))

    res.setHeader('content-type', 'text/terminal').send(`Documented ${files.length} source files.`)
  }
}

export { func, help, method, parameters, path }
