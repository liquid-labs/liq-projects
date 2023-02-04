import createError from 'http-errors'
import shell from 'shelljs'

const branchBaseName = () => {
  const now = new Date()
  const dateBit = now.getUTCFullYear()
    + (now.getUTCMonth() + '').padStart(2, '0')
    + (now.getUTCDate() + '').padStart(2, '0')
  const userId = shell.exec('git config user.email')
  if (userId.code !== 0) throw createError.InternalServerError('Failed to identify git user for branch name.')

  return dateBit + '-' + userId
}

const releaseBranchName = ({ releaseVersion }) => 'release-' + releaseVersion + '-' + branchBaseName()

export {
  branchBaseName,
  releaseBranchName
}
