// TODO: this handler should move to liq-projects
import * as fs from 'node:fs/promises'

import shell from 'shelljs'

import { readFJSON, writeFJSON } from '@liquid-labs/federated-json'
import { getOrgFromKey } from '@liquid-labs/liq-handlers-lib'

import { checkGitHubAPIAccess, checkGitHubSSHAccess } from './_lib/github-lib'

const DEFAULT_LICENSE='UNLICENSED'
const DEFAULT_VERSION='1.0.0-alpha.0'

const method = 'post'
const paths = [
  [ 'projects', ':orgKey', ':newProjectName', 'create' ],
  [ 'orgs', ':orgKey', 'projects', ':newProjectName', 'create' ]
]
const parameters = [
	{
		name: 'description',
		isSingleValue: true,
		required: true,
		description: 'If provided, will be used to set the newly created package description.'
	},
	{
		name: 'license',
		isSingleValue: true,
		description: `Sets the license string for the newly created package. If not provided, then defaults to org setting 'ORG_DEFAULT_LICENSE' if set and '${DEFAULT_LICENSE}' otherwise.`
	},
  {
  	name: 'noFork',
  	isBoolean: true,
  	description: 'Suppresses default behavior of proactively creating workspace fork for public repos.'
  },
  {
  	name: 'public',
  	isBoolean: true,
  	description: 'By default, project repositories are created private. If `public` is set to true, then the repository will be made public.'
  },
  {
  	name: 'version',
  	isSingleValue: true,
  	description: `The version string to use for the newly initialized package \`version\` field. Defaults to '${DEFAULT_VERSION}'.`
  }
]

const GITHUB_REPO_KEY = 'core.GITHUB_ORG_NAME'

const func = ({ app, model, reporter }) => {
  app.commonPathResolvers['newProjectName'] = {
    optionsFetcher: () => [],
    bitReString: '[a-zA-Z][a-zA-Z0-9-]*'
  }

  return async (req, res) => {
	const org = getOrgFromKey({ model, params: req.vars, res })
  if (org === false) return
  
  const report = []

  const {
    description,
    license,
    orgKey,
    newProjectName,
    noFork=false,
    public : publicRepo=false,
    version=DEFAULT_VERSION
  } = req.vars
  const orgGithubName = org.getSetting(GITHUB_REPO_KEY)
  if (!orgGithubName) {
  	res.status(400).type('text/plain').send(`'${GITHUB_REPO_KEY}' not defined for org '${orgKey}'.`)
  	return
  }

  if (!checkGitHubSSHAccess({ res })) return // the check will handle user feedback
  if (!(await checkGitHubAPIAccess({ res }))) return // ditto
  // else we are good to proceed
  const cleanupFuncs = []
	const cleanup = async ({ msg, res, status }) => {
		let failures = []
		let success = true
		for (const [func, desc] of cleanupFuncs) {
			try {
				success = await func() && success
				if (!success) failures.push(desc)
			}
			catch (e) {
				console.log(e)
				failures.push(desc)
			}
		}
		if (res) {
			res.status(status).type('text/plain')
	  		.send(msg + '\n\n'
	  			+ 'Cleanup appears to have ' + (failures.length === 0 ? 'succeeded' : 'failed;\n' + failures.join(' failed\n') + ' failed'))
		}

		return failures.length === 0
	}

  // set up the staging directory
  const stagingDir = `${app.liqHome()}/tmp/liq-core/project-staging/${newProjectName}`
  await fs.mkdir(stagingDir, { recursive: true })

  cleanupFuncs.push([
  	async () => { 
	  	await fs.rm(stagingDir, { recursive: true })
	  	return true
	  },
	  'remove staging dir'
  ])

  const initResult = shell.exec(`cd "${stagingDir}" && git init --quiet . && npm init -y > /dev/null`)
  if (initResult.code !== 0) {
  	await cleanup({ 
  		msg: `There was an error initalizing the local project in staging dir '${stagingDir}' (${initResult.code}):\n${initResult.stderr}`,
  		res,
  		status: 500
  	})
  	return
  }

  const packagePath = stagingDir + '/package.json'
  const packageJSON = readFJSON(packagePath)

  const qualifiedName = orgGithubName + '/' + newProjectName
	const repoFragment = 'github.com/' + qualifiedName
  const repoURL = `git+ssh://git@${repoFragment}.git`
  const bugsURL = `https://${repoFragment}/issues`
  const homepage = `https://${repoFragment}#readme`
  const pkgLicense = license || org.getSetting('ORG_DEFAULT_LICENSE') || DEFAULT_LICENSE

  packageJSON.name = '@' + qualifiedName
  packageJSON.main = `dist/${name}.js`
  packageJSON.version = version
  packageJSON.repository = repoURL
  packageJSON.bugs = { url: bugsURL }
  packageJSON.homepage = homepage
  packageJSON.license = pkgLicense
  if (description) {
  	packageJSON.description = description
  }

  writeFJSON({ data: packageJSON, file: packagePath, noMeta: true })

  const initCommitResult = shell.exec(`cd "${stagingDir}" && git add package.json && git commit -m "package initialization"`)
  if (initCommitResult.code !== 0) {
  	await cleanup({
  		msg: `Could not make initial project commit for '${qualifiedName}'.`,
  		res,
  		status: 500
  	})
  	return
  }
  report.push(`Initialized local repository for project '${qualifiedName}'.`)

  const creationOpts = '--remote-name origin'
  	+ ` -d "${description}"`
  	+ (publicRepo === true ? '' : ' --private')
  const hubCreateResult = shell.exec(`cd "${stagingDir}" && hub create ${creationOpts} ${qualifiedName}`)
  if (hubCreateResult.code !== 0) {
  	await cleanup({
  		msg: `There was an error initalizing the github repo '${qualifiedName}' (${hubCreateResult.code}):\n${hubCreateResult.stderr}`,
  		res,
  		status: 500
  	})
  	return
  }
  report.push(`Created GitHub repo '${qualifiedName}'.`)

  cleanupFuncs.push([
  	async () => {
  		const delResult = shell.exec(`hub delete -y ${qualifiedName}`)
  		return delResult.code === 0
  	},
  	'delete GitHu repo'
	])

  let retry = 3 // will try a total of four times
  let pushResult = shell.exec(`git push --all origin`)
  while (pushResult.code !== 0 && retry > 0) {
  	await new Promise(resolve => setTimeout(resolve, 1000))
		pushResult = shell.exec(`git push --all origin`)
		retry -= 1
  }
  if (pushResult.code !== 0) {
  	await cleanup({ msg: 'Could not push local staging dir changes to GitHub.', res, status: 500 })
  	return
  }

  if (publicRepo === true && noFork === false) {
  	const forkResult = shell.exec('hub fork --remote-name workspace')
  	if (forkResult.code === 0) report.push(`Created personal workspace fork for '${qualifiedName}'.`)
  	else report.push('Failed to create personal workspace fork.')
  }


  await fs.rename(stagingDir, app.liqPlayground() + '/' + qualifiedName)

  await cleanup({
  	msg: 'Cleaning up partial work.',
  	res,
  	status: 501
  })
}}

export {
	func,
	method,
	parameters,
	paths
}