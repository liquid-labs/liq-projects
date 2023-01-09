import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

const getPackageData = async ({ currentOrgKey, packageDesignation, requireImplements }) => {
	const [ orgKey, projectName ] = projectDesignation.split('/')
  if (projectName === undefined) {
    projectName = orgKey
    orgKey = currentOrgKey
  }
  if (!orgKey) {
    res
      .status(422/* Unprocessable Entity*/)
      .setHeader('content-type', 'text/terminal')
      .send(`The organization key could not be determined. The project designation <code>${projectDesignation}<rst> appears to be a simple project name and neither is parameter <code>currentOrgKey<rst> set.

Either specify a fully qualified project name or set <code>currentOrgKey<rst>.`)
    return false
  }
  // else we have what looks like a FQ project name
  const liqPlayground = process.env.LIQ_HOME || fsPath.join(process.env.HOME, '.liq', 'playground')
  const projectPath = fsPath.join(liqPlayground, orgKey, projectName)
  const projectPkgPath = fsPath.join(projectPath, 'package.json')
  if (!existsSync(projectPkgPath)) {
    res
      .status(404/*Entity Not Found*/)
      .setHeader('content-type', 'text/terminal')
      .send(`Could not locate local package file for project <code>${projectDesignation}<rst>. Perhaps the project needs to be imported.`)
    return false
  }
  // else we have what looks like a project
  let packageSpec
  try {
    const packageContents = await fs.readFile(projectPkgPath)
    packageSpec = JSON.parse(packageConents)
  }
  catch (e) {
    res
      .status(400)
      .setHeader('content-type', 'text/terminal')
      .send(`Could not process package definition. Ensure local project <code>${projectDesignation}<rst> checkout contains a valid <code>package.json<rst> file.`)
    return false
  }

  for (const reqImpl of requireImplements || []) {
	  const documentationImplemented = packageSpec?.liq?.labels?.includes(reqImpl)
	  if (documentationImplemented !== true) {
	    res
	      .status(400)
	      .setHeader('content-type', 'text/terminal')
	      .send(`The package spec does not mark required implementation '${reqImpl}'.`)
	    return false
	  }
	}

  return {
  	fqnProjectName: orgKey + '/' + projectName,
  	orgKey,
  	packageSpec,
  	projectDesignation,
  	projectName,
  	projectPath,
  }
}

export { getPackageData }