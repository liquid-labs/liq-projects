const setup = ({ app, model, reporter }) => {
  app.liq.pathResolvers.newProjectName = {
    bitReString    : '[a-zA-Z][a-zA-Z0-9-]*',
    optionsFetcher : () => []
  }
}

export { setup }
