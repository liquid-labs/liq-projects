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
const path = [ 'projects', ':projectDesignation'/* simple name or FQN*/]
const parameters = [
  {
    name: 'currentOrgKey',
    description: 'If set, then projects may be designated by their simple name. <code>currentOrgKey</rst> is treated as a valid org key. If a fully qualified project name is specified, then this parameter is ignored. The main use case for this parameter is to support a command line interface where the "current project" may be divined from the current working directory.',
    advanced: true
  },
  {
    name: 'ignoreDocumentationImplementation',
    isBoolean: true,
    description: 'If set to true, then a missing <code>implementation:documentation<rst> label will not cause the process to exit.'
  }
]

const projectNameRe = new RegExp(`.+${fsPath.sep}([^${fsPath.sep}]+)${fsPath.sep}([^${fsPath.sep}]+)$`)

const func = ({ app, model }) => {
  app.commonPathResolvers['projectDesignation'] = {
    optionsFetcher: async ({ model, currToken='' }) => {
      // TODO: we really want to see the endpoint parameters so we can properly handle when 'currentOrgKey' is set
      // TODO: this is a good case for using the cache
      const liqPlayground = process.env.LIQ_HOME || fsPath.join(process.env.HOME, '.liq', 'playground')
      const absDirs = await getFiles({ dir: liqPlayground, onlyDirs: true, depth: 2 })
      return absDirs
        ?.filter((d) => d.indexOf(fsPath.sep) !== -1)
        ?.map((d) => d.replace(projectNameRe, '$1/$2'))
    },
    bitReString: '(?:[a-z][a-z0-9-]*)?'
  }
  
  return async (req, res) => {
    const { currentOrgKey, ignoreDocumentationImplementation, projectDesignation } = req.vars

    const requireImplements = ignoreDocumentationImplementation === true
      ? []
      : [ 'implementation:documentation' ]

    const pkgData = await getPackageData({ currentOrgKey, projectDesignation, requireImplements })
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
