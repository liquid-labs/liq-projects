import * as fs from 'fs'
import * as sysPath from 'path'

import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { LIQ_PLAYGROUND } from '@liquid-labs/liq-defaults'
import { updateDeps } from '@liquid-labs/liq-projects-lib'

const method = 'put'

const parameters = [
  {
    name        : 'dryRun',
    required    : false,
    isBoolean   : true,
    description : 'Reports what would be done if target was updated, but makes no actual changes.'
  }
]

const doUpdate = async({ localProjectName, model, orgKey, reporter, req, res }) => {
  const { dryRun } = req.vars

  const localProjectPath = sysPath.join(LIQ_PLAYGROUND(), orgKey, localProjectName)
  if (!fs.existsSync(localProjectPath)) {
    res.status(404).json({ message : `Did not find expected local checkout for project '${orgKey}/${localProjectName}'.` })
    return
  }

  const { updated, actions } = updateDeps({ dryRun, localProjectPath, projectName : `${orgKey}/${localProjectName}` })

  let msg = reporter.taskReport.join('\n')
    + '\n' + actions.join('\n')
    + `\n\n<bold>${orgKey}/${localProjectName}<rst> <em>`
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

const getUpdateEndpointParameters = ({ workDesc }) => {
  const help = {
    name        : `Project update (${workDesc})`,
    summary     : `Updates the ${workDesc} project.`,
    description : `Updates the ${workDesc} project.`
  }

  return { help, method, parameters }
}

export { doUpdate, getUpdateEndpointParameters }
