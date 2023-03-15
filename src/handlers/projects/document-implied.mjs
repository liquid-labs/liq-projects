import createError from 'http-errors'

import { determineImpliedProject } from '@liquid-labs/liq-projects-lib'

import { doDocument, getDocumentEndpointParameters } from './_lib/document-lib'

const path = [ 'projects', 'document' ]

const { help, method, parameters } = getDocumentEndpointParameters({ workDesc : 'named' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'work document' with implied work, but 'X-CWD' header not found.")
  }
  const [orgKey, localProjectName] = determineImpliedProject({ currDir : cwd }).split('/')

  await doDocument({ orgKey, localProjectName, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
