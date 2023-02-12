import * as fs from 'node:fs'
import * as fsPath from 'node:path'

import createError from 'http-errors'
import shell from 'shelljs'

import { determineCurrentBranch, determineOriginAndMain } from '@liquid-labs/github-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { nextVersion } from '@liquid-labs/versioning'
import { releaseBranchName, verifyReadyForRelease } from '@liquid-labs/git-toolkit'

import { commonProjectPathParameters } from '../_lib/common-project-path-parameters'
import { getPackageData } from '../_lib/get-package-data'

const method = 'post'
const paths = [
  ['projects', ':orgKey', ':localProjectName', 'releases', 'prepare-and-publish'],
  ['orgs', ':orgKey', 'projects', ':localProjectName', 'releases', 'prepare-and-publish']
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
  reporter.reset()
  reporter = reporter.isolate()

  const { increment, orgKey, localProjectName, /* noBrowser, */ noPublish = false, otp } = req.vars

  const pkgData = await getPackageData({ orgKey, localProjectName, projectPath : req.vars.projectPath })

  const { packageSpec, projectFQN, projectPath } = pkgData
  const [originRemote, mainBranch] = determineOriginAndMain(({ projectPath, reporter }))

  const currentBranch = determineCurrentBranch({ projectPath, reporter })

  const currVer = packageSpec.version
  let nextVer
  if (currentBranch.startsWith('release-')) { // it looks like we're already on the release branch
    nextVer = currentBranch.replace(/^release-([0-9.]+(?:-(?:alpha|beta|rc)\.\d+)?)-.+$/, '$1')
  }
  else {
    nextVer = nextVersion({ currVer, increment })
  }

  const releaseBranch = releaseBranchName({ releaseVersion : nextVer })

  verifyReadyForRelease({ currentBranch, mainBranch, originRemote, packageSpec, projectPath, releaseBranch, reporter })

  if (currentBranch === mainBranch) {
    const checkoutResult = shell.exec(`cd '${projectPath}' && git checkout --quiet -b '${releaseBranch}'`)
    if (checkoutResult.code !== 0) { throw createError.InternalServerError(`Failed to checkout release branch '${releaseBranch}': ${checkoutResult.stderr}`) }
  }
  // else, we are on the release branch, as checked by 'verifyReadyForRelease'
  // TODO: generate changelog once 'work' history is defined

  const buildResult = shell.exec(`cd '${projectPath}' && npm run build`)
  if (buildResult.code !== 0) throw createError.BadRequest('Could not build project for release.')

  const releaseTag = 'v' + nextVer

  // npm version will tag and commit
  if (currVer !== nextVer) {
    let doCommit = false
    for (const qaFile of ['list-lint.txt', 'last-test.txt']) {
      if (fs.existsSync(fsPath.join(projectPath, qaFile))) {
        reporter.push(`Saving ${qaFile}...`)
        const addResult = shell.exec(`cd '${projectPath}' && git add --force '${qaFile}'`)
        if (addResult.code !== 0) { throw createError.InternalServerError(`Error adding QA file '${qaFile}': ${addResult.stderr}`) }
        doCommit = true
      }
    }
    if (doCommit === true) {
      const commitResult =
        shell.exec(`cd '${projectPath}' && git commit -m 'Saving QA files for release ${releaseTag}.'`)
      if (commitResult.code !== 0) { throw createError.InternalServerError(`Error commiting QA files: ${commitResult.stderr}`) }
    }

    reporter.push('Updating package version...')
    const versionResult = shell.exec(`cd '${projectPath}' && npm version ${nextVer}`)
    if (versionResult.code !== 0) { throw createError.InternalServerError(`'npm version ${nextVer}' failed; address or update manually; stderr: ${versionResult.stderr}`) }
  }
  else reporter.push('Version already updated')

  reporter.push(`Pushing release tag '${releaseTag}' to ${originRemote} remote...`) // TODO: doe
  const pushTagsResult = shell.exec(`cd '${projectPath}' && git push ${originRemote} ${releaseTag}`)
  if (pushTagsResult.code !== 0) { throw createError.InternalServerError(`Failed to push version release tag ${releaseTag}: ${pushTagsResult.stderr}`) }

  if (noPublish !== true) {
    reporter.push('Preparing to publish...')
    const pushCmd = `cd '${projectPath}' && npm publish${otp === undefined ? '' : ` --otp=${otp}`}`
    const publishResult = shell.exec(pushCmd, { timout : 1500 /* 1.5 sec */ })
    if (publishResult.code !== 0) { throw createError(`Project '${projectFQN}' preparation succeeded, but was unable to publish to npm; perhaps you need to include the 'otp' option? Stderr: ${publishResult.stderr}`) }
  }

  reporter.push(`Merging release branch '${releaseBranch}' to '${mainBranch}'...`)
  const mergeResult =
    shell.exec(`cd '${projectPath}' && git checkout '${mainBranch}' && git merge -m 'Merging auto-generated release branch (liq)' --no-ff '${releaseBranch}'`)
  if (mergeResult.code !== 0) throw createError.InternalServerError(`Could not merge release branch '${releaseBranch}' to '${mainBranch}'; address or merge manually.`)

  reporter.push('Deleting now merged release branch...')
  const deleteBranchResult = shell.exec(`cd '${projectPath}' && git branch -d '${releaseBranch}'`)
  if (deleteBranchResult.code !== 0) { throw createError.InternalServerError(`Could not delete release branch '${releaseBranch}'; manually delete.`) }

  reporter.push(`Updating ${originRemote}/${mainBranch}...`)
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

  httpSmartResponse({ msg : reporter.taskReport.join('\n'), req, res })
}

export {
  func,
  method,
  parameters,
  paths
}
