// TODO: we should do more with this; expose liq-specific info. Right now, we're duplicating playground/projects/get-package
import { doDetail, getDetailEndpointParameters } from './_lib/detail-lib'

const paths = [
  ['projects', ':orgKey', ':localProjectName', 'detail'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'detail']
]

const { help, method, parameters } = getDetailEndpointParameters({ workDesc : 'named' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { localProjectName, orgKey } = req.vars

  doDetail({ localProjectName, model, orgKey, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  paths
}
