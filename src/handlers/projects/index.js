import * as createHandler from './create'
import * as destroyHandler from './destroy'
import * as documentHandler from './document'
import * as renameHandler from './rename'
import * as setupHandler from './setup'

const handlers = [ createHandler, destroyHandler, documentHandler, renameHandler, setupHandler ]

export { handlers }
