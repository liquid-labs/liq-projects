// TODO: we should do more with this; expose liq-specific info.
import { getImpliedPackageJSON } from '@liquid-labs/liq-projects-lib'

import { doDetail, getDetailEndpointParameters } from './_lib/detail-lib'

const path = ['projects', 'detail']

const { help, method, parameters } = getDetailEndpointParameters({ workDesc : 'implied' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { name: projectName } = await getImpliedPackageJSON({ callDesc : 'project detail', req })

  doDetail({ app, projectName, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
