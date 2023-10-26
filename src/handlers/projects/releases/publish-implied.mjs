import { getImpliedPackageJSON } from '@liquid-labs/liq-projects-lib'

import { doPublish, getPublishEndpointParams } from './_lib/publish-lib'

const { help, method, parameters } = getPublishEndpointParams({ workDesc : 'implied' })

const path = ['projects', 'releases', 'publish']

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter.isolate()

  const { name: projectName } = await getImpliedPackageJSON({ callDesc : 'release publish', req })

  await doPublish({ app, cache, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
