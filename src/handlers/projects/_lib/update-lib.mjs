import * as fs from 'fs'

import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { update } from '@liquid-labs/npm-toolkit'

const method = 'put'

const parameters = [
  {
    name        : 'dryRun',
    required    : false,
    isBoolean   : true,
    description : 'Reports what would be done if target was updated, but makes no actual changes.'
  }
]

const doUpdate = async({ app, projectName, reporter, req, res }) => {
  const { dryRun } = req.vars

  const { projectPath } = await app.ext._liqProjects.playgroundMonitor.getProjectData(projectName) || {}
  if (projectpath === undefined) {
    res.status(404).json({ message : `Did not find expected local checkout for project '${projectName}'.` })
    return
  }

  const { updated, actions } = update({ dryRun, projectPath, projectName })

  let msg = reporter.taskReport.join('\n')
    + '\n' + actions.join('\n')
    + `\n\n<bold>${projectName}<rst> <em>`
  if (dryRun === true) {
    msg += updated === true
      ? 'no change<rst> (dry run)'
      : 'no change/possible error<rst> (dry run)'
  }
  else { // dryRun === false
    msg += updated === true
      ? 'updated<rst>'
      : 'not updated/possible error<rst>'
  }

  httpSmartResponse({ msg, req, res })
}

const getUpdateEndpointParameters = ({ alternateTo, workDesc }) => {
  const help = {
    alternateTo,
    name        : `Project update (${workDesc})`,
    summary     : `Updates the ${workDesc} project.`,
    description : `Updates the ${workDesc} project.`
  }

  return { help, method, parameters }
}

export { doUpdate, getUpdateEndpointParameters }
