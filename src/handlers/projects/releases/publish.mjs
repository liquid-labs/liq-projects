import { doPublish, getPublishEndpointParams } from './_lib/publish-lib'

const { help, method, parameters } = getPublishEndpointParams({ workDesc : 'indicated' })

const path = ['projects', ':projectName', 'releases', 'publish']

const func = ({ app, cache, model, reporter }) => async(req, res) => {
  const { projectName } = req.vars

  await doPublish({ app, cache, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
