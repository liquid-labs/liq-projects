import { doPublish, getPublishEndpointParams } from './_lib/publish-lib'

const { help, method, parameters } = getPublishEndpointParams({ workDesc : 'indicated' })

const paths = [
  ['projects', ':orgKey', ':localProjectName', 'releases', 'publish'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'releases', 'publish']
]

const func = ({ app, model, reporter }) => async(req, res) => {
  const { localProjectName, orgKey } = req.vars

  await doPublish({ app, localProjectName, model, orgKey, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  paths
}
