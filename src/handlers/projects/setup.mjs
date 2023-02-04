import * as fsPath from 'node:path'

import { getOrgFromKey } from '@liquid-labs/liq-handlers-lib'
import {
  checkGitHubAPIAccess,
  checkGitHubSSHAccess,
  regularizeMainBranch,
  regularizeRemote,
  setupGitHubLabels,
  setupGitHubMilestones
} from '@liquid-labs/github-toolkit'

import { commonProjectPathParameters } from './_lib/common-project-path-parameters'
import { commonProjectSetupParameters } from './_lib/common-project-setup-parameters'
import { GITHUB_REPO_KEY } from './_lib/common-constants'

const method = 'post'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'setup'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'setup']
]
const parameters = [
  {
    name        : 'noUpdateMainBranch',
    isBoolean   : true,
    description : "If true, the main branch will not be renamed even if it not standard 'main'."
  },
  {
    name        : 'noUpdateOriginRemote',
    isBoolean   : true,
    description : "If true, the origin remote will not be renamed even if not standard 'origin'."
  },
  {
    name        : 'unpbulished',
    isBoolean   : true,
    description : 'Set to true for new or otherwise unpblushed packages. By default, the process will query npm to get the latest version of the package for use with milestones setup. If set false, then this query is skipped and the local package data is used.'
  },
  ...commonProjectPathParameters,
  ...commonProjectSetupParameters
]
parameters.sort((a, b) => a.name.localeCompare(b.name))
Object.freeze(parameters)

const func = ({ app, model, reporter }) => async(req, res) => {
  const org = getOrgFromKey({ model, params : req.vars, res })
  if (org === false) return

  reporter?.push('Checking GitHub SSH access...')
  checkGitHubSSHAccess({ reporter }) // the check will throw HTTP errors if there's a problem
  reporter?.push('Checking GitHub API access..')
  await checkGitHubAPIAccess({ reporter }) // ditto

  const {
    noDeleteLabels = false,
    noUpdateLabels = false,
    noUpdateMainBranch = false,
    noUpdateOriginName = false,
    orgKey,
    localProjectName,
    skipLabels = false,
    skipMilestones = false,
    unpublished = false
  } = req.vars

  const projectPath = req.vars.projectPath
    || fsPath.join(process.env.HOME, '.liq', 'playground', orgKey, localProjectName)
  const githubOrg = org.getSetting(GITHUB_REPO_KEY)
  const projectFQN = githubOrg + '/' + localProjectName

  reporter = reporter?.isolate()
  if (skipLabels !== true) await setupGitHubLabels({ noDeleteLabels, noUpdateLabels, projectFQN, reporter })
  if (skipMilestones !== true) await setupGitHubMilestones({ model, projectFQN, projectPath, reporter, unpublished })
  if (noUpdateOriginName !== true) regularizeRemote({ projectPath, reporter })
  if (noUpdateMainBranch !== true) regularizeMainBranch({ projectFQN, projectPath, reporter })

  res.type('text/plain').send(reporter.taskReport.join('\n'))
}

export {
  func,
  method,
  parameters,
  paths
}
