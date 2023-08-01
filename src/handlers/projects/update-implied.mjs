import createError from 'http-errors'

import { determineImpliedProject } from '@liquid-labs/liq-projects-lib'

import { doUpdate, getUpdateEndpointParameters } from './_lib/update-lib'

const path = ['projects', 'update']

const { help, method, parameters } = getUpdateEndpointParameters({ workDesc : 'implied' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'work update' with implied work, but 'X-CWD' header not found.")
  }
  const [orgKey, localProjectName] = determineImpliedProject({ currDir : cwd }).split('/')

  await doUpdate({ localProjectName, model, orgKey, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
