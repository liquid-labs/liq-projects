import createError from 'http-errors'

import { getPackageJSON } from '@liquid-labs/npm-toolkit'

import { doArchive, getArchiveEndpointParameters } from './_lib/archive-lib'

const { help, method, parameters } = getArchiveEndpointParameters({ workDesc : 'implied' })

const path = ['projects', 'archive']

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'project archive' with implied work, but 'X-CWD' header not found.")
  }

  const { name: projectName } = await getPackageJSON({ pkgDir : cwd })

  await doArchive({ app, projectName, reporter, res, req })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
