import { getImpliedPackageJSON } from '@liquid-labs/liq-projects-lib'

import { doRename, getRenameEndpointParameters } from './_lib/rename-lib'

const path = ['projects', 'rename']

const { help, method, parameters } = getRenameEndpointParameters({ workDesc : 'implied' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { name: projectName } = await getImpliedPackageJSON({ callDesc : 'project rename', req })

  await doRename({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
