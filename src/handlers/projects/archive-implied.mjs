import { getImpliedPackageJSON } from '@liquid-labs/npm-toolkit'

import { doArchive, getArchiveEndpointParameters } from './_lib/archive-lib'

const { help, method, parameters } = getArchiveEndpointParameters({ workDesc : 'implied' })

const path = ['projects', 'archive']

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { name: projectName } = await getImpliedPackageJSON({ callDesc : 'project archive', req })

  await doArchive({ app, cache, projectName, reporter, res, req })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
