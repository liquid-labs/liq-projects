import createError from 'http-errors'

import { determineImpliedProject } from '@liquid-labs/liq-projects-lib'

import { doDestroy, getDestroyEndpointParameters } from './_lib/destroy-lib'

const path = ['projects', 'destroy']

const { help, method, parameters } = getDestroyEndpointParameters({ workDesc : 'implied' })

const func = ({ app, cache, model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'projects destroy' with implied work, but 'X-CWD' header not found.")
  }
  const [orgKey, localProjectName] = determineImpliedProject({ currDir : cwd }).split('/')

  await doDestroy({ app, cache, localProjectName, model, orgKey, reporter, req, res })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
