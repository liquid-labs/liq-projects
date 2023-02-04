import createError from 'http-errors'
import shell from 'shelljs'

import { determineOriginAndMain } from '@liquid-labs/github-toolkit'
import { nextVersion } from '@liquid-labs/versioning'

import { commonProjectPathParameters } from '../_lib/common-project-path-parameters'
import { getPackageData } from '../_lib/get-package-data'
import { releaseBranchName } from './_lib/branch-name-lib'
import { verifyReadyForRelease } from './_lib/verify-ready-for-release'

const method = 'post'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'releases', 'prepare-and-publish'],
  ['orgs', ':orgKey', 'projects', ':newProjectName', 'releases', 'prepare-and-publish']
]
const parameters = [
  {
    name        : 'increment',
    description : 'Indicates how to increment the version for this release.',
    matcher     : /^(?:major|minor|patch|premajor|preminor|prepatch|prerelease|pretype)$/
  },
  {
    name        : 'noBrowser',
    isBoolean   : true,
    description : 'If true, supresses launching of browser to show changelog page.'
  },
  {
    name        : 'noPublish',
    isBoolean   : true,
    description : 'If true, prepares but does not publish the package.'
  },
  {
    name        : 'otp',
    description : 'One time password to be used when publishing the project.'
  },
  ...commonProjectPathParameters
]
parameters.sort((a, b) => a.name.localeCompare(b.name))
Object.freeze(parameters)

const func = ({ app, model, reporter }) => async(req, res) => {
  const { increment, orgKey, localProjectName, /* noBrowser, */ noPublish, otp } = req.vars

  const pkgData = await getPackageData({ orgKey, localProjectName, projectPath : req.vars.projectPath })

  const { packageSpec, projectFQN, projectPath } = pkgData
  const [originRemote, mainBranch] = determineOriginAndMain(({ projectPath, reporter }))

  const currVer = packageSpec.version
  const nextVer = nextVersion({ currVer, increment })

  const releaseBranch = releaseBranchName({ releaseVersion : nextVer })

  const currentBranch =
    verifyReadyForRelease({ mainBranch, originRemote, packageSpec, projectPath, releaseBranch, reporter })

  if (currentBranch === mainBranch) {
    const checkoutResult = shell.exec(`cd '${projectPath}' && git checkout --quiet -b '${releaseBranch}'`)
    if (checkoutResult.code !== 0) { throw createError.InternalServerError(`Failed to checkout release branch '${releaseBranch}': ${checkoutResult.stderr}`) }
  }
  // else, we are on the release branch, as checked by 'verifyReadyForRelease'
  // TODO: generate changelog once 'work' history is defined

  const buildResult = shell.exec(`cd '${projectPath}' && npm run build`)
  if (buildResult.code !== 0) throw createError.BadRequest('Could not build project for release.')

  // npm version will tag and commit
  const versionResult = shell.exec(`cd '${projectPath}' && npm version ${nextVer}`)
  if (versionResult.code !== 0) { throw createError.InternalServerError(`'npm version ${nextVer}' failed; address or update manually.`) }
  const pushTagsResult = shell.exec(`cd '${projectPath}' && git push --tags`)
  if (pushTagsResult.code !== 0) { throw createError.InternalServerError(`Failed to push version release tag v${nextVer}; address or push manually.`) }

  reporter?.push(`Merging release branch '${releaseBranch}' to '${mainBranch}'...`)
  const mergeResult =
    shell.exec(`cd '${projectPath}' && git checkout '${mainBranch}' && git merge -m 'Merging auto-generated release branch (liq)' --no-ff '${releaseBranch}'`)
  if (mergeResult.code !== 0) throw createError.InternalServerError(`Could not merge release branch '${releaseBranch}' to '${mainBranch}'; address or merge manually.`)
  const deleteBranchResult = shell.exec(`cd '${projectPath}' && git branch -d '${releaseBranch}'`)
  if (deleteBranchResult.code !== 0) { throw createError.InternalServerError(`Could not delete release branch '${releaseBranch}'; manually delete.`) }

  const pushResult = shell.exec(`cd '${projectPath}' && git push ${originRemote} ${mainBranch}`)
  if (pushResult.code !== 0) { throw createError.InternalServerError(`Failed to push merged '${mainBranch}' to remote '${originRemote}'; push manually.`) }

  /* TODO: open browser to
  if (noBrowser === false) {
    const releaseAnchor = `release-v${nextVer}`
    const browseResult = shell.exec(`hub browse '${projectFQN}' 'blob/master/CHANGELOG.md#${releaseAnchor}'`)
    if (browseResult.code !== 0)
      throw createError.InternalServerError(`Release succeded, but unable to browse to CHANGELOG.md for ${projectFQN}.`)
  }
  */

  if (noPublish === false) {
    const publishResult = shell.exec(`cd '${projectPath}' && npm publish .${otp === undefined ? '' : `--otp=${otp}`}`)
    if (publishResult.code !== 0) { throw createError(`Project '${projectFQN}' preparation succeeded, but was unable to publish to npm; address manually: ${publishResult.stderr}`) }
  }
}

export {
  func,
  method,
  parameters,
  paths
}
