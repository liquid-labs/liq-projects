import createError from 'http-errors'

import { getPackageJSON } from '@liquid-labs/npm-toolkit'

import { doRename, getRenameEndpointParameters } from './_lib/rename-lib'

const path = ['projects', 'rename']

const { help, method, parameters } = getRenameEndpointParameters({ workDesc : 'implied' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'project document' with implied work, but 'X-CWD' header not found.")
  }

  const { name: projectName } = await getPackageJSON({ pkgDir : cwd })

  await doRename({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
