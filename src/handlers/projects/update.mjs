import { doUpdate, getUpdateEndpointParameters } from './_lib/update-lib'

const paths = [
  ['projects', ':orgKey', ':localProjectName', 'update'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'update']
]

const { help, method, parameters } = getUpdateEndpointParameters({ workDesc : 'named' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { localProjectName, orgKey } = req.vars

  await doUpdate({ localProjectName, model, orgKey, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  paths
}
