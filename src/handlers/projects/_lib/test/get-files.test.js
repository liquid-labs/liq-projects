/* global describe expect test */

import { getFiles } from '../get-files'

const dataRoot = process.env.PWD + '/test-staging/handlers/projects/_lib/test/data'

describe('getFiles', () => {
  test('recursively finds all files', async() => {
    const results = await getFiles({ dir : dataRoot })
    expect(results).toHaveLength(7)
    expect(results)
      .toEqual(['.a2.txt', '.e/e1.txt', 'a1.txt', 'b/b1.txt', 'b/b2.plain', 'b/d/d1.txt', 'c/c1.txt'].map((f) => dataRoot + '/' + f))
  })

  test("'onlyDirs: true' recursively finds all directories", async() => {
    const results = await getFiles({ dir : dataRoot, onlyDirs : true })
    expect(results).toHaveLength(4)
    expect(results)
      .toEqual(['.e', 'b', 'b/d', 'c'].map((f) => dataRoot + '/' + f))
  })

  test("'depth: 1' limits search to root directory", async() => {
    const results = await getFiles({ dir : dataRoot, depth : 1 })
    expect(results).toHaveLength(2)
    expect(results)
      .toEqual(['.a2.txt', 'a1.txt'].map((f) => dataRoot + '/' + f))
  })

  test("'depth: 2' limits search to root directory and direct child files", async() => {
    const results = await getFiles({ dir : dataRoot, depth : 2 })
    expect(results).toHaveLength(6)
    expect(results)
      .toEqual(['.a2.txt', '.e/e1.txt', 'a1.txt', 'b/b1.txt', 'b/b2.plain', 'c/c1.txt'].map((f) => dataRoot + '/' + f))
  })

  test("'depth: 2, onlyDirs: true' limits search to root directory and direct child dirs", async() => {
    const results = await getFiles({ dir : dataRoot, depth : 2, onlyDirs : true })
    expect(results).toHaveLength(4)
    expect(results)
      .toEqual(['.e', 'b', 'b/d', 'c'].map((f) => dataRoot + '/' + f))
  })

  test("'noRecurse: true' limits search to root directory", async() => {
    const results = await getFiles({ dir : dataRoot, noRecurse : true })
    expect(results).toHaveLength(2)
    expect(results)
      .toEqual(['.a2.txt', 'a1.txt'].map((f) => dataRoot + '/' + f))
  })

  test("'noRecurse' overrides depth", async() => {
    const results = await getFiles({ dir : dataRoot, noRecurse : true, depth : 2 })
    expect(results).toHaveLength(2)
    expect(results)
      .toEqual(['.a2.txt', 'a1.txt'].map((f) => dataRoot + '/' + f))
  })

  test("'reName: (?:.txt) filters out non-'.txt' files", async() => {
    const results = await getFiles({ dir : dataRoot, reName : '(?:.txt)' })
    expect(results).toHaveLength(6)
    expect(results)
      .toEqual(['.a2.txt', '.e/e1.txt', 'a1.txt', 'b/b1.txt', 'b/d/d1.txt', 'c/c1.txt'].map((f) => dataRoot + '/' + f))
  })

  test("will ignore regular dot-files when 'ignoreDotFiles: true'", async() => {
    const results = await getFiles({ dir : dataRoot, ignoreDotFiles : true, noRecurse : true })
    expect(results).toHaveLength(1)
    expect(results)
      .toEqual(['a1.txt'].map((f) => dataRoot + '/' + f))
  })

  test("will ignore dir dot-files when 'ignoreDotFiles: true'", async() => {
    const results = await getFiles({ dir : dataRoot, onlyDirs : true, ignoreDotFiles : true })
    expect(results).toHaveLength(3)
    expect(results)
      .toEqual(['b', 'b/d', 'c'].map((f) => dataRoot + '/' + f))
  })
})
