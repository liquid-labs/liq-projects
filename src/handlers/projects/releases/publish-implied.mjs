import createError from 'http-errors'

import { determineImpliedProject } from '@liquid-labs/liq-projects-lib'

import { doPublish, getPublishEndpointParams } from './_lib/publish-lib'

const { help, method, parameters } = getPublishEndpointParams({ workDesc : 'implied' })

const path = ['projects', 'releases', 'publish']

const func = ({ app, cache, model, reporter }) => async(req, res) => {
  const cwd = req.get('X-CWD')
  if (cwd === undefined) {
    throw createError.BadRequest("Called 'work document' with implied work, but 'X-CWD' header not found.")
  }
  const [orgKey, localProjectName] = determineImpliedProject({ currDir : cwd }).split('/')

  await doPublish({ app, cache, localProjectName, model, orgKey, reporter, req, res })
}

export {
  func,
  help,
  method,
  parameters,
  path
}
