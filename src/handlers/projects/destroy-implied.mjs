import createError from 'http-errors'

import { getPackageJSON } from '@liquid-labs/npm-toolkit'

import { doDestroy, getDestroyEndpointParameters } from './_lib/destroy-lib'

const path = ['projects', 'destroy']

const { help, method, parameters } = getDestroyEndpointParameters({ workDesc : 'implied' })

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'project destroy' with implied work, but 'X-CWD' header not found.")
  }

  const { name: projectName } = await getPackageJSON({ pkgDir : cwd })

  await doDestroy({ app, cache, projectName, reporter, req, res })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
