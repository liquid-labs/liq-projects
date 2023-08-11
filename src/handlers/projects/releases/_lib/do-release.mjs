import { Octocache } from '@liquid-labs/octocache'

import { determineCurrentRelease } from '@liquid-labs/github-toolkit'
import * as version from '@liquid-labs/versioning'

const doRelease = async({ app, cache, mainBranch, name, org, projectFQN, releaseVersion, reporter, summary }) => {
  reporter.push('Creating GitHub release...')

  const credDB = app.ext.credentialsDB
  const authToken = credDB.getToken('GITHUB_API') // TODO: check we have access before doinganything...

  const githubOwner = org.getSetting('github.ORG_NAME')
  const [, project] = projectFQN.split('/')

  const prerelease = version.prerelease(releaseVersion) !== null

  let makeLatest
  if (prerelease === true) {
    const currentRelease = determineCurrentRelease({ authToken, githubOwner, project, reporter })
    makeLatest = currentRelease === true
  }
  else {
    makeLatest = true
  }

  let released = false
  const releaseTag = 'v' + releaseVersion
  try {
    const octocache = new Octocache({ authToken })
    const results = await octocache.request(`POST /repos/${githubOwner}/${project}/releases`, {
      tag_name               : releaseTag,
      target_commitish       : mainBranch,
      generate_release_notes : true,
      make_latest            : makeLatest + '', // yes, this is a string of either 'true', 'false', or 'legacy'
      name,
      prerelease,
      summary
    })
    released = true
    reporter.push(`Created release <em>${results.tag_name}<rst>${results.name ? '/' + results.name : ''}.`)
  }
  catch (e) {
    reporter.push('<error>There was an error while attempting to create the GitHub release<rst>: ' + e.message)
  }

  const releaseMsg = released === true
    ? `Created GitHub release <em>${releaseTag}<rst>.`
    : '<warn>GitHub release failed; create manually.<rst>'

  return releaseMsg
}

export { doRelease }
