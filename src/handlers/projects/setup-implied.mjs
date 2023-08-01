import createError from 'http-errors'

import { determineImpliedProject } from '@liquid-labs/liq-projects-lib'

import { doSetup, getSetupEndpointParameters } from './_lib/setup-lib'

const path = ['projects', 'setup']

const { help, method, parameters } = getSetupEndpointParameters({ workDesc : 'implied' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'projects setup' with implied work, but 'X-CWD' header not found.")
  }
  const [orgKey, localProjectName] = determineImpliedProject({ currDir : cwd }).split('/')

  await doSetup({ localProjectName, model, orgKey, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
