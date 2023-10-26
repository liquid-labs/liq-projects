import { getImpliedPackageJSON } from '@liquid-labs/liq-projects-lib'

import { doDocument, getDocumentEndpointParameters } from './_lib/document-lib'

const path = ['projects', 'document']

const { help, method, parameters } = getDocumentEndpointParameters({ workDesc : 'implied' })

const func = ({ app, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const { name: projectName } = await getImpliedPackageJSON({ callDesc : 'project document', req })

  await doDocument({ app, projectName, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
