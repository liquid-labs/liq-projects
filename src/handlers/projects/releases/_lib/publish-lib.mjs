import createError from 'http-errors'

import {
  determineCurrentBranch,
  determineOriginAndMain,
  releaseBranchName,
  verifyClean,
  verifyMainBranchUpToDate
} from '@liquid-labs/git-toolkit'
import { httpSmartResponse } from '@liquid-labs/http-smart-response'
import { cleanupQAFiles, runQA, saveQAFiles } from '@liquid-labs/liq-qa-lib'
import { tryExec } from '@liquid-labs/shell-toolkit'
import * as version from '@liquid-labs/versioning'

import { doRelease } from './do-release'
import { commonProjectPathParameters } from '../../_lib/common-project-path-parameters'
import { getPackageData } from '../../_lib/get-package-data'

const doActualPublish = ({ originRemote, otp, projectFQN, projectPath, releaseTag, reporter }) => {
  reporter.push(`Pushing release tag '${releaseTag}' to ${originRemote} remote...`) // TODO: doe
  const pushTagsResult = tryExec(`cd '${projectPath}' && git push ${originRemote} ${releaseTag}`)
  if (pushTagsResult.code !== 0) { throw createError.InternalServerError(`Failed to push version release tag ${releaseTag}: ${pushTagsResult.stderr}`) }

  reporter.push('Preparing to publish...')
  const pushCmd = `cd '${projectPath}' && npm publish${otp === undefined ? '' : ` --otp=${otp}`}`
  const publishResult = tryExec(pushCmd, { timout : 1500 /* 1.5 sec */ })
  if (publishResult.code !== 0) { throw createError(`Project '${projectFQN}' preparation succeeded, but was unable to publish to npm; perhaps you need to include the 'otp' option? Stderr: ${publishResult.stderr}`) }
  reporter.push('  success.')
}

const doPublish = async({ app, cache, localProjectName, model, orgKey, reporter, req, res }) => {
  reporter.reset()
  reporter = reporter.isolate()

  const {
    dirtyOK,
    increment,
    name,
    /* noBrowser, */
    noPublish = false,
    noRelease = false,
    otp,
    publish,
    releaseOnly = false,
    summary
  } = req.vars

  const org = model.orgs[orgKey]

  const pkgData = await getPackageData({ localProjectName, model, orgKey })

  const { packageSpec, projectFQN, projectPath } = pkgData
  const [originRemote, mainBranch] = determineOriginAndMain({ projectPath, reporter })

  const publishOnPrepare = org.getSetting(`projects.${projectFQN}.releases.PUBLISH_FROM`)
    || org.getSetting('projects.releases.PUBLISH_FROM')
  if (publishOnPrepare !== undefined && publishOnPrepare !== 'release-branch' && publishOnPrepare !== 'main-branch') {
    throw createError.BadRequest(`Invalid value for 'PUBLISH_FROM' '${publishOnPrepare}'; must be one of 'release-branch' or 'main-branch'.`)
  }

  if (noPublish === false && publish === undefined && publishOnPrepare === undefined) {
    throw createError.BadRequest("Must specify endpoint parameter 'publish', 'noPublish', or set 'PUBLISH_FROM' for the project or organization.")
  }

  // TODO: should be 'org.getSettings(`npm.${npmOrg}.OTP_REQUIRED`)' or similar.
  if (releaseOnly !== true && otp === undefined && app.ext.localSettings.NPM?.['otp-required'] === true) {
    const interrogationBundles = [
      {
        title   : 'One-time-password security verification',
        actions : [
          { prompt : 'Provide your <em>NPM OTP<rst>:', parameter : 'otp', handling : 'parameter' }
        ]
      }
    ]

    res
      .type('application/json')
      .set('X-Question-and-Answer', 'true')
      .send(interrogationBundles)

    return
  }

  const currVer = packageSpec.version

  if (releaseOnly === true) {
    const releaseMsg = await doRelease({
      app,
      cache,
      mainBranch,
      name,
      org,
      projectFQN,
      releaseVersion : currVer,
      reporter,
      summary
    })

    const msg = reporter.taskReport.join('\n') + '\n\n' + releaseMsg

    httpSmartResponse({ msg, req, res })

    return
  }

  const currentBranch = determineCurrentBranch({ projectPath, reporter })

  let nextVer
  if (currentBranch.startsWith('release-')) { // it looks like we're already on the release branch
    nextVer = currentBranch.replace(/^release-([0-9.]+(?:-(?:alpha|beta|rc)\.\d+)?)-.+$/, '$1')
  }
  else {
    nextVer = version.nextVersion({ currVer, increment })
  }

  const releaseBranch = releaseBranchName({ releaseVersion : nextVer })
  const releaseTag = 'v' + nextVer

  verifyReadyForPublish({
    currentBranch,
    dirtyOK,
    mainBranch,
    originRemote,
    packageSpec,
    projectPath,
    releaseBranch,
    reporter
  })

  if (currentBranch === mainBranch) {
    const checkoutResult = tryExec(`cd '${projectPath}' && git checkout --quiet -b '${releaseBranch}'`)
    if (checkoutResult.code !== 0) { throw createError.InternalServerError(`Failed to checkout release branch '${releaseBranch}': ${checkoutResult.stderr}`) }
  }
  // else, we are on the release branch, as checked by 'verifyReadyForPublish'
  // TODO: generate changelog once 'work' history is defined

  reporter.push('Building project...')
  const buildResult = tryExec(`cd '${projectPath}' && npm run build`, { noThrow : true })
  if (buildResult.code !== 0) throw createError.BadRequest('Could not build project for release:' + buildResult.stderr)

  // npm version will tag and commit
  if (currVer !== nextVer) {
    try {
      await saveQAFiles({
        commitMsg : `Saving QA files for release ${releaseTag}.`,
        projectPath,
        reporter
      })

      reporter.push(`Updating package version from '${currVer}' to '${nextVer}'...`)
      const versionResult = tryExec(`cd '${projectPath}' && npm version ${nextVer}`, { noThrow : true })

      if (versionResult.code !== 0) { throw createError.InternalServerError(`'npm version ${nextVer}' failed; address or update manually; stderr: ${versionResult.stderr}`) }
      else { reporter.push('  success!') }
    }
    finally {
      await cleanupQAFiles({ projectPath, reporter })
    }
  }
  else reporter.push('Version already updated')

  if (publish === 'release-branch' || (publishOnPrepare === 'release-branch')) {
    doActualPublish({ originRemote, otp, projectFQN, projectPath, releaseTag, reporter })
  }

  reporter.push(`Merging release branch '${releaseBranch}' to '${mainBranch}'...`)
  const mergeResult =
    tryExec(`cd '${projectPath}' && git checkout '${mainBranch}' && git merge -m 'Merging auto-generated release branch (liq)' --no-ff '${releaseBranch}'`)
  if (mergeResult.code !== 0) throw createError.InternalServerError(`Could not merge release branch '${releaseBranch}' to '${mainBranch}'; address or merge manually.`)

  reporter.push('Deleting now merged release branch...')
  const deleteBranchResult = tryExec(`cd '${projectPath}' && git branch -d '${releaseBranch}'`)
  if (deleteBranchResult.code !== 0) { throw createError.InternalServerError(`Could not delete release branch '${releaseBranch}'; manually delete.`) }

  reporter.push(`Updating ${originRemote}/${mainBranch}...`)
  const pushResult = tryExec(`cd '${projectPath}' && git push ${originRemote} ${mainBranch}`)
  if (pushResult.code !== 0) { throw createError.InternalServerError(`Failed to push merged '${mainBranch}' to remote '${originRemote}'; push manually.`) }

  if (publish === 'main-branch' || (publishOnPrepare === 'main-branch')) {
    doActualPublish({ originRemote, otp, projectFQN, projectPath, releaseTag, reporter })
  }

  /* TODO: open browser to
  if (noBrowser === false) {
    const releaseAnchor = `release-v${nextVer}`
    const browseResult = shell.exec(`hub browse '${projectFQN}' 'blob/${main}/CHANGELOG.md#${releaseAnchor}'`)
    if (browseResult.code !== 0)
      throw createError.InternalServerError(`Release succeded, but unable to browse to CHANGELOG.md for ${projectFQN}.`)
  }
  */

  reporter.push('Updating internal model...')
  model.load()

  const releaseMsg = noRelease === true
    ? ''
    : await doRelease({
      app,
      cache,
      mainBranch,
      name,
      org,
      projectFQN,
      releaseVersion : nextVer,
      reporter,
      summary
    })

  const msg = reporter.taskReport.join('\n') + '\n\n'
    + (publish !== undefined || publishOnPrepare !== undefined
      ? `<bold>Published<rst> project <em>${projectFQN}<rst>.`
      : `<bold>Prepared<rst> project <em>${projectFQN}<rst>; publish manually.`)
    + ' ' + releaseMsg

  httpSmartResponse({ msg, req, res })
}

const getPublishEndpointParams = ({ workDesc }) => {
  const help = {
    name        : `projects release prepare (${workDesc})`,
    summary     : 'Prepares and (usually) publish the project.',
    description : 'Prepares and typically publishes a project. Preparation involves bumping the version, checking and saving the QA results on a release branch. Because the work typically moves on, it is most common to publish at the same time'
  }

  const parameters = [
    {
      name        : 'dirtyOK',
      isBoolean   : true,
      summary     : 'Skips checking if the branch is clean.',
      description : 'Skips the branch clean check, allowing for the presence of uncommitted changes/files'
    },
    {
      name           : 'increment',
      description    : 'Indicates how to increment the version for this release.',
      matcher        : /^(?:major|minor|patch|premajor|preminor|prepatch|prerelease|pretype)$/,
      optionsFetcher : () => ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease', 'pretype']
    },
    {
      name        : 'name',
      description : 'Optional "name" for the release. This will be used in the generated changelog.'
    },
    {
      name        : 'noBrowser',
      isBoolean   : true,
      description : 'If true, supresses launching of browser to show changelog page.'
    },
    {
      name        : 'noPublish',
      isBoolean   : true,
      description : 'If true, skips the publish step. One and only one of `noPublish` and `publish` must be set.'
    },
    {
      name        : 'noRelease',
      isBoolean   : true,
      description : "If true, skips creating the release. Will still publish unless 'noPublish' is also set."
    },
    {
      name           : 'publish',
      description    : "May be set to 'release-branch' or 'main-branch'. One and only one of `publish` and `noPublish` must be set unless one of the settings `projects.<project FQN>.releases.",
      matcher        : /^(?:main-branch|release-branch)$/,
      optionsFetcher : () => ['main-branch', 'release-branch']
    },
    {
      name        : 'releaseOnly',
      isBoolean   : true,
      description : "If true, then will create a release based on the current version. This can be used to create a release for versions previously published with 'noRelease' set to true, or in other instances where the release is missing."
    },
    {
      name        : 'otp',
      description : 'One time password to be used when publishing the project.'
    },
    {
      name        : 'summary',
      description : 'Optional short description of the release. This will be used in the changelog if provided.'
    },
    ...commonProjectPathParameters
  ]
  parameters.sort((a, b) => a.name.localeCompare(b.name))
  Object.freeze(parameters)

  return {
    help,
    method : 'post',
    parameters
  }
}

/**
 * Verifies that the repo is ready for release by verifyirg we are on the main or release branch, the repo is clean,
 * the main branch is up to date with the origin remote and vice-a-versa, and there is a package 'qa' script that
 * passes.
 */
const verifyReadyForPublish = ({
  currentBranch,
  dirtyOK,
  mainBranch,
  originRemote,
  packageSpec,
  projectPath,
  releaseBranch,
  reporter
}) => {
  // verify we are on a valid branch
  reporter?.push('Checking current branch valid...')
  if (currentBranch === releaseBranch) reporter.push(`  already on release branch ${releaseBranch}.`)
  else if (currentBranch !== mainBranch) { throw createError.BadRequest(`Release branch can only be cut from main branch '${mainBranch}'; current branch: '${currentBranch}'.`) }

  if (dirtyOK !== true) {
    verifyClean({ projectPath, reporter })
  }
  verifyMainBranchUpToDate({ projectPath, reporter })
  runQA({
    msgFail     : 'Project must pass QA prior to release.',
    msgNoScript : "You must define a 'qa' script to be run prior to release.",
    packageSpec,
    projectPath
  })
}

export { doPublish, getPublishEndpointParams }
