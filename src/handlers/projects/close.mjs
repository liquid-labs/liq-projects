import { doClose, getCloseEndpointParameters } from './_lib/close-lib'

const path = ['projects', ':projectName', 'close']

const { help, method, parameters } = getCloseEndpointParameters({
  alternateTo : {
    altId     : '/projects/close',
    variation : 'explicitly name the project'
  },
  workDesc : 'named'
})

const func = ({ app, cache, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doClose({ app, cache, projectName, reporter, req, res })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
