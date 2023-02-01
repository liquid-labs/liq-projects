const commonProjectSetupParameters = [
  {
    name        : 'noDeleteLabels',
    isBoolean   : true,
    description : 'If true, then only missing labels will be added and any existing labels will be kept in place. Existing labels with the same name will be updated unless `noUpdateLabels` is set.'
  },
  {
    name        : 'noUpdateLabels',
    isBoolean   : true,
    description : 'If true, then existing labels with the same name as the canonical label set will be left unchanged. Thtey will still be deleted, however, unless `noUpdateLabels` is set.'
  },
  {
    name        : 'skipLabels',
    isBoolean   : true,
    description : 'If true, then the entire label normalization process will be skipped.'
  },
  {
    name        : 'skipMilestones',
    isBoolean   : true,
    description : 'If true, the milestone setup process is skipped.'
  }
]

export { commonProjectSetupParameters }
