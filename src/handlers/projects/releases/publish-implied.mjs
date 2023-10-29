import { getPackageJSON } from '@liquid-labs/npm-toolkit'

import { doPublish, getPublishEndpointParams } from './_lib/publish-lib'

const { help, method, parameters } = getPublishEndpointParams({ workDesc : 'implied' })

const path = ['projects', 'releases', 'publish']

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'projects releases publish' with implied work, but 'X-CWD' header not found.")
  }

  const { name: projectName } = await getPackageJSON({ pkgDir: cwd })

  await doPublish({ app, cache, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
