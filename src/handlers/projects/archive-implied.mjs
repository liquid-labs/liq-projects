import createError from 'http-errors'

import { determineImpliedProject } from '@liquid-labs/liq-projects-lib'

import { doArchive, getArchiveEndpointParameters } from './_lib/archive-lib'

const { help, method, parameters } = getArchiveEndpointParameters({ workDesc : 'named' })

const path = ['projects', 'archive']

const func = ({ app, cache, model, reporter }) => async(req, res) => {
  reporter = reporter.isolate()

  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'work submit' with implied work, but 'X-CWD' header not found.")
  }
  const [ orgKey, localProjectName ] = determineImpliedProject({ currDir : cwd }).split('/')

  await doArchive({ app, cache, model, orgKey, localProjectName, reporter, res, req })
}

export {
  help,
  func,
  method,
  parameters,
  path
}
