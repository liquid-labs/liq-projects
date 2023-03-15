// TODO: we should do more with this; expose liq-specific info. Right now, we're duplicating playground/projects/get-package
import createError from 'http-errors'

import { determineImpliedProject } from '@liquid-labs/liq-projects-lib'

import { doDetail, getDetailEndpointParameters } from './_lib/detail-lib'

const path = ['projects', 'detail']

const { help, method, parameters } = getDetailEndpointParameters({ workDesc : 'implied' })

const func = ({ model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'work detail' with implied work, but 'X-CWD' header not found.")
  }
  const [orgKey, localProjectName] = determineImpliedProject({ currDir : cwd }).split('/')

  doDetail({ localProjectName, model, orgKey, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
