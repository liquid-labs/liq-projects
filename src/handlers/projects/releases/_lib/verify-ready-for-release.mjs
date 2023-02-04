import createError from 'http-errors'
import shell from 'shelljs'

import { determineCurrentBranch } from '@liquid-labs/github-toolkit'

const verifyReadyForRelease = ({ mainBranch, originRemote, packageSpec, projectPath, releaseBranch, reporter }) => {
  const currentBranch = determineCurrentBranch({ projectPath, reporter })

  reporter?.push('Checking current branch valid...')
  if (currentBranch === releaseBranch) reporter.push(`  already on release branch ${releaseBranch}.`)
  else if (currentBranch !== mainBranch) { throw createError.BadRequest(`Release branch can only be cut from main branch '${mainBranch}'; current branch: '${currentBranch}'.`) }

  // Update main branch so we can check we're in sync
  reporter?.push(`Checking ${originRemote} HEAD is up-to-date...`)
  const updateResult = shell.exec(`cd ${projectPath} && git fetch -q ${originRemote} ${mainBranch}`)
  if (updateResult !== 0) { throw createError.InternalServerError(`Could not update ${originRemote}/${mainBranch}: ${updateResult.stderr}`) }

  const originHead = shell.exec(`git rev-parse ${originRemote}/${mainBranch}`)
  if (originHead !== 0) { throw createError.InternalServerError(`Could not determnie version for ${originRemote}/${mainBranch}: ${originHead.stderr}`) }
  const localHead = shell.exec(`git rev-parse ${mainBranch}`)
  if (localHead !== 0) { throw createError.InternalServerError(`Could not determnie version for ${mainBranch}: ${localHead.stderr}`) }

  if (originHead.stdout !== localHead.stdout) { throw createError.BadRequest(`Local and ${originRemote} '${mainBranch} are not in sync. Try:\n\ngit fetch ${originRemote} ${mainBranch} \\\n  && git merge ${originRemote}/${mainBranch}\\\n  && git push ${originRemote} ${mainBranch}`) }

  reporter?.push('Checking working directory is clean...')
  const cleanResult = shell.exec(`cd '${projectPath}' && git status --porcelain`)
  if (cleanResult.code !== 0) { throw createError.InternalServerError(`Could not execute 'git status' in dir '${projectPath}'.`) }
  else if (cleanResult.stdout.length > 0) { throw createError.BadRequest(`git repo at '${projectPath}' is not clean.`) }

  reporter?.push("Checking for and running 'qa' script...")
  if ('qa' in packageSpec.scripts) {
    const qaResult = shell.exec(`cd ${projectPath} && npm run qa`)
    if (qaResult.code !== 0) throw createError.BadRequest('Project must pass QA prior to release.')
  }
  else throw createError.BadRequest("You must define a 'qa' script to be run prior to release.")

  return currentBranch
}

export { verifyReadyForRelease }
