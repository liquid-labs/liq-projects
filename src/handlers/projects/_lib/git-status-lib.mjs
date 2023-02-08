import createError from 'http-errors'
import shell from 'shelljs'

const tryExec = (cmd, { msg = '', httpStatus = 500 } = {}) => {
  const result = shell.exec(cmd)
  if (result.code !== 0) {
    if (msg.length > 0) msg += ' '
    throw createError(httpStatus, msg + `Failed to execute '${cmd}'; stderr: ${result.stderr}`)
  }

  return result
}

const verifyClean = ({ mainBranch, originRemote, projectPath, reporter }) => {
  // Update main branch so we can check we're in sync
  reporter?.push(`Checking ${originRemote} HEAD is up-to-date...`)
  tryExec(`cd '${projectPath}' && git fetch -q ${originRemote} ${mainBranch}`,
    { msg : `Could not update ${originRemote}/${mainBranch}.` })

  const originHead = tryExec(`cd '${projectPath}' && git rev-parse ${originRemote}/${mainBranch}`,
    { msg : `Could not determnie version for ${originRemote}/${mainBranch}.` })
  const localHead = tryExec(`cd '${projectPath}' && git rev-parse ${mainBranch}`,
    { msg : `Could not determnie version for ${mainBranch}.` })

  if (originHead.stdout !== localHead.stdout) { throw createError.BadRequest(`Local and ${originRemote} '${mainBranch} are not in sync. Try:\n\ngit fetch ${originRemote} ${mainBranch} \\\n  && git merge ${originRemote}/${mainBranch}\\\n  && git push ${originRemote} ${mainBranch}`) }

  reporter?.push('Checking working directory is clean...')
  const cleanResult = shell.exec(`cd '${projectPath}' && git status --porcelain`)
  if (cleanResult.code !== 0) { throw createError.InternalServerError(`Could not execute 'git status' in dir '${projectPath}'.`) }
  else if (cleanResult.stdout.length > 0) { throw createError.BadRequest(`git repo at '${projectPath}' is not clean.`) }
}

const verifyReadyForRelease = ({
  currentBranch,
  mainBranch,
  originRemote,
  packageSpec,
  projectPath,
  releaseBranch,
  reporter
}) => {
  reporter?.push('Checking current branch valid...')
  if (currentBranch === releaseBranch) reporter.push(`  already on release branch ${releaseBranch}.`)
  else if (currentBranch !== mainBranch) { throw createError.BadRequest(`Release branch can only be cut from main branch '${mainBranch}'; current branch: '${currentBranch}'.`) }

  verifyClean({ mainBranch, originRemote, projectPath, reporter })

  reporter?.push("Checking for and running 'qa' script...")
  if ('qa' in packageSpec.scripts) {
    tryExec(`cd '${projectPath}' && npm run qa`, { httpStatus : 400, msg : 'Project must pass QA prior to release.' })
  }
  else throw createError.BadRequest("You must define a 'qa' script to be run prior to release.")
}

export { verifyClean, verifyReadyForRelease }
