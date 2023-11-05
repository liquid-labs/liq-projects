import { doPublish, getPublishEndpointParams } from './_lib/publish-lib'

const path = ['projects', ':projectName', 'releases', 'publish']

const { help, method, parameters } = getPublishEndpointParams({
  alternateTo : {
    altId     : '/projects/releases/publish',
    variation : 'explicitly name the project'
  },
  workDesc : 'named'
})

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
