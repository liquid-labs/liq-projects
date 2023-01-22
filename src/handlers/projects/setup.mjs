import { getOrgFromKey } from '@liquid-labs/liq-handlers-lib'

import { checkGitHubAPIAccess, checkGitHubSSHAccess } from './_lib/github-lib'
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
    name        : 'projectPath',
    description : 'Path to local project to work with. Can be used to specify projects in non-default locations. Otherwise, the process will look in the liq playground under the `&lt;orgKey&gt;/&lt;localProjectName&gt;`.'
  },
  {
    name        : 'skipLabels',
    isBoolean   : true,
    description : 'If true, then the entire label normalization process will be skipped.'
  },
  {
    name        : 'skipMilestones',
    isBoolean   : true,
    description : 'If true, the milestone setup process is skipped.'
  },
  {
    name        : 'unpbulished',
    isBoolean   : true,
    description : 'TODO: ???'
  }
]

const func = ({ app, model, reporter }) => {
  app.commonPathResolvers.newProjectName = {
    optionsFetcher : () => [],
    bitReString    : '[a-zA-Z][a-zA-Z0-9-]*'
  }

  return async(req, res) => {
    const org = getOrgFromKey({ model, params : req.vars, res })
    if (org === false) return

    if (!checkGitHubSSHAccess({ res })) return // the check will handle user feedback
    if (!(await checkGitHubAPIAccess({ res }))) return // ditto

    const {
      noDeleteLabels = false,
      noUpdateLabels = false,
      orgKey,
      localProjectName,
      projectPath,
      skipLabels = false,
      skipMilestones = false,
      unpublished = false
    } = req.vars

    const projectName = orgKey + '/' + localProjectName

    const report = []
    if (skipLabels !== true) setupGitHubLabels({ noDeleteLabels, noUpdateLabels, projectName, report })
    if (skipMilestones !== true) await setupGitHubMilestones({ model, projectName, projectPath, report, unpublished })

    res.type('text/plain').send(report.join('\n'))
  }
}

export {
  func,
  method,
  parameters,
  paths
}
