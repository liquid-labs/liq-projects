import { getImpliedPackageJSON } from '@liquid-labs/liq-projects-lib'

import { doUpdate, getUpdateEndpointParameters } from './_lib/update-lib'

const path = ['projects', 'update']

const { help, method, parameters } = getUpdateEndpointParameters({ workDesc : 'implied' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { name: projectName } = await getImpliedPackageJSON({ callDesc : 'project update', req })

  await doUpdate({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
