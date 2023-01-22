import shell from 'shelljs'

const defaultLabels = [
  {
    name : 'assigned', descpription : 'This task has been assigned/claimed.', color : 'fbca04'
  },
  {
    name : 'bounty', descpription : 'This task offers a bounty', color : '209020'
  },
  {
    name : 'breaking', descpription : 'Breaks compatibility with previous major version.', color : 'd93f0b'
  },
  {
    name : 'bug', descpription : 'Something is broken', color : 'd73a4a'
  },
  {
    name : 'enhancement', descpription : 'New feature or request', color : 'a2eeef'
  },
  {
    name : 'good first issue', descpription : 'Good for newcomers', color : '7050ff'
  },
  {
    name : 'needs spec', descpription : 'Task not fully specified', color : 'ff4040'
  },
  {
    name : 'optimization', descpription : 'Non-behavior changing improvement', color : '00dd70'
  },
  {
    name : 'security', descpription : 'A security related tasks', color : 'ff0000'
  },
  {
    name : 'task', descpription : 'General task', color : '009900'
  }
]

const setupGitHubLabels = ({ org, noDeleteLabels, noUpdateLabels, projectName, report }) => {
  console.log(`Setting up labebls for '${projectName}'`)
  report.push(`Setting up labebls for '${projectName}'`)

  const projectLabels = org?.projects?.DEFAULT_LABELS || defaultLabels

  if (projectLabels === defaultLabels) {
    console.log('No project labels defined; using default label set...')
    report.push('No project labels defined; using default label set...')
  }

  const currLabelDataString = shell.exec(`hub api "/repos/${projectName}/labels"`)
  const currLabelData = JSON.parse(currLabelDataString)
  const currLabelNames = currLabelData?.map((l) => l.name) || []

  const excessLabelNames = currLabelNames.filter((n) => !projectLabels.some((l) => l.name === n))
  const missinglabels = projectLabels.filter(({ name: n }) => !currLabelNames.some((l) => l === n))

  let labelsSynced = true
  for (const excessLabelName of excessLabelNames) {
    if (noDeleteLabels === true) labelsSynced = false
    else {
      const result = shell.exec(`hub api -X DELETE "/repos/${projectName}/labels/${excessLabelName}"`)
      if (result.code === 0) currLabelData.splice(currLabelData.findIndex((l) => l.name === excessLabelName), 1)
      else report.push(`There was an error removing excess label '${excessLabelName}...`)
    }
  }

  for (const { name, description, color } of missinglabels) {
    console.log(`Adding label '${name}...`)
    report.push(`Adding label '<em>${name}<rst>...`)
    const result = shell.exec(`hub api -X POST "/repos/${projectName}/labels" \\
        -f name="${name}" \\
        -f description="${description}" \\
        -f color="${color}"`)
    if (result.code === 0) {
      currLabelData.push({ name, description, color })
    }
    else {
      labelsSynced = false
      console.log(`  There was an issue creating label '${name}': ${result.stderr}`)
      report.push(`  There was an issue creating label '${name}': ${result.stderr}`)
    }
  }

  // all the project labels have been added
  for (const { name, description, color } of projectLabels) {
    const { description: currDesc, color: currColor } = currLabelData.find((l) => l.name === name)
    if (description !== currDesc || color !== currColor) {
      console.log(`Updating definition for label '${name}'...`)
      report.push(`Updating definition for label '<em>${name}<rst>'...`)
      const result = shell.exec(`hub api -X PATCH "/repos/${projectName}/labels/${name}" \\
        -f description="${description}" \\
        -f color="${color}"`)
      if (result.code !== 0) {
        labelsSynced = false
        console.log(`There was an error updating label '${name}: ${result.stderr}`)
        report.push(`There was an error updating label '<em>${name}<rst>: ${result.stderr}`)
      }
    }
  }

  console.log('Labels ' + (labelsSynced === true ? '' : 'not ') + 'synchronized.')
  report.push('Labels ' + (labelsSynced === true ? '' : 'not ') + 'synchronized.')
}

export { setupGitHubLabels }
