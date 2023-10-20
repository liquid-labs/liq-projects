import createError from 'http-errors'

import { determineCurrentBranch, determineLocalMain } from '@liquid-labs/git-toolkit'
import {
  checkGitHubAPIAccess,
  checkGitHubSSHAccess,
  regularizeMainBranch,
  regularizeRemote,
  setupGitHubLabels,
  setupGitHubMilestones
} from '@liquid-labs/github-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'

import { commonProjectPathParameters } from './common-project-path-parameters'
import { commonProjectSetupParameters } from './common-project-setup-parameters'
import { getPackageData } from './get-package-data'

/**
 * Implements shared setup logic for the named and implied project setup endpoints.
 */
const doSetup = async({ app, projectName, reporter, req, res }) => {
  reporter?.push('Checking GitHub SSH access...')
  checkGitHubSSHAccess({ reporter }) // the check will throw HTTP errors if there's a problem
  reporter?.push('Checking GitHub API access..')
  await checkGitHubAPIAccess({ reporter }) // ditto

  const {
    noDeleteLabels = false,
    noUpdateLabels = false,
    noUpdateMainBranch = false,
    noUpdateOriginName = false,
    skipLabels = false,
    skipMilestones = false,
    unpublished = false
  } = req.vars

  const { githubName: projectFQN, pkgJSON, projectPath: pp } = getPackageData({ app, projectName })
  const projectPath = req.vars.projectPath || pp

  const localMain = determineLocalMain({ projectPath })
  const currentBranch = determineCurrentBranch({ projectPath })

  if (localMain !== currentBranch) {
    throw createError.BadRequest(`Project must be on main branch '${localMain}' (is on '${currentBranch}').`)
  }

  reporter = reporter?.isolate()
  if (skipLabels !== true) await setupGitHubLabels({ noDeleteLabels, noUpdateLabels, projectFQN, reporter })
  if (skipMilestones !== true) await setupGitHubMilestones({ pkgJSON, projectFQN, projectPath, reporter, unpublished })
  if (noUpdateOriginName !== true) regularizeRemote({ projectPath, reporter })
  if (noUpdateMainBranch !== true) await regularizeMainBranch({ projectFQN, projectPath, reporter })

  const msg = reporter.taskReport.join('\n') + '\n\n'
    + `<em>Setup<rst> project <code>${projectFQN}<rst>.`

  httpSmartResponse({ msg, req, res })
}

/**
 * Defines the setup endpoint parameters for the named and implied project setup endpoints.
 */
const getSetupEndpointParameters = ({ workDesc }) => {
  const help = {
    name        : `Project setup (${workDesc})`,
    summary     : `Sets up the ${workDesc} project.`,
    description : `Sets up the ${workDesc} project with common configurations. This will:
- set the origin remote name to 'origin',
- set the local main and remote default branch names to 'main',
- set up standard issue labels, and
- setup standard project milestones`
  }

  const method = 'post'

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

  return { help, method, parameters }
}

export { doSetup, getSetupEndpointParameters }
