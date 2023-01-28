import { getOrgFromKey } from '@liquid-labs/liq-handlers-lib'

import { checkGitHubAPIAccess, checkGitHubSSHAccess } from './_lib/github-lib'
import { commonProjectSetupParameters } from './_lib/common-project-setup-parameters'
import { commonProjectPathParameters } from './_lib/common-project-path-parameters'
import { GITHUB_REPO_KEY } from './_lib/common-constants'
import { setupGitHubLabels } from './_lib/setup-github-labels'
import { setupGitHubMilestones } from './_lib/setup-github-milestones'

const method = 'post'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'setup'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'setup']
]
const parameters = [
  {
    name        : 'noDeleteLabels',
    isBoolean   : true,
    description : 'If true, then only missing labels will be added and any existing labels will be kept in place. Existing labels with the same name will be updated unless `noUpdateLabels` is set.'
  },
  {
    name        : 'noUpdateLabels',
    isBoolean   : true,
    description : 'If true, then existing labels with the same name as the canonical label set will be left unchanged. Thtey will still be deleted, however, unless `noUpdateLabels` is set.'
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

  if (!checkGitHubSSHAccess({ res })) return // the check will handle user feedback
  if (!(await checkGitHubAPIAccess({ res }))) return // ditto

  const {
    noDeleteLabels = false,
    noUpdateLabels = false,
    localProjectName,
    projectPath,
    skipLabels = false,
    skipMilestones = false,
    unpublished = false
  } = req.vars

  const githubOrg = org.getSetting(GITHUB_REPO_KEY)
  const projectName = githubOrg + '/' + localProjectName

  const report = []
  if (skipLabels !== true) setupGitHubLabels({ noDeleteLabels, noUpdateLabels, projectName, report })
  if (skipMilestones !== true) await setupGitHubMilestones({ model, projectName, projectPath, report, unpublished })

  res.type('text/plain').send(report.join('\n'))
}

export {
  func,
  method,
  parameters,
  paths
}
