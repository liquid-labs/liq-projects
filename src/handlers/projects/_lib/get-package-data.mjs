import { existsSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as fsPath from 'node:path'

const getPackageData = async ({ localOrgKey, projectName, requireImplements }) => {
  const liqPlayground = process.env.LIQ_HOME || fsPath.join(process.env.HOME, '.liq', 'playground')
  const projectPath = fsPath.join(liqPlayground, localOrgKey, projectName)
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
  	fqnProjectName: localOrgKey + '/' + projectName,
  	packageSpec,
  	projectDesignation,
  	projectName,
  	projectPath
  }
}

export { getPackageData }