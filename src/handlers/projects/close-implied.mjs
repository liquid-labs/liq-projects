import createError from 'http-errors'

import { getPackageJSON } from '@liquid-labs/npm-toolkit'

import { doClose, getCloseEndpointParameters } from './_lib/close-lib'

const path = ['projects', 'close']

const { help, method, parameters } = getCloseEndpointParameters({ workDesc : 'implied' })

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'project close' with implied work, but 'X-CWD' header not found.")
  }

  const { name: projectName } = await getPackageJSON({ pkgDir : cwd })

  await doClose({ app, cache, projectName, reporter, req, res })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
