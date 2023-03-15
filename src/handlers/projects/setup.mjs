import { doSetup, getSetupEndpointParameters } from './_lib/setup-lib'

const paths = [
  ['projects', ':orgKey', ':localProjectName', 'setup'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'setup']
]

const { help, method, parameters } = getSetupEndpointParameters({ workDesc : 'named' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { localProjectName, orgKey } = req.vars

  await doSetup({ localProjectName, model, orgKey, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  paths
}
