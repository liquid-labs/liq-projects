import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';

import walk from 'walkdir'

import { getFiles } from './_lib/get-files'
import { getPackageData } from './_lib/get-package-data'

hljs.registerLanguage('javascript', javascript);

const help = {
  name: 'Local project document',
  summary: 'Generates developer documents for local projects.',
  description: 'Generates developer documentation for <em>local<rst> projects which have been imported to the liq playground.'
}

const method = 'put'
const path = [ 'playground', 'projects', ':localOrgKey', ':localProjectName', 'document' ]
const parameters = [
  {
    name: 'ignoreDocumentationImplementation',
    isBoolean: true,
    description: 'If set to true, then a missing <code>implementation:documentation<rst> label will not cause the process to exit.'
  }
]

const func = ({ app, model }) => async (req, res) => {
  const { localOrgKey, ignoreDocumentationImplementation, localProjectName } = req.vars

  const requireImplements = ignoreDocumentationImplementation === true
    ? []
    : [ 'implements:documentation' ]

  const pkgData = await getPackageData({ localOrgKey, localProjectName, requireImplements, res })
  if (pkgData === false) return // error results already sent
  // else, we are good to start generating documentation!

  const { projectPath } = pkgData

  const pkgSrc = fsPath.join(projectPath, 'src')
  const docPath = fsPath.join(projectPath, 'docs')

  const pkgSrcLength = pkgSrc.length
  const sourceFiles = await getFiles({ dir: pkgSrc, reName: '.(?:js|mjs)$' })
  const dirs = {}

  await fs.rm(docPath, { recursive: true })

  await Promise.all(sourceFiles.map(async (file) => {
    const fileContents = await fs.readFile(file, { encoding: 'utf8' })
    const pkgRelPath = file.slice(pkgSrcLength)
    const pkgRelDoc = pkgRelPath + '.html' // so we end up with file names like 'library.js.html'
    const docFilePath = fsPath.join(docPath, pkgRelDoc)
    const docDirPath = fsPath.dirname(docFilePath)
    if (dirs[docDirPath] === undefined) {
      await fs.mkdir(docDirPath, { recursive: true })
      dirs[docDirPath] = true
    }
    

    const htmlifiedSource = htmlifySource(fileContents, pkgRelPath)

    return fs.writeFile(docFilePath, htmlifiedSource)
  }))

  res.setHeader('content-type', 'text/terminal').send(`Documented ${sourceFiles.length} source files.`)
}

const extToType = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript'
}

const htmlifySource = (rawContent, pkgRelPath) => {
  const fileExt = pkgRelPath.slice(pkgRelPath.lastIndexOf('.') + 1)
  const fileType = extToType[fileExt] || fileExt
  const title = fsPath.basename(pkgRelPath)

  let html = `<html>
  <head>
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/lightfair.min.css">
  </head>
  <body>
${hljs.highlight(rawContent, { language: fileType }).value}
  </body>
</html>`

  return html
}

export { func, help, method, parameters, path }
