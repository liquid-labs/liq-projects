import { doDocument, getDocumentEndpointParameters } from './_lib/document-lib'

const paths = [
  ['projects', ':orgKey', ':localProjectName', 'document'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'document']
]

const { help, method, parameters } = getDocumentEndpointParameters({ workDesc : 'named' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { localProjectName, orgKey } = req.vars

  await doDocument({ model, orgKey, localProjectName, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  paths
}
