import { doUpdate, getUpdateEndpointParameters } from './_lib/update-lib'

const path = ['projects', ':projectName', 'update']

const { help, method, parameters } = getUpdateEndpointParameters({
  alternateTo : {
    altId     : '/projects/update',
    variation : 'explicitly name the project'
  },
  workDesc : 'named'
})

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doUpdate({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
