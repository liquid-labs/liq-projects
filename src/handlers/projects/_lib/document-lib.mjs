import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import naturalSort from 'natural-sort'

import { getFiles } from './get-files'
import { getPackageData } from './get-package-data'

hljs.registerLanguage('javascript', javascript)

/**
 * Implements documenting a project. Used by the named and implied project detail endpoints.
 */
const doDocument = async({ app, projectName, reporter, req, res }) => {
  const pkgData = await getPackageData({ app, projectName })
  // else, we are good to start generating documentation!

  const { projectPath } = pkgData

  const pkgSrc = fsPath.join(projectPath, 'src')
  const docPath = fsPath.join(projectPath, 'docs')

  reporter.log(`Building docs from ${pkgSrc}...`)

  const pkgSrcLength = pkgSrc.length
  const sourceFiles = await getFiles({ dir : pkgSrc, reName : '.(?:js|mjs)$' })
  const dirs = {}

  reporter.log(`Refreshing ${docPath}...`)
  await fs.rm(docPath, { force : true, recursive : true })
  await fs.mkdir(docPath, { recursive : true })

  const tocFiles = []

  await Promise.all(sourceFiles.map(async(file) => {
    reporter.log(`Precossing ${file}...`)
    const fileContents = await fs.readFile(file, { encoding : 'utf8' })
    const pkgRelPath = file.slice(pkgSrcLength)
    const pkgRelDoc = pkgRelPath + '.html' // so we end up with file names like 'library.js.html'
    const docFilePath = fsPath.join(docPath, pkgRelDoc)
    const docDirPath = fsPath.dirname(docFilePath)

    tocFiles.push(pkgRelDoc.slice(1)) // removing leading '/'

    if (dirs[docDirPath] === undefined) {
      await fs.mkdir(docDirPath, { recursive : true })
      dirs[docDirPath] = true
    }

    const htmlifiedSource = htmlifySource(fileContents, pkgRelPath)

    return fs.writeFile(docFilePath, htmlifiedSource)
  }))

  tocFiles.sort(naturalSort)

  const indexPath = fsPath.join(docPath, 'index.html')
  let tocContent = `<html>
  <head>
    <title>${projectName}</title>
  </head>
    <body>
      <ul>`
  for (const tocFile of tocFiles) {
    tocContent += `
        <li>
          <a href=${tocFile}>${tocFile.slice(0, -5)}</a>
        </li>`
  }
  tocContent += `
      </ul>
    </body>
  </html>`

  await fs.writeFile(indexPath, tocContent)

  res.setHeader('content-type', 'text/terminal').send(`Documented ${sourceFiles.length} source files.`)
}

const extToType = {
  js  : 'javascript',
  jsx : 'javascript',
  mjs : 'javascript'
}

const htmlifySource = (rawContent, pkgRelPath) => {
  const fileExt = pkgRelPath.slice(pkgRelPath.lastIndexOf('.') + 1)
  const fileType = extToType[fileExt] || fileExt
  const title = fsPath.basename(pkgRelPath)

  const html = `<html>
  <head>
    <title>${title}</title>

    <style>
      body {
        text-align: left;
      }

      pre {
        text-align: left;
        display: inline-block;
        max-width: 120em;
        margin: 1em 1em;
        padding: 1em 1em;
        border-top: solid blue 1px;
        border-right: solid blue 1px;
        border-bottom: solid blue 1px;
        white-space: pre-wrap;
      }
    </style>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/base16/google-light.min.css">
  </head>
  <body>
    <pre><code>
${hljs.highlight(rawContent, { language : fileType }).value}
    </code></pre>
  </body>
</html>`

  return html
}

/**
 * Provides common endpoint parameters for named and implied document endpoints.
 */
const getDocumentEndpointParameters = ({ alternateTo, workDesc }) => {
  const help = {
    alternateTo,
    name        : `Project document (${workDesc})`,
    summary     : `Generates developer documents for the ${workDesc} project.`,
    description : `Locally generates developer documentation for the ${workDesc} project.`
  }

  const method = 'put'

  const parameters = []
  Object.freeze(parameters)

  return { help, method, parameters }
}

export { doDocument, getDocumentEndpointParameters }
