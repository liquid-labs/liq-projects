import { doDocument, getDocumentEndpointParameters } from './_lib/document-lib'

const path = ['projects', ':projectName', 'document']

const { help, method, parameters } = getDocumentEndpointParameters({ workDesc : 'named' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { projectName } = req.vars

  await doDocument({ app, projectName, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
