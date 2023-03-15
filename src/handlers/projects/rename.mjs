import { doRename, getRenameEndpointParameters } from './_lib/rename-lib'

const paths = [
  ['projects', ':orgKey', ':localProjectName', 'rename'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'rename']
]

const { help, method, parameters } = getRenameEndpointParameters({ workDesc : 'named' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { localProjectName, orgKey } = req.vars

  await doRename({ orgKey, localProjectName, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  paths
}
