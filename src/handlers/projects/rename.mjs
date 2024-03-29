import { doRename, getRenameEndpointParameters } from './_lib/rename-lib'

const path = ['projects', ':projectName', 'rename']

const { help, method, parameters } = getRenameEndpointParameters({
  alternateTo : {
    altId     : '/projects/rename',
    variation : 'explicitly name the project'
  },
  workDesc : 'named'
})

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doRename({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
