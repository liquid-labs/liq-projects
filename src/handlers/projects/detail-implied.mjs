// TODO: we should do more with this; expose liq-specific info.
import createError from 'http-errors'

import { getPackageJSON } from '@liquid-labs/npm-toolkit'

import { doDetail, getDetailEndpointParameters } from './_lib/detail-lib'

const path = ['projects', 'detail']

const { help, method, parameters } = getDetailEndpointParameters({ workDesc : 'implied' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'project detail' with implied work, but 'X-CWD' header not found.")
  }

  const { name: projectName } = await getPackageJSON({ pkgDir : cwd })

  doDetail({ app, projectName, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
