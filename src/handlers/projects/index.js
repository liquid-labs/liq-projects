import * as createHandler from './create'
import * as documentHandler from './document'
import * as renameHandler from './rename'
import * as setupHandler from './setup'

const handlers = [ createHandler, documentHandler, renameHandler, setupHandler ]

export { handlers }
