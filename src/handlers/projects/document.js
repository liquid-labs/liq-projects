import { doDocument, getDocumentEndpointParameters } from './_lib/document-lib'

const path = ['projects', ':projectName', 'document']

const { help, method, parameters } = getDocumentEndpointParameters({
  alternateTo : {
    altId     : '/projects/document',
    variation : 'explicitly name the project'
  },
  workDesc : 'named'
})

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doDocument({ app, projectName, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
