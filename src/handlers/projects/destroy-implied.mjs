import { getImpliedPackageJSON } from '@liquid-labs/liq-projects-lib'

import { doDestroy, getDestroyEndpointParameters } from './_lib/destroy-lib'

const path = ['projects', 'destroy']

const { help, method, parameters } = getDestroyEndpointParameters({ workDesc : 'implied' })

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { name: projectName } = await getImpliedPackageJSON({ callDesc : 'project destroy', req })

  await doDestroy({ app, cache, projectName, reporter, req, res })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
