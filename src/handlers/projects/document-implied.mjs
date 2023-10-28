import createError from 'http-errors'

import { getPackageJSON } from '@liquid-labs/npm-toolkit'

import { doDocument, getDocumentEndpointParameters } from './_lib/document-lib'

const path = ['projects', 'document']

const { help, method, parameters } = getDocumentEndpointParameters({ workDesc : 'implied' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'project document' with implied work, but 'X-CWD' header not found.")
  }

  const { name: projectName } = await getPackageJSON({ pkgDir : cwd })

  await doDocument({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
