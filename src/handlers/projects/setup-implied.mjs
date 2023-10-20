import { getImpliedPackageJSON } from '@liquid-labs/liq-projects-lib'

import { doSetup, getSetupEndpointParameters } from './_lib/setup-lib'

const path = ['projects', 'setup']

const { help, method, parameters } = getSetupEndpointParameters({ workDesc : 'implied' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { name: projectName } = await getImpliedPackageJSON({ callDesc : 'project setup', req })

  await doSetup({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
